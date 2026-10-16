/**
 * Phase 8 — SCR-37 BACKEND `/api/users` (N38-N46) through the real API, no browser, NO mocks (QA-08 P12, skill `qa-api-test`).
 * Flows FL-B08U-01..04 of `QA-08/flows-C7.md` (anonymous + role gate, read contract, invite/validation/resend,
 * role change + self guard). FL-B08U-05..07 live in `phase08_users_b_api.spec.ts`. One `test()` per flow,
 * one `test.step('[<row id>] …')` per catalog row of `catalog-C7.md`, planned order. `BE:` = `F:/App/AppBack` main dc510655.
 *
 * ## Non-serial, own data
 * Acting admin = pool admin `p08-B08U-adm1` (QA-08 decision S2.2: invites never come from the seed admin; the seed admin is
 * only used by `poolUser` for first-fill invites of a slot). Read-only users: `p08-eng` / `p08-view` (FL-01 gate actors),
 * `p08-B08U-2` viewer (target never mutated here). Mutated users keep their own slot: `p08-B08U-3` viewer (restored to
 * viewer in `finally`), `p08-B08U-4` admin (self-guard actor). Throw-away invitees `testEmail(...)` are deleted in `finally`.
 *
 * ## Real-backend budget per run of this file (counted `users_invite`, 30 / 3600 s per admin, adm1 only)
 * FL-02: 1. FL-03 by adm1: C-012, C-018, C-011, C-013, C-014, G-050, G-046, C-016, G-048, G-049 = 10 (the limiter runs before body/identity
 * checks, so refused 422 calls count too; 403 / 401 do not). FL-01 / FL-04: 0. Total adm1 = 11 <= 12 per run.
 * The resend steps G-062 / G-063 / G-064 (+ G-021 log) are done by adm2 (`p08-B08U-adm2`, shared bucket with `_users_b_api`: +3 there).
 * First fill of a pool slot = 1 invite from the seed admin (p08-eng, p08-view, p08-B08U-2/3/4, adm1) — first run only.
 * `POST /api/auth/login` (120 / 60 s per IP): <= 14 logins. `recovery_ip` accepts: 2 (FL-03 invitees G-047/G-048 old link) + 1 (FL-02) = <= 3.
 * The 429 of the invite limiter is owned by pytest (does not burn the bucket here).
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { newApiContext } from './support/api';
import { testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail } from './support/mailpit';
import {
  Cleanup,
  INVITE_SUBJECT,
  acceptAttempt,
  activityOf,
  asJson,
  call,
  countKind,
  deleteLater,
  expectError,
  inviteOne,
  listUsers,
  loginAs,
  pooled,
  tokenFromLink,
  tokenFor,
  type Json,
} from './support/p08/P12';

const ADM1 = 'p08-B08U-adm1';

test.describe('A08 phase-8 backend (/api/users N38-N46, part 1)', () => {
  test('SCR-37 · FL-B08U-01 · Anonymous and role gate of /api/users', async () => {
    const cleanup = new Cleanup();
    try {
      const viewer = await pooled(cleanup, 'viewer', 'p08-view');
      const engineer = await pooled(cleanup, 'engineer', 'p08-eng');
      const target = await pooled(cleanup, 'viewer', 'p08-B08U-2');
      const anon = await newApiContext();
      cleanup.add(() => anon.dispose());
      const id = target.user.id;
      const adm = await pooled(cleanup, 'admin', ADM1);
      cleanup.add(() => adm.api.post(`/api/users/${id}/enable`, { data: {} }));
      const before = JSON.stringify((await listUsers(adm.api)).users.find((u) => u.id === id));
      const routes = [
        { n: '38', method: 'GET', path: '/api/users' },
        { n: '39', method: 'GET', path: `/api/users/${id}/memberships` },
        { n: '40', method: 'GET', path: `/api/users/${id}/activity` },
        { n: '41', method: 'PATCH', path: `/api/users/${id}/role`, body: { role: 'engineer', userId: id } },
        { n: '42', method: 'POST', path: `/api/users/${id}/disable`, body: {} },
        { n: '43', method: 'POST', path: `/api/users/${id}/enable`, body: {} },
        { n: '44', method: 'POST', path: '/api/users/invitations', body: { emails: [testEmail('b08u-gate')], role: 'viewer' } },
        { n: '45', method: 'POST', path: `/api/users/invitations/${id}/resend`, body: {} },
        { n: '46', method: 'DELETE', path: `/api/users/${id}`, body: { userId: id, confirmEmail: target.user.email } },
      ] as const;
      const unchanged = async (): Promise<void> => {
        expect.soft(JSON.stringify((await listUsers(adm.api)).users.find((u) => u.id === id)), 'target unchanged').toBe(before);
      };

      await test.step('[B08U-G-091] all 9 /api/users routes anonymous → 401 UNAUTHENTICATED; truncated JSON on writes still 401', async () => {
        for (const r of routes) {
          const sent = await call(anon, `B08U-G-091_n${r.n}_anonymous`, r.method, r.path, 'body' in r ? r.body : undefined, [`#${r.n} without Authorization → 401 UNAUTHENTICATED`]);
          expectError(sent, 401, 'UNAUTHENTICATED', {}, true);
        }
        const trunc = await call(anon, 'B08U-G-091_n41_truncated_json', 'PATCH', `/api/users/${id}/role`, undefined, ['truncated JSON anonymous → 401 not 400 (auth before body)'], { raw: '{"role":' });
        expectError(trunc, 401, 'UNAUTHENTICATED', {}, true);
      });

      await test.step('[B08U-G-092] garbage Bearer → 401 UNAUTHENTICATED', async () => {
        const sent = await call(anon, 'B08U-G-092_garbage_bearer', 'GET', '/api/users', undefined, ['Bearer not-a-jwt → 401 UNAUTHENTICATED'], { headers: { Authorization: 'Bearer not-a-jwt' } });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      const reads = routes.slice(0, 3);
      const writes = [routes[3], routes[4], routes[5], routes[8]];
      const gate = async (who: typeof viewer, label: string, rid: string): Promise<void> => {
        for (const r of reads) {
          const sent = await call(who.api, `${rid}_${label}_n${r.n}`, r.method, r.path, undefined, [`${label} on #${r.n} → 403 FORBIDDEN`]);
          const body = expectError(sent, 403, 'FORBIDDEN');
          expect.soft(body.resource, 'no resource key').toBeUndefined();
        }
      };

      await test.step('[B08U-D-001] viewer on reads #38 #39 #40 → 403 FORBIDDEN without resource', async () => {
        await gate(viewer, 'viewer', 'B08U-D-001');
      });

      await test.step('[B08U-D-002] engineer on reads #38 #39 #40 → 403 FORBIDDEN', async () => {
        await gate(engineer, 'engineer', 'B08U-D-002');
      });

      const writeGate = async (who: typeof viewer, label: string, rid: string): Promise<void> => {
        for (const r of writes) {
          const sent = await call(who.api, `${rid}_${label}_n${r.n}`, r.method, r.path, r.body, [`${label} on #${r.n} valid body → 403 FORBIDDEN`]);
          expectError(sent, 403, 'FORBIDDEN');
        }
        await unchanged();
      };

      await test.step('[B08U-D-003] viewer on writes #41 #42 #43 #46 → 403 before validation; target unchanged', async () => {
        await writeGate(viewer, 'viewer', 'B08U-D-003');
      });

      await test.step('[B08U-D-004] engineer on writes #41 #42 #43 #46 → 403; target unchanged', async () => {
        await writeGate(engineer, 'engineer', 'B08U-D-004');
      });

      await test.step('[B08U-D-005] viewer and engineer on #44 #45 → 403 before the limiter', async () => {
        for (const [who, label] of [[viewer, 'viewer'], [engineer, 'engineer']] as const) {
          for (const r of [routes[6], routes[7]]) {
            const sent = await call(who.api, `B08U-D-005_${label}_n${r.n}`, r.method, r.path, r.body, [`${label} on #${r.n} → 403 FORBIDDEN (limiter not consumed)`]);
            expectError(sent, 403, 'FORBIDDEN');
          }
        }
      });

      await test.step('[B08U-D-006] invalid body as viewer → 403 not 422', async () => {
        const sent = await call(viewer.api, 'B08U-D-006_invalid_body_viewer', 'POST', '/api/users/invitations', { emails: [], role: 'owner' }, ['invalid body as viewer → 403 FORBIDDEN, not 422 VALIDATION']);
        expectError(sent, 403, 'FORBIDDEN');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-37 · FL-B08U-02 · Read contract: list, memberships, activity', async () => {
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM1);
      const viewer = await pooled(cleanup, 'viewer', 'p08-B08U-2');
      const invitee = await inviteOne(cleanup, adm.api, 'b08u-list', 'engineer');
      let list: { total: number; users: Json[] } = { total: 0, users: [] };

      await test.step('[B08U-G-001] #38 GET /api/users decodes as AdminUserList', async () => {
        const sent = await call(adm.api, 'B08U-G-001_list', 'GET', '/api/users', undefined, ['200 {total, users[]}; id,email,name,role,status,projectCount, lastActiveAt key always present']);
        expect(sent.status).toBe(200);
        const body = asJson(sent.body);
        list = { total: Number(body.total), users: body.users as Json[] };
        expect(Array.isArray(list.users) && typeof body.total === 'number').toBe(true);
        for (const u of list.users) {
          for (const k of ['id', 'email', 'name', 'role', 'status', 'projectCount']) expect(u, `user has ${k}`).toHaveProperty(k);
          expect(Object.keys(u), 'lastActiveAt key present (null if never active)').toContain('lastActiveAt');
        }
      });

      await test.step('[B08U-G-002] #38 order created_at ASC and total >= users.length', async () => {
        if (list.users.length < 1000) expect.soft(list.total, 'total = listed rows below the cap').toBe(list.users.length);
        // order by created_at ASC, id ASC: the invitee just created is after the pool viewer created earlier
        const ids = list.users.map((u) => u.id);
        expect.soft(ids.indexOf(invitee.id), 'invitee is listed after the older pool viewer').toBeGreaterThan(ids.indexOf(viewer.user.id));
        expect.soft(new Set(ids).size, 'no duplicate rows').toBe(ids.length);
      });

      await test.step('[B08U-G-003] #38 pending invitee row: pending, invite window, projectCount 0, role', async () => {
        const row = list.users.find((u) => u.id === invitee.id) ?? {};
        expect.soft(row.status).toBe('pending');
        expect.soft(typeof row.invitedAt === 'string' && typeof row.inviteExpiresAt === 'string', 'invite window present').toBe(true);
        expect.soft(row.projectCount).toBe(0);
        expect.soft(row.role).toBe('engineer');
      });

      await test.step('[B08U-G-004] #38 active user has no invitedAt / inviteExpiresAt keys', async () => {
        const row = list.users.find((u) => u.id === viewer.user.id) ?? {};
        expect.soft(row.status).toBe('active');
        expect.soft(Object.keys(row)).not.toContain('invitedAt');
        expect.soft(Object.keys(row)).not.toContain('inviteExpiresAt');
      });

      await test.step('[B08U-G-011] #39 memberships contract', async () => {
        const mine = await call(adm.api, 'B08U-G-011_memberships_viewer', 'GET', `/api/users/${viewer.user.id}/memberships`, undefined, ['200 array {projectId, projectName, role}; role = current system role']);
        expect.soft(mine.status).toBe(200);
        expect(Array.isArray(mine.body)).toBe(true);
        for (const m of mine.body as Json[]) {
          for (const k of ['projectId', 'projectName', 'role']) expect.soft(m).toHaveProperty(k);
          expect.soft(m.role).toBe('viewer');
        }
        const none = await call(adm.api, 'B08U-G-011_memberships_invitee', 'GET', `/api/users/${invitee.id}/memberships`, undefined, ['pending invitee → []']);
        expect.soft(none.status).toBe(200);
        expect.soft(none.body).toEqual([]);
      });

      await test.step('[B08U-G-012] #39 unknown user → 404 NOT_FOUND resource user', async () => {
        const sent = await call(adm.api, 'B08U-G-012_memberships_unknown', 'GET', `/api/users/${randomUUID()}/memberships`, undefined, ['404 NOT_FOUND resource "user"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-016] #40 activity contract: newest first, decimal-string id, user.invite row', async () => {
        const sent = await call(adm.api, 'B08U-G-016_activity', 'GET', `/api/users/${adm.user.id}/activity`, undefined, ['200 array {id,at,kind,objectCode,objectLabel} newest first; user.invite objectCode = invitee id, label = email']);
        expect(sent.status).toBe(200);
        const rows = sent.body as Json[];
        for (const r of rows) {
          for (const k of ['id', 'at', 'kind', 'objectCode', 'objectLabel']) expect.soft(r).toHaveProperty(k);
          expect.soft(String(r.id)).toMatch(/^\d+$/u);
        }
        const times = rows.map((r) => Date.parse(String(r.at)));
        expect.soft(times, 'newest first').toEqual([...times].sort((a, b) => b - a));
        const row = rows.find((r) => r.kind === 'user.invite' && r.objectCode === invitee.id);
        expect.soft(row?.objectLabel, 'label = invitee email').toBe(invitee.email);
      });

      await test.step('[B08U-G-017] #40 unknown user → 404 resource user', async () => {
        const sent = await call(adm.api, 'B08U-G-017_activity_unknown', 'GET', `/api/users/${randomUUID()}/activity`, undefined, ['404 NOT_FOUND resource "user"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-37 · FL-B08U-03 · Invite, validation, re-invite, resend', async () => {
    test.setTimeout(180_000);
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM1);
      const viewer = await pooled(cleanup, 'viewer', 'p08-B08U-2');
      const adm2 = await pooled(cleanup, 'admin', 'p08-B08U-adm2');
      const inv1 = testEmail('b08u-inv1');
      const inv2 = testEmail('b08u-inv2');
      const dup = testEmail('b08u-dup');
      const invite = (name: string, body: unknown, why: string[]) => call(adm.api, name, 'POST', '/api/users/invitations', body, why);
      const ids: Record<string, string> = {};
      const since = new Date(Date.now() - 5_000);
      let oldToken1 = '';
      let token2 = '';
      let resendId = '';
      let upper = '';

      await test.step('[B08U-C-012] invite emails [] → 422 field emails', async () => {
        const sent = await invite('B08U-C-012_empty_emails', { emails: [], role: 'viewer' }, ['422 VALIDATION field "emails" (min_length 1)']);
        expectError(sent, 422, 'VALIDATION', { field: 'emails' }, true);
      });

      await test.step('[B08U-C-018] invite emails as a string → 422', async () => {
        const sent = await invite('B08U-C-018_emails_string', { emails: 'a@x.test', role: 'viewer' }, ['422 VALIDATION']);
        expectError(sent, 422, 'VALIDATION');
      });

      await test.step('[B08U-C-011] invite role owner → 422 field role', async () => {
        const sent = await invite('B08U-C-011_role_owner', { emails: [testEmail('b08u-role')], role: 'owner' }, ['422 VALIDATION field "role"']);
        expectError(sent, 422, 'VALIDATION', { field: 'role' });
      });

      await test.step('[B08U-C-013] invite not-an-email → 422 field emails (not emails.0)', async () => {
        const sent = await invite('B08U-C-013_malformed_email', { emails: ['not-an-email'], role: 'viewer' }, ['422 VALIDATION field "emails" (K37)']);
        expectError(sent, 422, 'VALIDATION', { field: 'emails' });
      });

      await test.step('[B08U-C-014] invite NFD unicode email → 422 field emails, never folded into a duplicate', async () => {
        const nfd = `e\u0301${'a'}@example.test`;
        const sent = await invite('B08U-C-014_nfd_email', { emails: [nfd], role: 'viewer' }, ['422 VALIDATION field "emails" (C16)']);
        expectError(sent, 422, 'VALIDATION', { field: 'emails' });
      });

      await test.step('[B08U-G-050] 51 emails → 422 field emails, none created', async () => {
        const emails = Array.from({ length: 51 }, (_, i) => `${testEmail('b08u-cap')}`.replace('@', `-${String(i)}@`));
        const sent = await invite('B08U-G-050_cap_51', { emails, role: 'viewer' }, ['422 VALIDATION field "emails", cap 50 counted before dedupe']);
        if (sent.status === 201) for (const r of sent.body as Json[]) deleteLater(cleanup, adm.api, String(r.id), String(r.email));
        expectError(sent, 422, 'VALIDATION', { field: 'emails' });
        const list = await listUsers(adm.api);
        expect.soft(list.users.filter((u) => emails.includes(String(u.email))), 'none created').toHaveLength(0);
      });

      await test.step('[B08U-G-046] #44 invite 201: array in input order, pending, role, invite window', async () => {
        const sent = await invite('B08U-G-046_invite_201', { emails: [inv1, inv2], role: 'viewer' }, ['201 array in input order, each pending, role viewer, invitedAt/inviteExpiresAt present']);
        expect(sent.status).toBe(201);
        const rows = sent.body as Json[];
        expect.soft(rows.map((r) => r.email)).toEqual([inv1, inv2]);
        for (const r of rows) {
          ids[String(r.email)] = String(r.id);
          expect.soft(r.status).toBe('pending');
          expect.soft(r.role).toBe('viewer');
          expect.soft(typeof r.invitedAt === 'string' && typeof r.inviteExpiresAt === 'string').toBe(true);
          deleteLater(cleanup, adm.api, String(r.id), String(r.email));
        }
      });

      await test.step('[B08U-G-047] mail after commit: Mailpit subject per email, working token', async () => {
        for (const email of [inv1, inv2]) {
          const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
          await deleteMails([mail.id]); // old mails must not answer the later "new mail" waits (G-048 / G-062)
          expect.soft(mail.subject).toContain(INVITE_SUBJECT);
          const token = tokenFromLink(linkFrom(mail, '/login/invitation'));
          expect.soft(token, `${email} link carries a token`).not.toBe('');
          if (email === inv1) oldToken1 = token;
          else token2 = token;
        }
      });

      await test.step('[B08U-C-016] invite dedupes by normalised email: one row, first spelling', async () => {
        upper = dup.replace('b08u-dup', 'B08U-DUP');
        const sent = await invite('B08U-C-016_dedupe', { emails: [upper, dup], role: 'viewer' }, ['201 one row, first spelling']);
        expect(sent.status).toBe(201);
        const rows = sent.body as Json[];
        expect.soft(rows).toHaveLength(1);
        expect.soft(rows[0]?.email, 'first spelling kept').toBe(upper);
        if (rows[0]) deleteLater(cleanup, adm.api, String(rows[0].id), String(rows[0].email));
      });

      await test.step('[B08U-G-048] re-invite pending with role engineer: 201, role updated, old link dead', async () => {
        const again = new Date(Date.now() - 5_000);
        const sent = await invite('B08U-G-048_reinvite', { emails: [inv1], role: 'engineer' }, ['201 role engineer, new token, old link no longer accepted']);
        expect(sent.status).toBe(201);
        expect.soft(asJson((sent.body as Json[])[0]).role).toBe('engineer');
        const fresh = await tokenFor(cleanup, inv1, again);
        expect.soft(fresh).not.toBe(oldToken1);
        const old = await acceptAttempt(cleanup, 'B08U-G-048_old_link', oldToken1, ['old token → 422 INVITATION_TOKEN_INVALID']);
        expectError(old, 422, 'INVITATION_TOKEN_INVALID');
      });

      await test.step('[B08U-G-049] taken email → 422 USER_EMAIL_TAKEN, whole batch rolled back', async () => {
        const other = testEmail('b08u-rollback');
        const sent = await invite('B08U-G-049_taken', { emails: [other, viewer.user.email], role: 'viewer' }, ['422 USER_EMAIL_TAKEN field "emails"; other email not created']);
        if (sent.status === 201) for (const r of sent.body as Json[]) deleteLater(cleanup, adm.api, String(r.id), String(r.email));
        expectError(sent, 422, 'USER_EMAIL_TAKEN', { field: 'emails' });
        const list = await listUsers(adm.api);
        expect.soft(list.users.find((u) => u.email === other), 'rolled back').toBeUndefined();
      });

      await test.step('[B08U-G-062] #45 resend 200: new mail, old link no longer accepted', async () => {
        resendId = ids[inv2] ?? '';
        const later = new Date(Date.now() - 5_000);
        const sent = await call(adm2.api, 'B08U-G-062_resend', 'POST', `/api/users/invitations/${resendId}/resend`, {}, ['200 AdminUser, new mail, old link dead']);
        expect(sent.status).toBe(200);
        expect.soft(asJson(sent.body).status).toBe('pending');
        const fresh = await tokenFor(cleanup, inv2, later);
        expect.soft(fresh).not.toBe(token2);
        const old = await acceptAttempt(cleanup, 'B08U-G-062_old_link', token2, ['old token → 422 INVITATION_TOKEN_INVALID']);
        expectError(old, 422, 'INVITATION_TOKEN_INVALID');
      });

      await test.step('[B08U-G-063] #45 resend on an active user → 422 USER_NOT_PENDING', async () => {
        const sent = await call(adm2.api, 'B08U-G-063_resend_active', 'POST', `/api/users/invitations/${viewer.user.id}/resend`, {}, ['422 USER_NOT_PENDING']);
        expectError(sent, 422, 'USER_NOT_PENDING');
      });

      await test.step('[B08U-G-064] #45 resend unknown user → 404 resource user', async () => {
        const sent = await call(adm2.api, 'B08U-G-064_resend_unknown', 'POST', `/api/users/invitations/${randomUUID()}/resend`, {}, ['404 NOT_FOUND resource "user"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-021] #40 resend logged: user.invite_resend row for the target', async () => {
        const rows = await activityOf(adm2.api, adm2.user.id);
        expect.soft(countKind(rows, 'user.invite_resend', resendId), 'user.invite_resend row').toBeGreaterThanOrEqual(1);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-37 · FL-B08U-04 · Role change, self guard, W21, token revoke', async () => {
    test.setTimeout(120_000);
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM1);
      const target = await pooled(cleanup, 'viewer', 'p08-B08U-3');
      const self = await pooled(cleanup, 'admin', 'p08-B08U-4');
      const tid = target.user.id;
      const path = `/api/users/${tid}/role`;
      const patch = (name: string, body: unknown, why: string[], raw?: string) => call(adm.api, name, 'PATCH', path, body, why, raw === undefined ? {} : { raw });
      // restore: admin adm1 puts both pool users back (viewer / admin) whatever happened
      cleanup.add(() => adm.api.patch(path, { data: { role: 'viewer', userId: tid } }));
      await adm.api.patch(path, { data: { role: 'viewer', userId: tid } }); // setup: a killed earlier run may leave another role
      const roleChanges = countKind(await activityOf(adm.api, adm.user.id), 'user.role_change', tid);
      cleanup.add(() => adm.api.patch(`/api/users/${self.user.id}/role`, { data: { role: 'admin', userId: self.user.id } }));

      await test.step('[B08U-D-010] non-seed admin p08-B08U-4 → GET /api/users 200', async () => {
        const res = await self.api.get('/api/users');
        expect(res.status(), 'pool admin reads /api/users').toBe(200);
      });

      await test.step('[B08U-C-001] self role change → 422 USER_SELF_MODIFICATION, nothing written', async () => {
        const sent = await call(self.api, 'B08U-C-001_self_role', 'PATCH', `/api/users/${self.user.id}/role`, { role: 'viewer', userId: self.user.id }, ['422 USER_SELF_MODIFICATION']);
        expectError(sent, 422, 'USER_SELF_MODIFICATION');
        const row = (await listUsers(adm.api)).users.find((u) => u.id === self.user.id);
        expect.soft(row?.role, 'still admin').toBe('admin');
      });

      await test.step('[B08U-C-002] self disable → 422 USER_SELF_MODIFICATION', async () => {
        const sent = await call(self.api, 'B08U-C-002_self_disable', 'POST', `/api/users/${self.user.id}/disable`, {}, ['422 USER_SELF_MODIFICATION']);
        expectError(sent, 422, 'USER_SELF_MODIFICATION');
        const row = (await listUsers(adm.api)).users.find((u) => u.id === self.user.id);
        expect.soft(row?.status, 'still active').toBe('active');
      });

      await test.step('[B08U-G-023] #41 role change 200 → engineer; target old token 401', async () => {
        const sent = await patch('B08U-G-023_role_change', { role: 'engineer', userId: tid }, ['200 AdminUser role engineer; old access token → 401 (token version bumped)']);
        expect(sent.status).toBe(200);
        expect.soft(asJson(sent.body).role).toBe('engineer');
        const old = await target.api.get('/api/me');
        expect.soft(old.status(), 'old access token revoked').toBe(401);
      });

      await test.step('[B08U-G-024] #41 same role → 200, no new user.role_change row, token still valid', async () => {
        const fresh = await loginAs(cleanup, target.user);
        const before = countKind(await activityOf(adm.api, adm.user.id), 'user.role_change', tid);
        const sent = await patch('B08U-G-024_same_role', { role: 'engineer', userId: tid }, ['200, no new user.role_change row, token still valid']);
        expect.soft(sent.status).toBe(200);
        expect.soft(countKind(await activityOf(adm.api, adm.user.id), 'user.role_change', tid), 'no new row').toBe(before);
        expect.soft((await fresh.get('/api/me')).status(), 'token still valid').toBe(200);
      });

      await test.step('[B08U-D-009] promoted engineer is 403 on /api/users; promoted to admin → 200', async () => {
        const eng = await loginAs(cleanup, target.user);
        expect.soft((await eng.get('/api/users')).status(), 'engineer → 403').toBe(403);
        const sent = await patch('B08U-D-009_promote_admin', { role: 'admin', userId: tid }, ['200 role admin']);
        expect.soft(sent.status).toBe(200);
        const adminSession = await loginAs(cleanup, target.user);
        expect.soft((await adminSession.get('/api/users')).status(), 'admin → 200').toBe(200);
        await patch('B08U-D-009_restore_viewer', { role: 'viewer', userId: tid }, ['200 role viewer (restore)']);
      });

      await test.step('[B08U-C-009] role owner → 422 VALIDATION field role', async () => {
        const sent = await patch('B08U-C-009_role_owner', { role: 'owner', userId: tid }, ['422 VALIDATION field "role"']);
        expectError(sent, 422, 'VALIDATION', { field: 'role' });
      });

      await test.step('[B08U-C-010] role / userId missing → 422 VALIDATION', async () => {
        expectError(await patch('B08U-C-010_empty_body', {}, ['422 VALIDATION']), 422, 'VALIDATION');
        expectError(await patch('B08U-C-010_no_userid', { role: 'viewer' }, ['422 VALIDATION field "userId"']), 422, 'VALIDATION', { field: 'userId' });
      });

      await test.step('[B08U-C-025] W21: path != body userId → 422 PATH_BODY_MISMATCH; unknown path id → 404', async () => {
        expectError(await patch('B08U-C-025_mismatch', { role: 'viewer', userId: randomUUID() }, ['422 PATH_BODY_MISMATCH']), 422, 'PATH_BODY_MISMATCH');
        const ghost = randomUUID();
        const sent = await call(adm.api, 'B08U-C-025_unknown_id', 'PATCH', `/api/users/${ghost}/role`, { role: 'viewer', userId: ghost }, ['404 NOT_FOUND']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-028] #41 malformed JSON → 400 MALFORMED_JSON through the real proxy', async () => {
        const sent = await patch('B08U-G-028_malformed_json', undefined, ['400 MALFORMED_JSON'], '{"role":');
        expectError(sent, 400, 'MALFORMED_JSON');
      });

      await test.step('[B08U-G-019] #40 role change logged: user.role_change, objectCode = target id, label = email', async () => {
        const rows = await activityOf(adm.api, adm.user.id);
        // this run wrote exactly 3: G-023, D-009 promote, D-009 restore (counted after the setup PATCH)
        expect.soft(countKind(rows, 'user.role_change', tid), 'three new user.role_change rows').toBe(roleChanges + 3);
        expect.soft(rows.find((r) => r.kind === 'user.role_change' && r.objectCode === tid)?.objectLabel).toBe(target.user.email);
      });
    } finally {
      await cleanup.run();
    }
  });
});

/**
 * Phase 8 — SCR-37 BACKEND `/api/users` state changes through the real API, no browser, NO mocks (QA-08 P12, skill `qa-api-test`).
 * Flows FL-B08U-05..07 of `QA-08/flows-C7.md` (disable/enable active user, disable/enable pending invitee, delete user).
 * FL-B08U-01..04 live in `phase08_users_api.spec.ts`. One `test()` per flow, one `test.step('[<row id>] …')` per catalog row.
 * `BE:` = `F:/App/AppBack` main dc510655.
 *
 * ## Non-serial, own data
 * Acting admin = pool admin `p08-B08U-adm2` (QA-08 decision S2.2; the seed admin is only used by `poolUser` first fills).
 * FL-B08U-05 target = own pool viewer slot `p08-B08U-5` (disabled then enabled; enabled again in `finally`) — flows named
 * `p08-B08U-2`, but that slot is read by the other users file running in parallel, so it is not mutated here.
 * FL-06 / FL-07 use throw-away `testEmail(...)` invitees (deleted in `finally`, mails removed).
 *
 * ## Real-backend budget per run of this file (counted `users_invite`, 30 / 3600 s per admin, adm2 only)
 * FL-05: 0. FL-06: inviteOne + C-026 resend + C-027 invite = 3. FL-07: inviteOne + C-028 = 2. Total 5 here, plus 3 resend calls
 * (G-062/G-063/G-064) made by adm2 in `phase08_users_api.spec.ts` FL-03 = 8 per run (<= 12; limiter counts refused 422/404 too).
 * First fill of a pool slot = 1 invite from the seed admin (adm2, p08-B08U-5) — first run only.
 * `POST /api/auth/login` (120 / 60 s per IP): <= 6. `recovery_ip` accepts: 1 (FL-07) + 1 refused (FL-06) = 2.
 * The 429 of the invite limiter is owned by pytest.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { newApiContext, signedInApi } from './support/api';
import {
  Cleanup,
  acceptAttempt,
  acceptInvitation,
  activityOf,
  asJson,
  call,
  countKind,
  deleteLater,
  expectError,
  inviteOne,
  listUsers,
  pooled,
  type Json,
} from './support/p08/P12';

const ADM2 = 'p08-B08U-adm2';

test.describe('A08 phase-8 backend (/api/users N38-N46, part 2)', () => {
  test('SCR-37 · FL-B08U-05 · Disable and enable an active user', async () => {
    test.setTimeout(120_000);
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM2);
      const target = await pooled(cleanup, 'viewer', 'p08-B08U-5');
      const tid = target.user.id;
      cleanup.add(() => adm.api.post(`/api/users/${tid}/enable`, { data: {} }));
      const act0 = await activityOf(adm.api, adm.user.id);
      const disables0 = countKind(act0, 'user.disable', tid);
      const enables0 = countKind(act0, 'user.enable', tid);
      const disable = (name: string, body: unknown, why: string[]) => call(adm.api, name, 'POST', `/api/users/${tid}/disable`, body, why);

      await test.step('[B08U-G-033] #42 disable 200; target access token and refresh → 401', async () => {
        const sent = await disable('B08U-G-033_disable', {}, ['200 status "disabled"; access token → 401, refresh → 401']);
        expect(sent.status).toBe(200);
        expect(asJson(sent.body).status).toBe('disabled');
        expect((await target.api.get('/api/me')).status(), 'access token').toBe(401);
        expect((await target.api.post('/api/auth/refresh')).status(), 'refresh').toBe(401);
      });

      await test.step('[B08U-G-034] #42 repeat disable → 200, still disabled, no second user.disable row', async () => {
        const before = countKind(await activityOf(adm.api, adm.user.id), 'user.disable', tid);
        const sent = await disable('B08U-G-034_disable_again', {}, ['200 still disabled; no second user.disable row']);
        expect.soft(sent.status).toBe(200);
        expect.soft(asJson(sent.body).status).toBe('disabled');
        expect.soft(countKind(await activityOf(adm.api, adm.user.id), 'user.disable', tid), 'no second row').toBe(before);
      });

      await test.step('[B08U-D-008] disabled user own Bearer → 401 on GET /api/users', async () => {
        // the old token is dead anyway (token version bumped): also a fresh login must be refused
        const sent = await call(target.api, 'B08U-D-008_disabled_bearer', 'GET', '/api/users', undefined, ['disabled user Bearer → 401']);
        expect.soft(sent.status).toBe(401);
        const anon = await newApiContext();
        cleanup.add(() => anon.dispose());
        const login = await anon.post('/api/auth/login', { data: { email: target.user.email, password: target.user.password, rememberMe: false } });
        expect.soft(login.status(), 'fresh login of a disabled user is refused').not.toBe(204);
      });

      await test.step('[B08U-C-024] empty-body write accepts only {} : {"x":1} and [] → 422', async () => {
        expectError(await disable('B08U-C-024_extra_key', { x: 1 }, ['422 VALIDATION']), 422, 'VALIDATION');
        expectError(await disable('B08U-C-024_array_body', [], ['422 VALIDATION']), 422, 'VALIDATION');
      });

      await test.step('[B08U-G-041] #43 enable 200 active; user can sign in again', async () => {
        const sent = await call(adm.api, 'B08U-G-041_enable', 'POST', `/api/users/${tid}/enable`, {}, ['200 status "active"; sign-in works again']);
        expect(sent.status).toBe(200);
        expect.soft(asJson(sent.body).status).toBe('active');
        const again = await signedInApi(target.user.email, target.user.password);
        cleanup.add(() => again.dispose());
        expect.soft((await again.get('/api/me')).status(), 'signed in again').toBe(200);
      });

      await test.step('[B08U-G-020] #40 disable and enable logged: user.disable then user.enable', async () => {
        const all = await activityOf(adm.api, adm.user.id);
        expect.soft(countKind(all, 'user.disable', tid), 'one new user.disable row').toBe(disables0 + 1);
        expect.soft(countKind(all, 'user.enable', tid), 'one new user.enable row').toBe(enables0 + 1);
        const rows = all.filter((r) => r.objectCode === tid);
        const iEnable = rows.findIndex((r) => r.kind === 'user.enable');
        const iDisable = rows.findIndex((r) => r.kind === 'user.disable');
        expect.soft(iEnable, 'newest first: enable above disable').toBeLessThan(iDisable);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-37 · FL-B08U-06 · Disable and enable a pending invitee', async () => {
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM2);
      const inv = await inviteOne(cleanup, adm.api, 'b08u-pend');

      await test.step('[B08U-G-039] #42 pending target: invitation revoked, row disabled', async () => {
        const sent = await call(adm.api, 'B08U-G-039_disable_pending', 'POST', `/api/users/${inv.id}/disable`, {}, ['200 disabled; accept with its token → 422 INVITATION_TOKEN_INVALID']);
        expect(sent.status).toBe(200);
        expect(asJson(sent.body).status).toBe('disabled');
        const late = await acceptAttempt(cleanup, 'B08U-G-039_accept_revoked', inv.token, ['422 INVITATION_TOKEN_INVALID']);
        expectError(late, 422, 'INVITATION_TOKEN_INVALID', {}, true);
      });

      await test.step('[B08U-C-026] resend on a disabled invitee → 422 USER_NOT_PENDING', async () => {
        const sent = await call(adm.api, 'B08U-C-026_resend_disabled', 'POST', `/api/users/invitations/${inv.id}/resend`, {}, ['422 USER_NOT_PENDING']);
        expectError(sent, 422, 'USER_NOT_PENDING');
      });

      await test.step('[B08U-C-027] invite email of a disabled user → 422 USER_EMAIL_TAKEN field emails', async () => {
        const sent = await call(adm.api, 'B08U-C-027_invite_disabled', 'POST', '/api/users/invitations', { emails: [inv.email], role: 'viewer' }, ['422 USER_EMAIL_TAKEN field "emails"']);
        expectError(sent, 422, 'USER_EMAIL_TAKEN', { field: 'emails' });
      });

      await test.step('[B08U-G-042] #43 enable pending invitee → pending, no invite window', async () => {
        const sent = await call(adm.api, 'B08U-G-042_enable_pending', 'POST', `/api/users/${inv.id}/enable`, {}, ['200 status "pending"; invitedAt/inviteExpiresAt absent until resend']);
        expect.soft(sent.status).toBe(200);
        const body = asJson(sent.body);
        expect.soft(body.status).toBe('pending');
        expect.soft(Object.keys(body)).not.toContain('invitedAt');
        expect.soft(Object.keys(body)).not.toContain('inviteExpiresAt');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-37 · FL-B08U-07 · Delete a user (confirm, W21, aftermath)', async () => {
    test.setTimeout(120_000);
    const cleanup = new Cleanup();
    try {
      const adm = await pooled(cleanup, 'admin', ADM2);
      const inv = await inviteOne(cleanup, adm.api, 'b08u-del');
      const api = await acceptInvitation(cleanup, inv.token, 'QA b08u del');
      const del = (name: string, body: unknown, why: string[]) => call(adm.api, name, 'DELETE', `/api/users/${inv.id}`, body, why);
      let deleted: Json = {};

      await test.step('[B08U-C-019] delete with a wrong confirmEmail → 422 USER_CONFIRM_EMAIL_MISMATCH, user still listed', async () => {
        const sent = await del('B08U-C-019_confirm_mismatch', { userId: inv.id, confirmEmail: 'other@example.test' }, ['422 USER_CONFIRM_EMAIL_MISMATCH field "confirmEmail"']);
        expectError(sent, 422, 'USER_CONFIRM_EMAIL_MISMATCH', { field: 'confirmEmail' }, true);
        const list = await listUsers(adm.api);
        expect.soft(list.users.some((u) => u.id === inv.id), 'still listed').toBe(true);
      });

      await test.step('[B08U-C-023] delete body without confirmEmail → 422 VALIDATION field confirmEmail', async () => {
        const sent = await del('B08U-C-023_no_confirm', { userId: inv.id }, ['422 VALIDATION field "confirmEmail"']);
        expectError(sent, 422, 'VALIDATION', { field: 'confirmEmail' });
      });

      await test.step('[B08U-G-070] #46 path / body userId mismatch → 422 PATH_BODY_MISMATCH, nothing deleted', async () => {
        const sent = await del('B08U-G-070_mismatch', { userId: randomUUID(), confirmEmail: inv.email }, ['422 PATH_BODY_MISMATCH']);
        expectError(sent, 422, 'PATH_BODY_MISMATCH');
        expect.soft((await adm.api.get(`/api/users/${inv.id}/memberships`)).status(), 'still exists').toBe(200);
      });

      await test.step('[B08U-C-020] confirmEmail is case-insensitive: upper-case email → 200', async () => {
        const sent = await del('B08U-C-020_upper_case_confirm', { userId: inv.id, confirmEmail: inv.email.toUpperCase() }, ['200 AdminUser (normalize_email)']);
        expect(sent.status).toBe(200);
        deleted = asJson(sent.body);
      });

      await test.step('[B08U-G-066] #46 delete 200 returns the pre-delete view; #39 and #40 then 404', async () => {
        expect.soft(deleted.id).toBe(inv.id);
        expect.soft(deleted.email).toBe(inv.email);
        expect.soft(deleted.status).toBe('active');
        const m = await call(adm.api, 'B08U-G-066_memberships_after', 'GET', `/api/users/${inv.id}/memberships`, undefined, ['404 after delete']);
        expectError(m, 404, 'NOT_FOUND', { resource: 'user' });
        const a = await call(adm.api, 'B08U-G-066_activity_after', 'GET', `/api/users/${inv.id}/activity`, undefined, ['404 after delete']);
        expectError(a, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-010] #38 soft-deleted user absent and total drops by 1', async () => {
        const list = await listUsers(adm.api);
        expect.soft(list.users.some((u) => u.id === inv.id), 'absent').toBe(false);
        // global counts move with parallel files: assert self-consistency, not a difference of totals
        if (list.users.length < 1000) expect.soft(list.total, 'total = listed rows below the cap').toBe(list.users.length);
      });

      await test.step('[B08U-G-013] #39 soft-deleted user → 404 resource user', async () => {
        const sent = await call(adm.api, 'B08U-G-013_memberships_deleted', 'GET', `/api/users/${inv.id}/memberships`, undefined, ['404 NOT_FOUND resource "user"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-067] #46 sessions killed: deleted user Bearer → 401', async () => {
        const sent = await call(api, 'B08U-G-067_deleted_bearer', 'GET', '/api/me', undefined, ['401 for the deleted user Bearer']);
        expect.soft(sent.status).toBe(401);
      });

      await test.step('[B08U-G-068] #46 already deleted → 404 resource user', async () => {
        const sent = await del('B08U-G-068_delete_again', { userId: inv.id, confirmEmail: inv.email }, ['404 NOT_FOUND resource "user"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'user' });
      });

      await test.step('[B08U-G-022] #40 delete logged: user.delete row, objectLabel = email', async () => {
        const row = (await activityOf(adm.api, adm.user.id)).find((r) => r.kind === 'user.delete' && r.objectCode === inv.id);
        expect.soft(row, 'user.delete row').toBeDefined();
        expect.soft(row?.objectLabel).toBe(inv.email);
      });

      await test.step('[B08U-C-028] invite email of a deleted user → 201, email free again', async () => {
        const sent = await call(adm.api, 'B08U-C-028_reinvite_deleted', 'POST', '/api/users/invitations', { emails: [inv.email], role: 'viewer' }, ['201 pending row for the freed email']);
        expect(sent.status).toBe(201);
        const row = asJson((sent.body as Json[])[0]);
        expect.soft(row.email).toBe(inv.email);
        deleteLater(cleanup, adm.api, String(row.id), inv.email);
      });
    } finally {
      await cleanup.run();
    }
  });
});

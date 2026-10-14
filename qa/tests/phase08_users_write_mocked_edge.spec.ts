/**
 * Phase 8 - SCR-37 `/admin/users` WRITE side, MOCKED RESPONSES (QA-08 P10, flows-C5 FL-37W-M1..M3).
 * Every flow title carries `[mocked response]`: 403/429/500/network loss/422 on writes and a one-admin list cannot be
 * produced on the shared stack. Real pairs: FL-37W-02 (422 + successful invite), FL-37W-04 (role/disable/enable),
 * FL-37W-05 (delete) in phase08_users_write_edge; every flow here ends with `unroute` + a real `GET /api/users` 200.
 * Held/recorded requests are counted from `page.on('request')`; "no second POST" is asserted only after `page.clock.runFor`
 * has fired every timer a client retry could use (a certain milestone), never after a fixed wait.
 * Source (FE): UMH useUserManagement.ts:156-163 (failure titles), :139 (last-admin text); UMB UserManagementTable.tsx
 * (row buttons `Vô hiệu hoá` / `Bật lại` / `Xoá`, role select `Vai của {tên}`); UMD UserManagementDetail.tsx:254 (delete dialog
 * `Xoá hẳn {tên}?`, field `Địa chỉ thư`, `Xác nhận xoá vĩnh viễn`); phase08_admin_edge.spec.ts:353-361 (custom Select + toast helpers).
 *
 * ## Users
 * Admin seed in the browser (read only here: nothing real is written); M2 shows the shared read-only engineer `p08-eng`
 * (packs.md S2 decision 1) as a row but never changes it for real: PATCH/POST are all mocked, so no restore is needed.
 * ## Request budget
 * `POST /api/auth/login`: 3 flows x (1 UI + 1 API setup) = 6 (limit 120 / 60 s per IP).
 * `POST /api/users/invitations`: 0 real (M1 answers all 6 attempts from the mock; none reaches the BE, `users_invite` untouched).
 * Real writes to the BE: none.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { captureEvidence, testEmail } from './support/evidence';
import { poolUser } from './support/phase03Seed';
import { DESKTOP } from './support/p08/admin';
import { USERS_RE, json, markToast, realUsers, requestLog, wireError, type Json } from './support/p08/P10';

const T = {
  invite: 'Mời người dùng', // UMT:31
  emails: 'Email người được mời', // UMT:33
  submit: 'Gửi lời mời', // UMT:35
  inviteFailed: 'Không gửi được lời mời', // UMH:161
  roleFailed: 'Không đổi được vai', // UMH:156
  statusFailed: 'Không đổi được trạng thái tài khoản', // UMH:159
  removeFailed: 'Không xoá được tài khoản', // UMH:163
  pending: 'Chờ chấp nhận',
  active: 'Đang hoạt động',
  engineer: 'Kỹ sư',
  viewer: 'Người xem',
  disable: 'Vô hiệu hoá',
  enable: 'Bật lại',
  remove: 'Xoá',
  lastAdmin: 'Đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này', // UMH:139
  removeConfirm: 'Xác nhận xoá vĩnh viễn', // UMD:282
  removeEmail: 'Địa chỉ thư', // UMD:264
} as const;

const INVITE_RE = /\/api\/users\/invitations$/u;
const idRe = (leaf: string): RegExp => new RegExp(`/api/users/[^/]+/${leaf}$`, 'u');
const DELETE_RE = /\/api\/users\/[^/]+$/u;

const toast = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
const rowOf = (page: Page, email: string): Locator => page.locator('tbody tr').filter({ hasText: email });
const getList = (page: Page) =>
  page.waitForResponse((r) => r.request().method() === 'GET' && USERS_RE.test(r.url()) && r.status() === 200);
async function pick(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

type Fail = { readonly status: number; readonly code: string } | 'abort';
/** Answers one request with a scripted failure; `abort` loses the network. */
const fail = (route: Route, how: Fail): Promise<void> =>
  how === 'abort' ? route.abort('failed') : json(route, how.status, wireError(how.code));

/** Own admin row + the shared read-only engineer row, from the real list (setup only, 1 API login). */
async function setupRows(withPeer: boolean): Promise<{ self: Json; peer?: Json }> {
  const { email, password } = readAdminCredentials();
  const api = await signedInApi(email, password);
  try {
    const peerId = withPeer ? (await poolUser(api, 'engineer', 'p08-eng')).id : undefined;
    const users = await realUsers(api);
    const self = users.find((u) => u.email === email);
    if (self === undefined) throw new Error('setup: admin row missing from GET /api/users');
    const peer = users.find((u) => u.id === peerId);
    if (withPeer && peer === undefined) throw new Error('setup: p08-eng missing from GET /api/users');
    return peer === undefined ? { self } : { self, peer };
  } finally {
    await api.dispose();
  }
}

test.describe('A08 SCR-37 users write, mocked responses', () => {
  test.use({ viewport: DESKTOP });

  test('SCR-37 · FL-37W-M1 · [mocked response] Mời lỗi: 403 / 429 / 500 / mạng / quá 50 địa chỉ', async ({ page }) => {
    test.setTimeout(180_000);
    const typed = testEmail('users_write_m1');
    let how: Fail = { status: 429, code: 'RATE_LIMITED' };
    const posts = requestLog(page, 'POST', INVITE_RE);
    await page.route(INVITE_RE, (route) => (route.request().method() === 'POST' ? fail(route, how) : route.fallback()));
    await signInAdmin(page, ROUTES.adminUsers);
    await page.clock.install();
    const list = getList(page);
    await page.goto(ROUTES.adminUsers);
    await list;
    const field = page.getByRole('textbox', { name: T.emails, exact: true });
    const send = async (): Promise<void> => {
      await page.getByRole('button', { name: T.submit, exact: true }).click();
    };
    const sendAndSee = async (): Promise<void> => {
      const asked = page.waitForRequest((r) => r.method() === 'POST' && INVITE_RE.test(r.url()));
      await send();
      await asked;
    };
    try {
      await test.step('[37W-G-002] 429 users_invite -> toast, text kept, optimistic row gone, ONE POST (N8: no client retry)', async () => {
        await page.getByRole('button', { name: T.invite, exact: true }).click();
        await field.fill(typed);
        const mark = await markToast(page, T.inviteFailed);
        await sendAndSee();
        await mark.expectNew();
        await expect(field).toHaveValue(typed);
        await expect(rowOf(page, typed)).toHaveCount(0);
        await expect.soft(toast(page, T.inviteFailed).last()).toContainText(/S/u);
        await captureEvidence(page, 'E08_37W-G-002_users_write.png', { caption: '429: toast, text kept, row gone' });
        await page.clock.runFor(120_000); // fires every retry/backoff timer a client could use: the milestone for "no more POST"
        // ⚑ N8: the client must not resend on its own
        expect(posts.count(), 'POST /api/users/invitations after a 429').toBe(1);
      });

      await test.step('[37W-B-007] after the failure: field keeps its text, no extra "Chờ chấp nhận" row', async () => {
        await expect.soft(field).toHaveValue(typed);
        await expect.soft(rowOf(page, typed)).toHaveCount(0);
        await expect.soft(page.getByText(T.pending, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E08_37W-B-007_users_write.png');
      });

      await test.step('[37W-G-003] 403 -> toast "Không gửi được lời mời"', async () => {
        how = { status: 403, code: 'FORBIDDEN' };
        const mark = await markToast(page, T.inviteFailed);
        await sendAndSee();
        await mark.expectNew(true);
        await captureEvidence(page, 'E08_37W-G-003_users_write.png');
      });

      await test.step('[37W-G-004] 500 -> toast "Không gửi được lời mời"', async () => {
        how = { status: 500, code: 'INTERNAL' };
        const mark = await markToast(page, T.inviteFailed);
        await sendAndSee();
        await mark.expectNew(true);
        await captureEvidence(page, 'E08_37W-G-004_users_write.png');
      });

      await test.step('[37W-G-005] network abort -> toast, field keeps its text', async () => {
        how = 'abort';
        const mark = await markToast(page, T.inviteFailed);
        await sendAndSee();
        await mark.expectNew(true);
        await expect.soft(field).toHaveValue(typed);
        await captureEvidence(page, 'E08_37W-G-005_users_write.png');
      });

      await test.step('[37W-C-009] 51 addresses -> mock 422 VALIDATION field=emails -> toast', async () => {
        how = { status: 422, code: 'VALIDATION' };
        const many = Array.from({ length: 51 }, (_, i) => `qa08m1-${String(i)}@example.test`).join('\n');
        await field.fill(many);
        const mark = await markToast(page, T.inviteFailed);
        const asked = page.waitForRequest((r) => r.method() === 'POST' && INVITE_RE.test(r.url()));
        await send();
        const body = (await asked).postDataJSON() as { emails?: unknown };
        expect.soft(Array.isArray(body.emails) ? body.emails.length : -1, 'all 51 addresses were sent').toBe(51);
        await mark.expectNew(true);
        await captureEvidence(page, 'E08_37W-C-009_users_write.png');
      });
    } finally {
      posts.stop();
      await page.unroute(INVITE_RE);
    }
    const real = getList(page); // real pair: unroute + a real GET /api/users 200
    await page.reload();
    expect((await real).status()).toBe(200);
  });

  test('SCR-37 · FL-37W-M2 · [mocked response] Đổi vai / vô hiệu / bật lại lỗi; ghi bị 403 giữa phiên', async ({ page }) => {
    test.setTimeout(240_000);
    const { peer } = await setupRows(true);
    if (peer === undefined) throw new Error('unreachable');
    const email = String(peer.email);
    const name = String(peer.name);
    let roleHow: Fail[] = [];
    let disableHow: Fail[] = [];
    let enableHow: Fail[] = [];
    const next = (queue: Fail[]): Fail => queue.shift() ?? { status: 500, code: 'INTERNAL' };
    await page.route(idRe('role'), (route) => (route.request().method() === 'PATCH' ? fail(route, next(roleHow)) : route.fallback()));
    await page.route(idRe('disable'), (route) => fail(route, next(disableHow)));
    await page.route(idRe('enable'), (route) => fail(route, next(enableHow)));
    const patches = requestLog(page, 'PATCH', idRe('role'));
    await signInAdmin(page, ROUTES.adminUsers);
    await page.clock.install(); // markToast runs the fake clock; every later page.goto keeps it
    const select = (): Locator => rowOf(page, email).getByRole('combobox', { name: `Vai của ${name}`, exact: true });
    const change = async (to: string): Promise<void> => {
      const asked = page.waitForRequest((r) => r.method() === 'PATCH' && idRe('role').test(r.url()));
      await pick(page, select(), to);
      await asked;
    };
    try {
      await test.step('[37W-G-007] PATCH 422 USER_SELF_MODIFICATION then USER_LAST_ADMIN -> toast, select back to the old role', async () => {
        await expect(select()).toContainText(T.engineer);
        for (const code of ['USER_SELF_MODIFICATION', 'USER_LAST_ADMIN']) {
          roleHow = [{ status: 422, code }];
          const mark = await markToast(page, T.roleFailed);
          await change(T.viewer);
          await mark.expectNew();
          await expect(select()).toContainText(T.engineer);
        }
        await captureEvidence(page, 'E08_37W-G-007_users_write.png');
      });

      await test.step('[37W-B-004] rollback: one row, select shows "Kỹ sư"', async () => {
        await expect.soft(rowOf(page, email)).toHaveCount(1);
        await expect.soft(select()).toContainText(T.engineer);
        expect.soft(patches.count()).toBe(2);
        await captureEvidence(page, 'E08_37W-B-004_users_write.png');
      });

      await test.step('[37W-G-009] PATCH 403 / 500 / abort -> toast "Không đổi được vai"', async () => {
        for (const how of [{ status: 403, code: 'FORBIDDEN' }, { status: 500, code: 'INTERNAL' }, 'abort'] as const) {
          roleHow = [how];
          const mark = await markToast(page, T.roleFailed);
          await change(T.viewer);
          await mark.expectNew(true);
          await expect.soft(select()).toContainText(T.engineer);
        }
        await captureEvidence(page, 'E08_37W-G-009_users_write.png');
      });

      await test.step('[37W-G-010] disable 422 / 404 / 500 / abort -> toast, badge unchanged', async () => {
        // UMB RowActions:152: the button calls onDisableUser at once (no confirm dialog)
        for (const how of [{ status: 422, code: 'USER_LAST_ADMIN' }, { status: 404, code: 'NOT_FOUND' }, { status: 500, code: 'INTERNAL' }, 'abort'] as const) {
          disableHow = [how];
          const mark = await markToast(page, T.statusFailed);
          const asked = page.waitForRequest((r) => r.method() === 'POST' && idRe('disable').test(r.url()));
          await rowOf(page, email).getByRole('button', { name: T.disable, exact: true }).click();
          await asked;
          await mark.expectNew(true);
          await expect.soft(rowOf(page, email)).toContainText(T.active);
        }
        await captureEvidence(page, 'E08_37W-G-010_users_write.png');
      });

      await test.step('[37W-G-011] enable 404 / 500 / abort on a (mocked) disabled row -> same toast', async () => {
        const asRow = { ...peer, status: 'disabled' };
        await page.route(USERS_RE, async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const res = await route.fetch();
          const body = (await res.json()) as { users: Json[] };
          return json(route, 200, { ...body, users: body.users.map((u) => (u.id === peer.id ? asRow : u)) });
        });
        const list = getList(page);
        await page.goto(ROUTES.adminUsers);
        await list;
        for (const how of [{ status: 404, code: 'NOT_FOUND' }, { status: 500, code: 'INTERNAL' }, 'abort'] as const) {
          enableHow = [how];
          const mark = await markToast(page, T.statusFailed);
          const asked = page.waitForRequest((r) => r.method() === 'POST' && idRe('enable').test(r.url()));
          await rowOf(page, email).getByRole('button', { name: T.enable, exact: true }).click();
          await asked;
          await mark.expectNew(true);
          await expect.soft(rowOf(page, email).getByRole('button', { name: T.enable, exact: true })).toBeVisible();
        }
        await captureEvidence(page, 'E08_37W-G-011_users_write.png');
        await page.unroute(USERS_RE);
      });

      await test.step('[37W-D-005] 403 on a write mid-session -> error toast, row back to its real state', async () => {
        const list = getList(page);
        await page.goto(ROUTES.adminUsers); // real list again: peer is active
        await list;
        disableHow = [{ status: 403, code: 'FORBIDDEN' }];
        const mark = await markToast(page, T.statusFailed);
        const asked = page.waitForRequest((r) => r.method() === 'POST' && idRe('disable').test(r.url()));
        await rowOf(page, email).getByRole('button', { name: T.disable, exact: true }).click();
        await asked;
        await mark.expectNew(true);
        await expect.soft(rowOf(page, email)).toContainText(T.active);
        await expect.soft(rowOf(page, email).getByRole('button', { name: T.disable, exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37W-D-005_users_write.png');
      });
    } finally {
      patches.stop();
      for (const re of [idRe('role'), idRe('disable'), idRe('enable'), USERS_RE]) await page.unroute(re);
    }
    const real = getList(page); // real pair
    await page.reload();
    expect((await real).status()).toBe(200);
  });

  test('SCR-37 · FL-37W-M3 · [mocked response] Xoá lỗi; quản trị cuối cùng', async ({ page }) => {
    test.setTimeout(180_000);
    const { self } = await setupRows(false);
    const pendingEmail = testEmail('users_write_m3');
    const pendingName = 'QA08 M3 pending';
    const pending: Json = {
      id: 'usr_qa08m3pending',
      email: pendingEmail,
      name: pendingName,
      role: 'viewer',
      status: 'pending',
      projectCount: 0,
      lastActiveAt: null,
      invitedAt: '2026-10-14T08:00:00Z',
      inviteExpiresAt: '2026-10-21T08:00:00Z',
    };
    const second: Json = { id: 'usr_qa08m3second', email: testEmail('users_write_m3_adm'), name: 'QA08 M3 second admin', role: 'admin', status: 'active', projectCount: 0, lastActiveAt: null };
    let withSecond = false;
    let how: Fail = { status: 404, code: 'NOT_FOUND' };
    await page.route(USERS_RE, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const users = withSecond ? [self, second, pending] : [self, pending];
      return json(route, 200, { total: users.length, users });
    });
    await page.route(DELETE_RE, (route) => (route.request().method() === 'DELETE' ? fail(route, how) : route.fallback()));
    const deletes = requestLog(page, 'DELETE', DELETE_RE);
    await signInAdmin(page, ROUTES.adminUsers);
    await page.clock.install();
    const selfRow = rowOf(page, String(self.email));
    const dialogOf = (n: string): Locator => page.getByRole('dialog', { name: `Xoá hẳn ${n}?`, exact: true });
    try {
      await test.step('[37W-C-012] last admin -> role / disable / delete blocked with the last-admin reason', async () => {
        await expect(selfRow).toBeVisible();
        // UMB RowActions:145-158 + UMH buildRow:289-337: on the OWN row the self reason takes precedence for role and disable
        // (selfRoleBlocked / selfDisableBlocked); the last-admin sentence is the span that replaces the "Xoá" button.
        await expect(selfRow.getByText(T.lastAdmin, { exact: true })).toBeVisible();
        await expect(selfRow.getByRole('button', { name: T.remove, exact: true })).toHaveCount(0);
        await expect.soft(selfRow.getByRole('button', { name: T.disable, exact: true })).toHaveCount(0);
        await expect.soft(selfRow.getByText('Bạn không thể tự vô hiệu hoá tài khoản của mình', { exact: true })).toBeVisible();
        await expect.soft(selfRow.getByText('Bạn không thể tự đổi vai của mình', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37W-C-012_users_write.png');
      });

      await test.step('[37W-G-014] delete the pending row with DELETE 404 / 403 / 500 / abort -> toast, row back', async () => {
        await rowOf(page, pendingEmail).getByRole('button', { name: T.remove, exact: true }).click();
        const dialog = dialogOf(pendingName);
        await expect(dialog).toBeVisible();
        await dialog.getByLabel(T.removeEmail, { exact: true }).fill(pendingEmail);
        for (const attempt of [{ status: 404, code: 'NOT_FOUND' }, { status: 403, code: 'FORBIDDEN' }, { status: 500, code: 'INTERNAL' }, 'abort'] as const) {
          how = attempt;
          const mark = await markToast(page, T.removeFailed);
          const asked = page.waitForRequest((r) => r.method() === 'DELETE' && DELETE_RE.test(r.url()));
          await dialog.getByRole('button', { name: T.removeConfirm, exact: true }).click();
          await asked;
          await mark.expectNew(true);
          await expect.soft(rowOf(page, pendingEmail)).toHaveCount(1);
        }
        expect.soft(deletes.count()).toBe(4);
        await captureEvidence(page, 'E08_37W-G-014_users_write.png');
      });

      await test.step('[37W-B-005] row back in its place, dialog still open', async () => {
        await expect.soft(dialogOf(pendingName)).toBeVisible();
        const emails = await page.locator('tbody tr').allInnerTexts();
        expect.soft(emails.findIndex((t) => t.includes(pendingEmail)), 'pending row keeps the last position').toBe(emails.length - 1);
        await captureEvidence(page, 'E08_37W-B-005_users_write.png');
        await dialogOf(pendingName).getByRole('button', { name: 'Để sau', exact: true }).click();
      });

      await test.step('[37W-G-015] own row with a second admin: DELETE 422 USER_SELF_MODIFICATION (⚑ no path to it)', async () => {
        withSecond = true;
        const list = getList(page);
        await page.goto(ROUTES.adminUsers);
        await list;
        how = { status: 422, code: 'USER_SELF_MODIFICATION' };
        const own = rowOf(page, String(self.email)).getByRole('button', { name: T.remove, exact: true });
        // ⚑ correct behaviour: the app offers no delete on your own row
        await expect.soft(own, 'no "Xoá" on the own row').toHaveCount(0);
        if ((await own.count()) > 0) {
          await own.click();
          const dialog = dialogOf(String(self.name));
          await dialog.getByLabel(T.removeEmail, { exact: true }).fill(String(self.email));
          const mark = await markToast(page, T.removeFailed);
          await dialog.getByRole('button', { name: T.removeConfirm, exact: true }).click();
          await mark.expectNew(true);
        }
        await expect.soft(rowOf(page, String(self.email))).toHaveCount(1);
        await captureEvidence(page, 'E08_37W-G-015_users_write.png');
      });
    } finally {
      deletes.stop();
      await page.unroute(USERS_RE);
      await page.unroute(DELETE_RE);
    }
    const real = getList(page); // real pair
    await page.reload();
    expect((await real).status()).toBe(200);
  });
});

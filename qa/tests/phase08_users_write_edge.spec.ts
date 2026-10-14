/**
 * Phase 8 - EDGE, SCR-37 /admin/users, WRITE part (invite, role, disable/enable, delete, self-edit block).
 * Plan: QA-08 flows-C5 FL-37W-01..06 + packs.md "Quyet dinh S2" (invites only through the own admin pool user).
 * Short names under src/screens/admin/UserManagement/: UM UserManagement.tsx, UMT ...Toolbar.tsx, UMB ...Table.tsx,
 * UMD ...Detail.tsx, UUM useUserManagement.ts, UMG userManagementGateway.ts. Copy of toasts: UUM:130-165; errors: src/i18n/vi.json
 * via src/lib/errors/describeError.ts; lost rights: UMG:226 over src/lib/auth/permissions.ts:64-88.
 *
 * ## Accounts (real backend, no mock)
 * - UI admin = pool user `p08-37W-adm` (role admin), NEVER the seed admin (seed login only fills pool slots, API).
 * - Written (own slots, restored in finally): p08-37W-1/2/3 engineer, p08-37W-5 engineer (project member, read only in panel).
 * - Read only, shared: PU6/PU10/PU7 = `p08-eng`, PU8 = `p08-view`. Invitees: testEmail('users_write') @example.test, deleted in finally.
 * - Retry policy: fixed slots, `-r<retry>` suffix only on retry.
 *
 * ## Request budget (POST /api/users/invitations, 30/h/admin; this file's admin = p08-37W-adm)
 * Counted per run: FL-02 5 (e1, e2+e3 one call, e4 one call, e1 again, PU6 email) + FL-03 1 (e5) + FL-05 2 (r1, r2) = 8 invitations
 * (the held double-click sends 1). FL-01 and FL-06 send 0. Worst case with one retry of every test: 16 < 30. Seed-admin invites: only
 * to fill empty pool slots (adm, 1, 2, 3, 5, eng, view) = 7 once.
 * Logins: 1 seed API + 1 adm API + 1 adm UI per test (+ 2 in FL-06 for PU7/PU8) = ~22 per run.
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

import { adminApi, holdResponse } from './support/p08/admin';
import { signedInApi } from './support/api';
import { TEST_DATA_PREFIX, captureEvidence, testEmail } from './support/evidence';
import { waitForMail } from './support/mailpit';
import { addProjectMember, createProject, deleteSeededProject, poolUser, removeProjectMember, type PoolUser } from './support/phase03Seed';
import {
  INVITATIONS,
  ROLE,
  STATUS,
  T,
  USERS,
  asList,
  deleteUser,
  detailAside,
  enableApi,
  findUserId,
  inviteApi,
  inviteBox,
  inviteSubmit,
  nextListRead,
  nextResponse,
  openInviteButton,
  openUsers,
  patchRole,
  pickOption,
  re,
  recordWrites,
  sessionOf,
  slot,
  str,
  toast,
  userRow,
} from './support/p08/P11';

const ev = (page: Page, id: string): Promise<string> => captureEvidence(page, `E08_${id}_users_write.png`);
const STEM = `${TEST_DATA_PREFIX}users_write-`;

interface Env {
  readonly seed: APIRequestContext;
  readonly adm: PoolUser;
  readonly api: APIRequestContext;
}

/** Seed API only to fill pool slots; the admin pool user does every write. */
async function env(): Promise<{ e: Env; fill: (role: 'admin' | 'engineer' | 'viewer', s: string) => Promise<PoolUser>; dispose: () => Promise<void> }> {
  const seed = await adminApi();
  const adm = await poolUser(seed, 'admin', 'p08-37W-adm');
  const api = await signedInApi(adm.email, adm.password);
  return {
    e: { seed, adm, api },
    fill: (role, s) => poolUser(seed, role, s),
    dispose: async () => {
      await api.dispose();
      await seed.dispose();
    },
  };
}

const pendingCount = async (page: Page): Promise<number> =>
  Number(
    await page
      .locator('dl')
      .filter({ hasText: T.summaryPending })
      .locator('div')
      .filter({ has: page.locator('dt', { hasText: T.summaryPending }) })
      .locator('dd')
      .first()
      .innerText(),
  );

const search = (page: Page, text: string): Promise<void> => page.getByLabel(T.search, { exact: true }).fill(text);
const lastFocusNotBody = (page: Page): Promise<void> =>
  expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'NONE'), { message: 'focus must not fall to body' }).not.toBe('BODY');

test.describe('E08 SCR-37 users write (edge)', () => {
  test('SCR-37 · FL-37W-01 · Khối mời: nhập, kiểm hợp lệ, huỷ (không gửi gì)', async ({ browser }) => {
    test.setTimeout(120_000);
    const x = await env();
    const { context, page } = await sessionOf(browser, x.e.adm);
    try {
      await openUsers(page);
      const rec = recordWrites(page);
      const box = inviteBox(page);
      const submit = inviteSubmit(page);
      const chip = (n: number) => page.getByText(T.validChip(n), { exact: true });
      const ok = testEmail('users_write');
      await test.step('[37W-A-001] mở khối mời', async () => {
        await openInviteButton(page).click(); // UMT:83
        await expect(box).toBeVisible();
        await expect(page.getByLabel(T.inviteRole)).toContainText(ROLE.viewer);
        await expect(submit).toBeDisabled();
        await expect(page.getByRole('button', { name: T.inviteCancel, exact: true })).toBeVisible();
        await ev(page, '37W-A-001');
      });
      await test.step('[37W-E-004] focus vao o email khi mo', async () => {
        await expect.soft(box, 'N6: focus should land in the email box').toBeFocused(); // UMT:112-121 has no autoFocus
        await ev(page, '37W-E-004');
      });
      await test.step('[37W-E-001] Tab order', async () => {
        await box.focus();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('combobox', { name: T.inviteRole })).toBeFocused();
        await page.keyboard.press('Tab'); // submit is disabled (box empty) -> skipped
        await expect.soft(page.getByRole('button', { name: T.inviteCancel, exact: true })).toBeFocused();
        await ev(page, '37W-E-001');
      });
      await test.step('[37W-C-001] o rong', async () => {
        await expect.soft(page.getByText(T.needsEmail, { exact: true })).toBeVisible(); // UUM:147
        await ev(page, '37W-C-001');
      });
      await test.step('[37W-C-002] dia chi sai', async () => {
        await box.fill('abc');
        await expect.soft(page.getByText(T.invalidLine('abc'), { exact: true })).toBeVisible();
        await expect.soft(page.getByText(T.fixInvalid, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(/địa chỉ hợp lệ/u)).toHaveCount(0);
        await ev(page, '37W-C-002');
      });
      await test.step('[37W-E-002] aria-describedby', async () => {
        await expect.soft(submit).toBeDisabled();
        await expect.soft(submit).toHaveAttribute('aria-describedby', T.blockedReasonId); // UMT:140
        await ev(page, '37W-E-002');
      });
      await test.step('[37W-C-003] hon hop', async () => {
        await box.fill(`abc, ${ok}`);
        await expect.soft(chip(1)).toBeVisible();
        await expect.soft(page.getByText(T.invalidLine('abc'), { exact: true })).toBeVisible();
        await expect.soft(submit).toBeDisabled();
        await ev(page, '37W-C-003');
      });
      await test.step('[37W-C-004] trung chu', async () => {
        await box.fill(`${ok}, ${ok}`);
        await expect.soft(chip(1)).toBeVisible();
        await ev(page, '37W-C-004');
      });
      await test.step('[37W-C-006] dau cham phay', async () => {
        await box.fill('a@example.test; b@example.test');
        await expect.soft(page.getByText(/^Chưa đúng dạng địa chỉ thư:/u)).toBeVisible();
        await expect.soft(submit).toBeDisabled();
        await ev(page, '37W-C-006');
      });
      await test.step('[37W-E-003] Esc', async () => {
        await box.focus();
        await page.keyboard.press('Escape');
        await expect.soft(box, 'Esc inside the text box keeps the panel').toBeVisible(); // UM:150-156
        await page.keyboard.press('Tab'); // out of the text box
        await page.keyboard.press('Escape');
        await expect.soft(box, 'Esc outside the text box closes the panel').toHaveCount(0);
        await ev(page, '37W-E-003');
      });
      await test.step('[37W-B-003] Esc dong khoi moi truoc panel', async () => {
        await openInviteButton(page).click();
        await expect(box).toBeVisible();
        await page.getByRole('button', { name: x.e.adm.name, exact: true }).click(); // UMB:305
        await expect(detailAside(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(box).toHaveCount(0);
        await expect.soft(detailAside(page)).toBeVisible();
        await ev(page, '37W-B-003');
      });
      await test.step('[37W-A-006] Huy xoa chu, khong POST', async () => {
        await openInviteButton(page).click();
        await box.fill('zzz');
        await page.getByRole('button', { name: T.inviteCancel, exact: true }).click();
        await expect.soft(box).toHaveCount(0);
        await openInviteButton(page).click();
        await expect.soft(box).toHaveValue('');
        expect.soft(rec.writes(), 'no write was sent').toEqual([]);
        await ev(page, '37W-A-006');
      });
      rec.stop();
    } finally {
      await context.close();
      await x.dispose();
    }
  });

  test('SCR-37 · FL-37W-02 · Mời: gửi một, lô, vai, trùng, đã có, thư tới', async ({ browser }) => {
    test.setTimeout(420_000);
    const x = await env();
    const pu6 = await x.fill('engineer', 'p08-eng'); // PU6: email taken, read only (Quyet dinh S2 #1)
    const e1 = testEmail('users_write');
    const e2 = testEmail('users_write');
    const e3 = testEmail('users_write');
    const e4 = testEmail('users_write');
    const { context, page } = await sessionOf(browser, x.e.adm);
    const since = new Date(Date.now() - 2_000);
    try {
      await openUsers(page);
      await search(page, STEM);
      const rec = recordWrites(page);
      const box = inviteBox(page);
      const role = page.getByRole('combobox', { name: 'Vai cho lời mời' });
      let successes = 0;
      let doubleClickPosts = 0;
      let loadingDuringHold = false;
      let optimisticName = '';
      let postBody: unknown;
      let pendingBefore = 0;
      await test.step('[37W-A-002] gui mot dia chi', async () => {
        pendingBefore = await pendingCount(page);
        await openInviteButton(page).click();
        await box.fill(e1);
        const held = await holdResponse(page, `**${INVITATIONS}`, 'POST'); // real response, held ~ until released (B-001/B-002)
        const post = nextResponse(page, 'POST', re(INVITATIONS), [201]);
        await inviteSubmit(page).dblclick({ force: true });
        await held.seen;
        loadingDuringHold = await inviteSubmit(page).isDisabled();
        optimisticName = await userRow(page, e1).innerText();
        doubleClickPosts = rec.writes().length;
        const list = nextListRead(page);
        await held.release();
        const sent = await post;
        postBody = sent.response.request().postDataJSON();
        await list;
        successes += 1;
        expect(postBody).toEqual({ emails: [e1], role: 'viewer' });
        await expect(box).toHaveCount(0);
        await expect(toast(page, T.invitedTitle)).toContainText(e1);
        await expect(userRow(page, e1)).toContainText(STATUS.pending);
        expect(await pendingCount(page)).toBe(pendingBefore + 1);
        await ev(page, '37W-A-002');
      });
      await test.step('[37W-B-001] bam dup chi 1 POST', async () => {
        expect.soft(doubleClickPosts, 'exactly one POST while the response was held').toBe(1);
        expect.soft(loadingDuringHold, 'submit is loading/disabled while sending').toBe(true);
        await ev(page, '37W-B-001');
      });
      await test.step('[37W-B-002] hang lac quan', async () => {
        expect.soft(optimisticName, 'optimistic row exists before the POST answers, temporary name = email').toContain(e1);
        await expect.soft(userRow(page, e1)).toHaveCount(1);
        await ev(page, '37W-B-002');
      });
      await test.step('[37W-G-001] than POST', async () => {
        expect.soft(Object.keys(postBody as object).sort()).toEqual(['emails', 'role']);
        await ev(page, '37W-G-001');
      });
      await test.step('[37W-A-005] thu moi toi e1', async () => {
        const mail = await waitForMail(e1, since, 30_000, 'Lời mời tham gia AppBack');
        expect.soft(mail.subject).toContain('Lời mời');
        await ev(page, '37W-A-005');
      });
      await test.step('[37W-A-003] lo 2 dia chi vai Ky su', async () => {
        await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20_000 }); // toasts gone: no group merge
        await openInviteButton(page).click();
        await box.fill(`${e2},\n${e3}`);
        await pickOption(page, role, ROLE.engineer);
        await expect.soft(page.getByText(T.validChip(2), { exact: true })).toBeVisible();
        const post = nextResponse(page, 'POST', re(INVITATIONS), [201]);
        const list = nextListRead(page);
        await inviteSubmit(page).click();
        expect((await post).response.request().postDataJSON()).toEqual({ emails: [e2, e3], role: 'engineer' });
        await list;
        successes += 1;
        await expect.soft(userRow(page, e2)).toContainText(ROLE.engineer);
        await expect.soft(userRow(page, e3)).toContainText(STATUS.pending);
        await expect.soft(toast(page, T.invitedTitle)).toContainText(`${e2}, ${e3}`);
        await ev(page, '37W-A-003');
      });
      const upper = e4.toUpperCase();
      await test.step('[37W-A-004] doi vai khong xoa o email', async () => {
        await openInviteButton(page).click();
        await box.fill(`${e4}\n${upper}`);
        await pickOption(page, role, ROLE.admin);
        await pickOption(page, role, ROLE.viewer);
        await expect.soft(box).toHaveValue(`${e4}\n${upper}`);
        await ev(page, '37W-A-004');
      });
      await test.step('[37W-C-005] bien the hoa', async () => {
        await expect.soft(page.getByText(T.validChip(1), { exact: true }), 'N4: one address differing only by case should count once').toBeVisible();
        const post = nextResponse(page, 'POST', re(INVITATIONS), [201]);
        const list = nextListRead(page);
        await inviteSubmit(page).click();
        const sent = await post;
        expect.soft((sent.response.request().postDataJSON() as { role: string }).role, 'A-004: last chosen role').toBe('viewer');
        await list;
        successes += 1;
        await expect.soft(userRow(page, e4)).toHaveCount(1);
        await expect.soft(toast(page, T.invitedTitle)).not.toContainText(upper);
        await ev(page, '37W-C-005');
      });
      await test.step('[37W-C-008] moi lai e1 dang pending', async () => {
        const before = asList(((await (await x.e.api.get(USERS)).json()) as { users: unknown }).users).length;
        await openInviteButton(page).click();
        await box.fill(e1);
        const post = nextResponse(page, 'POST', re(INVITATIONS), [200, 201]);
        const list = nextListRead(page);
        await inviteSubmit(page).click();
        await post;
        await list;
        successes += 1;
        const after = asList(((await (await x.e.api.get(USERS)).json()) as { users: unknown }).users).length;
        expect.soft(after, 'total users unchanged').toBe(before);
        await expect.soft(userRow(page, e1)).toHaveCount(1);
        await ev(page, '37W-C-008');
      });
      await test.step('[37W-B-006] han con: Gui lai', async () => {
        await expect.soft(userRow(page, e1).getByRole('button', { name: new RegExp(T.resend) }), 'N3: an unexpired invite should offer "Gửi lại"').toHaveCount(1);
        await ev(page, '37W-B-006');
      });
      await test.step('[37W-C-007] moi email cua PU6', async () => {
        await openInviteButton(page).click();
        await box.fill(pu6.email);
        const post = nextResponse(page, 'POST', re(INVITATIONS), [422]);
        await inviteSubmit(page).click();
        await post;
        await expect.soft(toast(page, T.inviteFailedTitle)).toBeVisible();
        await expect.soft(box).toHaveValue(pu6.email);
        await expect.soft(userRow(page, pu6.email)).toHaveCount(0);
        await expect.soft(box, 'N5: error attached to the email field').toHaveAttribute('aria-invalid', 'true');
        await ev(page, '37W-C-007');
      });
      await test.step('[37W-G-016] moi lan ghi thanh cong lam moi dung 1 lan', async () => {
        expect.soft(rec.listReads(), '1 initial read + 1 per successful write').toBe(1 + successes);
        await ev(page, '37W-G-016');
      });
      rec.stop();
    } finally {
      await context.close();
      for (const email of [e1, e2, e3, e4]) {
        const id = await findUserId(x.e.api, email);
        if (id) await deleteUser(x.e.api, id, email);
      }
      await x.dispose();
    }
  });

  test('SCR-37 · FL-37W-03 · Người được mời: gửi lại, vô hiệu→bật lại, tham chiếu cũ (404)', async ({ browser }) => {
    test.setTimeout(300_000);
    const x = await env();
    const pu10 = await x.fill('engineer', 'p08-eng'); // active, read only (resend must 422)
    const e5 = testEmail('users_write');
    const { context, page } = await sessionOf(browser, x.e.adm);
    let id5 = '';
    try {
      await page.clock.install();
      const invited = await inviteApi(x.e.api, e5, 'viewer'); // 1 invite (UI invite covered by FL-37W-02)
      id5 = str(invited, 'id');
      const expiresAt = Date.parse(str(invited, 'inviteExpiresAt')) || Date.now() + 8 * 86_400_000;
      await page.clock.setFixedTime(new Date(expiresAt + 60_000)); // verified: nowMs = gateway.now = Date.now (userManagementGateway.ts:458, useUserManagement.ts:471,573), so a fixed Date is enough
      await openUsers(page);
      await search(page, e5);
      const row = userRow(page, e5);
      let accName = '';
      await test.step('[37W-A-007] het han -> Gui lai', async () => {
        await expect(row).toContainText(T.expired);
        const link = row.getByRole('button', { name: new RegExp(T.resend) });
        accName = (await link.getAttribute('aria-label')) ?? (await link.innerText());
        const post = nextResponse(page, 'POST', re(`${INVITATIONS}/${id5}/resend`), [200]);
        await link.click();
        await post;
        await expect(toast(page, T.resentTitle)).toContainText(e5);
        await ev(page, '37W-A-007');
      });
      await test.step('[37W-E-010] ten truy cap Gui lai neu nguoi nhan', async () => {
        expect.soft(accName, 'N7: resend link names its recipient').toContain(e5);
        await ev(page, '37W-E-010');
      });
      await test.step('[37W-G-012] resend nguoi active -> 422', async () => {
        // UNKNOWN — NEED VERIFICATION: an active row has no resend control, so the 422 is taken by API (toast has no UI path).
        const res = await x.e.api.post(`${INVITATIONS}/${pu10.id}/resend`);
        expect.soft(res.status()).toBe(422);
        expect.soft(JSON.stringify(await res.json())).toContain('USER_NOT_PENDING');
        await ev(page, '37W-G-012');
      });
      await test.step('[37W-A-015] vo hieu roi bat lai nguoi duoc moi', async () => {
        await row.getByRole('button', { name: T.disable, exact: true }).click();
        await expect(row.getByRole('button', { name: T.enable, exact: true })).toBeVisible();
        await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        await row.getByRole('button', { name: T.enable, exact: true }).click();
        await expect.soft(toast(page, T.enabledTitle)).toBeVisible();
        await expect.soft(row).toContainText(STATUS.pending);
        await expect.soft(row).not.toContainText(STATUS.active);
        await ev(page, '37W-A-015');
      });
      await test.step('[37W-G-008] doi vai tren hang da bi xoa -> 404', async () => {
        await deleteUser(x.e.api, id5, e5); // background delete, row stays in the stale list
        await expect(page.getByRole('status')).toHaveCount(0, { timeout: 20_000 });
        const select = row.getByRole('combobox');
        const post = nextResponse(page, 'PATCH', re(`${USERS}/${id5}/role`), [404]);
        await pickOption(page, select, ROLE.engineer);
        await post;
        await expect.soft(toast(page, T.roleFailed)).toContainText(T.notFoundDesc);
        await expect.soft(select).toContainText(ROLE.viewer);
        await ev(page, '37W-G-008');
      });
    } finally {
      await context.close();
      if (id5) await deleteUser(x.e.api, id5, e5);
      await x.dispose();
    }
  });

  test('SCR-37 · FL-37W-04 · Người dùng pool: đổi vai, hoàn tác, bàn phím, vô hiệu, bật lại', async ({ browser }) => {
    test.setTimeout(480_000);
    const x = await env();
    const r = test.info().retry;
    const pu1 = await x.fill('engineer', slot('p08-37W-1', r));
    const pu2 = await x.fill('engineer', slot('p08-37W-2', r));
    const pu3 = await x.fill('engineer', slot('p08-37W-3', r));
    const { context, page } = await sessionOf(browser, x.e.adm);
    const calm = (): Promise<void> => expect(page.getByRole('status')).toHaveCount(0, { timeout: 20_000 }); // no toast group merge
    try {
      await openUsers(page);
      const rec = recordWrites(page);
      const rowOf = (u: PoolUser) => userRow(page, u.email);
      const sel = (u: PoolUser) => rowOf(u).getByRole('combobox', { name: `Vai của ${u.name}`, exact: true });
      await search(page, 'pool');
      await test.step('[37W-E-005] combobox Vai cua ten', async () => {
        await expect(sel(pu1)).toBeVisible();
        await ev(page, '37W-E-005');
      });
      let roleRes: Awaited<ReturnType<typeof nextResponse>> | undefined;
      await test.step('[37W-A-008] Ky su -> Nguoi xem', async () => {
        const patch = nextResponse(page, 'PATCH', re(`${USERS}/${pu1.id}/role`), [200]);
        await pickOption(page, sel(pu1), ROLE.viewer);
        const res = await patch;
        expect(res.response.request().postDataJSON()).toEqual({ role: 'viewer', userId: pu1.id });
        await expect(toast(page, T.roleChanged)).toContainText(T.toViewerLost);
        await ev(page, '37W-A-008');
        roleRes = res;
      });
      await test.step('[37W-C-017] than {role,userId}', async () => {
        expect.soft(roleRes?.response.url()).toContain(`/users/${pu1.id}/role`);
        await ev(page, '37W-C-017');
      });
      await test.step('[37W-G-006] 200 tra viewer', async () => {
        expect.soft((roleRes?.json as { role?: string } | undefined)?.role).toBe('viewer');
        await expect.soft(sel(pu1)).toContainText(ROLE.viewer);
        await ev(page, '37W-G-006');
      });
      await test.step('[37W-E-009] Hoan tac toi duoc bang Tab', async () => {
        const undo = page.getByRole('status').getByRole('button', { name: T.undo });
        // Toast.tsx:80-90 hover/focus holds the undo window (holdUndoWindows, undoTicket.ts:57; window UNDO_WINDOW_MS 8000, undoTicket.ts:18),
        // so the Tab count below does not race the 8 s timer.
        await toast(page, T.roleChanged).hover();
        let reached = false;
        for (let i = 0; i < 40 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await undo.evaluate((el) => el === document.activeElement).catch(() => false);
        }
        expect.soft(reached, 'undo reachable by Tab (window held while hovered)').toBe(true);
        await ev(page, '37W-E-009');
      });
      await test.step('[37W-A-009] bam Hoan tac', async () => {
        const patch = nextResponse(page, 'PATCH', re(`${USERS}/${pu1.id}/role`), [200]);
        await page.getByRole('status').getByRole('button', { name: T.undo }).click();
        expect((await patch).response.request().postDataJSON()).toEqual({ role: 'engineer', userId: pu1.id });
        await expect.soft(sel(pu1)).toContainText(ROLE.engineer);
        await expect.soft(page.getByRole('status')).toHaveCount(0); // no second toast (undo must not announce again)
        await ev(page, '37W-A-009');
      });
      await test.step('[37W-A-011] chon lai vai hien tai', async () => {
        const before = rec.writes().length;
        await pickOption(page, sel(pu1), ROLE.engineer);
        await expect(page.getByRole('option')).toHaveCount(0); // list closed: marker that the pick finished
        expect.soft(rec.writes().length).toBe(before);
        await expect.soft(page.getByRole('status')).toHaveCount(0);
        await ev(page, '37W-A-011');
      });
      await test.step('[37W-E-006] doi vai bang ban phim', async () => {
        await calm();
        const before = rec.writes().filter((w) => w.startsWith('PATCH')).length;
        await sel(pu2).focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        await page.getByRole('option', { name: ROLE.admin, exact: true }).focus();
        const patch = nextResponse(page, 'PATCH', re(`${USERS}/${pu2.id}/role`), [200]);
        await page.keyboard.press('Enter');
        expect((await patch).response.request().postDataJSON()).toEqual({ role: 'admin', userId: pu2.id });
        expect.soft(rec.writes().filter((w) => w.startsWith('PATCH')).length - before).toBe(1);
        await ev(page, '37W-E-006');
      });
      await test.step('[37W-A-010] toast len Quan tri', async () => {
        await expect.soft(toast(page, T.roleChanged)).toContainText(T.toAdmin);
        await ev(page, '37W-A-010');
        await calm();
        await patchRole(x.e.api, pu2.id, 'engineer'); // restore now (finally also restores)
      });
      await test.step('[37W-A-012] vo hieu hoa PU3', async () => {
        await page.reload();
        await search(page, pu3.email);
        const post = nextResponse(page, 'POST', re(`${USERS}/${pu3.id}/disable`), [200]);
        await rowOf(pu3).getByRole('button', { name: T.disable, exact: true }).click();
        await post;
        await expect.soft(rowOf(pu3)).toContainText(STATUS.disabled);
        await expect.soft(rowOf(pu3).getByRole('button', { name: T.enable, exact: true })).toBeVisible();
        await expect.soft(toast(page, T.disabledTitle)).toBeVisible();
        await ev(page, '37W-A-012');
      });
      await test.step('[37W-A-013] bat lai', async () => {
        await calm();
        const post = nextResponse(page, 'POST', re(`${USERS}/${pu3.id}/enable`), [200]);
        await rowOf(pu3).getByRole('button', { name: T.enable, exact: true }).click();
        await post;
        await expect.soft(rowOf(pu3)).toContainText(STATUS.active);
        await expect.soft(toast(page, T.enabledTitle)).toBeVisible();
        await ev(page, '37W-A-013');
      });
      await test.step('[37W-A-014] vo hieu roi Hoan tac', async () => {
        await calm();
        await rowOf(pu3).getByRole('button', { name: T.disable, exact: true }).click();
        await expect(toast(page, T.disabledTitle)).toBeVisible();
        const post = nextResponse(page, 'POST', re(`${USERS}/${pu3.id}/enable`), [200]);
        await page.getByRole('status').getByRole('button', { name: T.undo }).click();
        await post;
        await expect.soft(rowOf(pu3)).toContainText(STATUS.active);
        await expect.soft(page.getByRole('status')).toHaveCount(0);
        await ev(page, '37W-A-014');
      });
      rec.stop();
    } finally {
      await context.close();
      await patchRole(x.e.api, pu1.id, 'engineer');
      await patchRole(x.e.api, pu2.id, 'engineer');
      await enableApi(x.e.api, pu3.id);
      await x.dispose();
    }
  });

  test('SCR-37 · FL-37W-05 · Xoá hẳn: từ hàng và từ panel chi tiết', async ({ browser }) => {
    test.setTimeout(420_000);
    const x = await env();
    const pu5 = await x.fill('engineer', slot('p08-37W-5', test.info().retry));
    const r1 = testEmail('users_write');
    const r2 = testEmail('users_write');
    const { context, page } = await sessionOf(browser, x.e.adm);
    const created: Array<{ id: string; email: string }> = [];
    let projectId = '';
    try {
      const project = await createProject(x.e.api, 'users_write', 0);
      projectId = project.projectId;
      await addProjectMember(x.e.api, projectId, pu5.email);
      const a = await inviteApi(x.e.api, r1, 'viewer');
      const b = await inviteApi(x.e.api, r2, 'viewer');
      created.push({ id: str(a, 'id'), email: r1 }, { id: str(b, 'id'), email: r2 });
      const nameA = str(a, 'name');
      await openUsers(page);
      await search(page, r1);
      const row = userRow(page, r1);
      const dialog = page.getByRole('dialog', { name: `Xoá hẳn ${nameA}?`, exact: true }); // UMD:254
      const input = dialog.getByLabel(T.removeEmailLabel, { exact: true });
      const confirm = dialog.getByRole('button', { name: T.removeConfirm, exact: true });
      const removeBtn = row.getByRole('button', { name: T.remove, exact: true });
      const rec = recordWrites(page);
      let delBody: unknown;
      await test.step('[37W-A-016] hop xoa tu hang', async () => {
        await removeBtn.click();
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(T.removeWarning);
        await expect(dialog).toContainText(`Gõ lại ${r1} để xác nhận.`);
        await expect(confirm).toBeDisabled();
        await ev(page, '37W-A-016');
      });
      await test.step('[37W-E-007] dialog, focus, Esc', async () => {
        expect.soft(await dialog.evaluate((el) => el.contains(document.activeElement)), 'focus is inside the dialog').toBe(true);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.soft(removeBtn).toBeFocused();
        await ev(page, '37W-E-007');
      });
      await test.step('[37W-A-017] go sai, De sau', async () => {
        await removeBtn.click();
        await input.fill(`x${r1}`);
        await expect.soft(confirm).toBeDisabled();
        await dialog.getByRole('button', { name: T.removeLater, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await removeBtn.click();
        await expect.soft(input).toHaveValue('');
        expect.soft(rec.writes().filter((w) => w.startsWith('DELETE'))).toEqual([]);
        await ev(page, '37W-A-017');
      });
      await test.step('[37W-C-016] HOA co khoang trang', async () => {
        await input.fill(`  ${r1.toUpperCase()} `);
        await expect.soft(confirm).toBeEnabled();
        await ev(page, '37W-C-016');
      });
      let delRes: Awaited<ReturnType<typeof nextResponse>> | undefined;
      await test.step('[37W-A-018] xac nhan xoa', async () => {
        const del = nextResponse(page, 'DELETE', re(`${USERS}/${created[0]?.id ?? ''}`), [200, 422]);
        await confirm.click();
        delRes = await del;
        delBody = delRes.response.request().postDataJSON();
        expect(delRes.response.status()).toBe(200);
        await expect(dialog).toHaveCount(0);
        await expect(row).toHaveCount(0);
        await expect.soft(toast(page, T.removedTitle)).toContainText(r1);
        await expect.soft(page.getByRole('status').getByRole('button', { name: T.undo })).toHaveCount(0);
        await ev(page, '37W-A-018');
      });
      await test.step('[37W-G-013] than DELETE', async () => {
        expect.soft(delBody).toEqual({ userId: created[0]?.id, confirmEmail: r1.toUpperCase() }); // N9: FE trims, keeps case; BE must accept (200 above)
        expect.soft(delRes?.response.status()).toBe(200);
        await ev(page, '37W-G-013');
      });
      await test.step('[37W-E-008] sau xoa focus khong roi body', async () => {
        await lastFocusNotBody(page);
        await ev(page, '37W-E-008');
      });
      await test.step('[37W-C-018] panel PU5: vai trong du an', async () => {
        await search(page, pu5.email);
        await page.getByRole('button', { name: pu5.name, exact: true }).click();
        const aside = detailAside(page);
        await expect(aside).toBeVisible();
        const section = aside.getByRole('region', { name: 'Dự án tham gia' });
        await expect.soft(section).toContainText(project.name);
        await expect.soft(section).toContainText(T.membershipBlocked);
        await expect.soft(section.getByRole('combobox')).toHaveCount(0);
        await ev(page, '37W-C-018');
      });
      await test.step('[37W-A-019] xoa tu panel', async () => {
        await search(page, r2);
        const nameB = str(b, 'name');
        await page.getByRole('button', { name: nameB, exact: true }).click();
        const aside = detailAside(page);
        await expect(aside).toBeVisible();
        await aside.getByRole('region', { name: T.removeSection }).getByRole('button', { name: T.remove, exact: true }).click();
        const dlg = page.getByRole('dialog', { name: `Xoá hẳn ${nameB}?`, exact: true });
        await dlg.getByLabel(T.removeEmailLabel, { exact: true }).fill(r2);
        const del = nextResponse(page, 'DELETE', re(`${USERS}/${created[1]?.id ?? ''}`), [200]);
        await dlg.getByRole('button', { name: T.removeConfirm, exact: true }).click();
        await del;
        await expect(dlg).toHaveCount(0);
        await expect.soft(detailAside(page)).toHaveCount(0);
        await ev(page, '37W-A-019');
      });
      await test.step('[37W-A-020] hang r2 mat, focus khong roi body', async () => {
        await expect.soft(userRow(page, r2)).toHaveCount(0);
        await lastFocusNotBody(page);
        await ev(page, '37W-A-020');
      });
      rec.stop();
    } finally {
      await context.close();
      for (const c of created) await deleteUser(x.e.api, c.id, c.email);
      if (projectId) {
        expect(await removeProjectMember(x.e.api, projectId, pu5.id), 'cleanup member').toBeNull();
        await deleteSeededProject(x.e.api, projectId);
      }
      await x.dispose();
    }
  });

  test('SCR-37 · FL-37W-06 · Vai và chặn tự sửa chính mình', async ({ browser }) => {
    test.setTimeout(240_000);
    const x = await env();
    const pu7 = await x.fill('engineer', 'p08-eng'); // read only, shared
    const pu8 = await x.fill('viewer', 'p08-view'); // read only, shared
    const { context, page } = await sessionOf(browser, x.e.adm);
    try {
      await openUsers(page);
      const own = userRow(page, x.e.adm.email);
      await test.step('[37W-D-001] quan tri thay dieu khien ghi', async () => {
        await search(page, pu8.email);
        const other = userRow(page, pu8.email);
        await expect(openInviteButton(page)).toBeVisible();
        await expect(other.getByRole('combobox', { name: `Vai của ${pu8.name}`, exact: true })).toBeVisible();
        await expect(other.getByRole('button', { name: T.disable, exact: true })).toBeVisible();
        await expect(other.getByRole('button', { name: T.remove, exact: true })).toBeVisible();
        await ev(page, '37W-D-001');
      });
      await test.step('[37W-C-013] hang cua minh khong co nut Xoa', async () => {
        await search(page, x.e.adm.email);
        await expect(own).toBeVisible();
        await expect.soft(own.getByRole('button', { name: T.remove, exact: true }), 'N1: own row must not offer "Xoá"').toHaveCount(0);
        // useUserManagement.ts:337 only blocks the last admin: no self-delete copy exists, so correct = no "Xoá" and a visible reason text in the actions cell
        await expect.soft(own.getByRole('cell').last(), 'N1: own actions cell states why it cannot be deleted').toContainText(/xoá/iu);
        await ev(page, '37W-C-013');
      });
      await test.step('[37W-C-014] panel hang minh', async () => {
        await page.getByRole('button', { name: x.e.adm.name, exact: true }).click(); // UMB:305
        const aside = detailAside(page);
        await expect(aside).toBeVisible();
        const btn = aside.getByRole('region', { name: T.removeSection }).getByRole('button', { name: T.remove, exact: true });
        await expect.poll(async () => (await btn.count()) === 0 || (await btn.isDisabled()), { message: 'N2: own panel has no usable "Xoá"' }).toBe(true);
        await ev(page, '37W-C-014');
      });
      const blocked = async (who: PoolUser, id: string): Promise<void> => {
        const s = await sessionOf(browser, who);
        const rec = recordWrites(s.page);
        let usersRead = false;
        s.page.on('request', (req) => {
          if (req.method() === 'GET' && new URL(req.url()).pathname === USERS) usersRead = true;
        });
        try {
          await s.page.goto('/admin/users');
          await expect.soft(s.page.getByText(T.forbidden, { exact: true })).toBeVisible();
          expect.soft(usersRead, 'no GET /api/users').toBe(false);
          await expect.soft(openInviteButton(s.page)).toHaveCount(0);
          expect.soft(rec.writes(), 'no write').toEqual([]);
          await ev(s.page, id);
        } finally {
          rec.stop();
          await s.context.close();
        }
      };
      await test.step('[37W-D-002] ky su: khong quan ly duoc', async () => blocked(pu7, '37W-D-002'));
      await test.step('[37W-D-003] nguoi xem: nhu D-002', async () => blocked(pu8, '37W-D-003'));
    } finally {
      await context.close();
      await x.dispose();
    }
  });
});

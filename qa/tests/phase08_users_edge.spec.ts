/**
 * Phase 08 · SCR-37 `/admin/users` (read side) · real stack, 1440 (FL-37U-05 last step 768). Flows: QA-08 flows-C4 FL-37U-01..06.
 *
 * Request budget (one run, no retry):
 * - Invitations (`users_invite` 30 / 3600 s per admin): sent ONLY by the file's own admin pool user `p08-37U-adm` (S2 decision 2):
 *   FL-01 1, FL-02 1, FL-05 1 = 3 per run (+3 per retry). Shared read-only users `p08-eng` / `p08-view` come from the pool (first fill
 *   of a slot = 1 invitation from the admin seed, once).
 * - Logins: admin seed UI 1 in each of FL-01, 02, 03, 05, 06 (5) + pool admin API 1 per test (6) + pool engineer/viewer in FL-04 (2)
 *   => ~13 logins (LOGIN_IP_LIMIT 120 / 60 s); refresh: 1 per page load.
 * - Reads only elsewhere; no project is deleted for good (FL-02 projects removed in `finally`).
 */
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { signInAdmin } from './support/auth';
import { addProjectMember, deleteSeededProject, createProject, signInPoolUser, type PoolUser } from './support/p08/pool';
import { BREADCRUMB_NAV, DESKTOP, MODAL, ROUTES, dialog, panel } from './support/p08/admin';
import {
  ALL_CELLS,
  MATRIX,
  ROLE_LABEL,
  STATUS_LABEL,
  TIMESTAMP_RE,
  USR,
  asList,
  asRecord,
  cellSr,
  figure,
  summaryNumbers,
  foldForSearch,
  inviteUser,
  listUsersApi,
  nameButton,
  pickOption,
  recordGets,
  removeUser,
  seed37U,
  str,
  summary,
  sweepMails,
  userRow,
  waitGet,
  type Json,
} from './support/p08/P9';

test.use({ viewport: DESKTOP });

const USERS_PATH = '/api/users';

/** Admin seed UI session on the users screen: sign in, optional clock before goto, then the real list read. */
async function openUsers(page: Page, beforeGoto?: () => Promise<void>): Promise<Json[]> {
  await signInAdmin(page);
  if (beforeGoto !== undefined) await beforeGoto();
  const list = waitGet(page, USERS_PATH);
  await page.goto(ROUTES.users);
  const users = asList(asRecord(await list, 'GET /api/users').users, 'users');
  await expect(page.getByLabel(USR.search, { exact: true })).toBeVisible();
  return users;
}

async function denied(browser: Browser, user: PoolUser): Promise<{ page: Page; gets: ReturnType<typeof recordGets>; close: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  const page = await context.newPage();
  await signInPoolUser(context, user);
  const gets = recordGets(page);
  return { page, gets, close: () => context.close() };
}

/** Removes the invitee + its mails and disposes the seed; every step is guarded so one failure never skips the next. */
async function cleanupInvitee(s: Awaited<ReturnType<typeof seed37U>>, id: string | undefined, email: string): Promise<void> {
  try {
    const failed = id === undefined ? null : await removeUser(s.admApi, id, email);
    if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: `removeUser: ${String(error)}` });
  }
  try {
    await sweepMails(email);
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: `sweepMails: ${String(error)}` });
  }
  await s.dispose();
}

test.describe('SCR-37 users (read) edge', () => {
  test('SCR-37 · FL-37U-01 · Danh sách: cột, hàng, thứ tự, tìm kiếm, bộ lọc, tổng kết', async ({ page }) => {
    test.setTimeout(180_000);
    const s = await seed37U();
    const invEmail = testEmail('users-pend');
    let invitedId: string | undefined;
    try {
      const inv = await inviteUser(s.admApi, invEmail);
      invitedId = String(inv.id);
      const users = await openUsers(page);
      const peRow = userRow(page, s.pe.email);
      const peJson = users.find((u) => u.id === s.pe.id);
      const rows = page.locator('tbody tr');
      const search = page.getByLabel(USR.search, { exact: true });
      const roleBox = page.getByRole('combobox', { name: USR.role, exact: true });
      const statusBox = page.getByRole('combobox', { name: USR.status, exact: true });
      let summaryBefore: string[] = [];

      await test.step('[37U-A-002] breadcrumb Quản trị › Người dùng, một aria-current', async () => {
        const nav = page.getByRole('navigation', { name: BREADCRUMB_NAV });
        await expect(nav).toContainText('Quản trị');
        await expect(nav).toContainText('Người dùng');
        // UM:60-67 gives aria-current to every item without href (both) — correct: only the last.
        await expect(nav.locator('[aria-current="page"]'), 'exactly one aria-current="page"').toHaveCount(1);
        await captureEvidence(page, 'E08_37U-A-002_users.png');
      });
      await test.step('[37U-A-003] header row: 6 columns', async () => {
        await expect.soft(page.getByRole('columnheader')).toHaveText(['Người dùng', 'Vai', 'Số dự án', 'Lần hoạt động cuối', 'Trạng thái', 'Hành động']);
        await captureEvidence(page, 'E08_37U-A-003_users.png');
      });
      await test.step('[37U-A-004] PE row equals GET /api/users', async () => {
        expect(peJson, 'environment: PE (p08-eng) is in GET /api/users').toBeDefined();
        await expect.soft(peRow).toContainText(s.pe.name);
        await expect.soft(peRow).toContainText(s.pe.email);
        await expect.soft(peRow).toContainText(ROLE_LABEL.engineer);
        await expect.soft(peRow).toContainText(String(peJson?.projectCount ?? ''));
        await expect.soft(peRow).toContainText(STATUS_LABEL.active);
        await captureEvidence(page, 'E08_37U-A-004_users.png');
      });
      await test.step('[37U-A-005] row order = users[] order', async () => {
        await expect.soft(rows).toHaveCount(users.length);
        for (const [i, u] of users.entries()) await expect.soft(rows.nth(i), `row ${String(i)} = ${str(u, 'email')}`).toContainText(str(u, 'email'));
        await captureEvidence(page, 'E08_37U-A-005_users.png');
      });
      await test.step('[37U-C-001] summary "Người dùng" = users.length', async () => {
        await expect.soft(figure(summary(page), USR.summaryUsers)).toHaveText(String(users.length));
        await captureEvidence(page, 'E08_37U-C-001_users.png');
      });
      await test.step('[37U-C-002] summary "Quản trị" = active admins', async () => {
        const admins = users.filter((u) => u.role === 'admin' && u.status === 'active').length;
        await expect.soft(figure(summary(page), USR.summaryAdmins)).toHaveText(String(admins));
        await captureEvidence(page, 'E08_37U-C-002_users.png');
      });
      await test.step('[37U-C-003] summary "Lời mời đang chờ" = pending (>= 1)', async () => {
        const pending = users.filter((u) => u.status === 'pending').length;
        expect(pending, 'INV is pending').toBeGreaterThanOrEqual(1);
        await expect.soft(figure(summary(page), USR.summaryPending)).toHaveText(String(pending));
        summaryBefore = await summaryNumbers(summary(page)).allInnerTexts();
        await captureEvidence(page, 'E08_37U-C-003_users.png');
      });
      await test.step('[37U-B-011] INV row shows "Chờ chấp nhận"', async () => {
        await expect.soft(userRow(page, invEmail)).toContainText(STATUS_LABEL.pending);
        await captureEvidence(page, 'E08_37U-B-011_users.png');
      });
      await test.step('[37U-A-009] upper-case email search keeps PE only', async () => {
        const needle = s.pe.email.toUpperCase();
        await search.fill(needle);
        await expect.soft(peRow).toBeVisible();
        await expect.soft(rows).toHaveCount(users.filter((u) => str(u, 'email').toLowerCase().includes(needle.toLowerCase())).length);
        await captureEvidence(page, 'E08_37U-A-009_users.png');
      });
      await test.step('[37U-A-010] folded name + spaces finds PE; blank search = all rows', async () => {
        await search.fill(`  ${foldForSearch(s.pe.name)}  `);
        await expect.soft(peRow).toBeVisible();
        await captureEvidence(page, 'E08_37U-A-010_users.png');
        await search.fill('   ');
        await expect.soft(rows).toHaveCount(users.length);
      });
      await test.step('[37U-A-013] search + Vai + Trạng thái combine (AND)', async () => {
        await search.fill(s.pe.email);
        await pickOption(page, roleBox, ROLE_LABEL.engineer);
        await pickOption(page, statusBox, STATUS_LABEL.active);
        const expected = users.filter((u) => str(u, 'email').includes(s.pe.email) && u.role === 'engineer' && u.status === 'active').length;
        await expect.soft(rows).toHaveCount(expected);
        await expect.soft(peRow).toBeVisible();
        await captureEvidence(page, 'E08_37U-A-013_users.png');
      });
      await test.step('[37U-C-004] summary unchanged by filtering', async () => {
        expect.soft(await summaryNumbers(summary(page)).allInnerTexts()).toEqual(summaryBefore);
        await captureEvidence(page, 'E08_37U-C-004_users.png');
      });
      await test.step('[37U-A-014] no match → empty state; "Xoá tìm kiếm và bộ lọc" resets and focuses search', async () => {
        await search.fill('zzz-khong-ai-khop-qa08');
        await expect.soft(page.getByText(USR.noMatchTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(USR.noMatchBody, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37U-A-014_users.png');
        await page.getByRole('button', { name: USR.clearSearch, exact: true }).click();
        await expect.soft(search).toHaveValue('');
        await expect.soft(roleBox).toContainText('Tất cả');
        await expect.soft(statusBox).toContainText('Tất cả');
        await expect.soft(search).toBeFocused();
      });
      await test.step('[37U-C-012] PE row: no blocked reason, "Vô hiệu hoá" and "Xoá" visible', async () => {
        await expect.soft(peRow).not.toContainText(USR.lastAdmin);
        await expect.soft(peRow.getByRole('button', { name: USR.disable, exact: true })).toBeVisible();
        await expect.soft(peRow.getByRole('button', { name: USR.remove, exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37U-C-012_users.png');
      });
    } finally {
      await cleanupInvitee(s, invitedId, invEmail);
    }
  });

  test('SCR-37 · FL-37U-02 · Chi tiết người dùng', async ({ page }) => {
    test.setTimeout(180_000);
    const s = await seed37U();
    const invEmail = testEmail('users-pend');
    let invitedId: string | undefined;
    const projects: string[] = [];
    try {
      const inv = await inviteUser(s.admApi, invEmail);
      invitedId = String(inv.id);
      const small = await createProject(s.admApi, '37u-02');
      projects.push(small.projectId);
      await addProjectMember(s.admApi, small.projectId, s.pe.email);
      const longName = `${TEST_DATA_PREFIX}37u-long-${'d'.repeat(80)}`.slice(0, 80);
      const created = await s.admApi.post('/api/projects', { data: { name: longName } });
      expect(created.status(), `setup: POST /api/projects (80 chars = BE NAME_MAX): ${(await created.text()).slice(0, 200)}`).toBe(201);
      const longId = String(asRecord(await created.json(), 'POST /api/projects').id);
      projects.push(longId);
      await addProjectMember(s.admApi, longId, s.pe.email);

      await openUsers(page);
      const peRow = userRow(page, s.pe.email);
      const invRow = userRow(page, invEmail);
      const admRow = userRow(page, s.adm.email);
      const aside = panel(page, USR.detail);
      const region = (name: string) => aside.getByRole('region', { name, exact: true });
      let peMemberCount = 0;
      const invName = (await nameButton(invRow).innerText()).split('\n')[0]?.trim() ?? '';

      await test.step('[37U-A-019] click PE name → profile panel', async () => {
        const memberships = waitGet(page, `${USERS_PATH}/${s.pe.id}/memberships`);
        const activity = waitGet(page, `${USERS_PATH}/${s.pe.id}/activity`);
        await nameButton(peRow).click();
        peMemberCount = asList(await memberships, 'memberships').length;
        await activity;
        await expect(aside).toBeVisible();
        await expect(aside.getByRole('heading', { name: s.pe.name, exact: true })).toBeVisible();
        await expect.soft(aside).toContainText(s.pe.email);
        await expect.soft(aside).toContainText(ROLE_LABEL.engineer);
        await expect.soft(aside).toContainText(STATUS_LABEL.active);
        await captureEvidence(page, 'E08_37U-A-019_users.png');
      });
      await test.step('[37U-A-020] "Dự án tham gia": names, blocked-role note, no select', async () => {
        await expect.soft(region(USR.memberships)).toContainText(small.name);
        // BUG-P08-021 (work.md:52, UserManagementDetail.tsx DetailMemberships): the note is said ONCE under the list, not on every card. RR: expected 2 (=cards), received 1.
        await expect.soft(region(USR.memberships).getByText(USR.membershipBlocked, { exact: true })).toHaveCount(peMemberCount > 0 ? 1 : 0);
        await expect.soft(region(USR.memberships).getByRole('combobox')).toHaveCount(0);
        await captureEvidence(page, 'E08_37U-A-020_users.png');
      });
      await test.step('[37U-A-022] "Hoạt động gần đây" of the inviting admin: kind label + timestamp', async () => {
        const activity = waitGet(page, `${USERS_PATH}/${s.adm.id}/activity`);
        await nameButton(admRow).click();
        await activity;
        await expect(aside.getByRole('heading', { name: s.adm.name, exact: true })).toBeVisible();
        const inviteItem = region(USR.activity).getByRole('listitem').filter({ hasText: invEmail }).first();
        await expect.soft(inviteItem).toContainText(USR.invitedKind);
        await expect.soft(inviteItem).toContainText(TIMESTAMP_RE);
        await captureEvidence(page, 'E08_37U-A-022_users.png');
      });
      await test.step('[37U-A-026] activity subject is text, not a link', async () => {
        await expect.soft(region(USR.activity).getByRole('listitem').filter({ hasText: invEmail }).locator('a')).toHaveCount(0);
        await captureEvidence(page, 'E08_37U-A-026_users.png');
      });
      await test.step('[37U-A-027] ⚑ subject label is not a raw usr_ ULID', async () => {
        const texts = await region(USR.activity).getByRole('listitem').filter({ hasText: invEmail }).allInnerTexts();
        expect(texts.length, 'the invitation item is listed').toBeGreaterThanOrEqual(1);
        for (const text of texts) expect.soft(text, 'BUG-084: raw usr_<ULID> shown').not.toMatch(/usr_[0-9A-Z]{20,}/u);
        await captureEvidence(page, 'E08_37U-A-027_users.png');
      });
      await test.step('[37U-A-028] "Xoá người dùng" section (not clicked)', async () => {
        await expect.soft(region(USR.removeSection)).toContainText(USR.removeSectionText);
        await expect.soft(region(USR.removeSection).getByRole('button', { name: USR.remove, exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37U-A-028_users.png');
      });
      await test.step('[37U-A-029] permission matrix at the bottom of the panel = PERM', async () => {
        await expect.soft(aside).toContainText(USR.matrixTitle);
        for (const line of ALL_CELLS) await expect.soft(aside.getByText(line, { exact: true }), line).toHaveCount(1);
        await captureEvidence(page, 'E08_37U-A-029_users.png');
      });
      await test.step('[37U-A-016] click INV while open → panel switches, aria-selected moves', async () => {
        await nameButton(invRow).click();
        await expect.soft(aside.getByRole('heading', { name: invName, exact: true })).toBeVisible();
        await expect.soft(invRow).toHaveAttribute('aria-selected', 'true');
        await expect.soft(admRow).not.toHaveAttribute('aria-selected', 'true');
        await expect.soft(peRow).not.toHaveAttribute('aria-selected', 'true');
        await captureEvidence(page, 'E08_37U-A-016_users.png');
      });
      await test.step('[37U-A-021] INV has no projects', async () => {
        await expect.soft(region(USR.memberships)).toContainText(USR.noMemberships);
        await captureEvidence(page, 'E08_37U-A-021_users.png');
      });
      await test.step('[37U-A-023] INV has no activity', async () => {
        await expect.soft(region(USR.activity)).toContainText(USR.noActivity);
        await captureEvidence(page, 'E08_37U-A-023_users.png');
      });
      await test.step('[37U-C-008] PE then INV in a row: panel holds INV data only', async () => {
        await nameButton(peRow).click();
        // cached by react-query (staleTime) → no request to wait for; auto-wait on the DOM instead.
        await nameButton(invRow).click();
        await expect.soft(aside.getByRole('heading', { name: invName, exact: true })).toBeVisible();
        await expect.soft(region(USR.memberships)).toContainText(USR.noMemberships);
        await expect.soft(region(USR.memberships)).not.toContainText(small.name);
        await expect.soft(region(USR.activity)).toContainText(USR.noActivity);
        await captureEvidence(page, 'E08_37U-C-008_users.png');
      });
      await test.step('[37U-C-007] filter Vai=Quản trị hides INV row, panel stays on INV', async () => {
        await pickOption(page, page.getByRole('combobox', { name: USR.role, exact: true }), ROLE_LABEL.admin);
        await expect.soft(invRow).toHaveCount(0);
        await expect.soft(aside.getByRole('heading', { name: invName, exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37U-C-007_users.png');
      });
      await test.step('[37U-A-017] "Đóng chi tiết người dùng" closes panel, table back to 6 columns', async () => {
        await aside.getByRole('button', { name: USR.closeDetail, exact: true }).click();
        await expect.soft(aside).toHaveCount(0);
        await expect.soft(page.getByRole('columnheader')).toHaveCount(6);
        await captureEvidence(page, 'E08_37U-A-017_users.png');
      });
      await test.step('[37U-C-006] ⚑ 80-char (BE max) project name readable (title = full name)', async () => {
        await pickOption(page, page.getByRole('combobox', { name: USR.role, exact: true }), 'Tất cả');
        await nameButton(peRow).click();
        await expect(aside).toBeVisible();
        const nameEl = region(USR.memberships).getByText(longName, { exact: true });
        await expect.soft(nameEl).toHaveCount(1);
        // UMD:147 only truncates, no title → red while the bug stays.
        await expect.soft(nameEl).toHaveAttribute('title', longName);
        await captureEvidence(page, 'E08_37U-C-006_users.png');
      });
    } finally {
      for (const id of projects) {
        try {
          await deleteSeededProject(s.admApi, id);
        } catch (error) {
          test.info().annotations.push({ type: 'cleanup', description: `project ${id}: ${String(error)}` });
        }
      }
      await cleanupInvitee(s, invitedId, invEmail);
    }
  });

  test('SCR-37 · FL-37U-03 · Hộp "Xem ma trận quyền"', async ({ page }) => {
    test.setTimeout(120_000);
    const s = await seed37U();
    try {
      await openUsers(page);
      const opener = page.getByRole('button', { name: USR.matrixButton, exact: true });
      const box = dialog(page, MODAL.permissionMatrix);
      await test.step('[37U-A-031] open the matrix dialog: 7 rows × 3 roles', async () => {
        await opener.click();
        await expect(box).toBeVisible();
        for (const row of MATRIX) await expect.soft(box.getByText(row.label, { exact: true }).first(), row.label).toBeVisible();
        for (const role of Object.values(ROLE_LABEL)) await expect.soft(box.getByText(role, { exact: true }).first(), role).toBeAttached();
        await captureEvidence(page, 'E08_37U-A-031_users.png');
      });
      await test.step('[37U-E-008] 21 sr-only cells = permissionMatrix', async () => {
        expect(ALL_CELLS).toHaveLength(21);
        for (const line of ALL_CELLS) await expect.soft(box.getByText(line, { exact: true }), line).toHaveCount(1);
        await captureEvidence(page, 'E08_37U-E-008_users.png');
      });
      await test.step('[37U-E-007] Tab stays in dialog; Esc closes; focus back on opener', async () => {
        for (let i = 0; i < 6; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await box.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(i + 1)} stays in the dialog`).toBe(true);
        }
        await captureEvidence(page, 'E08_37U-E-007_users.png');
        await page.keyboard.press('Escape');
        await expect.soft(box).toHaveCount(0);
        await expect.soft(opener).toBeFocused();
      });
      await test.step('[37U-A-032] close button and backdrop both close it', async () => {
        await opener.click();
        await expect(box).toBeVisible();
        await box.getByRole('button', { name: USR.matrixClose, exact: true }).click();
        await expect.soft(box).toHaveCount(0);
        await opener.click();
        await expect(box).toBeVisible();
        await page.mouse.click(4, 4);
        await expect.soft(box).toHaveCount(0);
        await captureEvidence(page, 'E08_37U-A-032_users.png');
      });
      await test.step('[37U-C-009] Esc with dialog over detail: dialog closes, panel stays', async () => {
        const peRow = userRow(page, s.pe.email);
        await nameButton(peRow).click();
        const aside = panel(page, USR.detail);
        await expect(aside).toBeVisible();
        await opener.click();
        await expect(box).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(box).toHaveCount(0);
        await expect.soft(aside).toBeVisible();
        await captureEvidence(page, 'E08_37U-C-009_users.png');
      });
    } finally {
      await s.dispose();
    }
  });

  test('SCR-37 · FL-37U-04 · Vai bị từ chối + anonymous', async ({ browser }) => {
    test.setTimeout(120_000);
    const s = await seed37U();
    const sessions: Array<() => Promise<void>> = [];
    try {
      const forbiddenOf = (page: Page) => page.getByText(USR.forbidden, { exact: true });
      const pn = await denied(browser, s.pe);
      sessions.push(pn.close);
      const page = pn.page;
      await test.step('[37U-D-006] anonymous → /login?next=%2Fadmin%2Fusers', async () => {
        const anon = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
        sessions.push(() => anon.close());
        const anonPage = await anon.newPage();
        await anonPage.goto(ROUTES.users);
        await expect(anonPage).toHaveURL(new RegExp(`${loginUrl(ROUTES.users).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u'));
        await captureEvidence(anonPage, 'E08_37U-D-006_users.png');
      });
      await test.step('[37U-D-002] engineer: forbidden alert + matrix + back link', async () => {
        await page.goto(ROUTES.users);
        await expect(forbiddenOf(page)).toBeVisible();
        await expect.soft(page.getByRole('link', { name: USR.backLabel, exact: true })).toBeVisible();
        await expect.soft(page.getByText(cellSr('engineer', 'Quản lý người dùng', false), { exact: true })).toHaveCount(1);
        await captureEvidence(page, 'E08_37U-D-002_users.png');
      });
      await test.step('[37U-D-003] engineer sent no GET /api/users', async () => {
        await page.waitForLoadState('networkidle');
        expect.soft(pn.gets.list()).toEqual([]);
        await captureEvidence(page, 'E08_37U-D-003_users.png');
      });
      await test.step('[37U-D-007] matrix inline: 7 rows = PERM, no dialog', async () => {
        for (const line of ALL_CELLS) await expect.soft(page.getByText(line, { exact: true }), line).toHaveCount(1);
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await captureEvidence(page, 'E08_37U-D-007_users.png');
      });
      await test.step('[37U-D-005] "Về bảng điều khiển" → / without a full reload', async () => {
        await page.evaluate(() => {
          (window as unknown as { __p08mark: number }).__p08mark = 1;
        });
        await page.getByRole('link', { name: USR.backLabel, exact: true }).click();
        await expect.poll(() => pathOf(page.url())).toBe('/');
        expect.soft(await page.evaluate(() => (window as unknown as { __p08mark?: number }).__p08mark), 'same document').toBe(1);
        await captureEvidence(page, 'E08_37U-D-005_users.png');
      });
      await test.step('[37U-D-004] viewer: same denied screen, 0 GET /api/users, no invite button', async () => {
        const pvSession = await denied(browser, s.pv);
        sessions.push(pvSession.close);
        await pvSession.page.goto(ROUTES.users);
        await expect(forbiddenOf(pvSession.page)).toBeVisible();
        await pvSession.page.waitForLoadState('networkidle');
        expect.soft(pvSession.gets.list()).toEqual([]);
        await expect.soft(pvSession.page.getByRole('button', { name: USR.invite, exact: true })).toHaveCount(0);
        await captureEvidence(pvSession.page, 'E08_37U-D-004_users.png');
      });
    } finally {
      for (const close of sessions) await close();
      await s.dispose();
    }
  });

  test('SCR-37 · FL-37U-05 · Đồng hồ (lời mời hết hạn, hoạt động cuối) và thu gọn 768', async ({ page }) => {
    test.setTimeout(150_000);
    const s = await seed37U();
    const invEmail = testEmail('users-pend');
    let invitedId: string | undefined;
    try {
      const inv = await inviteUser(s.admApi, invEmail);
      invitedId = String(inv.id);
      const expiresAt = Date.parse(str(inv, 'inviteExpiresAt'));
      expect(Number.isNaN(expiresAt), 'environment: the invitation has inviteExpiresAt').toBe(false);
      const invitedAt = Date.now();
      await openUsers(page, async () => {
        await page.clock.install();
        await page.clock.setFixedTime(new Date(invitedAt));
      });
      const invRow = userRow(page, invEmail);
      const peRow = userRow(page, s.pe.email);
      const lastActive = (row: typeof peRow) => row.getByRole('cell').nth(3);

      await test.step('[37U-B-013] clock right after invite: no "expired", but "Gửi lại" present (Q5)', async () => {
        await expect(invRow).toContainText(STATUS_LABEL.pending);
        await expect.soft(invRow).not.toContainText(USR.expired);
        // Q5 (questions.md, user answer 2026-10-16): resend on EVERY pending row; BUG-P08-024: aria-label "Gửi lại lời mời cho <email>" (UserManagementTable.tsx:125)
        await expect.soft(invRow.getByRole('button', { name: `${USR.resend} lời mời cho ${invEmail}`, exact: true })).toHaveCount(1);
        await captureEvidence(page, 'E08_37U-B-013_users.png');
      });
      await test.step('[37U-B-012] clock = expiry + 1 min: "Lời mời đã hết hạn" + "Gửi lại" (not clicked)', async () => {
        await page.clock.setFixedTime(new Date(expiresAt + 60_000));
        const list = waitGet(page, USERS_PATH);
        await page.reload();
        await list;
        await expect.soft(invRow).toContainText(STATUS_LABEL.pending);
        await expect.soft(invRow).toContainText(USR.expired);
        await expect.soft(invRow.getByRole('button', { name: `${USR.resend} lời mời cho ${invEmail}`, exact: true })).toBeVisible(); // Q5 + BUG-P08-024
        await captureEvidence(page, 'E08_37U-B-012_users.png');
      });
      await test.step('[37U-A-033] last activity: relative text + absolute tooltip; never active = "Chưa hoạt động lần nào"', async () => {
        const before = await lastActive(peRow).innerText();
        await page.clock.setFixedTime(new Date(expiresAt + 60_000 + 86_400_000));
        const list = waitGet(page, USERS_PATH);
        await page.reload();
        await list;
        const after = await lastActive(peRow).innerText();
        expect.soft(after.trim(), 'relative text present').not.toBe('');
        // types.ts:28-35: relative only under 1 h; older stamps are absolute 'dd/mm/yyyy hh:mm' and must NOT move with the clock.
        if (TIMESTAMP_RE.test(before)) expect.soft(after, 'absolute stamp (>1h) stays put').toBe(before);
        else if (!/Chưa hoạt động/u.test(before)) expect.soft(after, 'relative text moves with the clock (+1 day)').not.toBe(before);
        await lastActive(peRow).locator('span').first().hover();
        await expect.soft(page.getByRole('tooltip')).toContainText(TIMESTAMP_RE);
        await expect.soft(lastActive(userRow(page, invEmail))).toContainText(USR.never);
        await captureEvidence(page, 'E08_37U-A-033_users.png');
      });
      await test.step('[37U-C-010] 768: cards, Drawer opens and closes with Esc', async () => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await expect.soft(page.getByRole('table')).toHaveCount(0);
        const peButton = page.locator('button').filter({ hasText: s.pe.email }).first();
        await peButton.click();
        const drawer = page.getByRole('dialog').or(panel(page, USR.detail)).first();
        await expect(drawer).toBeVisible();
        await captureEvidence(page, 'E08_37U-C-010_users.png');
        await page.keyboard.press('Escape');
        await expect.soft(drawer).toHaveCount(0);
      });
    } finally {
      await cleanupInvitee(s, invitedId, invEmail);
    }
  });

  test('SCR-37 · FL-37U-06 · Bàn phím, a11y, số request, ngoại tuyến', async ({ page, context }) => {
    test.setTimeout(300_000); // Tab walk crosses ~700 stops on a 155-row list
    const s = await seed37U();
    try {
      await signInAdmin(page);
      const gets = recordGets(page);
      const list = waitGet(page, USERS_PATH);
      await page.goto(ROUTES.users);
      const users = asList(asRecord(await list, 'GET /api/users').users, 'users');
      const search = page.getByLabel(USR.search, { exact: true });
      await expect(search).toBeVisible();
      const peRow = userRow(page, s.pe.email);
      const aside = panel(page, USR.detail);
      const other = users.find((u) => u.id !== s.pe.id && u.id !== s.adm.id && str(u, 'status') !== 'pending') ?? users.find((u) => u.id !== s.pe.id);
      const otherEmail = other === undefined ? '' : str(other, 'email');

      await test.step('[37U-G-001] open: exactly 1 GET /api/users, 0 memberships, 0 activity', async () => {
        await page.waitForLoadState('networkidle');
        const seen = gets.list();
        expect(seen.filter((p) => p === USERS_PATH)).toHaveLength(1);
        expect(seen.filter((p) => p.endsWith('/memberships'))).toHaveLength(0);
        expect(seen.filter((p) => p.endsWith('/activity'))).toHaveLength(0);
        await captureEvidence(page, 'E08_37U-G-001_users.png');
      });
      await test.step('[37U-E-012] ⚑ exactly one h1', async () => {
        await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await captureEvidence(page, 'E08_37U-E-012_users.png');
      });
      await test.step('[37U-E-001] Tab order: search → Vai → Trạng thái → Mời → row name → role select → row button', async () => {
        await search.focus();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('combobox', { name: USR.role, exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('combobox', { name: USR.status, exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('button', { name: USR.invite, exact: true })).toBeFocused();
        const nameBtn = nameButton(peRow);
        let reached = false;
        const stops: string[] = [];
        const rowInfo = await page.locator('tbody tr').evaluateAll((rs, email) => ({ rows: rs.length, peIndex: rs.findIndex((r) => r.textContent?.includes(email)) }), s.pe.email);
        // D evidence E08_37U-E-001_tab_trace.json: rows=155, peIndex=140, 5 stops per row (name, role, last activity, Vô hiệu hoá, Xoá) => 140*5 > 40 stops = mechanics, loop was too short
        const maxStops = Math.max(40, (rowInfo.peIndex + 1) * 6 + 10);
        for (let i = 0; i < maxStops && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await nameBtn.evaluate((el) => el === document.activeElement);
          stops.push(await page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}|${a.getAttribute('aria-label') ?? ''}|${(a.textContent ?? '').trim().slice(0, 40)}` : 'none'; }));
        }
        // deciding value: peIndex x ~3 stops per row > 40 => mechanics (loop too short); else a real tab-order gap in `stops`
        await attachJson('E08_37U-E-001_tab_trace.json', { reached, ...rowInfo, stops });
        expect.soft(reached, 'a row name button is reached by Tab after "Mời người dùng"').toBe(true);
        await page.keyboard.press('Tab');
        await expect.soft(peRow.getByRole('combobox', { name: `Vai của ${s.pe.name}` })).toBeFocused();
        await page.keyboard.press('Tab');
        expect.soft(await peRow.evaluate((el) => el.contains(document.activeElement)), 'next stop is inside the row').toBe(true);
        await captureEvidence(page, 'E08_37U-E-001_users.png');
      });
      await test.step('[37U-E-002] accessible names', async () => {
        await expect.soft(page.getByLabel(USR.search, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('combobox', { name: USR.role, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('combobox', { name: USR.status, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('combobox', { name: `Vai của ${s.pe.name}` })).toBeAttached();
        await expect.soft(page.getByRole('columnheader', { name: 'Hành động' })).toBeAttached();
        await captureEvidence(page, 'E08_37U-E-002_users.png');
      });
      await test.step('[37U-E-003] table structure: table, 6 columnheader, name is a button', async () => {
        await expect.soft(page.getByRole('table')).toBeVisible();
        await expect.soft(page.getByRole('columnheader')).toHaveCount(6);
        await expect.soft(page.getByRole('button', { name: s.pe.name })).toBeVisible();
        await captureEvidence(page, 'E08_37U-E-003_users.png');
      });
      await test.step('[37U-E-004] role + status as text, not colour only', async () => {
        await expect.soft(peRow).toContainText(ROLE_LABEL.engineer);
        await expect.soft(peRow).toContainText(STATUS_LABEL.active);
        await captureEvidence(page, 'E08_37U-E-004_users.png');
      });
      await test.step('[37U-E-009] ⚑ "Lần hoạt động cuối" reachable by Tab, tooltip shows absolute time', async () => {
        // First span in the cell is the Tooltip wrapper (Tooltip.tsx:205, not focusable); the focusable one carries tabindex (RR tab trace: Tab stops on 'span||...').
        const target = peRow.getByRole('cell').nth(3).locator('span[tabindex="0"]');
        await peRow.getByRole('combobox', { name: `Vai của ${s.pe.name}` }).focus();
        let focused = false;
        for (let i = 0; i < 3 && !focused; i += 1) {
          await page.keyboard.press('Tab');
          focused = await target.evaluate((el) => el === document.activeElement);
        }
        // UMB:329-331: the span is not focusable → red while the bug stays.
        expect.soft(focused, 'the last-activity value takes keyboard focus').toBe(true);
        await expect.soft(page.getByRole('tooltip')).toContainText(TIMESTAMP_RE);
        await captureEvidence(page, 'E08_37U-E-009_users.png');
      });
      await test.step('[37U-E-006] Tab to PE name, Enter opens, Esc closes, focus back on the name button', async () => {
        const nameBtn = nameButton(peRow);
        // focus() instead of Tab: Tab order is covered by 37U-E-001.
        await nameBtn.focus();
        await expect(nameBtn).toBeFocused();
        const memberships = waitGet(page, `${USERS_PATH}/${s.pe.id}/memberships`);
        const activity = waitGet(page, `${USERS_PATH}/${s.pe.id}/activity`);
        await page.keyboard.press('Enter');
        await memberships;
        await activity;
        await expect.soft(aside).toBeVisible();
        await captureEvidence(page, 'E08_37U-E-006_users.png');
        await page.keyboard.press('Escape');
        await expect.soft(aside).toHaveCount(0);
        // UM:145-157 closes without moving focus back → red while the bug stays.
        await expect.soft(nameButton(peRow), 'focus returns to the PE name button').toBeFocused();
      });
      await test.step('[37U-G-002] Enter opened detail: one memberships + one activity read for PE id', async () => {
        const seen = gets.list();
        expect.soft(seen.filter((p) => p === `${USERS_PATH}/${s.pe.id}/memberships`)).toHaveLength(1);
        expect.soft(seen.filter((p) => p === `${USERS_PATH}/${s.pe.id}/activity`)).toHaveLength(1);
        await captureEvidence(page, 'E08_37U-G-002_users.png');
      });
      await test.step('[37U-E-005] panel landmark + named close button', async () => {
        await nameButton(peRow).click();
        await expect.soft(aside).toBeVisible();
        await expect.soft(aside.getByRole('button', { name: USR.closeDetail, exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_37U-E-005_users.png');
      });
      await test.step('[37U-G-007] ⚑ offline click on another person: panel reports an error, list stays', async () => {
        expect(otherEmail, 'environment: a second person to click').not.toBe('');
        await context.setOffline(true);
        try {
          await nameButton(userRow(page, otherEmail)).click();
          // One alert per failed section (memberships + activity, BUG-P08-015 ReadStateNotice; RF p08-rf: 2 alerts).
          await expect.soft(aside.getByRole('alert').first(), 'panel error while offline').toBeVisible({ timeout: 30_000 });
          await expect.soft(page.locator('tbody tr').first()).toBeVisible();
          await captureEvidence(page, 'E08_37U-G-007_users.png');
        } finally {
          await context.setOffline(false);
        }
      });
      await test.step('[37U-B-007] fresh page, users read aborted → load error + "Thử lại"; online + retry → table', async () => {
        const page2 = await context.newPage();
        try {
          // route chunks are lazy: fail only the API read (offline would also cut the chunk).
          await page2.route(/\/api\/users$/u, (route) => route.abort('internetdisconnected'));
          await page2.goto(ROUTES.users);
          const alertTitle = page2.getByText(USR.errorTitle, { exact: true });
          await expect.soft(alertTitle).toBeVisible({ timeout: 30_000 });
          await expect.soft(page2.getByRole('button', { name: USR.retry, exact: true })).toBeVisible();
          await captureEvidence(page2, 'E08_37U-B-007_users.png');
          await page2.unroute(/\/api\/users$/u);
          const reread = waitGet(page2, USERS_PATH);
          await page2.getByRole('button', { name: USR.retry, exact: true }).click();
          await reread;
          await expect.soft(page2.getByRole('table')).toBeVisible();
          await attachJson('E08_37U-B-007_users.json', { usersReads: gets.list().length });
        } finally {
          await page2.close();
        }
      });
      gets.stop();
    } finally {
      await context.setOffline(false);
      await s.dispose();
    }
  });
});

/**
 * Phase 11 - session edge (QA-11 P10): FL-11U-01 disable / undo / enable, FL-11U-02 session + login after disable,
 * FL-11U-03 remove-gate dialog, every cancel path. Real stack. Users are FRESH (invited per flow, never the pool,
 * never the shared admin session); admin signs in per flow in its own context. Nothing is deleted in the UI here;
 * cleanup `DELETE /api/users/:id` runs in `finally`.
 * Sources (FE 5fcaf502): UMT UserManagementTable.tsx, UMD UserManagementDetail.tsx, UMH useUserManagement.ts,
 * TOAST src/components/feedback/Toast.tsx, VI src/i18n/vi.json (auth.errors.accountDisabled, auth.notices.sessionEnded).
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import type { PoolUser } from './support/phase03Seed';
import type { AdminFlow } from './support/p11/P10';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../e2e/fixtures/session';
import { DASHBOARD_TITLE } from './support/auth';
import { apiBaseUrl } from './support/api';
import { captureEvidence } from './support/evidence';
import { DESKTOP } from './support/p11/common';
import {
  adminApi,
  disposeFreshUser,
  inviteFreshUser,
  openAdminFlow,
  runCleanups,
  signInFresh,
  toastWith,
  userRow,
} from './support/p11/P10';

test.describe.configure({ mode: 'default' });

const SESSION_ENDED = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.'; // VI auth.notices.sessionEnded
const DISABLED_TITLE = 'Tài khoản đã bị vô hiệu'; // VI auth.errors.accountDisabled.title
const DISABLED_DESC = 'Tài khoản này không còn được phép đăng nhập. Liên hệ quản trị dự án để mở lại.';
const WARNING =
  'Xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận'; // UMH:150-151
const CONFIRM = 'Xác nhận xoá vĩnh viễn'; // UMD:278
const SWITCH_ACCOUNT = 'Đăng nhập bằng tài khoản khác'; // VI auth.actions.signInWithAnotherAccount (AuthScreen.tsx:358)

/** Two animation frames: every handler of the click that just ran has finished (not a timed wait). */
const settled = (page: Page): Promise<unknown> =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/** Filters the table to the users matching `needle` (search box label 'Tìm người dùng', UMToolbar:26). */
async function openUsers(page: Page, needle: string): Promise<void> {
  await page.goto('/admin/users');
  const search = page.getByLabel('Tìm người dùng', { exact: true });
  await expect(search).toBeVisible();
  await search.fill(needle);
}

const userResponse = (page: Page, id: string, verb: 'disable' | 'enable') =>
  page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === `/api/users/${id}/${verb}`,
  );

test('SCR-37 · FL-11U-01 · admin · vô hiệu / hoàn tác / bật lại', async ({ browser }) => {
  test.setTimeout(240_000);
  let api: APIRequestContext | undefined;
  let fu1: PoolUser | undefined;
  let flow: AdminFlow | undefined;
  try {
    api = await adminApi();
    fu1 = await inviteFreshUser(api, 'engineer', 'dis');
    flow = await openAdminFlow(browser, DESKTOP);
    const { page, writes } = flow;
    const user = fu1;
    const row = userRow(page, user.email);
    await test.step('[11U-A-101] bảng có hàng fu1 với Vô hiệu hoá và Xoá', async () => {
      await openUsers(page, user.email);
      await expect(row).toBeVisible(); // UMT:45,157
      await expect(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toBeAttached();
      await expect(row.getByRole('button', { name: 'Xoá', exact: true })).toBeVisible();
      await captureEvidence(page, 'E11_11U-A-101_users.png');
    });
    await test.step('[11U-A-102] bấm Vô hiệu hoá: hàng Đã vô hiệu hoá, nút Bật lại', async () => {
      const done = userResponse(page, user.id, 'disable');
      await row.locator('summary').click(); // UX 26/10: row actions live in the "⋯" menu
      await row.getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click();
      expect((await done).status()).toBe(200);
      await expect.soft(row.getByText('Đã vô hiệu hoá', { exact: true })).toBeVisible(); // UMG:138
      await expect.soft(row.getByRole('button', { name: 'Bật lại', exact: true })).toBeAttached(); // UMT:46
      await captureEvidence(page, 'E11_11U-A-102_disabled.png');
    });
    await test.step('[11U-A-103] toast Đã vô hiệu hoá tài khoản + tên + Hoàn tác', async () => {
      const toast = toastWith(page, 'Đã vô hiệu hoá tài khoản'); // UMH:157,849-853
      await expect.soft(toast).toBeVisible();
      await expect.soft(toast).toContainText(user.name);
      await expect.soft(toast.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeVisible();
      await captureEvidence(page, 'E11_11U-A-103_toast.png');
    });
    await test.step('[11U-G-185] POST disable mang Idempotency-Key', async () => {
      const sent = writes.filter((w) => w.method === 'POST' && w.path === `/api/users/${user.id}/disable`);
      expect.soft(sent).toHaveLength(1);
      expect.soft(sent[0]?.headers['idempotency-key'] ?? '').not.toBe('');
      await captureEvidence(page, 'E11_11U-G-185_idempotency.png');
    });
    await test.step('[11U-A-104] Hoàn tác trong hạn: POST enable, hàng về Vô hiệu hoá, không toast thứ hai', async () => {
      const done = userResponse(page, user.id, 'enable');
      await toastWith(page, 'Đã vô hiệu hoá tài khoản').getByRole('button', { name: 'Hoàn tác', exact: true }).click();
      expect((await done).status()).toBe(200);
      await expect.soft(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toBeAttached();
      await expect.soft(toastWith(page, 'Đã bật lại tài khoản')).toHaveCount(0); // UMH:845-847 (isUndo returns)
      await captureEvidence(page, 'E11_11U-A-104_undone.png');
    });
    await test.step('[11U-B-124] hàng đã vô hiệu: chỉ Bật lại, Xoá còn', async () => {
      const again = userResponse(page, user.id, 'disable'); // precondition, not the checked behaviour
      await row.locator('summary').click(); // UX 26/10: row actions live in the "⋯" menu
      await row.getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click();
      expect((await again).status()).toBe(200);
      await expect.soft(row.getByRole('button', { name: 'Bật lại', exact: true })).toBeAttached();
      await expect.soft(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toHaveCount(0); // UMT:145-148
      await expect.soft(row.getByRole('button', { name: 'Xoá', exact: true })).toBeVisible(); // UMT:151-155
      await captureEvidence(page, 'E11_11U-B-124_disabledrow.png');
    });
    await test.step('[11U-A-105] bấm Bật lại: toast Đã bật lại tài khoản, hàng Vô hiệu hoá', async () => {
      const done = userResponse(page, user.id, 'enable');
      await row.locator('summary').click(); // UX 26/10: row actions live in the "⋯" menu
      await row.getByRole('button', { name: 'Bật lại', exact: true }).click();
      expect((await done).status()).toBe(200);
      await expect.soft(toastWith(page, 'Đã bật lại tài khoản')).toBeVisible(); // UMH:158
      await expect.soft(row.getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toBeAttached();
      await captureEvidence(page, 'E11_11U-A-105_enabled.png');
    });
    await test.step('[11U-E-165] toast nằm trong vùng role=status', async () => {
      const toast = toastWith(page, 'Đã bật lại tài khoản'); // getByRole('status') = TOAST:144
      await expect.soft(toast).toBeVisible();
      await expect.soft(toast).toHaveAttribute('aria-live', 'polite');
      await captureEvidence(page, 'E11_11U-E-165_status.png');
    });
  } finally {
    const [a, f, u] = [api, flow, fu1];
    await runCleanups([
      async () => f?.context.close(),
      async () => (a && u ? disposeFreshUser(a, u) : undefined),
      async () => a?.dispose(),
    ]);
  }
});

test('SCR-37/SCR-01 · FL-11U-02 · admin + user bị vô hiệu · phiên và đăng nhập sau vô hiệu', async ({ browser }) => {
  test.setTimeout(180_000);
  let api: APIRequestContext | undefined;
  let fu2: PoolUser | undefined;
  let flow: AdminFlow | undefined;
  let ctx2: BrowserContext | undefined;
  try {
    api = await adminApi();
    fu2 = await inviteFreshUser(api, 'engineer', 'kick');
    flow = await openAdminFlow(browser, DESKTOP);
    ctx2 = await browser.newContext({ viewport: DESKTOP });
    const { page } = flow;
    const user = fu2;
    const c2 = ctx2;
    await signInFresh(c2, user);
    const tab2 = await c2.newPage();
    await tab2.goto('/');
    await expect(tab2.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true })).toBeVisible();
    await openUsers(page, user.email);
    const row = userRow(page, user.email);
    const signInForm = async (): Promise<void> => {
      await tab2.getByLabel(EMAIL_LABEL, { exact: true }).fill(user.email);
      await tab2.getByLabel(PASSWORD_LABEL, { exact: true }).fill(user.password);
      await tab2.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
    };
    await test.step('[11U-A-107] admin vô hiệu: /api/me của fu2 401, tab về /login có thông báo phiên kết thúc', async () => {
      const done = userResponse(page, user.id, 'disable');
      await row.locator('summary').click(); // UX 26/10: row actions live in the "⋯" menu
      await row.getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click();
      expect((await done).status()).toBe(200);
      await expect(row.getByRole('button', { name: 'Bật lại', exact: true })).toBeAttached();
      // /api/me with cookies only is always 401 (core/routing.py:130-133): the proof is a refresh with the dead session cookie.
      const refresh = await c2.request.post('/api/auth/refresh', { headers: { Origin: apiBaseUrl() } });
      expect(refresh.status()).toBe(401); // oracle: auth/sessions.py:452-453
      expect(((await refresh.json()) as { code?: string }).code).toBe('SESSION_REVOKED');
      await tab2.goto('/'); // next navigation of the dead session
      await expect(tab2).toHaveURL(/\/login/u); // SB:293-306
      await expect(tab2.getByText(SESSION_ENDED, { exact: true })).toBeVisible();
      await captureEvidence(tab2, 'E11_11U-A-107_sessionended.png');
    });
    await test.step('[11U-A-106] đăng nhập form bị từ chối: Tài khoản đã bị vô hiệu', async () => {
      const login = tab2.waitForResponse(
        (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/auth/login',
      );
      await signInForm();
      const refused = await login; // oracle: auth/router.py:178-179, packages/core/error_codes.py:21
      expect.soft(refused.status()).toBe(403);
      expect.soft(((await refused.json()) as { code?: string }).code).toBe('ACCOUNT_DISABLED');
      await expect.soft(tab2.getByText(DISABLED_TITLE, { exact: true })).toBeVisible();
      await expect.soft(tab2.getByText(DISABLED_DESC, { exact: true })).toBeVisible();
      await captureEvidence(tab2, 'E11_11U-A-106_loginrefused.png');
    });
    await test.step('[11U-A-108] admin Bật lại: fu2 đăng nhập lại, vào Dự án của tôi', async () => {
      const done = userResponse(page, user.id, 'enable');
      await row.locator('summary').click(); // UX 26/10: row actions live in the "⋯" menu
      await row.getByRole('button', { name: 'Bật lại', exact: true }).click();
      expect((await done).status()).toBe(200);
      // After A-106 the blocked strip replaces the form (AuthScreen.tsx:351-361): reopen it first (RR red: form never came back).
      await tab2.getByRole('button', { name: SWITCH_ACCOUNT, exact: true }).click();
      await signInForm();
      await expect.soft(tab2.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true })).toBeVisible();
      await captureEvidence(tab2, 'E11_11U-A-108_backin.png');
    });
  } finally {
    const [a, f, u, c] = [api, flow, fu2, ctx2];
    await runCleanups([
      async () => c?.close(),
      async () => f?.context.close(),
      async () => (a && u ? disposeFreshUser(a, u) : undefined),
      async () => a?.dispose(),
    ]);
  }
});

test('SCR-37 · FL-11U-03 · admin · cổng hộp xoá hẳn, mọi đường huỷ', async ({ browser }) => {
  test.setTimeout(280_000);
  let api: APIRequestContext | undefined;
  let u3: PoolUser | undefined;
  let u3b: PoolUser | undefined;
  let flow: AdminFlow | undefined;
  try {
    api = await adminApi();
    u3 = await inviteFreshUser(api, 'engineer', 'rm');
    u3b = await inviteFreshUser(api, 'engineer', 'rmb');
    flow = await openAdminFlow(browser, DESKTOP);
    const { page, writes } = flow;
    const [fu3, fu3b] = [u3, u3b];
    const deletes = (): number => writes.filter((w) => w.method === 'DELETE').length;
    const row3 = userRow(page, fu3.email);
    const dlgName = { name: `Xoá hẳn ${fu3.name}?`, exact: true }; // UMD:254
    // dialog today; alertdialog once E-164 is fixed - the other steps must not turn red with it.
    const dialog = page.getByRole('dialog', dlgName).or(page.getByRole('alertdialog', dlgName));
    const typed = page.getByLabel('Địa chỉ thư', { exact: true });
    const confirm = page.getByRole('button', { name: CONFIRM, exact: true });
    const openRemove = async (): Promise<void> => {
      await row3.getByRole('button', { name: 'Xoá', exact: true }).click();
      await expect(dialog).toBeVisible();
    };
    await test.step('[11U-A-109] Xoá hàng fu3: hộp Xoá hẳn <tên fu3>? (không phải fu3b)', async () => {
      await openUsers(page, 'p11-session-rm');
      await expect(userRow(page, fu3b.email)).toBeVisible();
      await userRow(page, fu3b.email).getByRole('button', { name: fu3b.name, exact: true }).click(); // UMT:307 selects fu3b
      await expect(page.getByRole('complementary', { name: 'Chi tiết người dùng' })).toBeVisible();
      await openRemove();
      await expect(page.getByRole('dialog', { name: `Xoá hẳn ${fu3b.name}?`, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E11_11U-A-109_dialog.png');
    });
    await test.step('[11U-C-131] nội dung hộp: cảnh báo + gợi ý gõ lại email fu3', async () => {
      await expect.soft(dialog).toContainText(WARNING); // UMH:150-151
      await expect.soft(dialog.locator('code')).toHaveText(fu3.email); // UMD:259-262
      await expect.soft(dialog).toContainText('để xác nhận.');
      await captureEvidence(page, 'E11_11U-C-131_text.png');
    });
    await test.step('[11U-E-161] tiêu điểm trong hộp, Tab xoay vòng không ra ngoài', async () => {
      const inside = (): Promise<boolean> => dialog.evaluate((el) => el.contains(document.activeElement));
      await expect.poll(inside).toBe(true);
      for (let i = 0; i < 6; i += 1) {
        await page.keyboard.press('Tab');
        expect.soft(await inside(), `Tab #${String(i + 1)} stays in the dialog`).toBe(true);
      }
      await captureEvidence(page, 'E11_11U-E-161_focus.png');
    });
    await test.step('[11U-C-132] ô trống: Xác nhận xoá vĩnh viễn bị khoá', async () => {
      await expect.soft(typed).toHaveValue('');
      await expect.soft(confirm).toBeDisabled(); // UMD:278
      await captureEvidence(page, 'E11_11U-C-132_empty.png');
    });
    await test.step('[11U-E-166] ô có nhãn Địa chỉ thư, nút khoá có thuộc tính disabled', async () => {
      await expect.soft(typed).toHaveCount(1); // UMD:264
      await expect.soft(confirm).toHaveAttribute('disabled', '');
      await captureEvidence(page, 'E11_11U-E-166_label.png');
    });
    await test.step('[11U-C-133] gõ email fu3b (sai) + click cưỡng bức: vẫn khoá, không DELETE', async () => {
      await typed.fill(fu3b.email);
      await expect.soft(confirm).toBeDisabled();
      await confirm.click({ force: true });
      await settled(page);
      await expect.soft(dialog).toBeVisible();
      expect.soft(deletes()).toBe(0); // UMH:941-942
      await captureEvidence(page, 'E11_11U-C-133_wrong.png');
    });
    await test.step('[11U-C-134] email fu3 HOA + khoảng trắng hai đầu: nút bật', async () => {
      await typed.fill(`  ${fu3.email.toUpperCase()}  `);
      await expect.soft(confirm).toBeEnabled(); // UMH:941-942 trim + lowercase
      await captureEvidence(page, 'E11_11U-C-134_match.png');
    });
    await test.step('[11U-E-162] xoá ô, gõ sai rồi Enter: không DELETE', async () => {
      await typed.fill('');
      await typed.fill('sai@example.test');
      await typed.press('Enter');
      await settled(page);
      await expect.soft(dialog).toBeVisible();
      expect.soft(deletes()).toBe(0); // UMH:1154-1156
      await captureEvidence(page, 'E11_11U-E-162_enter.png');
    });
    await test.step('[11U-C-135] Để sau: hộp đóng, hàng fu3 còn, không DELETE', async () => {
      await dialog.getByRole('button', { name: 'Để sau', exact: true }).click(); // UMD:273-275
      await expect.soft(dialog).toBeHidden();
      await expect.soft(row3).toBeVisible();
      expect.soft(deletes()).toBe(0);
      await captureEvidence(page, 'E11_11U-C-135_later.png');
    });
    await test.step('[11U-E-163] tiêu điểm về nút Xoá của hàng fu3', async () => {
      await expect.soft(row3.getByRole('button', { name: 'Xoá', exact: true })).toBeFocused();
      await captureEvidence(page, 'E11_11U-E-163_focusback.png');
    });
    await test.step('[11U-C-136] mở lại, gõ vài ký tự, Esc: hộp đóng, không DELETE; mở lại ô trống', async () => {
      await openRemove();
      await typed.fill('abc');
      await page.keyboard.press('Escape');
      await expect.soft(dialog).toBeHidden();
      expect.soft(deletes()).toBe(0);
      await openRemove(); // UMH:1139-1142 reopening clears the field
      await expect.soft(typed).toHaveValue('');
      await captureEvidence(page, 'E11_11U-C-136_esc.png');
    });
    await test.step('[11U-E-164] ⚑ hộp xoá hẳn nên là alertdialog tên Xoá hẳn <tên fu3>?', async () => {
      // catalog 11U-E-164 oracle: role=dialog with the accessible name (Modal.Root, UMD:251). alertdialog for an irreversible action is a shared-Modal polish item (BUG-P11-008), not asserted here.
      await expect(page.getByRole('dialog', { name: `Xoá hẳn ${fu3.name}?`, exact: true })).toBeVisible();
      await captureEvidence(page, 'E11_11U-E-164_alertdialog.png');
    });
  } finally {
    const [a, f, x, y] = [api, flow, u3, u3b];
    await runCleanups([
      async () => f?.context.close(),
      async () => (a && x ? disposeFreshUser(a, x) : undefined),
      async () => (a && y ? disposeFreshUser(a, y) : undefined),
      async () => a?.dispose(),
    ]);
  }
});

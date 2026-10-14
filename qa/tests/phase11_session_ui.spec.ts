/**
 * Phase 11 · users + session · UI at 1920/1440/1024/768 (flows-C3 FL-11U-U1..U4). Real backend, own fresh users only;
 * the shared admin session is never used (each admin view signs in again in its own context).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, loginUrl } from '../../e2e/fixtures/routes';
import { readAdminCredentials } from './support/auth';
import { signedInApi } from './support/api';
import { poolUser, signInPoolUser } from './support/phase03Seed';
import { unknownProjectId } from './support/p03/P10';
import { DESKTOP_VIEWPORTS, p11Slot } from './support/p11/common';
import { adminPage, disposeFreshUser, inviteFreshUser, signedInPage, userRow } from './support/p11/P13';
import { verifyUi } from './support/ui-verify';

const SIGN_IN_REQUIRED = 'Hãy đăng nhập để tiếp tục.';
const SESSION_ENDED = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.';
const SELF_BLOCK = 'Bạn không thể tự vô hiệu hoá tài khoản của mình';

/** Opens `/admin/users` filtered to `email` (toolbar search `Tìm người dùng`, UserManagementToolbar.tsx:26). */
async function openUsers(page: Page, email: string): Promise<void> {
  await page.goto(ROUTES.adminUsers);
  await page.getByLabel('Tìm người dùng').fill(email);
  await expect(userRow(page, email)).toBeVisible();
}

test.describe('SCR-37/38/01 UI', () => {
  test('SCR-37 · FL-11U-U1 · admin · hộp xoá, bảng, panel', async ({ browser }) => {
    test.setTimeout(240_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    const fu = await inviteFreshUser(admin, 'engineer', 'ui1');
    const fu2 = await inviteFreshUser(admin, 'engineer', 'ui1b');
    const view = await adminPage(browser);
    try {
      const off = await admin.post(`/api/users/${fu2.id}/disable`, { data: {} });
      expect(off.status(), 'setup: disable fu2').toBe(200);

      await test.step('[11U-F-173] bảng: hàng thường và hàng đã vô hiệu ở 4 khổ', async () => {
        // UserManagementTable.tsx:139-163 RowActions
        await verifyUi(view.page, 'U11_11U-F-173_users-table', async (p) => {
          await p.goto(ROUTES.adminUsers);
          await p.getByLabel('Tìm người dùng').fill('p11-session-ui1');
          await expect(userRow(p, fu.email)).toBeVisible();
          await expect(userRow(p, fu2.email)).toBeVisible();
          await expect(userRow(p, fu.email).getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toBeVisible();
          await expect(userRow(p, fu.email).getByRole('button', { name: 'Xoá', exact: true })).toBeVisible();
          await expect(userRow(p, fu2.email).getByRole('button', { name: 'Bật lại', exact: true })).toBeVisible();
          await expect(userRow(p, fu2.email).getByRole('button', { name: 'Xoá', exact: true })).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });

      await test.step('[11U-F-174] panel chi tiết có mục Xoá người dùng ở 4 khổ', async () => {
        // UserManagementDetail.tsx:231 aria-label "Xoá người dùng"
        await verifyUi(view.page, 'U11_11U-F-174_detail-panel', async (p) => {
          await openUsers(p, fu.email);
          const row = userRow(p, fu.email);
          // table: the name cell is a button as well (card list: `onSelectUser` button holds name + email)
          await row.getByText(fu.email, { exact: true }).click();
          await expect(p.getByRole('region', { name: 'Xoá người dùng' })).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });

      await test.step('[11U-F-171] hộp Xoá hẳn, ô trống, nút khoá ở 4 khổ', async () => {
        await verifyUi(view.page, 'U11_11U-F-171_remove-empty', async (p) => {
          await openUsers(p, fu.email);
          await userRow(p, fu.email).getByRole('button', { name: 'Xoá', exact: true }).click();
          const dialog = p.getByRole('dialog');
          await expect(dialog.getByRole('heading', { name: `Xoá hẳn ${fu.name}?` })).toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn' })).toBeDisabled();
        }, DESKTOP_VIEWPORTS, { fullPage: false });
      });

      await test.step('[11U-F-172] hộp Xoá hẳn, email khớp, nút bật ở 4 khổ', async () => {
        await verifyUi(view.page, 'U11_11U-F-172_remove-typed', async (p) => {
          await openUsers(p, fu.email);
          await userRow(p, fu.email).getByRole('button', { name: 'Xoá', exact: true }).click();
          const dialog = p.getByRole('dialog');
          await expect(dialog.getByRole('heading', { name: `Xoá hẳn ${fu.name}?` })).toBeVisible();
          await dialog.getByLabel('Địa chỉ thư').fill(fu.email);
          await expect(dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn' })).toBeEnabled();
        }, DESKTOP_VIEWPORTS, { fullPage: false });
      });
    } finally {
      await view.context.close();
      await disposeFreshUser(admin, fu);
      await disposeFreshUser(admin, fu2);
      await admin.dispose();
    }
  });

  test('SCR-37 · FL-11U-U2 · admin tươi · câu chặn', async ({ browser }) => {
    test.setTimeout(120_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    const fa = await inviteFreshUser(admin, 'admin', 'ui2');
    const view = await signedInPage(browser, fa);
    try {
      await test.step('[11U-F-175] câu chặn tự vô hiệu xuống dòng ở 4 khổ', async () => {
        // useUserManagement.ts:138 selfDisableBlocked
        await verifyUi(view.page, 'U11_11U-F-175_self-block', async (p) => {
          await openUsers(p, fa.email);
          await expect(userRow(p, fa.email).getByText(SELF_BLOCK)).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });
    } finally {
      await view.context.close();
      await disposeFreshUser(admin, fa);
      await admin.dispose();
    }
  });

  test('SCR-38 · FL-11U-U3 · engineer · /khong-co-quyen', async ({ browser }) => {
    test.setTimeout(120_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    const context = await browser.newContext();
    try {
      const pu = await poolUser(admin, 'engineer', p11Slot('session-ui'));
      await signInPoolUser(context, pu);
      const page = await context.newPage();
      await test.step('[11U-F-331] /khong-co-quyen ở 4 khổ', async () => {
        await verifyUi(page, 'U11_11U-F-331_access-denied', async (p) => {
          await p.goto(ROUTES.accessDenied);
          await expect(p.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true })).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });
    } finally {
      await context.close();
      await admin.dispose();
    }
  });

  test('SCR-01 · FL-11U-U4 · khách / engineer / user bị vô hiệu · /login', async ({ browser }) => {
    test.setTimeout(300_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    const fu = await inviteFreshUser(admin, 'engineer', 'ui4');
    const anon = await browser.newContext();
    const sessionCtx = await browser.newContext();
    try {
      const pu = await poolUser(admin, 'engineer', p11Slot('session-ui'));
      const off = await admin.post(`/api/users/${fu.id}/disable`, { data: {} });
      expect(off.status(), 'setup: disable fu').toBe(200);
      const anonPage = await anon.newPage();
      const puPage = await sessionCtx.newPage();

      await test.step('[11U-F-411] /login với "Hãy đăng nhập để tiếp tục." ở 4 khổ', async () => {
        const target = ROUTES.project.viewer(unknownProjectId());
        await verifyUi(anonPage, 'U11_11U-F-411_sign-in-required', async (p) => {
          await p.goto(target);
          await expect.poll(() => new URL(p.url()).pathname + new URL(p.url()).search).toBe(loginUrl(target));
          await expect(p.getByText(SIGN_IN_REQUIRED)).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });

      await test.step('[11U-F-412] /login với "Phiên đăng nhập đã kết thúc." ở 4 khổ', async () => {
        await verifyUi(puPage, 'U11_11U-F-412_session-ended', async (p) => {
          await signInPoolUser(sessionCtx, pu);
          await p.goto(ROUTES.dashboard);
          await expect(p).toHaveURL(new RegExp(`${ROUTES.dashboard}$`, 'u'));
          // another tab of the same context signs out (AccessDenied "Đăng nhập bằng tài khoản khác")
          const other = await sessionCtx.newPage();
          await other.goto(ROUTES.accessDenied);
          await other.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true }).click();
          await expect(other).toHaveURL(/\/login/u);
          await other.close();
          await expect(p.getByText(SESSION_ENDED)).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });

      await test.step('[11U-F-413] đăng nhập user bị vô hiệu → "Tài khoản đã bị vô hiệu" ở 4 khổ', async () => {
        await verifyUi(anonPage, 'U11_11U-F-413_account-disabled', async (p) => {
          await p.goto(ROUTES.login);
          await p.getByLabel('Thư điện tử', { exact: true }).fill(fu.email);
          await p.getByLabel('Mật khẩu', { exact: true }).fill(fu.password);
          await p.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
          await expect(p.getByText('Tài khoản đã bị vô hiệu')).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });
    } finally {
      await anon.close();
      await sessionCtx.close();
      await disposeFreshUser(admin, fu);
      await admin.dispose();
    }
  });
});

/**
 * Phase 11 · users + session · UI at 1920/1440/1024/768 (flows-C3 FL-11U-U1..U4). Real backend, own fresh users only;
 * the shared admin session is never used (each admin view signs in again in its own context).
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import { ROUTES, loginUrl } from '../../e2e/fixtures/routes';
import { readAdminCredentials } from './support/auth';
import { signedInApi } from './support/api';
import { poolUser, signInPoolUser, type PoolUser } from './support/phase03Seed';
import { pathOf, unknownProjectId } from './support/p03/P10';
import { DESKTOP, DESKTOP_VIEWPORTS, p11Slot } from './support/p11/common';
import { adminPage, attachSnapshot, cleanAll, disposeFreshUser, inviteFreshUser, recordApi, signedInPage, userRow } from './support/p11/P13';
import { verifyUi } from './support/ui-verify';

const SIGN_IN_REQUIRED = 'Hãy đăng nhập để tiếp tục.';
const SESSION_ENDED = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.';
const SELF_BLOCK = 'Bạn không thể tự vô hiệu hoá tài khoản của mình';

/** Evidence probes for 11U-F-174 (UserManagementDetail.tsx:391-425: aside >= lg, Drawer when collapsed, section aria-label). */
const DETAIL_PROBES = {
  aside: 'aside[aria-label="Chi tiết người dùng"]',
  drawer: '[role="dialog"][aria-label="Chi tiết người dùng"]',
  removeSection: 'section[aria-label="Xoá người dùng"]',
  selectedRow: 'tr[aria-selected="true"], li[aria-current="true"], [data-selected="true"]',
};

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
    let fuRef: PoolUser | null = null;
    let fu2Ref: PoolUser | null = null;
    let view: Awaited<ReturnType<typeof adminPage>> | null = null;
    try {
      const fu = (fuRef = await inviteFreshUser(admin, 'engineer', 'ui1'));
      const fu2 = (fu2Ref = await inviteFreshUser(admin, 'engineer', 'ui1b'));
      const shown = (view = await adminPage(browser));
      const off = await admin.post(`/api/users/${fu2.id}/disable`, { data: {} });
      expect(off.status(), 'setup: disable fu2').toBe(200);

      await test.step('[11U-F-173] bảng: hàng thường và hàng đã vô hiệu ở 4 khổ', async () => {
        // UserManagementTable.tsx:139-163 RowActions
        await verifyUi(shown.page, 'U11_11U-F-173_users-table', async (p) => {
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

      const hits = recordApi(shown.page);
      await test.step('[11U-F-174] panel chi tiết có mục Xoá người dùng ở 4 khổ', async () => {
        // UserManagementDetail.tsx:231 aria-label "Xoá người dùng"
        await verifyUi(shown.page, 'U11_11U-F-174_detail-panel', async (p) => {
          await openUsers(p, fu.email);
          const row = userRow(p, fu.email);
          // table: the name cell is a button as well (card list: `onSelectUser` button holds name + email)
          const w = String(p.viewportSize()?.width ?? 0);
          const mark = hits.length;
          await attachSnapshot(p, `U11_11U-F-174_before-click-${w}.json`, hits, mark, DETAIL_PROBES);
          await row.getByText(fu.email, { exact: true }).click();
          try {
            await expect(p.getByRole('region', { name: 'Xoá người dùng' })).toBeVisible();
          } finally {
            await attachSnapshot(p, `U11_11U-F-174_after-click-${w}.json`, hits, mark, DETAIL_PROBES);
          }
        }, DESKTOP_VIEWPORTS);
      });

      await test.step('[11U-F-171] hộp Xoá hẳn, ô trống, nút khoá ở 4 khổ', async () => {
        await verifyUi(shown.page, 'U11_11U-F-171_remove-empty', async (p) => {
          await openUsers(p, fu.email);
          await userRow(p, fu.email).getByRole('button', { name: 'Xoá', exact: true }).click();
          const dialog = p.getByRole('dialog');
          await expect(dialog.getByRole('heading', { name: `Xoá hẳn ${fu.name}?` })).toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn' })).toBeDisabled();
        }, DESKTOP_VIEWPORTS, { fullPage: false });
      });

      await test.step('[11U-F-172] hộp Xoá hẳn, email khớp, nút bật ở 4 khổ', async () => {
        await verifyUi(shown.page, 'U11_11U-F-172_remove-typed', async (p) => {
          await openUsers(p, fu.email);
          await userRow(p, fu.email).getByRole('button', { name: 'Xoá', exact: true }).click();
          const dialog = p.getByRole('dialog');
          await expect(dialog.getByRole('heading', { name: `Xoá hẳn ${fu.name}?` })).toBeVisible();
          await dialog.getByLabel('Địa chỉ thư').fill(fu.email);
          await expect(dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn' })).toBeEnabled();
        }, DESKTOP_VIEWPORTS, { fullPage: false });
      });
    } finally {
      await cleanAll([
        async () => { if (view !== null) await view.context.close(); },
        async () => { if (fuRef !== null) await disposeFreshUser(admin, fuRef); },
        async () => { if (fu2Ref !== null) await disposeFreshUser(admin, fu2Ref); },
        () => admin.dispose(),
      ]);
    }
  });

  test('SCR-37 · FL-11U-U2 · admin tươi · câu chặn', async ({ browser }) => {
    test.setTimeout(120_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    let faRef: PoolUser | null = null;
    let view: Awaited<ReturnType<typeof signedInPage>> | null = null;
    try {
      const fa = (faRef = await inviteFreshUser(admin, 'admin', 'ui2'));
      const shown = (view = await signedInPage(browser, fa));
      await test.step('[11U-F-175] câu chặn tự vô hiệu xuống dòng ở 4 khổ', async () => {
        // useUserManagement.ts:138 selfDisableBlocked
        await verifyUi(shown.page, 'U11_11U-F-175_self-block', async (p) => {
          await openUsers(p, fa.email);
          await expect(userRow(p, fa.email).getByText(SELF_BLOCK)).toBeVisible();
        }, DESKTOP_VIEWPORTS);
      });
    } finally {
      await cleanAll([
        async () => { if (view !== null) await view.context.close(); },
        async () => { if (faRef !== null) await disposeFreshUser(admin, faRef); },
        () => admin.dispose(),
      ]);
    }
  });

  test('SCR-38 · FL-11U-U3 · engineer · /khong-co-quyen', async ({ browser }) => {
    test.setTimeout(120_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    let ctx: BrowserContext | null = null;
    try {
      const context = (ctx = await browser.newContext({ viewport: DESKTOP }));
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
      await cleanAll([
        async () => { if (ctx !== null) await ctx.close(); },
        () => admin.dispose(),
      ]);
    }
  });

  test('SCR-01 · FL-11U-U4 · khách / engineer / user bị vô hiệu · /login', async ({ browser }) => {
    test.setTimeout(300_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    let fuRef: PoolUser | null = null;
    let anon: BrowserContext | null = null;
    let sessionCtx: BrowserContext | null = null;
    try {
      const fu = (fuRef = await inviteFreshUser(admin, 'engineer', 'ui4'));
      const anonCtx = (anon = await browser.newContext({ viewport: DESKTOP }));
      const sessCtx = (sessionCtx = await browser.newContext({ viewport: DESKTOP }));
      const pu = await poolUser(admin, 'engineer', p11Slot('session-ui'));
      const off = await admin.post(`/api/users/${fu.id}/disable`, { data: {} });
      expect(off.status(), 'setup: disable fu').toBe(200);
      const anonPage = await anonCtx.newPage();
      const puPage = await sessCtx.newPage();

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
          await signInPoolUser(sessCtx, pu);
          await p.goto(ROUTES.dashboard);
          await expect.poll(() => pathOf(p)).toBe(ROUTES.dashboard);
          // another tab of the same context signs out (AccessDenied "Đăng nhập bằng tài khoản khác")
          const other = await sessCtx.newPage();
          await other.goto(ROUTES.accessDenied);
          await other.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true }).click();
          await expect(other).toHaveURL(/\/login/u);
          await other.close();
          // the protected tab follows the sign-out made in the other tab
          await expect(p).toHaveURL(/\/login/u);
          await expect(p.getByText(SESSION_ENDED, { exact: true })).toBeVisible();
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
      await cleanAll([
        async () => { if (anon !== null) await anon.close(); },
        async () => { if (sessionCtx !== null) await sessionCtx.close(); },
        async () => { if (fuRef !== null) await disposeFreshUser(admin, fuRef); },
        () => admin.dispose(),
      ]);
    }
  });
});

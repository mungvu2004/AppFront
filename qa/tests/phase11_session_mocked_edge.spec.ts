/**
 * Phase 11 · users + session · mocked responses (flows-C3 FL-11U-X1, X2). Every mocked row is labelled
 * `[mocked response]` in its title; the real counterparts are 11U-A-102 / 11U-A-111 / 11U-A-303.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { poolUser, signInPoolUser } from './support/phase03Seed';
import { DESKTOP, p11Slot } from './support/p11/common';
import { adminPage, attachSnapshot, cleanAll, recordApi, userRow } from './support/p11/P13';

/** Evidence probes for 11U-A-306: which screen `/` draws and whether the refresh cookie still revives the session. */
const ROOT_PROBES = { heading: 'h1', loginForm: 'form', dashboard: '[data-testid="dashboard"], main' };

test.describe('SCR-37/38 [mocked response]', () => {
  test('SCR-37 · FL-11U-X1 · admin · [mocked response] lỗi khi vô hiệu / xoá', async ({ browser }) => {
    test.setTimeout(180_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    let view: Awaited<ReturnType<typeof adminPage>> | null = null;
    try {
      // pool user, no invite (rate limit 30/h per admin): both writes are answered by the mock, the user is never changed
      const fu = await poolUser(admin, 'engineer', p11Slot('session-mock'));
      const shown = (view = await adminPage(browser));
      const page = shown.page;
      // one-shot 500s: `route.fulfill` once, then `route.fallback` (the real call) — removed with unroute at the end.
      let disableFailures = 1;
      let deleteFailures = 1;
      await page.route('**/api/users/*/disable', async (route) => {
        if (disableFailures > 0) {
          disableFailures -= 1;
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'mock' }) });
        } else await route.fallback();
      });
      await page.route('**/api/users/*', async (route) => {
        if (route.request().method() === 'DELETE' && deleteFailures > 0) {
          deleteFailures -= 1;
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'mock' }) });
        } else await route.fallback();
      });
      await page.goto(ROUTES.adminUsers);
      await page.getByLabel('Tìm người dùng').fill(fu.email);
      await expect(userRow(page, fu.email)).toBeVisible();

      await test.step('[11U-B-122] disable trả 500 → hàng hoàn về "Vô hiệu hoá" + toast lỗi', async () => {
        // useUserManagement.ts:159 setEnabledFailedTitle
        const failed = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/users/${fu.id}/disable`);
        await userRow(page, fu.email).getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click();
        expect((await failed).status(), 'mocked POST disable').toBe(500);
        await expect(page.getByText('Không đổi được trạng thái tài khoản')).toBeVisible();
        await expect(userRow(page, fu.email).getByRole('button', { name: 'Vô hiệu hoá', exact: true })).toBeVisible();
        await expect(userRow(page, fu.email).getByRole('button', { name: 'Bật lại', exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E11_11U-B-122_disable-failed.png');
      });

      await test.step('[11U-B-121] DELETE trả 500 → toast "Không xoá được tài khoản", hàng còn', async () => {
        // useUserManagement.ts:163 removeFailedTitle
        await userRow(page, fu.email).getByRole('button', { name: 'Xoá', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: `Xoá hẳn ${fu.name}?`, exact: true });
        await expect(dialog.getByRole('heading', { name: `Xoá hẳn ${fu.name}?`, exact: true })).toBeVisible();
        await dialog.getByLabel('Địa chỉ thư').fill(fu.email);
        const failed = page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname === `/api/users/${fu.id}`);
        await dialog.getByRole('button', { name: 'Xác nhận xoá vĩnh viễn' }).click();
        expect((await failed).status(), 'mocked DELETE user').toBe(500);
        await expect(page.getByText('Không xoá được tài khoản')).toBeVisible();
        await expect(userRow(page, fu.email)).toBeVisible();
        await captureEvidence(page, 'E11_11U-B-121_delete-failed.png');
        await page.unroute('**/api/users/*');
        await page.unroute('**/api/users/*/disable');
        const memberships = await admin.get(`/api/users/${fu.id}/memberships`);
        expect(memberships.status(), 'GET memberships after the mocked delete: user still exists').toBe(200);
      });
    } finally {
      await cleanAll([
        async () => { if (view !== null) await view.context.close(); },
        () => admin.dispose(),
      ]);
    }
  });

  test('SCR-38 · FL-11U-X2 · engineer · [mocked response] logout lỗi', async ({ browser }) => {
    test.setTimeout(120_000);
    const creds = readAdminCredentials();
    const admin = await signedInApi(creds.email, creds.password);
    let ctx: BrowserContext | null = null;
    try {
      const context = (ctx = await browser.newContext({ viewport: DESKTOP }));
      const pu = await poolUser(admin, 'engineer', p11Slot('session-mock'));
      await signInPoolUser(context, pu);
      const page = await context.newPage();
      const hits = recordApi(page);
      await page.route('**/api/auth/logout', (route) => route.abort('failed'));
      await test.step('[11U-A-306] logout abort → vẫn /login; mở / → cookie còn nên vào lại', async () => {
        // AccessDenied: navigation sits in `finally` (flows: AD:436-446); local session cleared before the call
        await page.goto(ROUTES.accessDenied);
        await page.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.login);
        await captureEvidence(page, 'E11_11U-A-306_logout-aborted.png');
        const mark = hits.length;
        await attachSnapshot(page, 'E11_11U-A-306_before-open-root.json', hits, mark, ROOT_PROBES);
        await page.goto(ROUTES.dashboard);
        try {
          // oracle: logout never reached the server, so the refresh cookie lives and the reload revives the session (D evidence E11_11U-A-306_after-open-root.json: POST /api/auth/refresh 200)
          await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
        } finally {
          await attachSnapshot(page, 'E11_11U-A-306_after-open-root.json', hits, mark, ROOT_PROBES);
        }
      });
    } finally {
      await cleanAll([
        async () => { if (ctx !== null) await ctx.close(); },
        () => admin.dispose(),
      ]);
    }
  });
});

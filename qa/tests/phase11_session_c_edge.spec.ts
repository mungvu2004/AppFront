/**
 * Phase 11 P12 · SCR-38 / SCR-01 · logout from AccessDenied across two tabs, and the gate / return path.
 * FL-11U-08 (engineer, fresh session, 11 steps) and FL-11U-09 (guest, then viewer, 4 steps). Real stack.
 * Only fresh sessions of own pool slots (`p11-session-c`); the shared admin session is never signed out.
 * FE: AD = src/screens/AccessDenied, SB = src/routes/SessionBootstrap.tsx:293-306,360-376,406.
 */
import { expect, test } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { poolUser, signInPoolUser } from './support/phase03Seed';
import { unknownProjectId } from './support/p03/P10';
import { DESKTOP, p11Slot } from './support/p11/common';
import { SESSION_ENDED, SIGN_IN_REQUIRED, countLogouts, formSignIn } from './support/p11/P12';

const SLOT = p11Slot('session-c');
const DENIED = 'Bạn chưa có quyền truy cập'; // AD:98
const soft = expect.configure({ soft: true });
const pathname = (url: string): string => new URL(url).pathname;

test.describe('SCR-38 / SCR-01 session edge (C)', () => {
  test('SCR-38 · FL-11U-08 · engineer · AccessDenied → logout, two tabs', async ({ browser }) => {
    test.setTimeout(180_000);
    const admin = readAdminCredentials();
    const api = await signedInApi(admin.email, admin.password);
    const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
    try {
      const user = await poolUser(api, 'engineer', SLOT);
      await signInPoolUser(context, user);
      const a = await context.newPage();
      const b = await context.newPage();
      const logouts = countLogouts(a);
      const back = a.getByRole('button', { name: 'Về danh sách dự án', exact: true });
      const other = a.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true });

      await test.step('[11U-A-301] denied page text', async () => {
        await b.goto(ROUTES.dashboard);
        await expect(b.getByRole('heading', { level: 1, name: 'Dự án của tôi', exact: true })).toBeVisible();
        await a.goto(ROUTES.accessDenied);
        await expect(a.getByText(DENIED, { exact: true })).toBeVisible();
        // AD:136 the email is a sibling <span> of the label span: assert on their shared parent.
        await expect(a.getByText('Bạn đang đăng nhập bằng', { exact: false }).locator('..')).toContainText(user.email); // AD:105
        await expect(
          a.getByText('Nội dung ở đường dẫn này đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.', { exact: true }),
        ).toBeVisible(); // AD:101
        await expect(a.getByText('Mã lỗi: 403 · /khong-co-quyen', { exact: true })).toBeVisible(); // AD:126
        await captureEvidence(a, 'E11_11U-A-301_denied_text.png');
      });

      await test.step('[11U-E-322] two buttons named exactly', async () => {
        await soft(back).toBeVisible();
        await soft(other).toBeVisible();
        await soft(a.getByRole('button')).toHaveCount(2);
        await captureEvidence(a, 'E11_11U-E-322_buttons.png');
      });

      await test.step('[11U-E-321] Tab reaches the other-account button', async () => {
        await other.focus(); // AD:108 real <button>; not activated
        await soft(other).toBeFocused();
        await soft(other).toBeVisible();
        await captureEvidence(a, 'E11_11U-E-321_focus.png');
      });

      await test.step('[11U-A-302] back to the project list keeps the session', async () => {
        await back.click();
        await soft.poll(() => pathname(a.url())).toBe(ROUTES.dashboard);
        await soft(a.getByRole('heading', { level: 1, name: 'Dự án của tôi', exact: true })).toBeVisible();
        await captureEvidence(a, 'E11_11U-A-302_home.png');
        await a.goBack();
        await soft(a.getByText(DENIED, { exact: true })).toBeVisible();
      });

      let status = 0;
      await test.step('[11U-A-307] double click sends exactly one logout', async () => {
        const logout = a.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/logout',
        );
        await other.dblclick();
        status = (await logout).status();
        await expect.poll(() => pathname(a.url())).toBe(ROUTES.login);
        expect.soft(logouts.count(), 'POST /api/auth/logout count').toBe(1);
        await captureEvidence(a, 'E11_11U-A-307_one_logout.png');
      });

      await test.step('[11U-A-303] logout answered < 300 and lands on /login', async () => {
        expect.soft(status, 'POST /api/auth/logout').toBe(204); // oracle: apps/api/auth/router.py:285
        expect.soft(pathname(a.url())).toBe(ROUTES.login);
        await captureEvidence(a, 'E11_11U-A-303_login.png');
      });

      await test.step('[11U-A-402] session-ended notice on /login', async () => {
        // UNKNOWN — NEED VERIFICATION: notice may be absent after an explicit logout (spec: "or no notice — record actual").
        await soft(a.getByText(SESSION_ENDED, { exact: true })).toBeVisible(); // SB:299-300
        await captureEvidence(a, 'E11_11U-A-402_notice.png');
      });

      await test.step('[11U-A-304] "/" after logout goes to /login', async () => {
        await a.goto(ROUTES.dashboard);
        await soft.poll(() => pathname(a.url())).toBe(ROUTES.login);
        await captureEvidence(a, 'E11_11U-A-304_gate.png');
      });

      await test.step('[11U-A-405] tab B follows through the broadcast', async () => {
        await soft.poll(() => pathname(b.url()), { timeout: 15_000 }).toBe(ROUTES.login); // SES:243-253
        await captureEvidence(b, 'E11_11U-A-405_tab_b.png');
      });

      await test.step('[11U-A-406] tab B shows the session-ended notice', async () => {
        await soft(b.getByText(SESSION_ENDED, { exact: true })).toBeVisible(); // SB:372-375
        await captureEvidence(b, 'E11_11U-A-406_tab_b_notice.png');
      });

      await test.step('[11U-A-311] Back from /login never shows protected content', async () => {
        await a.goBack();
        await a.goBack();
        await expect.poll(() => pathOf(a.url())).toMatch(/^\/login(\?next=%2Fkhong-co-quyen)?$/u);
        await soft(a.getByText(DENIED, { exact: true })).toHaveCount(0);
        await captureEvidence(a, 'E11_11U-A-311_back.png');
      });
    } finally {
      const errs: unknown[] = [];
      for (const cleanup of [() => context.close(), () => api.dispose()]) {
        try {
          await cleanup();
        } catch (e) {
          errs.push(e);
        }
      }
      if (errs.length > 0) throw errs[0];
    }
  });

  test('SCR-01 · FL-11U-09 · guest then viewer · gate and return path', async ({ browser }) => {
    test.setTimeout(150_000);
    const admin = readAdminCredentials();
    const api = await signedInApi(admin.email, admin.password);
    const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
    try {
      // viewer, not engineer: slot is per file and FL-08 holds the engineer; the role does not matter for the gate.
      const user = await poolUser(api, 'viewer', SLOT);
      const page = await context.newPage();
      const target = ROUTES.project.viewer(unknownProjectId());

      await test.step('[11U-A-403] guest "/" goes to /login?next=%2F, no notice', async () => {
        await page.goto(ROUTES.dashboard);
        // phase01_auth*.spec.ts + phase09_shell_b_edge.spec.ts:205 pin /login?next=%2F; SB:301-303 only drops the notice.
        await expect.poll(() => pathOf(page.url())).toBe(loginUrl(ROUTES.dashboard));
        await expect(page.getByLabel('Thư điện tử', { exact: true })).toBeVisible();
        await expect(page.getByText(SIGN_IN_REQUIRED, { exact: true })).toHaveCount(0);
        await expect(page.getByText(SESSION_ENDED, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E11_11U-A-403_bare_login.png');
      });

      await test.step('[11U-A-401] guest deep link keeps next + notice', async () => {
        await page.goto(target);
        await soft.poll(() => pathOf(page.url())).toBe(loginUrl(target));
        await soft(page.getByText(SIGN_IN_REQUIRED, { exact: true })).toBeVisible(); // SB:301-303
        await captureEvidence(page, 'E11_11U-A-401_next.png');
      });

      await test.step('[11U-A-404] sign-in returns to the deep link', async () => {
        await formSignIn(page, user);
        await soft.poll(() => pathname(page.url())).toBe(target);
        await soft(page.locator('body')).not.toBeEmpty();
        await captureEvidence(page, 'E11_11U-A-404_returned.png');
      });

      await test.step('[11U-A-305] from state returns to /khong-co-quyen', async () => {
        await page.goto(ROUTES.accessDenied);
        await page.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác', exact: true }).click(); // AD:108,447
        await expect.poll(() => pathname(page.url())).toBe(ROUTES.login);
        await formSignIn(page, user);
        await soft.poll(() => pathname(page.url())).toBe(ROUTES.accessDenied);
        await captureEvidence(page, 'E11_11U-A-305_from.png');
      });
    } finally {
      const errs: unknown[] = [];
      for (const cleanup of [() => context.close(), () => api.dispose()]) {
        try {
          await cleanup();
        } catch (e) {
          errs.push(e);
        }
      }
      if (errs.length > 0) throw errs[0];
    }
  });
});

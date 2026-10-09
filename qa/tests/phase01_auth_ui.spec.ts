/**
 * Phase 1 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per screen state of
 * SCR-01..SCR-04, each at 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U01_<state>_<width>.png`
 * + `U01_<state>.json` (layout metrics). Reviewed by the "verify ui" step with the qa-review-ui checklist.
 *
 * Budget 0 real login, 0 recovery calls. Anonymous loads send one bootstrap `POST /api/auth/refresh` without a
 * cookie → 401 (no limited bucket). The only submits are of EMPTY recovery forms, which FE validation stops
 * before any request (`usePasswordReset.ts` / `useInvitationAccept.ts` `submit`), plus 2 login submits in
 * `U01_login_strips_1024` answered by `page.route` ([mocked response] 401 INVALID_CREDENTIALS, 403 ORIGIN_MISMATCH):
 * they never reach the backend, so no failed attempt is counted against any address.
 * Two cases read Phase 1's admin storage state (`support/state.ts`), no new login: `U01_login_strips_1024`
 * (strip c, 1 load) then `U01_login_signed_in` (4 loads). Each load rotates the refresh cookie (AppBack
 * `apps/api/auth/sessions.py`, reuse after the grace window revokes the session), so the first reader writes
 * its rotated state back to the file before the second opens it — keep that order in the file.
 * Non-serial: each test uses its own fresh `page`.
 * Copy from `src/i18n/vi.json` (`auth.*`), as in `phase01_auth.spec.ts`; the strip case is checked against
 * `fix/qa01c-fe-master` (`/login` strips all under "Đăng nhập", fields keep room for their complaint).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../e2e/fixtures/session';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { EVIDENCE_DIR, attachJson } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';
import { verifyUi } from './support/ui-verify';

const GATED_PATH = ROUTES.project.floors('x');
const EMAIL_INVALID = 'Thư điện tử chưa đúng dạng. Kiểm tra lại phần trước và sau dấu a còng.';
const PARTIAL_NOTICE = 'Đã có thư điện tử, còn thiếu mật khẩu.';
const FORGOT_PASSWORD = 'Quên mật khẩu';
const SIGN_IN_REQUIRED = 'Hãy đăng nhập để tiếp tục.';
const EMAIL_TOO_LONG = 'Thư điện tử dài quá 254 ký tự. Kiểm tra lại địa chỉ.';
const SHOW_PASSWORD = 'Hiện mật khẩu';
const HIDE_PASSWORD = 'Ẩn mật khẩu';
const SIGNED_IN_NOTICE = 'Bạn đang đăng nhập. Đăng nhập ở đây sẽ thay cho phiên hiện tại.';
const GO_TO_PROJECTS = 'Về danh sách dự án';
// No `#token=` → `isLinkIncomplete` (BUG-005), not the server's "expired" sentence.
const INVITATION_INCOMPLETE = 'Trang này không còn mã của liên kết lời mời';
const RESET_INCOMPLETE = 'Trang này không còn mã của liên kết đặt lại mật khẩu';
const PASSWORD_REQUIRED = 'Chưa nhập mật khẩu.';
const ACCEPT_INVITATION = 'Nhận lời mời';
const SET_NEW_PASSWORD = 'Đổi mật khẩu';
const FULL_NAME_LABEL = 'Họ và tên';
const LOGIN_API = '/api/auth/login';
const STRIP_VIEWPORT = { width: 1024, height: 768 } as const;
const INVALID_CREDENTIALS_TITLE = 'Sai thư điện tử hoặc mật khẩu'; // vi:148
const RESET_PASSWORD_ACTION = 'Đặt lại mật khẩu'; // vi:129
const ORIGIN_MISMATCH_TITLE = 'Máy chủ từ chối yêu cầu'; // vi:156
const ORIGIN_MISMATCH_DESCRIPTION =
  'Máy chủ từ chối yêu cầu gửi từ địa chỉ trang này. Đây là lỗi cấu hình, không phải lỗi tài khoản — hãy báo quản trị hệ thống.'; // vi:157
/** 255 chars, well-formed: only `too_big` fires (`MAX_EMAIL_LENGTH` 254, `src/api/schemas/auth.ts`). */
const EMAIL_255 = `${'a'.repeat(64)}@${['b', 'c', 'd'].map((c) => c.repeat(61)).join('.')}.test`;

const authMain = (page: Page, state: string) => page.locator(`main[data-auth-state="${state}"]`);
const email = (page: Page) => page.getByLabel(EMAIL_LABEL, { exact: true });

async function openLogin(page: Page): Promise<void> {
  await page.goto(ROUTES.login);
  await expect(authMain(page, 'empty')).toBeVisible();
}

/**
 * One /login strip at 1024×768 only: `verifyUi` (image `U01_login_strip_<kind>_1024.png` + layout JSON), then
 * the page must not scroll vertically; the numbers go to `U01_login_strip_<kind>_1024.json` next to the image.
 */
async function checkStrip(page: Page, kind: string, open: (page: Page) => Promise<void>): Promise<void> {
  const name = `U01_login_strip_${kind}`;
  const [layout] = await verifyUi(page, name, open, [STRIP_VIEWPORT]);
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: (document.scrollingElement ?? document.documentElement).scrollHeight,
    innerHeight: window.innerHeight,
  }));
  const data = { strip: kind, scrollHeight, innerHeight, verticalOverflowPx: Math.max(0, scrollHeight - innerHeight), layout };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, `${name}_1024.json`), JSON.stringify(data, null, 2));
  await attachJson(`${name}_1024.json`, data);
  expect.soft(scrollHeight, `${kind} strip at 1024×768: page scrolls vertically`).toBeLessThanOrEqual(innerHeight);
}

test.describe('U01 UI verify — SCR-01 / SCR-02', () => {
  test('U01 · SCR-01 protected route → sign-in page with ?next=', async ({ page }) => {
    await verifyUi(page, 'U01_gate_login', async (p) => {
      await p.goto(GATED_PATH);
      await expect.poll(() => new URL(p.url()).pathname).toBe(ROUTES.login);
      await expect(email(p)).toBeVisible();
      // SessionBootstrap passes `state.notice = 'signInRequired'` when `next` is not the dashboard (BUG-007).
      await expect(p.getByText(SIGN_IN_REQUIRED, { exact: true })).toBeVisible();
    });
  });

  test('U01 · SCR-02 sign-in, empty form', async ({ page }) => {
    await verifyUi(page, 'U01_login_empty', openLogin);
  });

  test('U01 · SCR-02 sign-in, invalid e-mail message', async ({ page }) => {
    await verifyUi(page, 'U01_login_email_invalid', async (p) => {
      await openLogin(p);
      await email(p).fill('khong-hop-le');
      await email(p).blur();
      await expect(p.getByText(EMAIL_INVALID)).toBeVisible();
    });
  });

  test('U01 · SCR-02 sign-in, partial state (e-mail only)', async ({ page }) => {
    await verifyUi(page, 'U01_login_partial', async (p) => {
      await openLogin(p);
      await email(p).fill('qa-ui@example.test');
      await email(p).blur();
      await expect(p.getByText(PARTIAL_NOTICE)).toBeVisible();
    });
  });

  test('U01 · SCR-02 sign-in, e-mail over 254 characters (long data)', async ({ page }) => {
    await verifyUi(page, 'U01_login_email_too_long', async (p) => {
      await openLogin(p);
      await email(p).fill(EMAIL_255);
      await email(p).blur();
      await expect(p.getByText(EMAIL_TOO_LONG, { exact: true })).toBeVisible();
    });
  });

  test('U01 · SCR-02 sign-in, password shown (eye button)', async ({ page }) => {
    await verifyUi(page, 'U01_login_password_shown', async (p) => {
      await openLogin(p);
      await p.getByLabel(PASSWORD_LABEL, { exact: true }).fill('qa-ui-not-a-password');
      await p.getByRole('button', { name: SHOW_PASSWORD, exact: true }).click();
      await expect(p.getByRole('button', { name: HIDE_PASSWORD, exact: true })).toBeVisible();
      await expect(p.getByLabel(PASSWORD_LABEL, { exact: true })).toHaveAttribute('type', 'text');
    });
  });

  test('U01 · SCR-02 forgot-password panel', async ({ page }) => {
    await verifyUi(page, 'U01_login_forgot', async (p) => {
      await openLogin(p);
      // BUG-009: the first click on a fresh /login may not open the panel — retry the click, not the assertion.
      await expect(async () => {
        await p.getByRole('button', { name: FORGOT_PASSWORD, exact: true }).click();
        await expect(p.getByRole('heading', { level: 1, name: FORGOT_PASSWORD, exact: true })).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 15_000 });
    });
  });

  // Must stay BEFORE the "signed in" describe: strip (c) reads the admin storage state first and writes the
  // rotated cookie back, so `U01_login_signed_in` still reads a live refresh cookie (see header).
  test('U01_login_strips_1024 · [mocked response] SCR-02 tallest strips at 1024×768 → no vertical scroll', async ({ page, browser }) => {
    // Every strip sits UNDER "Đăng nhập" and each field keeps room for its complaint (qa01c AuthScreen.tsx:126-127,
    // 168-186), so at 1024×768 none of them may push the page past the fold.
    const mocked = {
      wrong: { status: 401, code: 'INVALID_CREDENTIALS' }, // useAuthScreen.ts:265-266, 294-300 (showResetAction)
      origin: { status: 403, code: 'ORIGIN_MISMATCH' }, // useAuthScreen.ts:269-270, 307-312
    } as const;
    let reply: { readonly status: number; readonly code: string } = mocked.wrong;
    const loginCalls: number[] = [];
    await page.route(
      (url) => url.pathname === LOGIN_API,
      async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        loginCalls.push(reply.status);
        // BE error envelope {code, requestId} (as phase01_auth_edge.spec.ts `wire`); never reaches the backend.
        return route.fulfill({
          status: reply.status,
          contentType: 'application/json',
          body: JSON.stringify({ requestId: 'req_u01', code: reply.code }),
        });
      },
    );

    const submitWithMock = async (p: Page): Promise<void> => {
      await openLogin(p);
      await email(p).fill('qa-ui-strip@example.test');
      await p.getByLabel(PASSWORD_LABEL, { exact: true }).fill('qa-ui-not-a-password');
      await p.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
    };

    // (a) wrong password + "Đặt lại mật khẩu" under the strip.
    await checkStrip(page, 'wrong', async (p) => {
      await submitWithMock(p);
      await expect(p.getByText(INVALID_CREDENTIALS_TITLE, { exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: RESET_PASSWORD_ACTION, exact: true })).toBeVisible();
    });

    // (b) originMismatch: the longest strip sentence, no action.
    reply = mocked.origin;
    await checkStrip(page, 'origin', async (p) => {
      await submitWithMock(p);
      await expect(p.getByText(ORIGIN_MISMATCH_TITLE, { exact: true })).toBeVisible();
      await expect(p.getByText(ORIGIN_MISMATCH_DESCRIPTION, { exact: true })).toBeVisible();
    });
    expect(loginCalls, 'mocked login POSTs (one per strip, none reached the backend)').toEqual([401, 403]);

    // (c) signed in: real refresh with the admin storage state, as `U01_login_signed_in`; no login.
    const signedIn = await browser.newContext({ baseURL: readBaseUrl(), viewport: STRIP_VIEWPORT, storageState: ADMIN_STORAGE_STATE_FILE });
    try {
      await checkStrip(await signedIn.newPage(), 'signed_in', async (p) => {
        await p.goto(ROUTES.login);
        await expect(p.getByText(SIGNED_IN_NOTICE, { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect(p.getByRole('button', { name: GO_TO_PROJECTS, exact: true })).toBeVisible();
      });
    } finally {
      // The /login load rotated the refresh cookie; hand the live one to the next reader of the file.
      await signedIn.storageState({ path: ADMIN_STORAGE_STATE_FILE });
      await signedIn.close();
    }
  });
});

test.describe('U01 UI verify — SCR-02 signed in', () => {
  // Written by phase01_auth.spec.ts `persistSession` (main layer runs first); missing file = ENOENT at context start.
  test.use({ storageState: ADMIN_STORAGE_STATE_FILE });

  test('U01 · SCR-02 /login while signed in → "already signed in" strip', async ({ page }) => {
    await verifyUi(page, 'U01_login_signed_in', async (p) => {
      await p.goto(ROUTES.login);
      await expect(p.getByText(SIGNED_IN_NOTICE, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByRole('button', { name: GO_TO_PROJECTS, exact: true })).toBeVisible();
    });
  });
});

test.describe('U01 UI verify — SCR-03 / SCR-04', () => {
  test('U01 · SCR-03 invitation without token → dead-end', async ({ page }) => {
    await verifyUi(page, 'U01_invite_deadend', async (p) => {
      await p.goto(ROUTES.invitationAccept);
      await expect(p.getByText(INVITATION_INCOMPLETE)).toBeVisible();
    });
  });

  test('U01 · SCR-03 invitation form (#token=bogus, nothing submitted)', async ({ page }) => {
    await verifyUi(page, 'U01_invite_form', async (p) => {
      await p.goto(`${ROUTES.invitationAccept}#token=bogus`);
      await expect(p.getByLabel(FULL_NAME_LABEL, { exact: true })).toBeVisible();
    });
  });

  test('U01 · SCR-03 invitation form, empty submit → field errors (no request)', async ({ page }) => {
    await verifyUi(page, 'U01_invite_required', async (p) => {
      await p.goto(`${ROUTES.invitationAccept}#token=bogus`);
      // Enabled once the bootstrap refresh settles (`canSubmit` waits for `isSessionPending`).
      await p.getByRole('button', { name: ACCEPT_INVITATION, exact: true }).click();
      await expect(p.getByText(PASSWORD_REQUIRED, { exact: true })).toBeVisible();
    });
  });

  test('U01 · SCR-04 reset without token → dead-end', async ({ page }) => {
    await verifyUi(page, 'U01_reset_deadend', async (p) => {
      await p.goto(ROUTES.passwordReset);
      await expect(p.getByText(RESET_INCOMPLETE)).toBeVisible();
    });
  });

  test('U01 · SCR-04 reset form (#token=bogus, nothing submitted)', async ({ page }) => {
    await verifyUi(page, 'U01_reset_form', async (p) => {
      await p.goto(`${ROUTES.passwordReset}#token=bogus`);
      await expect(p.locator('main input[type="password"]').first()).toBeVisible();
    });
  });

  test('U01 · SCR-04 reset form, empty submit → field errors (no request)', async ({ page }) => {
    await verifyUi(page, 'U01_reset_required', async (p) => {
      await p.goto(`${ROUTES.passwordReset}#token=bogus`);
      await p.getByRole('button', { name: SET_NEW_PASSWORD, exact: true }).click();
      await expect(p.getByText(PASSWORD_REQUIRED, { exact: true })).toBeVisible();
    });
  });
});

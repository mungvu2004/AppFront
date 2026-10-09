/**
 * Phase 1 — Auth, Track A (E2E-TEST-PLAN.md §4, SCR-01 → SCR-04). Start of a run: `resetState()`,
 * first statement of the first test (NOT `beforeAll`: after a failure Playwright restarts the worker and
 * re-runs `beforeAll`, which would wipe the session an earlier test saved).
 *
 * Default (non-serial) mode: a failing case does not skip the others. With one worker and no retries
 * the tests still run in file order, but none relies on a previous one: each starts with
 * `ensureAnonymous` or `ensureSignedIn` (both no-ops when already in that state) and opens its own page.
 * Every test that ends signed in re-saves the session, so it is valid even if a later test fails.
 *
 * One shared admin context/page per worker (anonymous until the SCR-02 P0 login). Exceptions, both
 * forced by the matrix itself:
 * - SCR-03/SCR-04 are "∅": they run in their own anonymous context (created lazily, so it survives a
 *   worker restart), because the shared one is signed in by then.
 * - SCR-01 session expiry runs LAST (it kills the session) in a second describe, then signs in again
 *   and re-saves the storage state. Tab B is a second PAGE of the shared context, not a second context:
 *   the cross-tab sign-out travels over `BroadcastChannel('auth')` (`src/lib/auth/events.ts`,
 *   `session.ts` DEFAULT_BROADCAST_CHANNEL_NAME), which only reaches pages of the same browser context.
 *
 * UI strings are copied from `src/i18n/vi.json` (`auth.*`); network contracts from
 * `e2e/fullstack/chain.fullstack.ts` step 1.
 */
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page, Request, Response } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../e2e/fixtures/session';
import { waitForApiWhere, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE, resetState, updateState } from './support/state';

/** Refresh cookie: `chain.fullstack.ts:44`, attributes asserted there at :187-193 (green on 2026-10-06). */
const REFRESH_COOKIE = 'appback_refresh';
const LOGIN_API = '/api/auth/login';
const REFRESH_API = /^\/api\/auth\/refresh$/u;
/** `src/api/endpoints.ts`: auth.passwordReset / auth.invitationAccept, under the `/api` base. */
const PASSWORD_RESET_API = '/api/auth/password-reset';
const INVITATION_ACCEPT_API = '/api/auth/invitations/accept';

const VIEWPORT = { width: 1440, height: 900 } as const;
const GATED_PATH = ROUTES.project.floors('x');

/* `src/i18n/vi.json` → `auth.*`. */
const EMAIL_INVALID = 'Thư điện tử chưa đúng dạng. Kiểm tra lại phần trước và sau dấu a còng.';
const PARTIAL_NOTICE = 'Đã có thư điện tử, còn thiếu mật khẩu.';
const SHOW_PASSWORD = 'Hiện mật khẩu';
const HIDE_PASSWORD = 'Ẩn mật khẩu';
const INVALID_CREDENTIALS_TITLE = 'Sai thư điện tử hoặc mật khẩu';
const RESET_PASSWORD_ACTION = 'Đặt lại mật khẩu';
const FORGOT_PASSWORD = 'Quên mật khẩu';
const BACK_TO_SIGN_IN = 'Quay lại đăng nhập';
const SSO_SIGN_IN = 'Đăng nhập bằng SSO công ty'; // vi.json:127 — asserted ABSENT (BUG-002)
const OR_DIVIDER = 'Hoặc'; // vi.json:126
const SESSION_ENDED_NOTICE = 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.';
const GO_TO_SIGN_IN = 'Về trang đăng nhập';
/*
 * No `#token` at all → `isLinkIncomplete` (useInvitationAccept.ts:340, usePasswordReset.ts:252) → the
 * "incomplete" sentence (InvitationAccept.tsx:86, PasswordReset.tsx:65-67; BUG-005). The "đã hết hạn"
 * sentence is only for a token the server rejected (422), so here it must be ABSENT.
 */
const INVITATION_DEAD_END_SUBTITLE = 'Liên kết này không mở được lời mời.'; // vi.json:179
const INVITATION_INCOMPLETE =
  'Trang này không còn mã của liên kết lời mời (trang đã được tải lại hoặc liên kết bị cắt). Hãy mở lại đúng liên kết trong thư mời, hoặc nhờ quản trị viên gửi lại lời mời.'; // vi.json:181
const INVITATION_EXPIRED = 'Lời mời đã hết hạn hoặc đã được dùng.'; // vi.json:180 (prefix)
const FULL_NAME_LABEL = 'Họ và tên';
const CONFIRM_PASSWORD_LABEL = 'Nhập lại mật khẩu';
const ACCEPT_INVITATION = 'Nhận lời mời';
const CONFIRM_MISMATCH = 'Hai mật khẩu chưa giống nhau.';
const RESET_DEAD_END_SUBTITLE = 'Liên kết này không đặt lại được mật khẩu.'; // vi.json:190
const RESET_LINK_INCOMPLETE =
  'Trang này không còn mã của liên kết đặt lại mật khẩu (trang đã được tải lại hoặc liên kết bị cắt). Hãy mở lại đúng liên kết trong thư, hoặc yêu cầu liên kết mới ở trang đăng nhập.'; // vi.json:192
const RESET_LINK_EXPIRED = 'Liên kết đã hết hạn hoặc đã được dùng.'; // vi.json:191 (prefix)

/** `ProjectDashboard.tsx:196` (h1) and `FloorManager.tsx:63,91` (h2): proof the destination painted. */
const DASHBOARD_TITLE = 'Dự án của tôi';
const FLOOR_MANAGER_TITLE = 'Quản lý tầng';

/** ≥ 8 chars so client validation lets it through to the server (`PasswordSchema`). Never the real one. */
const WRONG_PASSWORD = 'sai-mat-khau-e2e-01';
/** Typed only to make the eye toggle visible on screen; never submitted. */
const DUMMY_PASSWORD = 'an-hien-e2e';

const authMain = (page: Page, state: string) => page.locator(`main[data-auth-state="${state}"]`);
const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/**
 * Status-only wait. Chromium never hands Playwright the body of the auth 401s (compose run
 * 2026-10-08: the bootstrap refresh 401 was sent at +121 ms, `response.text()` hung until close),
 * so `waitForApi*`, which only accepts a response whose body it could read, timed out. These waits
 * assert the status; the body is not needed.
 */
function waitForStatus(
  page: Page,
  method: string,
  path: RegExp,
  statuses: readonly number[],
): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      path.test(new URL(response.url()).pathname) &&
      statuses.includes(response.status()),
  );
}

/** Open a page and wait for its session bootstrap (`POST /api/auth/refresh`) to answer with `status`. */
async function openWithBootstrap(page: Page, url: string, status: 401 | 200): Promise<void> {
  const answered = waitForStatus(page, 'POST', REFRESH_API, [status]);
  await page.goto(url, { waitUntil: 'commit' });
  await answered;
}

/** Next `POST /api/auth/login` whatever its status, so a wrong status fails with the status, not a timeout. */
function nextLogin(page: Page): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === LOGIN_API,
  );
}

const isLogin204 = (entry: ApiEntry): boolean =>
  entry.method === 'POST' && entry.path === LOGIN_API && entry.status === 204;
const isRefresh200 = (entry: ApiEntry): boolean =>
  entry.method === 'POST' && REFRESH_API.test(entry.path) && entry.status === 200;

/** True once the log (from `mark`) holds a login 204 followed by a refresh 200. */
function refreshFollowedLogin(api: readonly ApiEntry[], mark: number): boolean {
  const since = api.slice(mark);
  const login = since.findIndex(isLogin204);

  return login >= 0 && since.slice(login + 1).some(isRefresh200);
}

/**
 * Fill the admin credentials on the sign-in form already on screen and submit.
 * Asserts `POST /api/auth/login` 204, then `POST /api/auth/refresh` 200 (`withSession` →
 * `bootstrapAfterNewCookie`). The caller waited for the page's own bootstrap refresh first, so the
 * refresh counted here is the one the login caused, not the page load's.
 */
async function submitAdminCredentials(page: Page, api: readonly ApiEntry[]): Promise<void> {
  const { email, password } = readAdminCredentials();
  const mark = api.length;
  const login = nextLogin(page);

  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(email);
  // `exact`: otherwise it also matches the "Hiện mật khẩu" button.
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(password);
  await button(page, SIGN_IN_LABEL).click();

  expect((await login).status(), `POST ${LOGIN_API}`).toBe(204);
  await expect
    .poll(() => refreshFollowedLogin(api, mark), {
      message: 'POST /api/auth/refresh 200 after the login 204',
    })
    .toBe(true);
}

async function refreshCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === REFRESH_COOKIE);
}

/**
 * Hand the session to phases 2–11: storage state file + `session.*` in the runtime state.
 * `session.token` stays null on purpose: the access token lives only in tab memory
 * (`src/lib/auth/state.ts` `sessionState.accessToken`; the login screen never stores one —
 * `AuthScreen.container.tsx` "Signing in does not store a token"). Nothing readable to record.
 */
async function persistSession(context: BrowserContext): Promise<void> {
  const cookie = await refreshCookie(context);

  if (cookie === undefined) {
    throw new Error(
      `No "${REFRESH_COOKIE}" cookie after sign-in: nothing to hand to the later phases`,
    );
  }
  await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
  updateState((draft) => {
    draft.session.cookie = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    };
    draft.session.token = null;
    draft.session.storageStatePath = ADMIN_STORAGE_STATE_FILE;
  });
}

/** `/api/` requests sent by `page` from now on (for "no request" rows). */
function recordApiRequests(page: Page): { readonly sent: string[]; readonly stop: () => void } {
  const sent: string[] = [];
  const onRequest = (request: Request): void => {
    const { pathname } = new URL(request.url());

    if (pathname.startsWith('/api/')) sent.push(`${request.method()} ${pathname}`);
  };

  page.on('request', onRequest);
  return { sent, stop: () => page.off('request', onRequest) };
}

/** Precondition "anonymous": drop the cookies; the test's own `goto` then drops the in-memory token. */
async function ensureAnonymous(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/** Precondition "signed in" on the shared page: no-op while the refresh cookie is there. */
async function ensureSignedIn(page: Page): Promise<void> {
  if ((await refreshCookie(page.context())) !== undefined) return;
  await openWithBootstrap(page, ROUTES.login, 401);
  await submitAdminCredentials(page, api);
  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
}

/** Open the sign-in form, anonymous, and wait until it painted (so later request logs start clean). */
async function openAnonymousLogin(page: Page): Promise<void> {
  await ensureAnonymous(page);
  await openWithBootstrap(page, ROUTES.login, 401);
  await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();
}

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];

// Re-runs after a worker restart: a fresh context, never `resetState()`.
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  page = await context.newPage();
  api = watchApi(page);
});

test.afterAll(async () => {
  // No logout here: logout is Phase 11. The session was saved by the last test that ended signed in.
  await context.close();
});

test.describe('SCR-01 Session gate', () => {
  test('SCR-01 · anonymous /projects/x/floors redirects to /login?next=%2Fprojects%2Fx%2Ffloors', async () => {
    resetState();
    await ensureAnonymous(page);
    await openWithBootstrap(page, GATED_PATH, 401);

    await expect.poll(() => pathOf(page.url())).toBe(loginUrl(GATED_PATH));
    expect(loginUrl(GATED_PATH)).toBe('/login?next=%2Fprojects%2Fx%2Ffloors');
    await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();
    await attachJson('01_gate_redirect.json', { gatedPath: GATED_PATH, landedUrl: pathOf(page.url()) }); // BUG-034: URL not in the shot
    await captureEvidence(page, '01_gate_redirect.png');
  });
});

test.describe('SCR-02 Login', () => {
  test('SCR-02 · bad "Thư điện tử" then blur shows the format problem', async () => {
    await openAnonymousLogin(page);
    const email = page.getByLabel(EMAIL_LABEL, { exact: true });

    await email.fill('khong-hop-le');
    await email.press('Tab');

    await expect(page.getByText(EMAIL_INVALID, { exact: true })).toBeVisible();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await captureEvidence(page, '02_login_email_invalid.png');
  });

  test('SCR-02 · email filled, "Mật khẩu" empty → partial state', async () => {
    const { email } = readAdminCredentials();

    await openAnonymousLogin(page);
    await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(email);
    await expect(page.getByLabel(PASSWORD_LABEL, { exact: true })).toHaveValue('');

    await expect(authMain(page, 'partial')).toBeVisible();
    await expect(page.getByText(PARTIAL_NOTICE, { exact: true })).toBeVisible();
    await captureEvidence(page, '02_login_partial.png');
  });

  test('SCR-02 · "Hiện mật khẩu" / "Ẩn mật khẩu" toggles the input type', async () => {
    const password = page.getByLabel(PASSWORD_LABEL, { exact: true });

    await openAnonymousLogin(page);
    // Same screen as the old serial run: admin email already typed (partial state), then the dummy.
    await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(readAdminCredentials().email);
    await password.fill(DUMMY_PASSWORD);
    await expect(password).toHaveAttribute('type', 'password');

    await button(page, SHOW_PASSWORD).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(button(page, HIDE_PASSWORD)).toBeVisible();
    await captureEvidence(page, '02_login_eye.png');

    await button(page, HIDE_PASSWORD).click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(button(page, SHOW_PASSWORD)).toBeVisible();
  });

  test('SCR-02 · ONE wrong password → "Sai thư điện tử hoặc mật khẩu" + "Đặt lại mật khẩu"', async () => {
    // Exactly one attempt: the server locks the address out with a 429 after repeated failures.
    const { email, password } = readAdminCredentials();

    if (password === WRONG_PASSWORD)
      throw new Error('The admin password equals the wrong-password probe');
    await openAnonymousLogin(page);
    const login = nextLogin(page);

    await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(email);
    await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(WRONG_PASSWORD);
    await button(page, SIGN_IN_LABEL).click();

    // `AuthScreen.container.tsx`: "on ENDPOINTS.auth.login a 401 *is* the answer".
    expect((await login).status(), `POST ${LOGIN_API} with a wrong password`).toBe(401);
    await expect(page.getByText(INVALID_CREDENTIALS_TITLE, { exact: true })).toBeVisible();
    await expect(button(page, RESET_PASSWORD_ACTION)).toBeVisible();
    await expect(authMain(page, 'error')).toBeVisible();
    await captureEvidence(page, '02_login_wrong.png');
  });

  test('[BUG-009] SCR-02 · "Quên mật khẩu" opens the panel; "Quay lại đăng nhập" and Esc close it (no submit)', async () => {
    // EXPECTED TO FAIL until the BUG-009 fix (commit ceb9cf5b, branch fix/qa01-fe-master) is in the tested build:
    // the user's REAL first click right after the autofocused email box is swallowed. Kept on purpose — no blur
    // workaround — so this plan case keeps checking what a user does (BUG-054).
    await openAnonymousLogin(page);
    const requests = recordApiRequests(page);

    try {
      await button(page, FORGOT_PASSWORD).click();
      await expect(h1(page, FORGOT_PASSWORD)).toBeVisible();
      await captureEvidence(page, '02_login_forgot_panel.png');

      await button(page, BACK_TO_SIGN_IN).click();
      await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();

      await button(page, FORGOT_PASSWORD).click();
      await expect(h1(page, FORGOT_PASSWORD)).toBeVisible();
      // The panel focuses its email box on open; Esc is handled by the panel's form (`ForgotPasswordPanel.tsx`).
      await expect(page.getByLabel(EMAIL_LABEL, { exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();

      const resetRequests = requests.sent.filter((line) => line.endsWith(PASSWORD_RESET_API));
      expect(resetRequests).toEqual([]);
      await attachJson('02_login_forgot_panel.json', { resetRequests: resetRequests.length }); // BUG-034
    } finally {
      requests.stop();
    }
  });

  test('SCR-02 · no SSO flow wired → no "Đăng nhập bằng SSO công ty" button and no "Hoặc" divider (F-04, BUG-002)', async () => {
    // BUG-002 fix: a button that does nothing is a dead end, so it renders only when the host passes
    // `onSsoSignIn` (useAuthScreen.ts:187-189,781; AuthScreen.tsx:190-209). The only host,
    // AuthScreen.container.tsx:372-379, passes none → neither the divider nor the button is in the DOM.
    await openAnonymousLogin(page);

    await expect(button(page, SIGN_IN_LABEL)).toBeVisible();
    await expect(button(page, SSO_SIGN_IN), 'SSO button absent').toHaveCount(0);
    await expect(page.getByText(OR_DIVIDER, { exact: true }), '"Hoặc" divider absent').toHaveCount(0);
    await captureEvidence(page, '02_login_no_sso.png');
  });

  test('SCR-02 · valid credentials → login 204, refresh 200, lands on /, refresh cookie is httpOnly/Secure/Strict', async () => {
    await ensureAnonymous(page);
    await openWithBootstrap(page, ROUTES.login, 401);
    await submitAdminCredentials(page, api);

    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
    // The URL flips before the lazy screen paints; capture the dashboard, not the "Đang tải màn hình" shell.
    await expect(h1(page, DASHBOARD_TITLE)).toBeVisible();
    await captureEvidence(page, '02_login_submitted.png');

    const cookie = await refreshCookie(context);
    const cookieAttributes =
      cookie === undefined
        ? null
        : {
            name: cookie.name,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          };

    expect(cookieAttributes).toEqual({ name: REFRESH_COOKIE, httpOnly: true, secure: true, sameSite: 'Strict' });
    // BUG-034: statuses and cookie flags are not in the shot (submitAdminCredentials asserted 204 then 200).
    await attachJson('02_login_submitted.json', {
      loginStatus: 204,
      refreshAfterLogin: 200,
      landed: pathOf(page.url()),
      refreshCookie: cookieAttributes,
    });
    await persistSession(context);
  });

  test('SCR-02 · /login?next=/projects/x/floors then sign in lands on the next path', async () => {
    await ensureSignedIn(page);
    await openWithBootstrap(page, loginUrl(GATED_PATH), 200);
    await submitAdminCredentials(page, api);

    await expect.poll(() => pathOf(page.url())).toBe(GATED_PATH);
    await expect(
      page.getByRole('heading', { level: 2, name: FLOOR_MANAGER_TITLE, exact: true }),
    ).toBeVisible();
    await attachJson('02_login_next.json', { next: GATED_PATH, landed: pathOf(page.url()) }); // BUG-034
    await captureEvidence(page, '02_login_next.png');
    await persistSession(context);
  });

  test('SCR-02 · ?next=https://example.org/ and ?next=//example.org stay in-app at / (safeDestination)', async () => {
    const appOrigin = new URL(readBaseUrl()).origin;

    const landed: Record<string, string> = {};

    await ensureSignedIn(page);

    for (const next of ['https://example.org/', '//example.org']) {
      await openWithBootstrap(page, loginUrl(next), 200);
      await submitAdminCredentials(page, api);

      await expect
        .poll(() => pathOf(page.url()), { message: `next=${next}` })
        .toBe(ROUTES.dashboard);
      expect(new URL(page.url()).origin, `next=${next}`).toBe(appOrigin);
      await expect(h1(page, DASHBOARD_TITLE), `next=${next}`).toBeVisible();
      landed[next] = page.url();
    }
    await attachJson('02_login_next_open_redirect.json', { appOrigin, landedUrlByNext: landed }); // BUG-034
    await captureEvidence(page, '02_login_next_open_redirect.png');
    await persistSession(context);
  });

  test('SCR-02 · signed in, /login shows the form with no redirect (G1)', async () => {
    await ensureSignedIn(page);
    await openWithBootstrap(page, ROUTES.login, 200);

    await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();
    await expect(page.getByLabel(EMAIL_LABEL, { exact: true })).toBeVisible();
    await expect(authMain(page, 'empty')).toBeVisible();
    expect(pathOf(page.url())).toBe(ROUTES.login);
    await attachJson('02_login_signed_in.json', { url: pathOf(page.url()), redirected: false }); // BUG-034
    await captureEvidence(page, '02_login_signed_in.png');
    await persistSession(context);
  });
});

/*
 * SCR-03 / SCR-04 are "∅" in the matrix and the shared window is signed in by now, so both run in ONE
 * anonymous window, one after the other (signing out is Phase 11's job: the only logout is /khong-co-quyen).
 * Created by whichever of them runs first in this worker, so a worker restart between them gets a new one.
 */
test.describe('Anonymous window (SCR-03, SCR-04)', () => {
  let anonContext: BrowserContext | undefined;
  let anonPage: Page | undefined;

  async function anonWindow(browser: Browser): Promise<Page> {
    if (anonPage === undefined) {
      anonContext = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
      anonPage = await anonContext.newPage();
    }
    return anonPage;
  }

  test.afterAll(async () => {
    await anonContext?.close();
    anonContext = undefined;
    anonPage = undefined;
  });

  test.describe('SCR-03 Invitation', () => {
    test('SCR-03 · /login/invitation without a hash is the dead-end', async ({ browser }) => {
      const anon = await anonWindow(browser);

      await anon.goto(ROUTES.invitationAccept);

      await expect(authMain(anon, 'forbidden')).toBeVisible();
      await expect(anon.getByText(INVITATION_DEAD_END_SUBTITLE, { exact: true })).toBeVisible();
      await expect(anon.getByText(INVITATION_INCOMPLETE, { exact: true })).toBeVisible();
      await expect(anon.getByText(INVITATION_EXPIRED), '"đã hết hạn" only after a real 422').toHaveCount(0);
      await expect(anon.getByRole('link', { name: GO_TO_SIGN_IN, exact: true })).toBeVisible();
      await captureEvidence(anon, '03_invite_deadend.png');
    });

    test('SCR-03 · #token=bogus: mismatched passwords → "Hai mật khẩu chưa giống nhau."; #token stripped', async ({ browser }) => {
      const anon = await anonWindow(browser);

      // Leave the page first: a hash-only `goto` on the same path is a same-document navigation, and the
      // token is read once, in the `useState` initializer (`fragmentToken.ts`).
      await anon.goto('about:blank');
      await openWithBootstrap(anon, `${ROUTES.invitationAccept}#token=bogus`, 401);

      await expect(anon.getByLabel(FULL_NAME_LABEL, { exact: true })).toBeVisible();
      await expect.poll(() => new URL(anon.url()).hash).toBe('');
      expect(pathOf(anon.url())).toBe(ROUTES.invitationAccept);

      const requests = recordApiRequests(anon);

      try {
        await anon.getByLabel(FULL_NAME_LABEL, { exact: true }).fill('E2E QA');
        await anon.getByLabel(PASSWORD_LABEL, { exact: true }).fill('mat-khau-e2e-1');
        await anon.getByLabel(CONFIRM_PASSWORD_LABEL, { exact: true }).fill('mat-khau-e2e-2');
        // The mismatch is checked on submit, client-side, before anything is sent (`useInvitationAccept.ts`).
        await button(anon, ACCEPT_INVITATION).click();

        await expect(anon.getByText(CONFIRM_MISMATCH, { exact: true })).toBeVisible();
        const acceptRequests = requests.sent.filter((line) => line.endsWith(INVITATION_ACCEPT_API));
        expect(acceptRequests).toEqual([]);
        // BUG-034: the stripped hash and the absent request are not in the shot.
        await attachJson('03_invite_validation.json', { url: anon.url(), acceptRequests: acceptRequests.length });
        await captureEvidence(anon, '03_invite_validation.png');
      } finally {
        requests.stop();
      }
    });
  });

  test.describe('SCR-04 Password reset', () => {
    test('SCR-04 · /login/reset-password without a hash is the dead-end', async ({ browser }) => {
      const anon = await anonWindow(browser);

      await anon.goto(ROUTES.passwordReset);

      await expect(authMain(anon, 'forbidden')).toBeVisible();
      await expect(anon.getByText(RESET_DEAD_END_SUBTITLE, { exact: true })).toBeVisible();
      await expect(anon.getByText(RESET_LINK_INCOMPLETE, { exact: true })).toBeVisible();
      await expect(anon.getByText(RESET_LINK_EXPIRED), '"đã hết hạn" only after a real 422').toHaveCount(0);
      await expect(anon.getByRole('link', { name: GO_TO_SIGN_IN, exact: true })).toBeVisible();
      await captureEvidence(anon, '04_reset_deadend.png');
    });
  });
});

/*
 * Last on purpose: it kills the session, then signs in again and re-saves it.
 *
 * Mechanism (verified in source):
 * - The refresh cookie is cleared with `context.clearCookies`; the access token is memory-only
 *   (`state.ts`), so reloading tab A drops it. A's bootstrap refresh then gets 401 →
 *   `createRefreshFailure()` (`refresh.ts`) → `broadcastAuthIntent('signed-out')`.
 * - Tab B was authenticated and receives the broadcast → anonymous; `SessionBootstrap` sees
 *   authenticated → anonymous and redirects with `state.notice = 'sessionEnded'`, shown by the login
 *   strip as "Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại."
 * PLAN DEVIATION: the matrix expects the notice on tab A too. A reloaded tab starts `unknown`, not
 * `authenticated`, so `SessionBootstrap` redirects it WITHOUT the notice; only its landing on /login is
 * asserted. No in-page trigger for an immediate refresh exists without a reload (the proactive timer
 * fires ~60 s before token expiry; API calls still carry the valid in-memory token).
 */
test.describe('SCR-01 Session expiry (cross-tab)', () => {
  test('SCR-01 · refresh cookie gone: tab A back to /login, tab B signed out with the sessionEnded notice', async () => {
    await ensureSignedIn(page);
    await openWithBootstrap(page, ROUTES.dashboard, 200);
    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);

    const tabB = await context.newPage();

    try {
      // B's bootstrap broadcasts "signed-in"; A answers with its own refresh (`session.ts` onSignedIn).
      // Wait for both, so the rotated cookie is settled before it is cleared.
      const aFollows = waitForApiWhere(
        page,
        (response) =>
          response.request().method() === 'POST' &&
          REFRESH_API.test(new URL(response.url()).pathname) &&
          response.status() === 200,
        undefined,
        'tab A refresh after tab B signed in',
      );

      await openWithBootstrap(tabB, ROUTES.dashboard, 200);
      await aFollows;
      await expect.poll(() => pathOf(tabB.url())).toBe(ROUTES.dashboard);

      await context.clearCookies({ name: REFRESH_COOKIE });
      expect(await refreshCookie(context)).toBeUndefined();

      // Reload = drop A's in-memory access token and trigger the bootstrap refresh, now cookie-less.
      const cookieless = waitForStatus(page, 'POST', REFRESH_API, [401]);
      await page.reload({ waitUntil: 'commit' });
      await cookieless;

      await expect
        .poll(() => pathOf(page.url()), { message: 'tab A' })
        .toBe(loginUrl(ROUTES.dashboard));
      await expect
        .poll(() => pathOf(tabB.url()), { message: 'tab B' })
        .toBe(loginUrl(ROUTES.dashboard));
      await expect(tabB.getByText(SESSION_ENDED_NOTICE, { exact: true })).toBeVisible();
      // BUG-034: tab A, the cleared cookie and the 401 are not in tab B's shot.
      await attachJson('01_session_ended_crosstab.json', {
        refreshCookieCleared: true,
        tabABootstrapRefresh: 401,
        tabA: pathOf(page.url()),
        tabB: pathOf(tabB.url()),
      });
      await captureEvidence(tabB, '01_session_ended_crosstab.png');
    } finally {
      await tabB.close();
    }

    // Sign in again so the saved session is valid for phases 2–11 (A is on /login?next=%2F, anonymous).
    await expect(h1(page, SIGN_IN_LABEL)).toBeVisible();
    await submitAdminCredentials(page, api);
    await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
    // Re-saved last, so it holds the cookie of the last rotation.
    await persistSession(context);
  });
});

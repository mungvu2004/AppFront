/**
 * Phase 7 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of SCR-33 Account
 * Settings (`/tai-khoan`), each at 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U07_<state>_<width>.png`
 * + `U07_<state>.json`. Reviewed by the "verify ui" step with the qa-review-ui checklist. Models:
 * `phase01_auth_ui.spec.ts` (invite-a-second-user group), `phase06_rules_export_versions_ui.spec.ts` (`verifyAsAdmin`).
 *
 * Copy — every string checked in src/screens/account/AccountSettings (file noted next to it).
 *
 * Budget:
 *   - Admin states: no login; each test opens its OWN context from Phase 1's admin storage state (`ensureAdminSession`
 *     signs in only to replace a dead stored session). 9 tests × (4 loads + 1 session check) = 45
 *     `POST /api/auth/refresh` (`auth_refresh_total` 300 / 60 s per sid). Only the rotated COOKIES are written back to
 *     the storage-state file (`saveCookies`): the dark-theme case writes `localStorage['app-theme-mode']`
 *     (`useTheme.ts`), which must not leak into later phases.
 *   - No admin write: nothing is typed into a profile field (autosave would `PATCH /api/me`), no language/theme is
 *     saved to the server (appearance has no endpoint in v1, phase07_account.spec.ts header), the avatar dialog is
 *     only opened ("Thay ảnh" never clicked → no `PUT /api/me/avatar`), the password form is submitted with a 3-char
 *     new password, which `useAccountAuth.ts` `submitPassword` stops before any request. Every case asserts the
 *     browser sent NO non-GET `/api/` request other than the session refresh (`verifyAs` guard).
 *   - Long data: the admin account is never changed, so a run-unique viewer is created for it: 1 admin API login
 *     (`signedInApi`), 1 invitation (30 / h per admin), 1 `POST /api/auth/invitations/accept` (real Mailpit token,
 *     `recovery_ip` bucket; opens the viewer's session, so no viewer login), 1 refresh + 1 `PATCH /api/me` as the
 *     viewer (120-char name and job title = BE `FULL_NAME_MAX`, 32-char phone = `PHONE_MAX`, apps/api/me/schemas.py),
 *     then 1 `DELETE /api/users/:id` and its mail removed in `afterAll`.
 * No faked response: every state is the real stack. Loading (skeleton) and the page-level read error are not drawn
 * here (skill §1: error states come from the main / edge layers). Non-serial: each test uses its own context and page.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl, newApiContext, signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail } from './support/mailpit';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';
import { verifyUi } from './support/ui-verify';

/* Copy. */
const PAGE_TITLE = 'Cài đặt tài khoản'; // AccountSettings.tsx h1
const JOB_TITLE = 'Chức danh'; // ProfileSection.tsx aria-label
const PASSWORD_BLOCK = 'Mật khẩu'; // AccountSettings.tsx AccountBlock title
const SHORTCUTS_BLOCK = 'Phím tắt';
const SHORTCUT_SEARCH = 'Tìm phím tắt'; // ShortcutsSection.tsx Input label
/** useAccountTables.ts:384-385 countLabel while a query is set. */
const SHORTCUTS_FILTERED = /^Đang hiện [1-9]\d* trong \d+ phím tắt\.$/u;
const SHORTCUTS_EMPTY = 'Không có phím tắt nào khớp với ô tìm.'; // useAccountTables.ts:399
/** Plan SCR-33 row 3; key caps read "Ctrl" off Mac (`keyCapLabels`, BUG-085) and the filter folds `keys.join('+')`. */
const SHORTCUT_MATCH_TERM = 'Ctrl';
const SHORTCUT_NO_MATCH_TERM = `${TEST_DATA_PREFIX}khong-khop`;
const AVATAR_INPUT = 'Đổi ảnh'; // ProfileSection.tsx `<label htmlFor>` of the file input
const AVATAR_DIALOG = /^(?:Đặt|Thay) ảnh đại diện\?$/u; // AvatarReplaceDialog.tsx
const AVATAR_CANCEL = 'Huỷ';
const AVATAR_TYPE_UNSUPPORTED = 'Chỉ nhận ảnh PNG hoặc JPEG.'; // useAccountPreferences.ts:174
const CHANGE_EMAIL = 'Đổi thư điện tử'; // ProfileSection.tsx
/** useAccountPreferences.ts:151-153 EMAIL_REASON_LONG, set by "Đổi thư điện tử" (no request). */
const EMAIL_REASON_LONG =
  'Thư điện tử là tên đăng nhập nên đổi nó phải qua một bước xác minh. Liên hệ quản trị viên của công ty để đổi.';
const LANGUAGE = 'Ngôn ngữ'; // ProfileSection.tsx Select.Label (sr-only)
const THEME_GROUP = 'Chủ đề'; // AppearanceSection.tsx
const THEME_DARK = 'Tối';
const DARK_CLASS = /(?:^|\s)dark(?:\s|$)/u; // useTheme toggles <html class="dark"> (phase07_account.spec.ts)
/* PasswordSection.tsx labels; useAccountAuth.ts MESSAGES. */
const CURRENT_PASSWORD = 'Mật khẩu hiện tại';
const NEW_PASSWORD = 'Mật khẩu mới';
const CONFIRM_PASSWORD = 'Nhắc lại mật khẩu mới';
const CHANGE_PASSWORD = 'Đổi mật khẩu';
const PASSWORD_TOO_SHORT = 'Mật khẩu cần ít nhất 8 ký tự.'; // MIN_PASSWORD_LENGTH 8, src/api/schemas/index.ts:58
const CONFIRM_MISMATCH = 'Hai ô mật khẩu chưa khớp nhau.';
const STRENGTH_WEAK = 'Độ mạnh: yếu';
/** 3 chars: `newPasswordProblemOf` → too short, so `submitPassword` returns before the gateway (no request). */
const WEAK_NEW_PASSWORD = 'qa1';

const API_PREFIX = '/api/';
const REFRESH_PATH = '/api/auth/refresh';
/** 4 widths × one load of /tai-khoan (GET /api/me + identity). */
const TEST_TIMEOUT_MS = 120_000;
const SETTLE_TIMEOUT_MS = 20_000;

/** BE `FULL_NAME_MAX` (apps/api/me/schemas.py:16, auth_recovery/router.py:59) = FE `MeSchema` `.max(120)`. */
const TEXT_MAX = 120;
/** BE `PHONE_MAX` / FE `MeSchema.phone` `.max(32)` (src/api/schemas/me.ts:42). */
const PHONE_MAX = 32;
const LONG_NAME = `${`${TEST_DATA_PREFIX}u07-${Date.now().toString(36)} ${'Nguyễn Thị Phương Thảo Bình Minh '.repeat(5)}`.slice(0, TEXT_MAX - 1)}A`;
const LONG_JOB_TITLE = `${'Kiến trúc sư trưởng phụ trách thiết kế mặt bằng khu phức hợp văn phòng '.repeat(3).slice(0, TEXT_MAX - 1)}B`;
const LONG_PHONE = `+84 ${'9'.repeat(PHONE_MAX - 4)}`;
if (LONG_NAME.length !== TEXT_MAX || LONG_JOB_TITLE.length !== TEXT_MAX || LONG_PHONE.length !== PHONE_MAX) {
  throw new Error(`long data: name ${LONG_NAME.length}, title ${LONG_JOB_TITLE.length}, phone ${LONG_PHONE.length}`);
}

/* ---- helpers ---- */

/** Writes the context's rotated cookies back to the admin storage-state file, keeping its saved localStorage. */
async function saveCookies(context: BrowserContext): Promise<void> {
  const saved = JSON.parse(readFileSync(ADMIN_STORAGE_STATE_FILE, 'utf8')) as Record<string, unknown>;
  const { cookies } = await context.storageState();
  writeFileSync(ADMIN_STORAGE_STATE_FILE, JSON.stringify({ ...saved, cookies }, null, 2));
}

/** `verifyUi` in `context`, failing softly if the page sent any non-GET `/api/` request but the session refresh. */
async function verifyIn(context: BrowserContext, name: string, open: (page: Page) => Promise<void>): Promise<void> {
  const writes: string[] = [];
  const page = await context.newPage();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' || !path.startsWith(API_PREFIX)) return;
    if (request.method() === 'POST' && path === REFRESH_PATH) return;
    writes.push(`${request.method()} ${path}`);
  });
  await verifyUi(page, name, open);
  expect.soft(writes, 'a UI case sends no write request').toEqual([]);
}

/** Own context from the admin storage state; rotated refresh cookie written back (cookies only, see header). */
async function verifyAsAdmin(browser: Browser, name: string, open: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    await verifyIn(context, name, open);
  } finally {
    await saveCookies(context);
    await context.close();
  }
}

const heading = (page: Page) => page.getByRole('heading', { level: 1, name: PAGE_TITLE, exact: true });
const jobTitle = (page: Page) => page.getByRole('textbox', { name: JOB_TITLE, exact: true });
const shortcuts = (page: Page) => page.getByRole('region', { name: SHORTCUTS_BLOCK, exact: true });

/** `/tai-khoan` past its loading state: the profile fields (not the block skeleton) and the password block are drawn. */
async function openAccount(page: Page): Promise<void> {
  await page.goto(ROUTES.account);
  await expect(heading(page)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
  await expect(jobTitle(page)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
  await expect(page.getByRole('region', { name: PASSWORD_BLOCK, exact: true })).toBeVisible();
}

async function searchShortcuts(page: Page, term: string): Promise<void> {
  await openAccount(page);
  await shortcuts(page).getByRole('searchbox', { name: SHORTCUT_SEARCH, exact: true }).fill(term);
}

/** 1×1 PNG, in memory (as phase07_account.spec.ts). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* -------------------------------------------------------------------------- */
/* SCR-33 as the admin                                                        */
/* -------------------------------------------------------------------------- */

test.describe('U07 UI verify — SCR-33 Account Settings (admin)', () => {
  test.beforeEach(() => {
    test.setTimeout(TEST_TIMEOUT_MS);
  });

  test('U07 · SCR-33 account settings, default (loaded)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_default', openAccount);
  });

  test('U07 · SCR-33 dark theme ("Chủ đề" = Tối, local only)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_dark', async (p) => {
      await openAccount(p);
      const dark = p.getByRole('radiogroup', { name: THEME_GROUP, exact: true }).getByRole('radio', { name: THEME_DARK, exact: true });
      await dark.click();
      await expect(dark).toHaveAttribute('aria-checked', 'true');
      await expect(p.locator('html')).toHaveClass(DARK_CLASS);
    });
  });

  test('U07 · SCR-33 shortcuts filtered ("Tìm phím tắt" = Ctrl)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_shortcuts_filtered', async (p) => {
      await searchShortcuts(p, SHORTCUT_MATCH_TERM);
      await expect(shortcuts(p).getByRole('status')).toHaveText(SHORTCUTS_FILTERED);
    });
  });

  test('U07 · SCR-33 shortcuts, no match (empty table)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_shortcuts_no_match', async (p) => {
      await searchShortcuts(p, SHORTCUT_NO_MATCH_TERM);
      await expect(shortcuts(p).getByText(SHORTCUTS_EMPTY, { exact: true })).toBeVisible();
    });
  });

  test('U07 · SCR-33 avatar confirm dialog open (png chosen, nothing sent)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_avatar_dialog', async (p) => {
      await openAccount(p);
      await p.getByLabel(AVATAR_INPUT, { exact: true }).setInputFiles({ name: 'u07-avatar.png', mimeType: 'image/png', buffer: TINY_PNG });
      const dialog = p.getByRole('dialog', { name: AVATAR_DIALOG });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: AVATAR_CANCEL, exact: true })).toBeVisible();
    });
  });

  test('U07 · SCR-33 avatar rejected (not PNG/JPEG, no request)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_avatar_type', async (p) => {
      await openAccount(p);
      // `accept` only filters the OS picker; `onAvatarFileSelected` checks the type itself (useAccountPreferences.ts).
      await p.getByLabel(AVATAR_INPUT, { exact: true }).setInputFiles({ name: 'u07-avatar.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
      await expect(p.getByRole('alert').filter({ hasText: AVATAR_TYPE_UNSUPPORTED })).toBeVisible();
    });
  });

  test('U07 · SCR-33 e-mail long read-only reason ("Đổi thư điện tử")', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_email_reason', async (p) => {
      await openAccount(p);
      await p.getByRole('button', { name: CHANGE_EMAIL, exact: true }).click();
      await expect(p.getByText(EMAIL_REASON_LONG, { exact: true })).toBeVisible();
    });
  });

  test('U07 · SCR-33 language list open (nothing chosen)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_language_open', async (p) => {
      await openAccount(p);
      const trigger = p.getByRole('combobox', { name: LANGUAGE, exact: true });
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(p.getByRole('listbox')).toBeVisible();
    });
  });

  test('U07 · SCR-33 password form, validation messages + weak meter (no request)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U07_account_password_invalid', async (p) => {
      await openAccount(p);
      const block = p.getByRole('region', { name: PASSWORD_BLOCK, exact: true });
      await block.getByLabel(CURRENT_PASSWORD, { exact: true }).fill('qa-ui-not-a-password');
      await block.getByLabel(NEW_PASSWORD, { exact: true }).fill(WEAK_NEW_PASSWORD);
      await block.getByLabel(CONFIRM_PASSWORD, { exact: true }).fill(`${WEAK_NEW_PASSWORD}x`);
      await expect(block.getByText(STRENGTH_WEAK, { exact: true })).toBeVisible();
      await block.getByRole('button', { name: CHANGE_PASSWORD, exact: true }).click();
      await expect(block.getByText(PASSWORD_TOO_SHORT, { exact: true })).toBeVisible();
      await expect(block.getByText(CONFIRM_MISMATCH, { exact: true })).toBeVisible();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* SCR-33 with long user data (a run-unique viewer this file creates)         */
/* -------------------------------------------------------------------------- */

test.describe('U07 UI verify — SCR-33 long data (own viewer)', () => {
  let admin: APIRequestContext | undefined;
  let viewer: { id: string; email: string } | undefined;
  let viewerState: Awaited<ReturnType<APIRequestContext['storageState']>> | undefined;
  const mails: string[] = [];
  let since = new Date();

  test.beforeAll(async () => {
    test.setTimeout(TEST_TIMEOUT_MS);
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    since = new Date(Date.now() - 5_000);
    const address = testEmail('u07-long');
    const invited = await admin.post('/api/users/invitations', { data: { emails: [address], role: 'viewer' } });
    expect(invited.status(), 'setup: POST /api/users/invitations').toBe(201);
    const answer = (await invited.json()) as { id?: unknown; email?: unknown }[];
    const created = answer.find((u) => u.email === address) ?? answer[0];
    // Recorded BEFORE the checks: `afterAll` can still delete whoever was created.
    if (created?.id !== undefined) viewer = { id: String(created.id), email: String(created.email ?? address) };
    expect(created?.email, 'setup: the invited user is in the answer').toBe(address);

    const mail = await waitForMail(address, since);
    mails.push(mail.id);
    // BE auth_recovery/messages.py:46 `{PUBLIC_BASE_URL}{path}#token=…` (as phase01_auth_api.spec.ts tokenFrom).
    const token = new URLSearchParams(new URL(linkFrom(mail, ROUTES.invitationAccept)).hash.slice(1)).get('token');
    if (!token) throw new Error('setup: invitation mail link has no #token');

    const api = await newApiContext();
    try {
      const viewerPassword = `${randomBytes(12).toString('base64url')}a1`; // never printed
      const accepted = await api.post('/api/auth/invitations/accept', {
        data: { token, fullName: LONG_NAME, password: viewerPassword },
      });
      expect(accepted.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
      const refreshed = await api.post(REFRESH_PATH);
      expect(refreshed.status(), 'setup: POST /api/auth/refresh as the viewer').toBe(200);
      const { accessToken } = (await refreshed.json()) as { accessToken?: string };
      if (!accessToken) throw new Error('setup: refresh answered without an access token');
      const patched = await api.patch('/api/me', {
        data: { jobTitle: LONG_JOB_TITLE, phone: LONG_PHONE },
        headers: { Authorization: `Bearer ${accessToken}`, Origin: apiBaseUrl() },
      });
      expect(patched.status(), 'setup: PATCH /api/me as the viewer').toBe(200);
      viewerState = await api.storageState();
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async () => {
    try {
      if (admin && viewer) {
        // BE apps/api/users/router.py soft delete (as phase01_auth_ui.spec.ts cleanup).
        const res = await admin.delete(`/api/users/${viewer.id}`, { data: { userId: viewer.id, confirmEmail: viewer.email } });
        if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE user → ${res.status()}` });
      }
      await deleteMails(mails);
    } catch (error) {
      test.info().annotations.push({ type: 'cleanup', description: String(error) });
    } finally {
      await admin?.dispose();
    }
  });

  test('U07 · SCR-33 long data (120-char name and job title, 32-char phone)', async ({ browser }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    if (viewerState === undefined) throw new Error('setup: the long-data viewer has no session');
    const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: viewerState });
    try {
      await verifyIn(context, 'U07_account_long_data', async (p) => {
        await openAccount(p);
        await expect(jobTitle(p)).toHaveValue(LONG_JOB_TITLE);
        await expect(p.getByRole('textbox', { name: 'Họ tên', exact: true })).toHaveValue(LONG_NAME);
      });
    } finally {
      await context.close();
    }
  });
});

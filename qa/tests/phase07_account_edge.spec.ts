/**
 * Phase 7 — EDGE CASES, Track A: SCR-33 Account Settings (`/tai-khoan`). Gaps left by `phase07_account.spec.ts` (serial,
 * admin); inventory in `qa/coverage/phase07.md` (FE stamp 82e18a88).
 *
 * Every expected result cites the FE source of `F:/App/AppFront` @ 82e18a88 or, written `BE:`, AppBack. Short names
 * (all under `src/screens/account/AccountSettings/` unless a path is given):
 *   AS  AccountSettings.tsx          ASC AccountSettings.container.tsx   UAS useAccountSettings.ts
 *   ASG accountSettingsGateway.ts    PS  ProfileSection.tsx              ARD AvatarReplaceDialog.tsx
 *   UAP useAccountPreferences.ts     AP  AppearanceSection.tsx           NS  NotificationsSection.tsx
 *   SS  ShortcutsSection.tsx         UAT useAccountTables.ts             PWS PasswordSection.tsx
 *   UAA useAccountAuth.ts            AAG accountAuthGateway.ts
 *   CA  src/lib/autosave/createAutosave.ts   I18N src/i18n/vi.json   TST src/components/feedback/Toast.tsx
 *   INP src/components/ui/Input.tsx          FR  src/components/ui/FieldRow.tsx
 *
 * ## The subject account (real, no mock) — the admin is never changed
 * Every test that edits a profile, an avatar or a password does it on ONE `engineer` invitee per WORKER, made lazily:
 * the admin invites a run-unique `qa-<runId>-acct-…@example.test` (`POST /api/users/invitations`,
 * BE:apps/api/users/router.py), the one-time token is read from the real mail in Mailpit, and the invitee accepts it
 * (`POST /api/auth/invitations/accept`) with a random password kept in worker memory only (never logged or attached).
 * `test.afterAll` deletes the user (`DELETE /api/users/{id}`) and every mail to that address. The admin is only used
 * through the API to invite and delete; it is never signed in through the UI and its profile/password never change.
 *
 * ## Non-serial, independent
 * Every test opens its own browser context, signs the invitee in through the API inside that context (no UI login),
 * reads the starting profile from the page's own `GET /api/me`, and in `finally` puts the profile back
 * (`PATCH /api/me {fullName, jobTitle:'', phone:'', language:'vi'}` with the context's own session). A fresh context
 * also means a fresh `localStorage` (theme) and a fresh JS module (the local-only appearance/notification memory,
 * ASG:98). The one password change updates the in-memory password, so later tests sign in with the new one.
 *
 * ## Mocks — "[mocked response]" in the title (1 of 27)
 * - `GET /api/me` 500 — unpairable: 5xx is not producible on the shared stack (row for `coverage/phase07-be.md`).
 * One more test HOLDS the real `GET /api/me` response ("[held real response]") to see the loading skeleton; the body
 * served is the backend's own.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack override `qa-limits.override.yml` only raises
 * LOGIN_IP_LIMIT to 120 and RECOVERY_IP_LIMIT to 60)
 * - `POST /api/auth/login` per IP (override 120 / 60 s): admin API 1 per worker; invitee 1 per test (26) + 1 check of
 *   the new password = 28 per run, spread over several minutes (slowMo 400). 0 failed logins.
 * - `POST /api/users/invitations` 30 / 3600 s per admin: 1 per worker (+1 per failed test: Playwright restarts the
 *   worker) — phases 1 (8) + 2 (≤ 9) + this file (≤ 6) stay under 30.
 * - `recovery_ip` (override 60 / 900 s) counts the accept: same as the invitations.
 * - `POST /api/me/password` `me_password` 5 / 900 s per user (BE:apps/api/me/router.py:45-46): 2 per run (wrong
 *   current once — the double click must send ONE —, success once). The local-validation test sends none.
 * - `PUT /api/me/avatar` `me_avatar` 10 / 900 s per user (BE:apps/api/me/router.py:47-48): 2 per run.
 * - `PATCH /api/me`: no rate limit (no `rate_limit(` on it, BE:apps/api/me/router.py:137-143): ≤ 3 per test + 1 reset.
 * - `POST /api/auth/refresh` 300 / 60 s per session: 1 per page load + 1 per reset.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, APIResponse, Browser, BrowserContext, Locator, Page, Request, Route } from '@playwright/test';

import { ROUTES, loginUrl } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { linkFrom, waitForMail } from './support/mailpit';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

const ME_RE = /^\/api\/me$/u; // src/api/endpoints.ts:139 (ME_ROOT)
const AVATAR_API = '/api/me/avatar'; // src/api/endpoints.ts:137
const PASSWORD_API = '/api/me/password'; // src/api/endpoints.ts:138
const REFRESH_API = '/api/auth/refresh';
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase02_notify_edge INVITE_SUBJECT)
const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/u, '');
/** Admin access token lives 600 s (BE:auth/settings.py:31) — refreshed well before. */
const ADMIN_TOKEN_MAX_AGE_MS = 480_000;

/** A "nothing was sent" claim waits past the 800 ms autosave (UAS:103) plus a round trip. */
const QUIET_MS = 2_500;
/** react-query retries a failed read once (src/lib/query/cachePolicy.ts:79) before the error state paints. */
const ERROR_PAINT_TIMEOUT_MS = 30_000;
/** CA:80 OFFLINE_RECHECK_MS = 5 s, + debounce + round trip. */
const OFFLINE_FLUSH_TIMEOUT_MS = 20_000;

/* Page copy. */
const TITLE = 'Cài đặt tài khoản'; // AS:104
const LOAD_ERROR_TITLE = 'Không tải được cài đặt tài khoản'; // AS:189
const RETRY = 'Thử lại'; // AS:191
const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // I18N:63 errors.unknown.description
const BLOCK_IDS = ['account-profile', 'account-appearance', 'account-notifications', 'account-shortcuts', 'account-password'] as const; // AS:116-153

/* Save indicator (AS:110, I18N:66-72, UAS:109). */
const IND = {
  idle: 'Chưa có thay đổi', // I18N:67
  failed: 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.', // I18N:70, CA:188
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng', // I18N:71, CA:163
  saved: /^Đã lưu lúc/u, // src/hooks/useSaveIndicator.ts:44 (proven by phase07_account.spec.ts row 1)
  localOnly: 'Chỉ giữ trong phiên này', // UAS:109
} as const;
const UNDO_TOAST = 'Đã lưu cài đặt tài khoản.'; // UAS:121,348-353 (NotificationHost, src/main.tsx:68)
const UNDO = 'Hoàn tác'; // TST:149

/* Profile (PS, UAP, UAS). */
const PROBLEM = {
  fullName: 'Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển.', // UAS:113
  jobTitle: 'Chức danh tối đa 120 ký tự, không chứa ký tự điều khiển.', // UAS:114
  phone: 'Số điện thoại tối đa 32 ký tự.', // UAS:115
} as const;
const PLACEHOLDER = 'Chưa đặt'; // UAP:155,158
const EMAIL_REASON_SHORT = 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.'; // UAP:150
const EMAIL_REASON_LONG =
  'Thư điện tử là tên đăng nhập nên đổi nó phải qua một bước xác minh. Liên hệ quản trị viên của công ty để đổi.'; // UAP:151-153
const CHANGE_EMAIL = 'Đổi thư điện tử'; // PS:210
const LANGUAGE = { label: 'Ngôn ngữ', vi: 'Tiếng Việt', en: 'Tiếng Anh' } as const; // PS:243-258, UAP:117-120
/** BE:apps/api/me/schemas.py:16-17 FULL_NAME_MAX (also jobTitle) / PHONE_MAX. */
const TEXT_MAX = 120;
const PHONE_MAX = 32;

/* Avatar (UAP:163-181, ARD). */
const AVATAR_MAX_FILE_BYTES = 524_288; // UAP:163
const AVATAR = {
  pick: 'Đổi ảnh', // PS:159
  typeUnsupported: 'Chỉ nhận ảnh PNG hoặc JPEG.', // UAP:174
  fileTooBig: 'Ảnh tối đa 512 KB. Hãy chọn ảnh nhỏ hơn.', // UAP:175
  typeMismatch: 'Nội dung tệp không khớp loại ảnh. Chọn lại tệp PNG hoặc JPEG.', // UAP:177,199-200
  setTitle: 'Đặt ảnh đại diện?', // ARD:30
  replaceTitle: 'Thay ảnh đại diện?', // ARD:30
  setWarning: 'Sau khi đặt chỉ thay được, không gỡ được.', // ARD:31-33
  replaceWarning: 'Ảnh cũ không khôi phục được.', // ARD:31-33
  preview: 'Ảnh đại diện mới', // ARD:43
  cancel: 'Huỷ', // ARD:51-53
  confirm: 'Thay ảnh', // ARD:54-56
} as const;
const avatarAltOf = (name: string): string => (name === '' ? 'Ảnh đại diện' : `Ảnh đại diện của ${name}`); // UAP:160,609
/** 1×1 PNG, in memory. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* Appearance (AP, UAP). */
const THEME_ORDER = ['light', 'dark', 'system'] as const; // AP:60-64 (order of THEME_OPTIONS)
type ThemeChoice = (typeof THEME_ORDER)[number];
const THEME_LABEL: Readonly<Record<ThemeChoice, string>> = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' }; // AP:61-63
const THEME_STORAGE_KEY = 'app-theme-mode'; // src/hooks/useTheme.ts THEME_KEY (phase07_account.spec.ts)
const DARK_CLASS = /(?:^|\s)dark(?:\s|$)/u;
const VIEWPORT_DARK = 'Dùng nền tối cho khung nhìn 3D'; // AP:208,215
const SHOW_GRID = 'Hiện lưới 100 mm'; // AP:229,233
const DENSITY = { group: 'Mật độ hiển thị', comfortable: 'Thoải mái', compact: 'Gọn' } as const; // AP:67-70,238-241
const ROW_MIN_HEIGHT = { comfortable: '40px', compact: '36px' } as const; // UAP:133-148

/* Notifications (UAT:97-143, NS). */
const CHANNELS = { inApp: 'Trong ứng dụng', email: 'Thư điện tử' } as const; // UAT:98-99
/** UAT:117-143 `fallback` — what each cell shows when nothing was stored in this session. */
const NOTIFICATION_DEFAULTS: ReadonlyArray<{ label: string; inApp: boolean; email: boolean }> = [
  { label: 'AI xử lý xong', inApp: true, email: false },
  { label: 'Phát hiện vi phạm mới', inApp: true, email: true },
  { label: 'Được mời vào dự án', inApp: true, email: true },
  { label: 'Bình luận nhắc đến tôi', inApp: true, email: false },
  { label: 'Tổng hợp mỗi sáng', inApp: false, email: true },
];
const cellName = (event: string, channel: string): string => `${event} — ${channel}`; // UAT:355

/* Shortcuts (SS, UAT). */
const SHORTCUTS = {
  region: 'Phím tắt', // AS:144
  search: 'Tìm phím tắt', // SS:116
  empty: 'Không có phím tắt nào khớp với ô tìm.', // UAT:399
  all: /^(\d+) phím tắt đang có hiệu lực\.$/u, // UAT:384
  filtered: (shown: number, total: number): string => `Đang hiện ${String(shown)} trong ${String(total)} phím tắt.`, // UAT:385
} as const;
/** src/lib/input/shortcutRegistry.ts:697,707 — the two descriptions holding "hoàn tác" (folded: UAT:364-377). */
const UNDO_DESCRIPTIONS = ['Hoàn tác thao tác gần nhất', 'Làm lại thao tác vừa hoàn tác'] as const;
const CLOSE_TOP_LAYER = 'Đóng lớp trên cùng'; // src/lib/input/shortcutRegistry.ts:745

/* Password (PWS, UAA:78-99). */
const PW = {
  current: 'Mật khẩu hiện tại', // PWS:155
  next: 'Mật khẩu mới', // PWS:166
  confirm: 'Nhắc lại mật khẩu mới', // PWS:178
  submit: 'Đổi mật khẩu', // PWS:202
  currentRequired: 'Chưa nhập mật khẩu hiện tại.', // UAA:79
  currentWrong: 'Mật khẩu hiện tại không đúng.', // UAA:80
  tooShort: 'Mật khẩu cần ít nhất 8 ký tự.', // UAA:82 (MIN_PASSWORD_LENGTH 8, src/api/schemas/index.ts:58)
  letterDigit: 'Mật khẩu cần có cả chữ và số.', // UAA:83
  sameAsCurrent: 'Mật khẩu mới phải khác mật khẩu hiện tại.', // UAA:84
  mismatch: 'Hai ô mật khẩu chưa khớp nhau.', // UAA:85
  changed: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.', // UAA:86
  strength: (word: 'yếu' | 'khá' | 'mạnh'): string => `Độ mạnh: ${word}`, // PWS:74-76,126
} as const;

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
const asList = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not a JSON array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};
const textOf = (me: Json, key: string): string => (typeof me[key] === 'string' ? (me[key] as string) : '');
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pathname = (page: Page): string => new URL(page.url()).pathname;
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Diagnostic for an overflow: the deepest elements whose right edge passes the viewport (tag, classes, text). */
const widestElements = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > limit + 1))
      .slice(0, 12)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ').slice(0, 4).join('.')} right=${Math.round(el.getBoundingClientRect().right)} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
  });

/** Every mutating `/api/` request from now on (session upkeep `POST /api/auth/refresh` excluded), with its body. */
function recordWrites(page: Page): { readonly list: () => string[]; readonly bodies: (path: string) => unknown[]; readonly stop: () => void } {
  const seen: Array<{ line: string; path: string; body: unknown }> = [];
  const onRequest = (req: Request): void => {
    const path = new URL(req.url()).pathname;
    if (!path.startsWith('/api/') || req.method() === 'GET') return;
    if (req.method() === 'POST' && path === REFRESH_API) return;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    seen.push({ line: `${req.method()} ${path}`, path, body });
  };
  page.on('request', onRequest);
  return {
    list: () => seen.map((s) => s.line),
    bodies: (path) => seen.filter((s) => s.path === path).map((s) => s.body),
    stop: () => page.off('request', onRequest),
  };
}

/* ---------------------------------------------------------------- locators (labels verified in src/) */

const heading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: TITLE, exact: true });
const accountHeader = (page: Page): Locator => page.locator('header').filter({ has: heading(page) });
const saveIndicator = (page: Page): Locator => accountHeader(page).getByRole('status'); // AS:110 (SaveIndicator role=status)
const block = (page: Page, id: string): Locator => page.locator(`section[aria-labelledby="${id}"]`); // AS:79
const box = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
/** PS:203 + INP:63-68: the read-only email is a `<span>` with the value, not a textbox. */
const emailText = (page: Page, email: string): Locator => block(page, 'account-profile').getByText(email, { exact: true });
const fieldError = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text }); // INP:117
const undoToast = (page: Page): Locator => page.getByRole('status').filter({ hasText: UNDO_TOAST }); // TST:120
const avatarInput = (page: Page): Locator => page.getByLabel(AVATAR.pick, { exact: true }); // PS:133-160
const avatarDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^(?:Đặt|Thay) ảnh đại diện\?$/u }); // ARD:30
const themeGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Chủ đề', exact: true }); // AP:197-199
const themeRadio = (page: Page, choice: ThemeChoice): Locator => themeGroup(page).getByRole('radio', { name: THEME_LABEL[choice], exact: true });
const toggle = (page: Page, name: string): Locator => page.getByRole('switch', { name, exact: true });
const pwField = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true });
const pwSubmit = (page: Page): Locator => page.getByRole('button', { name: PW.submit, exact: true });
/** FR:62-70: the row div carrying `min-h-*` around a control. */
const rowOf = (control: Locator): Locator => control.locator('xpath=ancestor::div[contains(@class,"items-start")][1]');

async function checkedTheme(page: Page): Promise<ThemeChoice> {
  const value = await themeGroup(page).locator('[role="radio"][aria-checked="true"]').getAttribute('data-value');
  if (value !== 'light' && value !== 'dark' && value !== 'system') throw new Error(`"Chủ đề": no checked radio (got ${String(value)})`);
  return value;
}
const readStoredTheme = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY);
/** UAP:326-333 resolveTheme: 'system' follows `(prefers-color-scheme: dark)`. */
async function resolvedTheme(page: Page, choice: ThemeChoice): Promise<'light' | 'dark'> {
  if (choice !== 'system') return choice;
  return (await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'dark' : 'light';
}

/* ---------------------------------------------------------------- admin (API only, one login per worker) */

interface AdminApi {
  readonly ctx: APIRequestContext;
  token: string;
  tokenAt: number;
}

let adminPromise: Promise<AdminApi> | undefined;

/** Access token from a refresh body (src/lib/auth/refresh.ts:85-100: flat or under `data`). */
function accessTokenOf(json: unknown): string {
  const body = asRecord(json, 'refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = typeof root.accessToken === 'string' ? root.accessToken : String(root.access_token ?? '');
  if (token === '') throw new Error('refresh: no access token');
  return token;
}

async function refreshAdmin(admin: AdminApi): Promise<void> {
  const res = await admin.ctx.post(REFRESH_API);
  expect(res.status(), 'admin POST /api/auth/refresh').toBe(200);
  admin.token = accessTokenOf(await res.json());
  admin.tokenAt = Date.now();
}

async function adminApi(): Promise<AdminApi> {
  adminPromise ??= (async () => {
    const base = apiBaseUrl();
    const ctx = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
    const { email, password } = readAdminCredentials();
    const login = await ctx.post('/api/auth/login', { data: { email, password, rememberMe: false } });
    if (login.status() !== 204) {
      await ctx.dispose();
      throw new Error(`admin POST /api/auth/login → ${String(login.status())} (expected 204)`);
    }
    const admin: AdminApi = { ctx, token: '', tokenAt: 0 };
    await refreshAdmin(admin);
    return admin;
  })();
  const admin = await adminPromise;
  if (Date.now() - admin.tokenAt > ADMIN_TOKEN_MAX_AGE_MS) await refreshAdmin(admin);
  return admin;
}

async function asAdmin(method: 'POST' | 'DELETE', path: string, data?: unknown): Promise<APIResponse> {
  const admin = await adminApi();
  return admin.ctx.fetch(path, { method, headers: { Authorization: `Bearer ${admin.token}` }, ...(data === undefined ? {} : { data }) });
}

/* ---------------------------------------------------------------- the invitee (one per worker) */

interface Invitee {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Random, worker memory only, never logged or attached. Changes once (password-change test). */
  password: string;
}

let inviteePromise: Promise<Invitee> | undefined;
let invitedUser: { readonly id: string; readonly email: string } | undefined;

async function makeInvitee(): Promise<Invitee> {
  const email = testEmail('acct');
  const since = new Date(Date.now() - 5_000);
  const sent = await asAdmin('POST', '/api/users/invitations', { emails: [email], role: 'engineer' });
  expect(sent.status(), 'setup: POST /api/users/invitations').toBe(201);
  const user = asList(await sent.json(), 'invitations').find((u) => u.email === email);
  expect(user?.status, 'setup: the invitee is pending').toBe('pending');
  const id = String(user?.id);
  invitedUser = { id, email };

  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation mail: no #token');

  const name = `${TEST_DATA_PREFIX}acct-${uniq()}`;
  const password = `Qa-${randomUUID()}`;
  const base = apiBaseUrl();
  const anon = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    const accept = await anon.post('/api/auth/invitations/accept', { data: { token, fullName: name, password } });
    expect(accept.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
  } finally {
    await anon.dispose();
  }
  return { id, email, name, password };
}

const invitee = (): Promise<Invitee> => (inviteePromise ??= makeInvitee());

async function sweepMails(address: string): Promise<void> {
  const query = encodeURIComponent(`to:"${address}"`);
  const found = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=100`)).json()) as { messages?: Array<{ ID: string }> };
  const ids = (found.messages ?? []).map((m) => m.ID);
  if (ids.length === 0) return;
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) });
}

test.afterAll(async () => {
  if (invitedUser !== undefined) {
    const { id, email } = invitedUser;
    const res = await asAdmin('DELETE', `/api/users/${id}`, { userId: id, confirmEmail: email }).catch(() => null);
    if (res !== null && res.status() !== 200) console.warn(`cleanup: DELETE /api/users/${id} → ${String(res.status())}`);
    await sweepMails(email).catch(() => undefined);
  }
  if (adminPromise !== undefined) await (await adminPromise.catch(() => null))?.ctx.dispose();
});

/* ---------------------------------------------------------------- per-test session */

interface Session {
  readonly user: Invitee;
  readonly context: BrowserContext;
  readonly page: Page;
}

/**
 * Puts the invitee's profile back with the context's own session (refresh cookie → access token → `PATCH /api/me`).
 * Best effort: a failure is an annotation, never the test's reported failure.
 */
async function resetProfile(context: BrowserContext, user: Invitee): Promise<void> {
  try {
    const base = apiBaseUrl();
    const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: base } });
    if (refreshed.status() !== 200) throw new Error(`refresh → ${String(refreshed.status())}`);
    const token = accessTokenOf(await refreshed.json());
    const res = await context.request.patch('/api/me', {
      headers: { Origin: base, Authorization: `Bearer ${token}` },
      data: { fullName: user.name, jobTitle: '', phone: '', language: 'vi' },
    });
    if (res.status() !== 200) throw new Error(`PATCH /api/me → ${String(res.status())}`);
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: `profile reset: ${String(error)}` });
  }
}

/** New context, invitee signed in through the API inside it, `body`, profile reset, close. */
async function asInvitee(
  browser: Browser,
  body: (session: Session) => Promise<void>,
  { viewport = DESKTOP, reset = true }: { readonly viewport?: Viewport; readonly reset?: boolean } = {},
): Promise<void> {
  const user = await invitee();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  const page = await context.newPage();
  try {
    const login = await context.request.post('/api/auth/login', {
      headers: { Origin: apiBaseUrl() },
      data: { email: user.email, password: user.password, rememberMe: false },
    });
    expect(login.status(), 'invitee POST /api/auth/login').toBe(204);
    await body({ user, context, page });
  } finally {
    if (reset) await resetProfile(context, user);
    await context.close().catch(() => undefined);
  }
}

/** Opens `/tai-khoan` (fresh document) and returns the `GET /api/me` body the screen received (UAS:225-228, ASG:117-131). */
async function openAccount(page: Page, hash = ''): Promise<Json> {
  const me = waitForApi(page, 'GET', ME_RE, [200]);
  await page.goto(`${ROUTES.account}${hash}`);
  const { json } = await me;
  await expect(heading(page)).toBeVisible();
  await expect(box(page, 'Chức danh')).toBeVisible();
  return asRecord(json, 'GET /api/me');
}

/* ================================================================= SCR-33 — page states */

test.describe('E07 SCR-33 page states', () => {
  test('E07 · SCR-33 anonymous visit → /login?next=%2Ftai-khoan, no account read', async ({ browser }) => {
    // G1: SessionBootstrap sends an anonymous user to `/login?next=…` (encodeURIComponent); `/tai-khoan` is protected
    // (src/routes/router.tsx:390 inside the ScreenMain group).
    const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
    const page = await context.newPage();
    const meReads: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'GET' && ME_RE.test(new URL(req.url()).pathname)) meReads.push(req.url());
    });
    try {
      await page.goto(ROUTES.account);
      await expect.poll(() => pathname(page)).toBe(ROUTES.login);
      const url = new URL(page.url());
      expect(`${url.pathname}${url.search}`).toBe(loginUrl(ROUTES.account));
      await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
      expect(meReads, 'no GET /api/me without a session').toEqual([]);
      await captureEvidence(page, 'E07_anonymous_redirect.png', { caption: `→ ${loginUrl(ROUTES.account)}` });
      await attachJson('E07_anonymous_redirect.json', { landed: `${url.pathname}${url.search}`, meReads: meReads.length });
    } finally {
      await context.close();
    }
  });

  test('E07 · SCR-33 non-admin (engineer) gets the whole screen: five blocks, no sessions / danger zone, idle indicator, empty-state placeholders, initials avatar', async ({ browser }) => {
    await asInvitee(browser, async ({ page, user }) => {
      const me = await openAccount(page);
      // No role gate on the route (G2): every role sees the same five blocks; sessions/danger leave the DOM (AS:161-182,
      // AAG:142 capabilities false).
      for (const id of BLOCK_IDS) await expect(block(page, id)).toBeVisible();
      await expect(block(page, 'account-sessions')).toHaveCount(0);
      await expect(block(page, 'account-danger')).toHaveCount(0);
      // Idle indicator before any edit (I18N:67, useSaveIndicator.ts:37).
      await expect(saveIndicator(page)).toHaveText(IND.idle);
      // Email read-only, from the session (UAP:603,630): PS:203 passes `isReadOnly`, so INP:63-68 draws plain text, no
      // input at all.
      await expect(emailText(page, user.email)).toBeVisible();
      await expect(box(page, 'Thư điện tử')).toHaveCount(0);
      await expect(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toBeVisible();
      // State 1 (empty): a fresh invitee has no job title / phone / avatar → placeholder "Chưa đặt" (UAP:155-158) and
      // initials instead of an image (PS:126-132, Avatar.tsx:37-43).
      expect(textOf(me, 'jobTitle'), 'precondition: no jobTitle').toBe('');
      expect(textOf(me, 'phone'), 'precondition: no phone').toBe('');
      await expect(box(page, 'Chức danh')).toHaveAttribute('placeholder', PLACEHOLDER);
      await expect(box(page, 'Điện thoại')).toHaveAttribute('placeholder', PLACEHOLDER);
      await expect(box(page, 'Họ tên')).toHaveValue(textOf(me, 'fullName'));
      if (typeof me.avatarUrl !== 'string') {
        await expect(block(page, 'account-profile').locator(`span[aria-label="${avatarAltOf(textOf(me, 'fullName'))}"]`)).toBeVisible();
      }
      await captureEvidence(page, 'E07_engineer_full_screen.png', { fullPage: true });
    });
  });

  test('E07 · SCR-33 loading state [held real response]: the five blocks are skeletons until GET /api/me lands', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const hold = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await gate;
        return route.continue(); // the backend's own response, only later
      };
      await page.route('**/api/me', hold);
      try {
        await page.goto(ROUTES.account);
        await expect(heading(page)).toBeVisible();
        // AS:86: while `isLoading` every block shows `Skeleton preset="property-panel"` (animate-pulse) and no field.
        for (const id of BLOCK_IDS) await expect(block(page, id).locator('.animate-pulse').first()).toBeVisible();
        await expect(box(page, 'Chức danh')).toHaveCount(0);
        await captureEvidence(page, 'E07_loading_skeleton.png', { caption: 'GET /api/me held' });
        const me = waitForApi(page, 'GET', ME_RE, [200]);
        release();
        await me;
        await expect(box(page, 'Chức danh')).toBeVisible();
        await expect(block(page, 'account-profile').locator('.animate-pulse')).toHaveCount(0);
      } finally {
        release();
        await page.unroute('**/api/me', hold);
      }
    });
  });

  test('E07 · SCR-33 [mocked response] GET /api/me 500 → "Không tải được cài đặt tài khoản" replaces the blocks; "Thử lại" reads again', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      let served = 0;
      const fail = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        served += 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e07 mocked 500' }) });
      };
      await page.route('**/api/me', fail);
      try {
        await page.goto(ROUTES.account);
        // AS:184-193: InlineAlert(violation) with the read error's description (UAS:409-412) and "Thử lại".
        await expect(page.getByText(LOAD_ERROR_TITLE, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await expect(page.getByText(GENERIC_UNKNOWN, { exact: true })).toBeVisible();
        for (const id of BLOCK_IDS) await expect(block(page, id)).toHaveCount(0);
        await captureEvidence(page, 'E07_load_500.png');

        await page.unroute('**/api/me', fail);
        const me = waitForApi(page, 'GET', ME_RE, [200]);
        await page.getByRole('button', { name: RETRY, exact: true }).click(); // UAS:417-420 retryLoad → refetch
        await me;
        await expect(box(page, 'Chức danh')).toBeVisible();
        await expect(page.getByText(LOAD_ERROR_TITLE, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E07_load_500_retry.png');
        await attachJson('E07_load_500.json', { mockedResponses: served, status: 500, afterRetry: 200 });
      } finally {
        await page.unroute('**/api/me', fail).catch(() => undefined);
      }
    }, { reset: false });
  });

  test('E07 · SCR-33 deep link #account-notifications focuses the "Thông báo" heading; a later hash change moves focus to "Mật khẩu"', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page, '#account-notifications');
      // ASC:57-85: after loading, scrollIntoView + tabindex=-1 + focus on the element with the hash id; also on hashchange.
      const notifications = page.locator('#account-notifications');
      await expect(notifications).toBeFocused();
      await expect(notifications).toHaveAttribute('tabindex', '-1');
      await expect(notifications).toBeInViewport();
      await captureEvidence(page, 'E07_hash_notifications.png', { caption: 'focus: h2#account-notifications' });

      await page.evaluate(() => {
        window.location.hash = 'account-password';
      });
      const password = page.locator('#account-password');
      await expect(password).toBeFocused();
      await expect(password).toBeInViewport();
      await captureEvidence(page, 'E07_hash_password.png', { caption: 'hashchange → focus: h2#account-password' });
      await attachJson('E07_hash_focus.json', { first: '#account-notifications', then: '#account-password', focusedBoth: true });
    }, { reset: false });
  });
});

/* ================================================================= SCR-33 — profile */

test.describe('E07 SCR-33 profile', () => {
  test('E07 · "Chức danh" 121 characters → real 422 → field error + "Lưu thất bại…"; 120 characters → error gone, PATCH 200', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const jobTitle = box(page, 'Chức danh');
      const tooLong = 'x'.repeat(TEXT_MAX + 1);
      const rejected = waitForApi(page, 'PATCH', ME_RE, [422]);
      await jobTitle.fill(tooLong);
      const r422 = await rejected;
      expect(r422.response.request().postDataJSON()).toEqual({ jobTitle: tooLong });
      // BE:apps/api/me/schemas.py:56-65 → 422 VALIDATION field jobTitle; UAS:299-313 binds the copy to the field.
      expect(JSON.stringify(r422.json)).toContain('"field":"jobTitle"');
      await expect(fieldError(page, PROBLEM.jobTitle)).toBeVisible();
      await expect(jobTitle).toHaveAttribute('aria-invalid', 'true');
      await expect(saveIndicator(page)).toHaveText(IND.failed);
      await captureEvidence(page, 'E07_jobtitle_121_rejected.png');

      const ok = waitForApi(page, 'PATCH', ME_RE, [200]);
      const atMax = 'y'.repeat(TEXT_MAX);
      await jobTitle.fill(atMax); // UAS:364-376: editing the field drops its problem
      const saved = await ok;
      expect(saved.response.request().postDataJSON()).toEqual({ jobTitle: atMax });
      expect(textOf(asRecord(saved.json, 'PATCH'), 'jobTitle')).toBe(atMax);
      await expect(fieldError(page, PROBLEM.jobTitle)).toHaveCount(0);
      await expect(saveIndicator(page)).toHaveText(IND.saved);
      await captureEvidence(page, 'E07_jobtitle_120_saved.png');
      await attachJson('E07_jobtitle_boundary.json', { len121: r422.response.status(), len120: saved.response.status() });
    });
  });

  test('E07 · "Họ tên" emptied → real 422 → "Họ tên cần từ 1 đến 120 ký tự…"; retyping the saved name clears it and sends nothing', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const me = await openAccount(page);
      const name = textOf(me, 'fullName');
      const fullName = box(page, 'Họ tên');
      const rejected = waitForApi(page, 'PATCH', ME_RE, [422]);
      await fullName.fill('');
      const r422 = await rejected;
      expect(r422.response.request().postDataJSON()).toEqual({ fullName: '' }); // ASG:133-150 sends the changed key only
      await expect(fieldError(page, PROBLEM.fullName)).toBeVisible();
      await expect(saveIndicator(page)).toHaveText(IND.failed);
      await captureEvidence(page, 'E07_fullname_empty_rejected.png');

      // Draft equals the saved profile again → `getChanges` is undefined (UAS:281-288) → no PATCH; CA:156-159 → 'saved'
      // with no save yet → idle label.
      const writes = recordWrites(page);
      try {
        await fullName.fill(name);
        await expect(fieldError(page, PROBLEM.fullName)).toHaveCount(0);
        await expect(saveIndicator(page)).toHaveText(IND.idle);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'retyping the saved name sends nothing').toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_fullname_restored_no_patch.png');
      await attachJson('E07_fullname_empty.json', { emptyStatus: 422, writesAfterRetype: writes.list() });
    });
  });

  test('E07 · "Điện thoại" 33 characters → real 422 "Số điện thoại tối đa 32 ký tự."; 32 characters → PATCH 200', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const phone = box(page, 'Điện thoại');
      const rejected = waitForApi(page, 'PATCH', ME_RE, [422]);
      await phone.fill('9'.repeat(PHONE_MAX + 1));
      await rejected;
      await expect(fieldError(page, PROBLEM.phone)).toBeVisible();
      await captureEvidence(page, 'E07_phone_33_rejected.png');

      const ok = waitForApi(page, 'PATCH', ME_RE, [200]);
      await phone.fill('8'.repeat(PHONE_MAX));
      const saved = await ok;
      expect(saved.response.request().postDataJSON()).toEqual({ phone: '8'.repeat(PHONE_MAX) });
      await expect(fieldError(page, PROBLEM.phone)).toHaveCount(0);
      await expect(saveIndicator(page)).toHaveText(IND.saved);
      await captureEvidence(page, 'E07_phone_32_saved.png');
      await attachJson('E07_phone_boundary.json', { len33: 422, len32: saved.response.status() });
    });
  });

  test('E07 · "Chức danh" of spaces only → PATCH 200 clears it (response without jobTitle); after reload the field is empty with "Chưa đặt"', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const jobTitle = box(page, 'Chức danh');
      // First give it a value, so clearing is a real change.
      const first = waitForApi(page, 'PATCH', ME_RE, [200]);
      await jobTitle.fill(`${TEST_DATA_PREFIX}title`);
      await first;
      const cleared = waitForApi(page, 'PATCH', ME_RE, [200]);
      await jobTitle.fill('   ');
      const res = await cleared;
      expect(res.response.request().postDataJSON()).toEqual({ jobTitle: '   ' });
      // BE:apps/api/me/schemas.py:56-65 trims to '' and router.py:115-122 stores NULL; MeSchema omits None (schemas.py:21-29).
      expect(asRecord(res.json, 'PATCH').jobTitle).toBeUndefined();

      const reread = waitForApi(page, 'GET', ME_RE, [200]);
      await page.reload();
      expect(asRecord((await reread).json, 'GET').jobTitle).toBeUndefined();
      await expect(jobTitle).toHaveValue(''); // ASG:62 jobTitle ?? ''
      await expect(jobTitle).toHaveAttribute('placeholder', PLACEHOLDER);
      await captureEvidence(page, 'E07_jobtitle_spaces_cleared.png');
      await attachJson('E07_jobtitle_spaces.json', { sent: '   ', responseHasJobTitle: false, afterReload: '' });
    });
  });

  test('E07 · quick successive edits of "Chức danh" → ONE PATCH with the last value (800 ms debounce)', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const me = await openAccount(page);
      const base = textOf(me, 'jobTitle');
      const jobTitle = box(page, 'Chức danh');
      const writes = recordWrites(page);
      const finalValue = `${base}e07-debounce`;
      try {
        const saved = waitForApi(page, 'PATCH', ME_RE, [200]);
        // Each `fill` is one change; with slowMo ≤ 400 ms the gaps stay under the 800 ms debounce (UAS:103, CA:209-216)
        // and the 5 s max wait (CA:78).
        for (const step of ['e', 'e07', 'e07-deb', 'e07-debounce']) await jobTitle.fill(`${base}${step}`);
        const res = await saved;
        expect(res.response.request().postDataJSON()).toEqual({ jobTitle: finalValue });
        await expect(saveIndicator(page)).toHaveText(IND.saved);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'one PATCH for the whole burst').toEqual(['PATCH /api/me']);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_debounce_one_patch.png');
      await attachJson('E07_debounce.json', { requests: writes.list(), bodies: writes.bodies('/api/me') });
    });
  });

  test('E07 · undo toast "Đã lưu cài đặt tài khoản." → "Hoàn tác" sends PATCH with the previous value and restores the field', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const me = await openAccount(page);
      const original = textOf(me, 'jobTitle');
      const jobTitle = box(page, 'Chức danh');
      const edited = `${original}-e07-undo`;
      const saved = waitForApi(page, 'PATCH', ME_RE, [200]);
      await jobTitle.fill(edited);
      await saved;
      // UAS:336-353: every save publishes an undo ticket on the app bus (NotificationHost, TST:120,149).
      const toast = undoToast(page);
      await expect(toast).toBeVisible();
      await toast.hover(); // TST: hovering pauses the 8 s window (G5)
      await captureEvidence(page, 'E07_undo_toast.png');

      const restored = waitForApi(page, 'PATCH', ME_RE, [200]);
      await toast.getByRole('button', { name: UNDO, exact: true }).click();
      const res = await restored;
      expect(res.response.request().postDataJSON()).toEqual({ jobTitle: original });
      await expect(jobTitle).toHaveValue(original);
      // A restore makes no new ticket (UAS:329-334 isRestore → return).
      await page.mouse.move(0, 0);
      await expect(undoToast(page)).toHaveCount(0, { timeout: 15_000 });
      await captureEvidence(page, 'E07_undo_restored.png');
      await attachJson('E07_undo.json', { edited, undoBody: res.response.request().postDataJSON() as unknown });
    });
  });

  test('E07 · "Ngôn ngữ" → "Tiếng Anh" sends PATCH {language:"en"} only; back to "Tiếng Việt" sends {language:"vi"}', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const me = await openAccount(page);
      expect(me.language, 'precondition').toBe('vi');
      const combo = page.getByRole('combobox', { name: LANGUAGE.label, exact: true });
      await expect(combo).toHaveText(LANGUAGE.vi);
      const toEn = waitForApi(page, 'PATCH', ME_RE, [200]);
      await combo.click();
      await page.getByRole('option', { name: LANGUAGE.en, exact: true }).click();
      const en = await toEn;
      expect(en.response.request().postDataJSON()).toEqual({ language: 'en' });
      expect(asRecord(en.json, 'PATCH').language).toBe('en');
      await expect(combo).toHaveText(LANGUAGE.en);
      await captureEvidence(page, 'E07_language_en.png');

      const toVi = waitForApi(page, 'PATCH', ME_RE, [200]);
      await combo.click();
      await page.getByRole('option', { name: LANGUAGE.vi, exact: true }).click();
      const vi = await toVi;
      expect(vi.response.request().postDataJSON()).toEqual({ language: 'vi' });
      await expect(combo).toHaveText(LANGUAGE.vi);
      await attachJson('E07_language.json', { first: 'en', then: 'vi' });
    });
  });

  test('E07 · "Đổi thư điện tử" only swaps in the longer read-only reason; the email stays read-only and nothing is sent', async ({ browser }) => {
    await asInvitee(browser, async ({ page, user }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        await expect(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toBeVisible();
        await page.getByRole('button', { name: CHANGE_EMAIL, exact: true }).click(); // UAP:632
        await expect(page.getByText(EMAIL_REASON_LONG, { exact: true })).toBeVisible();
        await expect(page.getByText(EMAIL_REASON_SHORT, { exact: true })).toHaveCount(0);
        await expect(emailText(page, user.email)).toBeVisible(); // still plain text (INP:63-68)
        await expect(box(page, 'Thư điện tử')).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list()).toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_change_email_reason.png');
      await attachJson('E07_change_email.json', { writes: writes.list() });
    }, { reset: false });
  });

  test('E07 · offline edit → "Ngoại tuyến — sẽ lưu khi có mạng", nothing sent; back online → the same PATCH lands', async ({ browser }) => {
    await asInvitee(browser, async ({ page, context }) => {
      const me = await openAccount(page);
      const jobTitle = box(page, 'Chức danh');
      const edited = `${textOf(me, 'jobTitle')}-e07-offline`;
      const writes = recordWrites(page);
      try {
        await context.setOffline(true);
        await jobTitle.fill(edited);
        // CA:161-165: navigator offline → state 'offline', recheck every 5 s; I18N:71.
        await expect(saveIndicator(page)).toHaveText(IND.offline);
        expect(writes.list(), 'no PATCH while offline').toEqual([]);
        await captureEvidence(page, 'E07_offline_pending.png', { caption: 'context offline' });

        const landed = waitForApi(page, 'PATCH', ME_RE, [200], OFFLINE_FLUSH_TIMEOUT_MS);
        await context.setOffline(false);
        const res = await landed;
        expect(res.response.request().postDataJSON()).toEqual({ jobTitle: edited });
        await expect(saveIndicator(page)).toHaveText(IND.saved);
        await captureEvidence(page, 'E07_offline_flushed.png');
      } finally {
        await context.setOffline(false);
        writes.stop();
      }
      await attachJson('E07_offline.json', { requests: writes.list() });
    });
  });
});

/* ================================================================= SCR-33 — avatar */

test.describe('E07 SCR-33 avatar', () => {
  test('E07 · avatar rejected on the spot: GIF → "Chỉ nhận ảnh PNG hoặc JPEG."; 512 KB + 1 byte → "Ảnh tối đa 512 KB…"; no dialog, no PUT', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        await avatarInput(page).setInputFiles({ name: 'e07.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a-e07') });
        await expect(fieldError(page, AVATAR.typeUnsupported)).toBeVisible(); // UAP:528-532, PS:170-174
        await expect(avatarDialog(page)).toHaveCount(0);
        await captureEvidence(page, 'E07_avatar_gif_rejected.png');

        await avatarInput(page).setInputFiles({ name: 'e07-big.png', mimeType: 'image/png', buffer: Buffer.alloc(AVATAR_MAX_FILE_BYTES + 1) });
        await expect(fieldError(page, AVATAR.fileTooBig)).toBeVisible(); // UAP:534-538
        await expect(fieldError(page, AVATAR.typeUnsupported)).toHaveCount(0); // UAP:526 clears the previous problem
        await expect(avatarDialog(page)).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'local rejections send nothing').toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_avatar_too_big_rejected.png');
      await attachJson('E07_avatar_local_reject.json', { gif: AVATAR.typeUnsupported, bytes: AVATAR_MAX_FILE_BYTES + 1, writes: writes.list() });
    }, { reset: false });
  });

  test('E07 · avatar of exactly 512 KB passes the local checks → dialog with preview; Esc closes it and sends nothing', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        // UAP:534 `file.size > 524 288` and UAP:548 base64 > 699 052: 524 288 bytes encode to exactly 699 052 → accepted.
        await avatarInput(page).setInputFiles({ name: 'e07-512k.png', mimeType: 'image/png', buffer: Buffer.alloc(AVATAR_MAX_FILE_BYTES) });
        const dialog = avatarDialog(page);
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('img', { name: AVATAR.preview, exact: true })).toHaveCount(1);
        await expect(fieldError(page, AVATAR.fileTooBig)).toHaveCount(0);
        await captureEvidence(page, 'E07_avatar_512k_dialog.png');

        await page.keyboard.press('Escape'); // ARD:36 onClose = onCancel (A12)
        await expect(dialog).toBeHidden();
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'Esc sends nothing').toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_avatar_512k_escaped.png');
      await attachJson('E07_avatar_512k.json', { bytes: AVATAR_MAX_FILE_BYTES, dialogOpened: true, writesAfterEsc: writes.list() });
    }, { reset: false });
  });

  test('E07 · avatar real upload: double click "Thay ảnh" → ONE PUT /api/me/avatar 200 → image shown; next pick asks "Thay ảnh đại diện?" + "Ảnh cũ không khôi phục được."', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const me = await openAccount(page);
      const name = textOf(me, 'fullName');
      const hadAvatar = typeof me.avatarUrl === 'string';
      const writes = recordWrites(page);
      try {
        await avatarInput(page).setInputFiles({ name: 'e07.png', mimeType: 'image/png', buffer: TINY_PNG });
        const dialog = page.getByRole('dialog', { name: hadAvatar ? AVATAR.replaceTitle : AVATAR.setTitle, exact: true }); // ARD:30, UAP:618
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(hadAvatar ? AVATAR.replaceWarning : AVATAR.setWarning, { exact: true })).toBeVisible();

        const put = waitForApi(page, 'PUT', /^\/api\/me\/avatar$/u, [200]);
        await dialog.getByRole('button', { name: AVATAR.confirm, exact: true }).dblclick(); // UAP:569 guard, ARD:54 loading
        const res = await put;
        const avatarUrl = asRecord(res.json, 'PUT avatar').avatarUrl;
        expect(typeof avatarUrl, 'response carries avatarUrl').toBe('string');
        await expect(dialog).toBeHidden();
        const img = block(page, 'account-profile').getByRole('img', { name: avatarAltOf(name), exact: true });
        await expect(img).toHaveAttribute('src', String(avatarUrl)); // UAP:583,607
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list().filter((w) => w === `PUT ${AVATAR_API}`), 'double click sends one PUT').toHaveLength(1);
        await captureEvidence(page, 'E07_avatar_uploaded.png');

        // Now an avatar exists → "Thay" wording (ARD:30-33, UAP:618 avatarUrlOverride).
        await avatarInput(page).setInputFiles({ name: 'e07-2.png', mimeType: 'image/png', buffer: TINY_PNG });
        const replace = page.getByRole('dialog', { name: AVATAR.replaceTitle, exact: true });
        await expect(replace).toBeVisible();
        await expect(replace.getByText(AVATAR.replaceWarning, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E07_avatar_replace_dialog.png');
        await replace.getByRole('button', { name: AVATAR.cancel, exact: true }).click();
        await expect(replace).toBeHidden();
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list().filter((w) => w === `PUT ${AVATAR_API}`), 'cancel adds no PUT').toHaveLength(1);
      } finally {
        writes.stop();
      }
      await attachJson('E07_avatar_upload.json', { hadAvatar, puts: writes.list().filter((w) => w.startsWith('PUT')) });
    }, { reset: false });
  });

  test('E07 · avatar whose bytes are not an image → real 422 FILE_TYPE_MISMATCH → "Nội dung tệp không khớp loại ảnh…", dialog closed', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      await avatarInput(page).setInputFiles({ name: 'e07-fake.png', mimeType: 'image/png', buffer: Buffer.from('qa-e07 these bytes are not an image') });
      const dialog = avatarDialog(page);
      await expect(dialog).toBeVisible();
      const rejected = waitForApi(page, 'PUT', /^\/api\/me\/avatar$/u, [422]);
      await dialog.getByRole('button', { name: AVATAR.confirm, exact: true }).click();
      const res = await rejected;
      // BE:apps/api/me/avatar.py:158-167 (_detect_kind: unknown, not GIF/WebP/BMP/TIFF → FILE_TYPE_MISMATCH).
      expect(JSON.stringify(res.json)).toContain('FILE_TYPE_MISMATCH');
      await expect(dialog).toBeHidden(); // UAP:595-598 finally clears the pending avatar
      await expect(fieldError(page, AVATAR.typeMismatch)).toBeVisible(); // UAP:199-200,585-587
      await captureEvidence(page, 'E07_avatar_type_mismatch.png');
      await attachJson('E07_avatar_type_mismatch.json', { status: res.response.status(), body: res.json });
    }, { reset: false });
  });
});

/* ================================================================= SCR-33 — appearance & notifications */

test.describe('E07 SCR-33 appearance and notifications', () => {
  test('E07 · "Chủ đề" by keyboard: ArrowRight checks and focuses the next option (theme applied, stored), ArrowLeft goes back; no network', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        const start = await checkedTheme(page);
        const next = THEME_ORDER[(THEME_ORDER.indexOf(start) + 1) % THEME_ORDER.length]!;
        await themeRadio(page, start).focus();
        await page.keyboard.press('ArrowRight'); // AP:124-149 move(1): onChange + focus the next button
        await expect(themeRadio(page, next)).toHaveAttribute('aria-checked', 'true');
        await expect(themeRadio(page, next)).toBeFocused();
        const resolved = await resolvedTheme(page, next);
        await expect.poll(() => readStoredTheme(page)).toBe(resolved); // UAP:479-488 setTheme(resolved) → useTheme
        if (resolved === 'dark') await expect(page.locator('html')).toHaveClass(DARK_CLASS);
        else await expect(page.locator('html')).not.toHaveClass(DARK_CLASS);
        await captureEvidence(page, 'E07_theme_keyboard_next.png', { caption: `ArrowRight: ${start} → ${next}` });

        await page.keyboard.press('ArrowLeft');
        await expect(themeRadio(page, start)).toHaveAttribute('aria-checked', 'true');
        await expect(themeRadio(page, start)).toBeFocused();
        await expect(saveIndicator(page)).toHaveText(IND.localOnly);
        expect(writes.list(), 'theme keys send nothing').toEqual([]);
        await attachJson('E07_theme_keyboard.json', { start, next, storedAfterNext: resolved, writes: writes.list() });
      } finally {
        writes.stop();
      }
    }, { reset: false });
  });

  test('E07 · "Dùng nền tối cho khung nhìn 3D", "Hiện lưới 100 mm", "Mật độ hiển thị" = Gọn → rows 40 → 36 px; memory only, no network', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const writes = recordWrites(page);
      try {
        const viewportDark = toggle(page, VIEWPORT_DARK);
        const grid = toggle(page, SHOW_GRID);
        // Defaults UAP:385-388: viewportDark false, showGrid true, density comfortable.
        await expect(viewportDark).toHaveAttribute('aria-checked', 'false');
        await expect(grid).toHaveAttribute('aria-checked', 'true');
        const densityGroup = page.getByRole('radiogroup', { name: DENSITY.group, exact: true });
        const row = rowOf(themeGroup(page));
        await expect(row).toHaveCSS('min-height', ROW_MIN_HEIGHT.comfortable);

        await viewportDark.click();
        await expect(viewportDark).toHaveAttribute('aria-checked', 'true');
        await grid.click();
        await expect(grid).toHaveAttribute('aria-checked', 'false');
        await densityGroup.getByRole('radio', { name: DENSITY.compact, exact: true }).click();
        await expect(densityGroup.getByRole('radio', { name: DENSITY.compact, exact: true })).toHaveAttribute('aria-checked', 'true');
        await expect(row).toHaveCSS('min-height', ROW_MIN_HEIGHT.compact); // UAP:604, AP:190
        await expect(rowOf(box(page, 'Chức danh'))).toHaveCSS('min-height', ROW_MIN_HEIGHT.compact); // same class on profile rows (PS:119)
        await expect(saveIndicator(page)).toHaveText(IND.localOnly);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'appearance toggles send nothing').toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_appearance_toggles_density.png');
      await attachJson('E07_appearance_toggles.json', { viewportDark: true, showGrid: false, density: 'compact', rowMinHeight: ROW_MIN_HEIGHT.compact, writes: writes.list() });
    }, { reset: false });
  });

  test('E07 · reload: local-only settings ("Hiện lưới 100 mm" off, "Gọn") fall back to defaults; the theme survives (localStorage)', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const start = await checkedTheme(page);
      const other: ThemeChoice = start === 'dark' ? 'light' : 'dark';
      await themeRadio(page, other).click();
      await toggle(page, SHOW_GRID).click();
      const densityGroup = page.getByRole('radiogroup', { name: DENSITY.group, exact: true });
      await densityGroup.getByRole('radio', { name: DENSITY.compact, exact: true }).click();
      await expect(saveIndicator(page)).toHaveText(IND.localOnly);
      await expect.poll(() => readStoredTheme(page)).toBe(other);

      await page.reload();
      await expect(box(page, 'Chức danh')).toBeVisible();
      // ASG:97-98,126-130: appearance/notifications live in module memory → a new document starts empty → defaults
      // (UAP:385-388). The theme falls back to the store, which reads localStorage (UAP:371-373,384).
      await expect(toggle(page, SHOW_GRID)).toHaveAttribute('aria-checked', 'true');
      await expect(densityGroup.getByRole('radio', { name: DENSITY.comfortable, exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(themeRadio(page, other)).toHaveAttribute('aria-checked', 'true');
      expect(await readStoredTheme(page)).toBe(other);
      await captureEvidence(page, 'E07_reload_local_only_reset.png', { caption: `after reload: grid on, Thoải mái, theme ${other}` });
      await attachJson('E07_reload.json', { before: { theme: other, showGrid: false, density: 'compact' }, after: { theme: other, showGrid: true, density: 'comfortable' } });
    }, { reset: false });
  });

  test('E07 · notification matrix: 5 × 2 defaults from source; Space on a focused checkbox toggles it; memory only', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const section = block(page, 'account-notifications');
      await expect(section.getByRole('checkbox')).toHaveCount(NOTIFICATION_DEFAULTS.length * 2);
      for (const event of NOTIFICATION_DEFAULTS) {
        await expect(section.getByRole('checkbox', { name: cellName(event.label, CHANNELS.inApp), exact: true })).toBeChecked({ checked: event.inApp });
        await expect(section.getByRole('checkbox', { name: cellName(event.label, CHANNELS.email), exact: true })).toBeChecked({ checked: event.email });
      }
      const writes = recordWrites(page);
      try {
        const cell = section.getByRole('checkbox', { name: cellName('Tổng hợp mỗi sáng', CHANNELS.inApp), exact: true });
        await cell.focus();
        await page.keyboard.press('Space'); // native checkbox (NS:158-163)
        await expect(cell).toBeChecked();
        await expect(saveIndicator(page)).toHaveText(IND.localOnly);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list()).toEqual([]);
      } finally {
        writes.stop();
      }
      await captureEvidence(page, 'E07_notifications_matrix_keyboard.png');
      await attachJson('E07_notifications_matrix.json', { defaults: NOTIFICATION_DEFAULTS, toggled: 'Tổng hợp mỗi sáng — Trong ứng dụng', writes: writes.list() });
    }, { reset: false });
  });

  test('E07 · compact 375 px: the notification matrix becomes a list of named groups with two switches each; a switch is memory only; no horizontal scroll', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const section = block(page, 'account-notifications');
      // UAT:274-300 `(width < 640px)` → NS:95-126 list, group aria-labelledby the event, Toggle per channel.
      await expect(section.getByRole('table')).toHaveCount(0);
      await expect(section.getByRole('checkbox')).toHaveCount(0);
      const group = section.getByRole('group', { name: 'AI xử lý xong', exact: true });
      await expect(group.getByRole('switch', { name: CHANNELS.inApp, exact: true })).toHaveAttribute('aria-checked', 'true');
      const email = group.getByRole('switch', { name: CHANNELS.email, exact: true });
      await expect(email).toHaveAttribute('aria-checked', 'false');
      const writes = recordWrites(page);
      try {
        await email.click();
        await expect(email).toHaveAttribute('aria-checked', 'true');
        await expect(saveIndicator(page)).toHaveText(IND.localOnly);
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list()).toEqual([]);
      } finally {
        writes.stop();
      }
      await section.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E07_compact_notifications.png', { fullPage: true });
      const overflowPx = await horizontalOverflow(page);
      await attachJson('E07_compact_notifications.json', { viewport: PHONE, groups: NOTIFICATION_DEFAULTS.length, overflowPx, widest: await widestElements(page) });
      expect(overflowPx, 'no horizontal scroll at 375 px (offenders in E07_compact_notifications.json)').toBeLessThanOrEqual(0);
    }, { viewport: PHONE, reset: false });
  });

  test('E07 · "Tìm phím tắt" ignores case and diacritics ("HOAN TAC" = 2 rows, "dong lop" = 1); no match → empty sentence; cleared → all', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const region = page.getByRole('region', { name: SHORTCUTS.region, exact: true });
      const search = region.getByRole('searchbox', { name: SHORTCUTS.search, exact: true });
      const count = region.getByRole('status');
      await expect(count).toHaveText(SHORTCUTS.all);
      const total = Number(SHORTCUTS.all.exec((await count.textContent()) ?? '')?.[1]);

      await search.fill('HOAN TAC'); // UAT:364-377 foldForSearch on both sides (src/lib/format/fold.ts:36-38)
      await expect(count).toHaveText(SHORTCUTS.filtered(UNDO_DESCRIPTIONS.length, total));
      for (const text of UNDO_DESCRIPTIONS) await expect(region.getByRole('cell', { name: text, exact: true })).toBeVisible();
      await expect(region.locator('tbody tr')).toHaveCount(UNDO_DESCRIPTIONS.length);
      await captureEvidence(page, 'E07_shortcuts_folded.png');

      await search.fill('dong lop');
      await expect(count).toHaveText(SHORTCUTS.filtered(1, total));
      await expect(region.getByRole('cell', { name: CLOSE_TOP_LAYER, exact: true })).toBeVisible();

      await search.fill('qa-e07-zzz');
      await expect(count).toHaveText(SHORTCUTS.filtered(0, total));
      await expect(region.getByText(SHORTCUTS.empty, { exact: true })).toBeVisible(); // SS:170-176
      await captureEvidence(page, 'E07_shortcuts_no_match.png');

      await search.fill('');
      await expect(count).toHaveText(`${String(total)} phím tắt đang có hiệu lực.`);
      await expect(region.locator('tbody tr')).toHaveCount(total);
      await attachJson('E07_shortcuts.json', { total, hoanTac: UNDO_DESCRIPTIONS.length, dongLop: 1, noMatch: 0 });
    }, { reset: false });
  });
});

/* ================================================================= SCR-33 — password */

test.describe('E07 SCR-33 password', () => {
  test('E07 · password checks on the spot (no request): submit disabled until 3 fields; short / letters only / same as current / mismatch; strength yếu-khá-mạnh; Enter submits; clearing current after a submit', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const current = pwField(page, PW.current);
      const next = pwField(page, PW.next);
      const confirm = pwField(page, PW.confirm);
      const writes = recordWrites(page);
      try {
        // UAA:650-655 canSubmit needs all three.
        await expect(pwSubmit(page)).toBeDisabled();
        await current.fill('qa-e07-Current1');
        await expect(pwSubmit(page)).toBeDisabled();
        await next.fill('abc1');
        await expect(page.getByText(PW.strength('yếu'), { exact: true })).toBeVisible(); // UAA:186-187
        await expect(pwSubmit(page)).toBeDisabled();
        await confirm.fill('abc1');
        await expect(pwSubmit(page)).toBeEnabled();

        await pwSubmit(page).click();
        await expect(page.getByText(PW.tooShort, { exact: true })).toBeVisible(); // UAA:163-165,647
        await captureEvidence(page, 'E07_password_too_short.png');

        await next.fill('abcdefgh');
        await confirm.fill('abcdefgh');
        await confirm.press('Enter'); // PWS:145-150 form submit
        await expect(page.getByText(PW.letterDigit, { exact: true })).toBeVisible(); // UAA:136-139,167-169

        await next.fill('qa-e07-Current1');
        await confirm.fill('qa-e07-Current1');
        await pwSubmit(page).click();
        await expect(page.getByText(PW.sameAsCurrent, { exact: true })).toBeVisible(); // UAA:371-374,387

        await next.fill('Abcdefg12');
        await expect(page.getByText(PW.strength('khá'), { exact: true })).toBeVisible(); // valid, < 12 (UAA:190)
        await confirm.fill('Abcdefg13');
        await pwSubmit(page).click();
        await expect(page.getByText(PW.mismatch, { exact: true })).toBeVisible(); // UAA:375,648
        await captureEvidence(page, 'E07_password_mismatch.png');

        await next.fill('Abcdefghijk1');
        await expect(page.getByText(PW.strength('mạnh'), { exact: true })).toBeVisible(); // ≥ 12 (UAA:121,190)

        await current.fill('');
        await expect(pwSubmit(page)).toBeDisabled();
        await expect(page.getByText(PW.currentRequired, { exact: true })).toBeVisible(); // UAA:644-646 (hasSubmitted)
        await captureEvidence(page, 'E07_password_current_required.png');

        await page.waitForTimeout(QUIET_MS);
        expect(writes.list(), 'local checks send nothing').toEqual([]);
      } finally {
        writes.stop();
      }
      await attachJson('E07_password_local.json', { writes: writes.list() });
    }, { reset: false });
  });

  test('E07 · wrong current password, double-clicked → ONE POST /api/me/password → real 422 → "Mật khẩu hiện tại không đúng."; editing the field clears it', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      await openAccount(page);
      const current = pwField(page, PW.current);
      const newPassword = `Qa-${randomUUID()}`; // letters + digits, ≥ 8
      await current.fill(`Wrong-${randomUUID()}`);
      await pwField(page, PW.next).fill(newPassword);
      await pwField(page, PW.confirm).fill(newPassword);
      const writes = recordWrites(page);
      try {
        const rejected = waitForApi(page, 'POST', /^\/api\/me\/password$/u, [422]);
        await pwSubmit(page).dblclick(); // UAA:354,378,394 inFlight guard; PWS:196-203 loading
        const res = await rejected;
        expect(JSON.stringify(res.json)).toContain('CURRENT_PASSWORD_INCORRECT'); // BE:apps/api/me/router.py:234
        await expect(page.getByText(PW.currentWrong, { exact: true })).toBeVisible(); // AAG:175-177, UAA:416-423
        await expect(current).toHaveAttribute('aria-invalid', 'true');
        await page.waitForTimeout(QUIET_MS);
        expect(writes.list().filter((w) => w === `POST ${PASSWORD_API}`), 'double click sends one POST').toHaveLength(1);
        await captureEvidence(page, 'E07_password_wrong_current.png');

        await current.fill('Wrong-again-1'); // UAA:356-364 editing current drops the server problem
        await expect(page.getByText(PW.currentWrong, { exact: true })).toHaveCount(0);
      } finally {
        writes.stop();
      }
      await attachJson('E07_password_wrong_current.json', { status: 422, posts: writes.list().filter((w) => w.startsWith('POST')) });
    }, { reset: false });
  });

  test('E07 · password change succeeds (test user) → "Đã đổi mật khẩu…", fields cleared, this session stays, the new password signs in', async ({ browser }) => {
    await asInvitee(browser, async ({ page, user }) => {
      await openAccount(page);
      const newPassword = `Qa-${randomUUID()}`;
      await pwField(page, PW.current).fill(user.password);
      await pwField(page, PW.next).fill(newPassword);
      await pwField(page, PW.confirm).fill(newPassword);
      const changed = waitForApi(page, 'POST', /^\/api\/me\/password$/u, [204]);
      await pwSubmit(page).click();
      await changed;
      user.password = newPassword; // from here on, later tests sign in with it
      await expect(page.getByText(PW.changed, { exact: true })).toBeVisible(); // UAA:406-411, PWS:191-193
      for (const label of [PW.current, PW.next, PW.confirm]) await expect(pwField(page, label)).toHaveValue('');
      await captureEvidence(page, 'E07_password_changed.png');

      // BE:apps/api/me/router.py:205-213 revokes OTHER sessions (except_sid): this one still reads /me after a reload.
      const reread = waitForApi(page, 'GET', ME_RE, [200]);
      await page.reload();
      await reread;
      await expect(heading(page)).toBeVisible();
      expect(pathname(page)).toBe(ROUTES.account);

      const base = apiBaseUrl();
      const probe = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
      try {
        const login = await probe.post('/api/auth/login', { data: { email: user.email, password: newPassword, rememberMe: false } });
        expect(login.status(), 'the new password signs in').toBe(204);
      } finally {
        await probe.dispose();
      }
      await captureEvidence(page, 'E07_password_changed_session_kept.png');
      await attachJson('E07_password_changed.json', { changeStatus: 204, sessionKept: true, newPasswordLogin: 204 });
    }, { reset: false });
  });
});

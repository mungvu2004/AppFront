/**
 * Phase 07 shared helper for SCR-33 Account Settings (`/tai-khoan`). Ported from `phase07_account_edge.spec.ts` (and the
 * other phase07_account*.spec.ts); no spec imports another spec. Short names for sources (FE @82e18a88, under
 * `src/screens/account/AccountSettings/` unless a path is given): AS AccountSettings.tsx, PS ProfileSection.tsx,
 * ARD AvatarReplaceDialog.tsx, AP AppearanceSection.tsx, PWS PasswordSection.tsx, UAS useAccountSettings.ts,
 * UAP useAccountPreferences.ts, UAT useAccountTables.ts, UAA useAccountAuth.ts, I18N src/i18n/vi.json.
 *
 * Usage:
 *   const admin = await signedInApi(adminEmail, adminPassword);
 *   const user = await accountUser(admin, 'acct');                      // pool engineer, own slot
 *   await signInAccount(context, user);                                 // 1 login through the context's cookie jar
 *   const snap = await snapshotProfile(context);                        // BEFORE editing
 *   try { const me = await openAccount(page); ... } finally { await resetProfile(context, snap); }
 * Phase 07 is desktop/tablet only (DESKTOP_VIEWPORTS); there is no phone viewport.
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse, BrowserContext, Locator, Page, Request, Route, TestInfo } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { waitForApi } from '../../../../e2e/fullstack/apiWatch';
import { apiBaseUrl } from '../api';
import { poolUser, signInPoolUser, type PoolRole, type PoolUser } from '../phase03Seed';

/* ---------------------------------------------------------------- viewports */

/** The only viewports of phase 07 (desktop + tablet; no 375). */
export const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;
export const DESKTOP = { width: 1440, height: 900 } as const;

/* ---------------------------------------------------------------- constants (each cites its source) */

export const ME_RE = /^\/api\/me$/u; // src/api/endpoints.ts:139 (ME_ROOT)
export const AVATAR_API = '/api/me/avatar'; // src/api/endpoints.ts:137
export const PASSWORD_API = '/api/me/password'; // src/api/endpoints.ts:138
export const REFRESH_API = '/api/auth/refresh';

/** A "nothing was sent" claim waits past the 800 ms autosave (UAS:103) plus a round trip. */
export const QUIET_MS = 2_500;
/** react-query retries a failed read once (src/lib/query/cachePolicy.ts:79) before the error state paints. */
export const ERROR_PAINT_TIMEOUT_MS = 30_000;
/** createAutosave.ts OFFLINE_RECHECK_MS = 5 s, + debounce + round trip. */
export const OFFLINE_FLUSH_TIMEOUT_MS = 20_000;

export const TITLE = 'Cài đặt tài khoản'; // AS:104
export const LOAD_ERROR_TITLE = 'Không tải được cài đặt tài khoản'; // AS:189
export const RETRY = 'Thử lại'; // AS:191
export const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // I18N errors.unknown.description
export const BLOCK_IDS = ['account-profile', 'account-appearance', 'account-notifications', 'account-shortcuts', 'account-password'] as const; // AS:116-153

/** Save indicator (AS:110, I18N account.saveIndicator, UAS:109). */
export const IND = {
  idle: 'Chưa có thay đổi', // I18N, SaveIndicator.tsx
  failed: 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.',
  offline: 'Ngoại tuyến — sẽ lưu khi có mạng',
  saved: /^Đã lưu lúc/u, // src/hooks/useSaveIndicator.ts:44
  localOnly: 'Chỉ giữ trong phiên này', // UAS:109
} as const;
export const UNDO_TOAST = 'Đã lưu cài đặt tài khoản.'; // UAS:121,348-353
export const UNDO = 'Hoàn tác'; // src/components/feedback/Toast.tsx:149

export const PROBLEM = {
  fullName: 'Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển.', // UAS:113
  jobTitle: 'Chức danh tối đa 120 ký tự, không chứa ký tự điều khiển.', // UAS:114
  phone: 'Số điện thoại tối đa 32 ký tự.', // UAS:115
} as const;
export const PLACEHOLDER = 'Chưa đặt'; // UAP:155,158
export const EMAIL_REASON_SHORT = 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.'; // UAP:150
export const EMAIL_REASON_LONG =
  'Thư điện tử là tên đăng nhập nên đổi nó phải qua một bước xác minh. Liên hệ quản trị viên của công ty để đổi.'; // UAP:151-153
export const CHANGE_EMAIL = 'Đổi thư điện tử'; // PS:210
export const LANGUAGE = { label: 'Ngôn ngữ', vi: 'Tiếng Việt', en: 'Tiếng Anh' } as const; // PS:243-258, UAP:117-120
/** BE:apps/api/me/schemas.py FULL_NAME_MAX (also jobTitle) / PHONE_MAX. */
export const TEXT_MAX = 120;
export const PHONE_MAX = 32;

export const AVATAR_MAX_FILE_BYTES = 524_288; // UAP:163
export const AVATAR = {
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
export const avatarAltOf = (name: string): string => (name === '' ? 'Ảnh đại diện' : `Ảnh đại diện của ${name}`); // UAP:160
/** 1x1 PNG, in memory. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const THEME_ORDER = ['light', 'dark', 'system'] as const; // AP:60-64
export type ThemeChoice = (typeof THEME_ORDER)[number];
export const THEME_LABEL: Readonly<Record<ThemeChoice, string>> = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' }; // AP:61-63
export const THEME_STORAGE_KEY = 'app-theme-mode'; // src/hooks/useTheme.ts THEME_KEY
export const DARK_CLASS = /(?:^|\s)dark(?:\s|$)/u;
export const VIEWPORT_DARK = 'Dùng nền tối cho khung nhìn 3D'; // AP:215
export const REDUCE_MOTION = 'Giảm chuyển động'; // AP:224
export const SHOW_GRID = 'Hiện lưới 100 mm'; // AP:233
export const DENSITY = { group: 'Mật độ hiển thị', comfortable: 'Thoải mái', compact: 'Gọn' } as const; // AP:67-70,238-241
export const ROW_MIN_HEIGHT = { comfortable: '40px', compact: '36px' } as const; // UAP:133-148

export const CHANNELS = { inApp: 'Trong ứng dụng', email: 'Thư điện tử' } as const; // UAT:98-99
/** UAT:117-143 `fallback`: what each cell shows when nothing was stored in this session. */
export const NOTIFICATION_DEFAULTS: ReadonlyArray<{ label: string; inApp: boolean; email: boolean }> = [
  { label: 'AI xử lý xong', inApp: true, email: false },
  { label: 'Phát hiện vi phạm mới', inApp: true, email: true },
  { label: 'Được mời vào dự án', inApp: true, email: true },
  { label: 'Bình luận nhắc đến tôi', inApp: true, email: false },
  { label: 'Tổng hợp mỗi sáng', inApp: false, email: true },
];
export const cellName = (event: string, channel: string): string => `${event} — ${channel}`; // UAT:355

export const SHORTCUTS = {
  region: 'Phím tắt', // AS:144
  search: 'Tìm phím tắt', // SS:116
  empty: 'Không có phím tắt nào khớp với ô tìm.', // UAT:399
  all: /^(\d+) phím tắt đang có hiệu lực\.$/u, // UAT:384
  filtered: (shown: number, total: number): string => `Đang hiện ${String(shown)} trong ${String(total)} phím tắt.`, // UAT:385
} as const;
/** src/lib/input/shortcutRegistry.ts:697,707: the two descriptions holding "hoàn tác". */
export const UNDO_DESCRIPTIONS = ['Hoàn tác thao tác gần nhất', 'Làm lại thao tác vừa hoàn tác'] as const;
export const CLOSE_TOP_LAYER = 'Đóng lớp trên cùng'; // shortcutRegistry.ts:745

export const PW = {
  current: 'Mật khẩu hiện tại', // PWS:155
  next: 'Mật khẩu mới', // PWS:166
  confirm: 'Nhắc lại mật khẩu mới', // PWS:178
  submit: 'Đổi mật khẩu', // PWS:202
  currentRequired: 'Chưa nhập mật khẩu hiện tại.', // UAA:79
  currentWrong: 'Mật khẩu hiện tại không đúng.', // UAA:80
  tooShort: 'Mật khẩu cần ít nhất 8 ký tự.', // UAA:82
  letterDigit: 'Mật khẩu cần có cả chữ và số.', // UAA:83
  sameAsCurrent: 'Mật khẩu mới phải khác mật khẩu hiện tại.', // UAA:84
  mismatch: 'Hai ô mật khẩu chưa khớp nhau.', // UAA:85
  changed: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.', // UAA:86
  strength: (word: 'yếu' | 'khá' | 'mạnh'): string => `Độ mạnh: ${word}`, // PWS:74-76,126
} as const;

/* ---------------------------------------------------------------- small helpers */

export type Json = Record<string, unknown>;

/** Narrows `value` to a JSON object or throws naming `what`. */
export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/** Page overflow in px (scrollWidth - clientWidth); > 0 means a horizontal scrollbar. */
export const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Diagnostic for an overflow: the deepest elements whose right edge passes the viewport (tag, classes, text). */
export const widestElements = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > limit + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > limit + 1))
      .slice(0, 12)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ').slice(0, 4).join('.')} right=${Math.round(el.getBoundingClientRect().right)} "${(el.textContent ?? '').trim().slice(0, 40)}"`);
  });

/** Every mutating `/api/` request from now on (session upkeep `POST /api/auth/refresh` excluded), with its body. */
export function recordWrites(page: Page): { readonly list: () => string[]; readonly bodies: (path: string) => unknown[]; readonly stop: () => void } {
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

export const heading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: TITLE, exact: true });
export const accountHeader = (page: Page): Locator => page.locator('header').filter({ has: heading(page) });
export const saveIndicator = (page: Page): Locator => accountHeader(page).getByRole('status'); // AS:110
export const block = (page: Page, id: string): Locator => page.locator(`section[aria-labelledby="${id}"]`); // AS:79
export const box = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
/** PS:203 + Input.tsx:63-68: the read-only email is a `<span>` with the value, not a textbox. */
export const emailText = (page: Page, email: string): Locator => block(page, 'account-profile').getByText(email, { exact: true });
export const fieldError = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text }); // Input.tsx:117
export const undoToast = (page: Page): Locator => page.getByRole('status').filter({ hasText: UNDO_TOAST }); // Toast.tsx:120
export const avatarInput = (page: Page): Locator => page.getByLabel(AVATAR.pick, { exact: true }); // PS:133-160
export const avatarDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^(?:Đặt|Thay) ảnh đại diện\?$/u }); // ARD:30
export const themeGroup = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Chủ đề', exact: true }); // AP:197-199
export const themeRadio = (page: Page, choice: ThemeChoice): Locator => themeGroup(page).getByRole('radio', { name: THEME_LABEL[choice], exact: true });
export const toggle = (page: Page, name: string): Locator => page.getByRole('switch', { name, exact: true });
export const pwField = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true });
export const pwSubmit = (page: Page): Locator => page.getByRole('button', { name: PW.submit, exact: true });
/** FieldRow.tsx:62-70: the row div carrying `min-h-*` around a control. */
export const rowOf = (control: Locator): Locator => control.locator('xpath=ancestor::div[contains(@class,"items-start")][1]');

/* ---------------------------------------------------------------- theme helpers */

/** The checked "Chủ đề" radio (`data-value`). */
export async function checkedTheme(page: Page): Promise<ThemeChoice> {
  const value = await themeGroup(page).locator('[role="radio"][aria-checked="true"]').getAttribute('data-value');
  if (value !== 'light' && value !== 'dark' && value !== 'system') throw new Error(`"Chủ đề": no checked radio (got ${String(value)})`);
  return value;
}
/** Raw `localStorage` theme value (null when never set). */
export const readStoredTheme = (page: Page): Promise<string | null> =>
  page.evaluate((key) => window.localStorage.getItem(key), THEME_STORAGE_KEY);
/** UAP:326-333 resolveTheme: 'system' follows `(prefers-color-scheme: dark)`. */
export async function resolvedTheme(page: Page, choice: ThemeChoice): Promise<'light' | 'dark'> {
  if (choice !== 'system') return choice;
  return (await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'dark' : 'light';
}

/* ---------------------------------------------------------------- session / API */

/** Access token from a refresh body (src/lib/auth/refresh.ts:85-100: flat or under `data`). */
export function accessTokenOf(json: unknown): string {
  const body = asRecord(json, 'refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = typeof root.accessToken === 'string' ? root.accessToken : String(root.access_token ?? '');
  if (token === '') throw new Error('refresh: no access token');
  return token;
}

/** A pool user for `slot` (wraps `poolUser`; invites only on first use of the slot). */
export const accountUser = (admin: APIRequestContext, slot: string, role: PoolRole = 'engineer'): Promise<PoolUser> => poolUser(admin, role, slot);

/** Signs `user` in through the API inside `context` (wraps `signInPoolUser`; 1 login). */
export const signInAccount = (context: BrowserContext, user: PoolUser): Promise<void> => signInPoolUser(context, user);

/** `/api/me` with the context's own session: refresh cookie -> access token -> request. */
export async function meApi(context: BrowserContext): Promise<{ token: string; patch: (data: unknown) => Promise<APIResponse>; get: () => Promise<APIResponse> }> {
  const origin = apiBaseUrl();
  const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: origin } });
  if (refreshed.status() !== 200) throw new Error(`refresh -> ${String(refreshed.status())}`);
  const token = accessTokenOf(await refreshed.json());
  const headers = { Origin: origin, Authorization: `Bearer ${token}` };
  return {
    token,
    patch: (data) => context.request.patch('/api/me', { headers, data }),
    get: () => context.request.get('/api/me', { headers }),
  };
}

export interface ProfileSnapshot {
  readonly fullName: string;
  readonly jobTitle: string;
  readonly phone: string;
  readonly language: string;
}

const textOf = (me: Json, key: string): string => (typeof me[key] === 'string' ? (me[key] as string) : '');

/** Reads the current profile (call BEFORE editing, then restore with `resetProfile` in `finally`). */
export async function snapshotProfile(context: BrowserContext): Promise<ProfileSnapshot> {
  const res = await (await meApi(context)).get();
  expect(res.status(), 'snapshot: GET /api/me').toBe(200);
  const me = asRecord(await res.json(), 'GET /api/me');
  return { fullName: textOf(me, 'fullName'), jobTitle: textOf(me, 'jobTitle'), phone: textOf(me, 'phone'), language: textOf(me, 'language') || 'vi' };
}

/** Puts the profile back to `snapshot`. Best effort: a failure becomes an annotation, never the reported failure. */
export async function resetProfile(context: BrowserContext, snapshot: ProfileSnapshot, info: TestInfo = test.info()): Promise<void> {
  try {
    const res = await (await meApi(context)).patch(snapshot);
    if (res.status() !== 200) throw new Error(`PATCH /api/me -> ${String(res.status())}`);
  } catch (error) {
    info.annotations.push({ type: 'cleanup', description: `profile reset: ${String(error)}` });
  }
}

/** Opens `/tai-khoan` (fresh document) and returns the `GET /api/me` body the screen received (UAS:225-228). */
export async function openAccount(page: Page, hash = ''): Promise<Json> {
  const me = waitForApi(page, 'GET', ME_RE, [200]);
  await page.goto(`${ROUTES.account}${hash}`);
  const { json } = await me;
  await expect(heading(page)).toBeVisible();
  await expect(box(page, 'Chức danh')).toBeVisible();
  return asRecord(json, 'GET /api/me');
}

/**
 * Holds the REAL response of the first `method` request matching `urlGlob`: it is fetched upstream at once and fulfilled
 * only on `release()`. `seen` resolves with the request when intercepted. The route is removed on release.
 */
export async function holdResponse(
  page: Page,
  urlGlob: string,
  method: string,
): Promise<{ readonly seen: Promise<Request>; release: () => Promise<void> }> {
  let onSeen: (req: Request) => void = () => undefined;
  const seen = new Promise<Request>((resolve) => {
    onSeen = resolve;
  });
  let letGo: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  let held: Promise<void> | undefined;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method || held !== undefined) {
      await route.fallback();
      return;
    }
    onSeen(route.request());
    held = (async () => {
      const real = await route.fetch();
      await gate;
      await route.fulfill({ response: real });
    })();
    await held;
  };
  await page.route(urlGlob, handler);
  return {
    seen,
    release: async () => {
      letGo();
      await held;
      await page.unroute(urlGlob, handler);
    },
  };
}

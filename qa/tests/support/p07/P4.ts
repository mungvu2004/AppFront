/**
 * QA-07b pack P4 helpers: the three UI-verify specs of SCR-33 (`phase07_profile_ui`, `phase07_prefs_ui`,
 * `phase07_security_ui`). Everything here is new and local to P4; `account.ts` (shared) is only imported.
 *
 * Usage:
 *   const admin = await adminApi();
 *   const user = await accountUser(admin, 'p07-profile-ui');
 *   const { context, page } = await openUserSession(browser, user);     // 1 login through the context's cookie jar
 *   await verifyUi(page, U('33P-F-001', 'default'), async (p) => { await openAccount(p); ... }, FOUR);
 * `interceptRequests` answers (mock) or parks (hold) one request kind; a request parked while `verifyUi` moves to the
 * next width belongs to a page that is gone, so answering it throws and is ignored (see the catch there).
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { expect } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { signedInApi } from '../api';
import { ensureAdminSession, readAdminCredentials } from '../auth';
import { RUN_ID } from '../evidence';
import { signInPoolUser, type PoolUser } from '../phase03Seed';
import { ADMIN_STORAGE_STATE_FILE } from '../state';
import { AVATAR_API, DESKTOP, DESKTOP_VIEWPORTS, TINY_PNG, block, pwField, pwSubmit, PW } from './account';

/* ---------------------------------------------------------------- viewports and names */

/** The four phase-07 widths, passed explicitly to every `verifyUi` (its default list has 375 and nothing at 1920). */
export const FOUR = DESKTOP_VIEWPORTS;

/** Evidence/`verifyUi` name `U07_<row id>_<slug>` (the `_<width>.png` and `.json` suffixes are added by `verifyUi`). */
export const U = (rowId: string, slug: string): string => `U07_${rowId}_${slug}`;

/** `RUN_ID` re-exported for slots that must be fresh per run (`p07-profile-uiav-<runId>`). */
export const RUN = RUN_ID;

/* ---------------------------------------------------------------- sessions */

/** Admin API client (1 login). Used only to create/look up pool users. */
export async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
}

/** Own browser context signed in as the pool `user` (one `POST /api/auth/login` through the context's jar). */
export async function openUserSession(browser: Browser, user: PoolUser): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
  await signInPoolUser(context, user);
  return { context, page: await context.newPage() };
}

/** Own context from the admin storage state (`ensureAdminSession` replaces a dead stored session). Read-only use. */
export async function openAdminSession(browser: Browser): Promise<Session> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE, viewport: DESKTOP });
  await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
  return { context, page: await context.newPage() };
}

/** Writes only the rotated COOKIES back to the admin state file, keeping its saved localStorage (as the old ui spec). */
export async function saveAdminCookies(context: BrowserContext): Promise<void> {
  const saved = JSON.parse(readFileSync(ADMIN_STORAGE_STATE_FILE, 'utf8')) as Record<string, unknown>;
  const { cookies } = await context.storageState();
  writeFileSync(ADMIN_STORAGE_STATE_FILE, JSON.stringify({ ...saved, cookies }, null, 2));
}

/* ---------------------------------------------------------------- geometry */

export interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** Bounding box of a visible `locator`; throws when it is not on screen. */
export async function rect(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (b === null) throw new Error(`rect: ${locator.toString()} has no box`);
  return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height, width: b.width, height: b.height };
}

const sameBox = (a: Box, b: Box): boolean =>
  Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/** `rect` once the box stopped moving (entrance animations): two reads, two animation frames apart, must agree. */
export async function stableRect(locator: Locator): Promise<Box> {
  let previous = await rect(locator);
  for (let i = 0; i < 60; i += 1) {
    await locator.page().evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    const now = await rect(locator);
    if (sameBox(previous, now)) return now;
    previous = now;
  }
  return previous;
}

/** True when the two boxes share more than `tol` px in both axes. */
export const intersects = (a: Box, b: Box, tol = 1): boolean =>
  a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;

/** True when `inner` lies inside `outer` (within `tol` px). */
export const within = (inner: Box, outer: Box, tol = 1): boolean =>
  inner.left >= outer.left - tol && inner.right <= outer.right + tol && inner.top >= outer.top - tol && inner.bottom <= outer.bottom + tol;

/** Layout viewport (excludes a scrollbar), the frame "inside the viewport" is judged against. */
export const viewportOf = (page: Page): Promise<{ readonly w: number; readonly h: number }> =>
  page.evaluate(() => ({ w: document.documentElement.clientWidth, h: window.innerHeight }));

/* ---------------------------------------------------------------- request interception */

export interface Intercept {
  /** Requests of that kind seen since the route was installed. */
  readonly count: () => number;
  /** Lets every parked request go (answered by `finish`), then removes the route. */
  readonly release: () => Promise<void>;
}

/**
 * Routes `method` + `pathname` to `finish(route)`. `hold: true` parks each matching request until `release()`
 * (use `finish = (r) => r.continue()` for "the real answer, late"); `hold: false` answers at once (a mocked answer).
 * Other methods fall through to the network.
 */
export async function interceptRequests(
  page: Page,
  pathname: string,
  method: string,
  finish: (route: Route) => Promise<void>,
  options: { readonly hold: boolean },
): Promise<Intercept> {
  let seen = 0;
  let letGo: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  const pending: Array<Promise<void>> = [];
  const matches = (url: URL): boolean => url.pathname === pathname;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    seen += 1;
    const answered = (async () => {
      if (options.hold) await gate;
      try {
        await finish(route);
      } catch {
        // The page that sent this request already moved on (verifyUi opens the next width): nobody is waiting for it.
      }
    })();
    pending.push(answered);
    await answered;
  };
  await page.route(matches, handler);
  return {
    count: () => seen,
    release: async () => {
      letGo();
      await Promise.all(pending);
      await page.unroute(matches, handler);
    },
  };
}

/** `route.fulfill` with a JSON error body in the BE envelope (`code`, `message`, `requestId`, optional `field`). */
export const answerJson =
  (status: number, body: Readonly<Record<string, unknown>>, headers: Readonly<Record<string, string>> = {}) =>
  (route: Route): Promise<void> =>
    route.fulfill({ status, contentType: 'application/json', headers: { ...headers }, body: JSON.stringify(body) });

/* ---------------------------------------------------------------- profile (C1) */

export const CHIP_FIELD_REJECTED = 'Chưa lưu vì còn ô cần sửa'; // useAccountSettings.ts ACCOUNT_FIELD_REJECTED_LABEL (fix/qa07-a, BUG-503)
export const AVATAR_SENDING = 'Đang tải ảnh lên…'; // useAccountPreferences.ts:159
export const AVATAR_LOCKED = 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.'; // useAccountPreferences.ts:180
export const AVATAR_SET_CONFIRM = 'Đặt ảnh'; // AvatarReplaceDialog.tsx (fix/qa07-a, BUG-501)
export const AVATAR_ANY_CONFIRM = /^(?:Đặt|Thay) ảnh$/u; // opener only: the label itself is asserted in F-004 / F-005
export const PNG_FILE = { name: 'p07-ui-avatar.png', mimeType: 'image/png', buffer: TINY_PNG } as const;
export const GIF_FILE = { name: 'p07-ui-avatar.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') } as const;

/** Puts a pool user's profile back (its own API session). Best effort: a failure is an annotation, never the test's error. */
export async function resetPoolProfile(api: APIRequestContext, user: PoolUser, note: (text: string) => void): Promise<void> {
  const res = await api.patch('/api/me', { data: { fullName: user.name, jobTitle: '', phone: '', language: 'vi' } });
  if (res.status() !== 200) note(`profile reset of ${user.email}: PATCH /api/me -> ${String(res.status())}`);
}

/**
 * Uploads through `api` (the user's own session) until the `me_avatar` bucket (10 per 900 s) answers 429, so the next PUT from the
 * UI is refused. Every answer before the 429 must be 200; the bucket must close within 11 tries.
 * dup-of: flows `seedAvatarUploads(user, n)` in `profile.ts` (a count would break if an earlier PUT of the flow was repeated).
 */
export async function exhaustAvatarBucket(api: APIRequestContext): Promise<void> {
  for (let i = 0; i < 11; i += 1) {
    const res = await api.put(AVATAR_API, {
      headers: { 'Idempotency-Key': `p07ui-${RUN}-${String(i)}-${Date.now().toString(36)}` },
      data: { mimeType: PNG_FILE.mimeType, contentBase64: TINY_PNG.toString('base64') },
    });
    if (res.status() === 429) return;
    expect(res.status(), `seed: PUT ${AVATAR_API} #${String(i + 1)}`).toBe(200);
  }
  throw new Error(`seed: PUT ${AVATAR_API} never answered 429 in 11 tries`);
}

/* ---------------------------------------------------------------- password (C3) */

/** Values typed into the password form of the local QA stack. They are never submitted for real (see the spec header). */
export const PWV = {
  current: 'Qa-ui-current-1',
  strongNew: 'Qa-ui-strong-new-98765',
  weakNew: 'abc1',
  weakConfirm: 'abc12',
} as const;

/** Password block of `/tai-khoan`. */
export const passwordBlock = (page: Page): Locator => block(page, 'account-password');

/** Opens the screen past its loading state with the password form drawn. */
export async function openPasswordBlock(page: Page, goto: (p: Page) => Promise<unknown>): Promise<void> {
  await goto(page);
  await expect(passwordBlock(page).getByRole('heading', { level: 2, name: 'Mật khẩu', exact: true })).toBeVisible();
  await expect(pwField(page, PW.current)).toBeVisible();
}

/** Types the three fields (empty string = leave empty). */
export async function fillPasswords(page: Page, current: string, next: string, confirm: string): Promise<void> {
  await pwField(page, PW.current).fill(current);
  await pwField(page, PW.next).fill(next);
  await pwField(page, PW.confirm).fill(confirm);
}

/** The three password inputs and the submit button, for layout checks. */
export const passwordControls = (page: Page): Locator[] => [pwField(page, PW.current), pwField(page, PW.next), pwField(page, PW.confirm), pwSubmit(page)];

/** True when no two of `boxes` intersect. Returns the offending index pairs for the failure message. */
export function overlappingPairs(boxes: readonly Box[]): string[] {
  const bad: string[] = [];
  boxes.forEach((a, i) => {
    boxes.forEach((b, j) => {
      if (j > i && intersects(a, b)) bad.push(`${String(i)}x${String(j)}`);
    });
  });
  return bad;
}

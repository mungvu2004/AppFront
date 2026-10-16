/**
 * QA-07b pack P1 helpers (SCR-33 `/tai-khoan`: main chain FL-M-33P-01 and `phase07_profile_edge.spec.ts` FL-33P-01..03).
 * Shared names/locators come from `./account` (read only); only what that file lacks lives here.
 * Sources (FE master 1e1c16b7): AS AccountSettings.tsx, ASC AccountSettings.container.tsx, PS ProfileSection.tsx,
 * INI src/lib/format/initials.ts, SB src/routes (login redirect), SEL src/components/ui/Select.tsx.
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, Locator, Page, Request, Response, Route } from '@playwright/test';

import { EMAIL_LABEL, PASSWORD_LABEL, SIGN_IN_LABEL } from '../../../../e2e/fixtures/session';
import type { PoolUser } from '../phase03Seed';
import { ME_RE, block } from './account';

/** useAccountSettings.ts ACCOUNT_AUTOSAVE_DEBOUNCE_MS (UAS:103). */
export const DEBOUNCE_MS = 800;
/** FieldRow flash lasts durationMs('slow') = 340 ms (UAP:444-470). */
export const FLASH_MS = 340;

/** The five blocks every role sees, in page order (AS:116-153): id, h2, description. */
export const BLOCKS = [
  { id: 'account-profile', title: 'Hồ sơ', description: 'Tên, ảnh đại diện và thông tin liên hệ.' },
  { id: 'account-appearance', title: 'Giao diện', description: 'Chủ đề sáng, tối, hoặc theo hệ thống.' },
  { id: 'account-notifications', title: 'Thông báo', description: 'Việc nào báo qua thư điện tử, việc nào báo trong ứng dụng.' },
  { id: 'account-shortcuts', title: 'Phím tắt', description: 'Những phím tắt đang có hiệu lực trong ứng dụng.' },
  { id: 'account-password', title: 'Mật khẩu', description: 'Đổi mật khẩu đăng nhập.' },
] as const;
export const SUBTITLE = 'Hồ sơ, giao diện, thông báo, phím tắt và mật khẩu.'; // AS:105
export const NAME_AN = 'Nguyễn Văn An';

/** True for the response of a `PATCH /api/me`. */
export const isMePatch = (res: Response): boolean => res.request().method() === 'PATCH' && ME_RE.test(new URL(res.url()).pathname);

/** `initialsOf` (INI:7-15): first + last word initial, upper-cased; one word -> first two letters. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter((w) => w !== '');
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return '';
  const letters = words.length === 1 ? Array.from(first).slice(0, 2) : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join('').toLocaleUpperCase('vi');
}

/** The avatar initials `<span aria-label="…">` inside the profile block (PS:126-132, Avatar.tsx:37-43). */
export const avatarSpan = (page: Page, alt: string): Locator => block(page, 'account-profile').locator(`span[aria-label="${alt}"]`);

/** `FieldRow` root of the row labelled `label` (FieldRow.tsx:62-90: `flex items-start min-h-[36px]`, label in the left cell). */
export const fieldRow = (page: Page, label: string): Locator =>
  block(page, 'account-profile').locator('div.items-start', { has: page.locator('span', { hasText: new RegExp(`^${label}$`, 'u') }) }).first();

/** Logs in through the form of `/login` (copy of `signInAdmin` with `user`'s credentials); 204 is asserted, the landing is the caller's check. */
export async function signInViaForm(page: Page, user: PoolUser, loginPath: string): Promise<void> {
  await page.goto(loginPath);
  await page.getByLabel(EMAIL_LABEL, { exact: true }).fill(user.email);
  await page.getByLabel(PASSWORD_LABEL, { exact: true }).fill(user.password);
  const login = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: SIGN_IN_LABEL, exact: true }).click();
  expect((await login).status(), 'POST /api/auth/login (form)').toBe(204);
}

/**
 * Holds EVERY `GET /api/me` until `release()` (the backend's own answer, fetched only after the gate opens).
 * `seen` resolves with the first held request; `dispose()` opens the gate and removes the route.
 */
export async function holdMeReads(page: Page): Promise<{ readonly seen: Promise<Request>; release: () => void; dispose: () => Promise<void> }> {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  let onSeen: (req: Request) => void = () => undefined;
  const seen = new Promise<Request>((resolve) => {
    onSeen = resolve;
  });
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    onSeen(route.request());
    await gate;
    await route.continue();
  };
  await page.route('**/api/me', handler);
  return {
    seen,
    release: open,
    dispose: async () => {
      open();
      await page.unroute('**/api/me', handler);
    },
  };
}

/** Counts `GET /api/me` responses (status list) from now on. */
export function countMeReads(page: Page): { readonly statuses: () => number[]; readonly stop: () => void } {
  const seen: number[] = [];
  const onResponse = (res: Response): void => {
    if (res.request().method() === 'GET' && ME_RE.test(new URL(res.url()).pathname)) seen.push(res.status());
  };
  page.on('response', onResponse);
  return { statuses: () => [...seen], stop: () => page.off('response', onResponse) };
}

/**
 * Runs `body` with the page clock paused (needs `page.clock.install()` before the first load) and resumes it after, also on failure.
 * Never take evidence inside: its rAF wait never ends on a paused clock.
 */
export async function withPausedClock<T>(page: Page, body: () => Promise<T>): Promise<T> {
  await page.clock.pauseAt(new Date(Date.now() + 5_000));
  try {
    return await body();
  } finally {
    await page.clock.resume();
  }
}

/** Waits for the next `PATCH /api/me` after `act()` (real 800 ms debounce) and asserts it answered 200. */
export async function patchAfter(page: Page, act: () => Promise<void>): Promise<Response> {
  const res = page.waitForResponse(isMePatch);
  await act();
  const done = await res;
  expect(done.status(), 'PATCH /api/me').toBe(200);
  return done;
}

/** Admin API context for seeding pool users; callers dispose it. */
export type Admin = APIRequestContext;

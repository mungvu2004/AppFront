/**
 * QA-08 P10 helpers (SCR-37 mocked users flows). Own helper file; no other spec imports it.
 * Exports: USERS_RE, USER_ID_RE, json, deferred, wireError, realUsers, requestLog.
 */
import { expect, type APIRequestContext, type Page, type Request, type Route } from '@playwright/test';
import type { Json } from './users';

export { type Json };

/** `GET/POST /api/users` (list + invitations are NOT matched: path ends right after `users`). EP:325 */
export const USERS_RE = /\/api\/users(\?.*)?$/u;
/** `/api/users/<id>/(memberships|activity)` EP:320,326 */
export const detailRe = (leaf: 'memberships' | 'activity'): RegExp => new RegExp(`/api/users/[^/]+/${leaf}(\\?.*)?$`, 'u');

export const json = (route: Route, status: number, body: unknown): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** BE error envelope as the FE reads it (`wireError.ts`): code + message + requestId. */
export const wireError = (code: string, message = 'qa-08 mocked'): Json => ({ code, message, requestId: 'qa-08-mock' });

/** A promise whose settlement the test controls: holds a mocked response until `release()`. */
export function deferred(): { readonly promise: Promise<void>; readonly release: () => void } {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** Real `GET /api/users` rows through an API client (setup only). */
export async function realUsers(api: APIRequestContext): Promise<Json[]> {
  const res = await api.get('/api/users');
  if (res.status() !== 200) throw new Error(`setup: GET /api/users -> ${String(res.status())}`);
  return ((await res.json()) as { users: Json[] }).users;
}

/** Counts requests (method + URL regex) from now on. */
export function requestLog(page: Page, method: string, re: RegExp): { readonly count: () => number; readonly stop: () => void } {
  let n = 0;
  const on = (req: Request): void => {
    if (req.method() === method && re.test(req.url())) n += 1;
  };
  page.on('request', on);
  return { count: () => n, stop: () => page.off('request', on) };
}

/**
 * notificationBus folds toasts of one type inside 5 s into ONE toast whose title is the newest one (notificationBus.ts:8,
 * :158-195; all write failures share type 'user.write-failed', useUserManagement.ts:638), and Toast removes itself after 8 s
 * (Toast.tsx UNDO_WINDOW_MS). So "a new toast" is proven by clearing the old ones first: `markToast` runs the (installed) fake
 * clock 8 s, asserts none is left, and `expectNew()` then needs the toast with `text` to show. Install `page.clock` first.
 */
export async function markToast(page: Page, text: string): Promise<{ readonly expectNew: (soft?: boolean) => Promise<void> }> {
  const toasts = page.getByRole('status').filter({ hasText: text });
  await page.clock.runFor(8_000);
  await expect(toasts, 'previous toasts are gone before the action').toHaveCount(0);
  return {
    expectNew: async (soft = false) => {
      const check = soft ? expect.soft(toasts.last(), `toast "${text}"`) : expect(toasts.last(), `toast "${text}"`);
      await check.toBeVisible();
    },
  };
}

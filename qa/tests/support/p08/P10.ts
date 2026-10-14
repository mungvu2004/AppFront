/**
 * QA-08 P10 helpers (SCR-37 mocked users flows). Own helper file; no other spec imports it.
 * Exports: USERS_RE, USER_ID_RE, json, deferred, wireError, realUsers, requestLog.
 */
import { expect, type APIRequestContext, type Page, type Request, type Route } from '@playwright/test';

export type Json = Record<string, unknown>;

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

/** Counts the toasts with `text` now; `expectNew()` then needs exactly one MORE (a stale toast never satisfies it). */
export async function markToast(page: Page, text: string): Promise<{ readonly expectNew: (soft?: boolean) => Promise<void> }> {
  const toasts = page.getByRole('status').filter({ hasText: text });
  const before = await toasts.count();
  return {
    expectNew: async (soft = false) => {
      const check = soft ? expect.soft(toasts, `new toast "${text}"`) : expect(toasts, `new toast "${text}"`);
      await check.toHaveCount(before + 1);
      await expect.soft(toasts.nth(before)).toBeVisible();
    },
  };
}

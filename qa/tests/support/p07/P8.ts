/**
 * Phase 07 pack P8 helpers: SCR-33 "Mật khẩu" block (`PasswordSection.tsx` PWS, `useAccountAuth.ts` UAA,
 * `accountAuthGateway.ts` AAG under `src/screens/account/AccountSettings/`). Used by `phase07_security_b_edge.spec.ts`
 * and `phase07_security_mocked_edge.spec.ts`. Selectors/copy re-use `support/p07/account.ts` (PW, pwField, pwSubmit, fieldError).
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { waitForApi } from '../../../../e2e/fullstack/apiWatch';
import { apiBaseUrl, newApiContext, signedInApi } from '../api';
import { captureEvidence } from '../evidence';
import { signInPoolUser, type PoolUser } from '../phase03Seed';
import { DESKTOP, ME_RE, PASSWORD_API, PW, pwField, pwSubmit } from './account';

export const PWD_RE = /^\/api\/me\/password$/u; // src/api/endpoints.ts:138
export const COPY = {
  rateLimited: 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.', // UAA:87
  unavailable: 'Không đổi được mật khẩu lúc này. Thử lại sau ít phút.', // UAA:88
  afterFailure: 'Có thể mật khẩu đã đổi ở lượt trước; hãy thử mật khẩu mới.', // UAA:89
} as const;

/** `Qa-<uuid>`: letters + digits, >= 8, valid for the FE rules. */
export const freshPassword = (): string => `Qa-${randomUUID()}`;

/** Browser session of a pool user (1 login through the context's cookie jar), desktop viewport. */
export async function newSession(browser: Browser, user: PoolUser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: apiBaseUrl(), viewport: DESKTOP });
  try {
    await signInPoolUser(context, user);
    return { context, page: await context.newPage() };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** The labelled block (AS:79 `section[aria-labelledby=account-password]`). */
export const regionOf = (page: Page) => page.getByRole('region', { name: 'Mật khẩu', exact: true });

/** goto `/tai-khoan`, wait for `GET /api/me` and the "Mật khẩu" region. */
export async function openSecurity(page: Page): Promise<void> {
  const me = waitForApi(page, 'GET', ME_RE, [200]);
  await page.goto(ROUTES.account);
  await me;
  await expect(regionOf(page)).toBeVisible();
}

/** Fills the three fields. */
export async function fillPasswords(page: Page, current: string, next: string, confirm: string): Promise<void> {
  await pwField(page, PW.current).fill(current);
  await pwField(page, PW.next).fill(next);
  await pwField(page, PW.confirm).fill(confirm);
}

/** Fills, clicks "Đổi mật khẩu" and waits for the real 204 (one POST). */
export async function changeViaUi(page: Page, current: string, next: string): Promise<void> {
  await fillPasswords(page, current, next, next);
  const changed = waitForApi(page, 'POST', PWD_RE, [204]);
  await pwSubmit(page).click();
  await changed;
}

/** Evidence `E07_33S-<row>_<kind>.png` (row like `A-016`). */
export const shot = (page: Page, row: string, kind: string): Promise<string> => captureEvidence(page, `E07_33S-${row}_${kind}.png`);

/** A real round trip: once it returns, every request the page dispatched before it has been seen by listeners. */
export const settle = (page: Page): Promise<void> =>
  page.evaluate(() => fetch('/api/me', { credentials: 'include' }).then(() => undefined, () => undefined));

/** `Date.now()` as the page sees it (fake clock aware). */
export const pageNow = (page: Page): Promise<number> => page.evaluate(() => Date.now());

/**
 * Moves the fake clock so the page time is `t0 + ms` (no-op when already past). The clock also flows in real time
 * (`page.clock.install()` without `pauseAt`; a paused clock would hang `captureEvidence`'s rAF wait), so `t0` is taken
 * when the lock alert became visible and the checks keep a ~2 s margin around the exact boundary.
 */
export async function advanceTo(page: Page, t0: number, ms: number): Promise<void> {
  const delta = t0 + ms - (await pageNow(page));
  if (delta > 0) await page.clock.runFor(delta);
}

/** Puts the user's pool password back (`current` -> `user.password`) and probes the login. Annotates instead of throwing. */
export async function restorePassword(user: PoolUser, current: string): Promise<void> {
  if (current === user.password) return;
  try {
    const api = await signedInApi(user.email, current);
    try {
      const res = await api.post(PASSWORD_API, { data: { currentPassword: current, newPassword: user.password } });
      if (res.status() !== 204) throw new Error(`POST ${PASSWORD_API} -> ${String(res.status())}`);
    } finally {
      await api.dispose();
    }
    const probe = await newApiContext();
    try {
      const login = await probe.post('/api/auth/login', { data: { email: user.email, password: user.password, rememberMe: false } });
      if (login.status() !== 204) throw new Error(`probe login -> ${String(login.status())}`);
    } finally {
      await probe.dispose();
    }
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: `restorePassword ${user.email}: ${String(error)}` });
  }
}

/** Designed answer for the mocked N13 (W7 error body `{code, requestId}`, AppBack core/errors.py). */
export type Answer = (route: Route) => Promise<void>;
export const respond =
  (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): Answer =>
  (route) =>
    route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify({ requestId: 'qa-p8-mock', ...body }) });
export const abortRequest: Answer = (route) => route.abort('failed');

/** Each POST /api/me/password takes the next queued answer; with an empty queue it goes on to the real backend. */
export async function designedAnswers(page: Page): Promise<{ once: (answer: Answer) => void; hits: () => number; stop: () => Promise<void> }> {
  const queue: Answer[] = [];
  let hits = 0;
  const matcher = (url: URL): boolean => url.pathname === PASSWORD_API;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    hits += 1;
    const answer = queue.shift();
    if (answer) await answer(route);
    else await route.continue();
  };
  await page.route(matcher, handler);
  return { once: (answer) => void queue.push(answer), hits: () => hits, stop: () => page.unroute(matcher, handler) };
}

/** Fixed pool slot (these users only touch the 900 s me_password bucket); suffix only on a retry, so a retry gets a fresh bucket. */
export const slotOf = (base: string): string => (test.info().retry ? `${base}-r${test.info().retry}` : base);

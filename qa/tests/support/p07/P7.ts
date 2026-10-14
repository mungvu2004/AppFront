/**
 * QA-07b P7 helpers — SCR-33 "Mật khẩu" block of `/tai-khoan` (`phase07_security_edge.spec.ts`, FL-33S-01..04).
 * Short names (FE master 1e1c16b7, under `src/screens/account/AccountSettings/`): PWS PasswordSection.tsx,
 * UAA useAccountAuth.ts, AS AccountSettings.tsx; INP src/components/ui/Input.tsx.
 *
 * Sessions: the phase admin signs in through the API (1 login), a pool engineer of the flow's own slot signs in inside a
 * fresh browser context (1 login). A flow that changes the password puts it back in `finally` (`restorePassword`).
 * Budget of `POST /api/me/password`: `me_password` 5 per 900 s per user (BE:apps/api/me/router.py:45-46).
 */
import type { APIRequestContext, Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { ROUTES } from '../../../../e2e/fixtures/routes';
import { waitForApi } from '../../../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import type { PoolUser } from '../phase03Seed';
import { DESKTOP, ME_RE, PASSWORD_API, PW, accountUser, pwField, pwSubmit, signInAccount } from './account';

export const PASSWORD_RE = /^\/api\/me\/password$/u;
/** Tone class of one strength cell (PWS STRENGTH_LADDER) and of an unlit cell (`bg-bg-sunken`). */
export const TONE = { weak: 'bg-state-violation', fair: 'bg-state-attention', strong: 'bg-state-verified', off: 'bg-bg-sunken' } as const;

/** A flow's session: pool engineer of its own slot, signed in inside `context`; `admin` is API-only. */
export interface SecurityRun {
  readonly user: PoolUser;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly admin: APIRequestContext;
}

/** Region "Mật khẩu" (`<section aria-labelledby="account-password">`, AS:150-157). */
export const regionOf = (page: Page): Locator => page.getByRole('region', { name: 'Mật khẩu', exact: true });

// dup-of: security.ts openSecurity
/** Opens `/tai-khoan` (fresh document) and waits until the three password fields are painted. */
export async function openSecurity(page: Page): Promise<void> {
  const me = waitForApi(page, 'GET', ME_RE, [200]);
  await page.goto(ROUTES.account);
  await me;
  await expect(regionOf(page)).toBeVisible();
  await expect(pwField(page, PW.current)).toBeVisible();
}

/** Admin API + pool engineer `slot` + a fresh signed-in context/page, all closed afterwards. */
export async function withSecurityUser(
  browser: Browser,
  slot: string,
  body: (run: SecurityRun) => Promise<void>,
  viewport: { readonly width: number; readonly height: number } = DESKTOP,
): Promise<void> {
  const creds = readAdminCredentials();
  const admin = await signedInApi(creds.email, creds.password);
  try {
    const user = await accountUser(admin, slot);
    const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
    try {
      const page = await context.newPage();
      await signInAccount(context, user);
      await body({ user, context, page, admin });
    } finally {
      await context.close();
    }
  } finally {
    await admin.dispose();
  }
}

// dup-of: security.ts fillPasswords
/** Fills current / new / confirm (an empty string clears the field). */
export async function fillPasswords(page: Page, current: string, next: string, confirm: string): Promise<void> {
  await pwField(page, PW.current).fill(current);
  await pwField(page, PW.next).fill(next);
  await pwField(page, PW.confirm).fill(confirm);
}

// dup-of: security.ts submitPassword
/** Clicks "Đổi mật khẩu". */
export async function submitPassword(page: Page): Promise<void> {
  await pwSubmit(page).click();
}

/** INP:91,99,117: the `<p role="alert" id="<inputId>-error">` of the field labelled `label`. */
export async function errorOf(page: Page, label: string): Promise<Locator> {
  const id = await pwField(page, label).getAttribute('id');
  return page.locator(`[id="${String(id)}-error"]`);
}

/** Strength text "Độ mạnh: …" (PWS:126). */
export const meterText = (page: Page): Locator => regionOf(page).getByText(/^Độ mạnh: /u);

/** Tone class of each of the 3 cells (the `aria-hidden` div right before the text, PWS:110-126). */
export const meterTones = (page: Page): Promise<string[]> =>
  meterText(page)
    .locator('xpath=preceding-sibling::div[1]/span')
    .evaluateAll((cells) => cells.map((cell) => [...cell.classList].find((name) => name.startsWith('bg-')) ?? ''));

// dup-of: security.ts restorePassword
/**
 * Puts the pool password back after a flow changed it to `changedTo` (undefined = never submitted a right one).
 * Signs in with `changedTo`, changes it back, probes a login with the original. When `changedTo` no longer signs in the
 * change never happened: the original must still sign in. Failures are soft (they must not hide the flow's own failure).
 */
export async function restorePassword(user: PoolUser, changedTo: string | undefined): Promise<void> {
  if (changedTo === undefined) return;
  const probe = async (): Promise<number> => {
    const anon = await newApiContext();
    try {
      return (await anon.post('/api/auth/login', { data: { email: user.email, password: user.password, rememberMe: false } })).status();
    } finally {
      await anon.dispose();
    }
  };
  let api: APIRequestContext;
  try {
    api = await signedInApi(user.email, changedTo);
  } catch {
    expect.soft(await probe(), 'restore: the change never happened, the original password must sign in').toBe(204);
    return;
  }
  try {
    const back = await api.post(PASSWORD_API, { data: { currentPassword: changedTo, newPassword: user.password } });
    expect.soft(back.status(), 'restore: POST /api/me/password back to the pool password').toBe(204);
  } finally {
    await api.dispose();
  }
  expect.soft(await probe(), 'restore: the pool password signs in again').toBe(204);
}

/** Console / page errors / request URLs of the page, plus a scan of storage, URL and visible text for given secrets. */
export function collectSecrets(page: Page): { readonly leaks: (secrets: readonly string[]) => Promise<string[]> } {
  const seen: Array<[string, string]> = [];
  page.on('console', (message) => seen.push([`console.${message.type()}`, message.text()]));
  page.on('pageerror', (error) => seen.push(['pageerror', error.message]));
  page.on('request', (request) => seen.push(['request URL', request.url()]));
  return {
    leaks: async (secrets) => {
      const dump = await page.evaluate(() => ({
        local: JSON.stringify(Object.entries(window.localStorage)),
        session: JSON.stringify(Object.entries(window.sessionStorage)),
        text: document.body.innerText,
      }));
      const places: Array<[string, string]> = [['page URL', page.url()], ['localStorage', dump.local], ['sessionStorage', dump.session], ['visible text', dump.text], ...seen];
      return secrets.flatMap((secret) => places.filter(([, text]) => text.includes(secret)).map(([where]) => where));
    },
  };
}

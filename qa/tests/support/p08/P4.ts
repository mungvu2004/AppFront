/**
 * P4 helpers (QA-08 S3): SCR-35 edge/ui, SCR-37 users ui + write ui. Owned by pack P4 only.
 * // dup-of: recordWrites recordRequests (flows-C5 `recordWrites`)
 * // dup-of: pickOption pickOption (admin edge spec)
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { poolUser, type PoolUser } from '../phase03Seed';
import { signedInApi } from '../api';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { heading, openAdmin } from './admin';

/** goto /admin/training/jobs, main read 200, h1 visible. Returns the parsed list body. */
export async function openTraining(page: Page): Promise<unknown> {
  const body = await openAdmin(page, 'jobs');
  await expect(heading(page, 'jobs')).toBeVisible();
  return body;
}

/** Records every request whose URL matches `pred`; `stop()` detaches. */
export function recordRequests(page: Page, pred: (method: string, url: URL) => boolean): { list: () => string[]; stop: () => void } {
  const seen: string[] = [];
  const on = (req: import('@playwright/test').Request): void => {
    const url = new URL(req.url());
    if (pred(req.method(), url)) seen.push(`${req.method()} ${url.pathname}${url.search}`);
  };
  page.on('request', on);
  return { list: () => [...seen], stop: () => page.off('request', on) };
}

/** Custom Select (button role=combobox, portaled listbox). */
export async function pickOption(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/** Table row (>=1024) or card (<1024) of a user. */
export const userRow = (page: Page, email: string): Locator => page.locator('tbody tr, main li').filter({ hasText: email }).first();

/** 254-char address (BE MAX_EMAIL_LENGTH) from testEmail, as phase08_admin_ui.spec.ts longEmail. */
export function longEmail(slug: string): string {
  const [local = '', domain = ''] = testEmail(slug).split('@');
  const address = `${local.padEnd(64, 'a')}@${'b'.repeat(61)}.${'c'.repeat(61)}.${'d'.repeat(64 - domain.length)}.${domain}`;
  if (address.length !== 254) throw new Error(`long e-mail is ${address.length} chars, not 254`);
  return address;
}

/** Signed-in API of a pool admin (own invitation budget, Decision S2 #2). */
export async function poolAdminApi(admin: import('@playwright/test').APIRequestContext, slot: string): Promise<{ user: PoolUser; api: import('@playwright/test').APIRequestContext }> {
  const user = await poolUser(admin, 'admin', slot);
  return { user, api: await signedInApi(user.email, user.password) };
}

export async function inviteUser(api: import('@playwright/test').APIRequestContext, email: string): Promise<{ id: string; email: string; name: string }> {
  const res = await api.post('/api/users/invitations', { data: { emails: [email], role: 'viewer' } });
  expect(res.status(), 'setup: POST /api/users/invitations').toBe(201);
  const row = ((await res.json()) as { id: string; email: string; name: string }[]).find((u) => u.email === email);
  if (row === undefined) throw new Error('setup: invitation response has no row for the address');
  return { id: String(row.id), email, name: String(row.name) };
}

/** DELETE a user (404 = already gone). */
export async function removeUser(api: import('@playwright/test').APIRequestContext, u: { id: string; email: string }): Promise<void> {
  const res = await api.delete(`/api/users/${u.id}`, { data: { userId: u.id, confirmEmail: u.email } });
  expect([200, 404], `cleanup DELETE ${u.id}`).toContain(res.status());
}

export { TEST_DATA_PREFIX };

/* ---------------------------------------------------------------- UI verify wrapper */
import type { Browser, BrowserContext } from '@playwright/test';
import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { verifyUi } from '../ui-verify';
import { DESKTOP_VIEWPORTS, signInAdminUser } from './admin';

/** `verifyUi` over the 4 desktop viewports plus soft hard-defect assertions. */
export async function verifyDesktop(page: Page, name: string, open: (page: Page) => Promise<void>, fullPage = true): Promise<void> {
  const all = await verifyUi(page, name, open, DESKTOP_VIEWPORTS, { fullPage });
  for (const m of all) {
    expect.soft(m.openError, `${name} ${m.viewport}: state opened`).toBeUndefined();
    expect.soft(m.horizontalOverflowPx, `${name} ${m.viewport}: no horizontal scroll`).toBeLessThanOrEqual(0);
    expect.soft(m.offscreen, `${name} ${m.viewport}: nothing pushed off-screen`).toEqual([]);
    expect.soft(m.brokenImages, `${name} ${m.viewport}: no broken image`).toEqual([]);
  }
}

/** New context signed in as a pool user; closed after `fn`. */
export async function asPoolUser(browser: Browser, user: PoolUser, fn: (page: Page, context: BrowserContext) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl() });
  try {
    await signInAdminUser(context, user);
    await fn(await context.newPage(), context);
  } finally {
    await context.close();
  }
}

/** /admin/users after GET /api/users 200 with the search box drawn. */
export async function openUsersList(page: Page): Promise<void> {
  const listed = page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/users');
  await page.goto('/admin/users');
  expect((await listed).status(), 'GET /api/users').toBe(200);
  await expect(page.getByLabel('Tìm người dùng', { exact: true })).toBeVisible();
}

export const isWide = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

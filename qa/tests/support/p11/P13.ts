/**
 * P13 helpers (QA-11, session slug): fresh users (invited, never in the pool file), signed-in contexts, write recorder.
 * Admin shared session (`admin.storage.json`) is never touched: every admin view signs in again in its own context.
 */
import { randomUUID } from 'node:crypto';

import { expect } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';

import { apiBaseUrl, newApiContext } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import type { PoolRole, PoolUser } from '../phase03Seed';

/** Same subject as `phase03Seed.ts` INVITE_SUBJECT (BE auth_recovery/messages.py). */
const INVITE_SUBJECT = 'Lời mời tham gia AppBack';

/** Invites `testEmail('p11-session-<slug>')` with `role`, reads the mail, accepts. // dup-of: phase03Seed.inviteAndAccept (not exported) */
export async function inviteFreshUser(admin: APIRequestContext, role: PoolRole, slug: string): Promise<PoolUser> {
  const email = testEmail(`p11-session-${slug}`);
  const name = `${TEST_DATA_PREFIX}session ${slug}`;
  return inviteEmail(admin, role, email, name);
}

/** Invites an explicit `email` (A-117 re-invites the deleted address). */
export async function inviteEmail(admin: APIRequestContext, role: PoolRole, email: string, name: string): Promise<PoolUser> {
  const since = new Date(Date.now() - 5_000);
  const sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(sent.status(), `setup: POST /api/users/invitations (${role})`).toBe(201);
  const rows = (await sent.json()) as { id?: unknown; email?: unknown }[];
  const id = rows.find((row) => row.email === email)?.id;
  if (typeof id !== 'string') throw new Error(`setup: invitation answer has no row for ${email}`);
  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  try {
    const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
    if (!token) throw new Error(`setup: mail "${mail.subject}" link has no #token`);
    const password = `Qa-${randomUUID()}`;
    const anon = await newApiContext();
    try {
      const accepted = await anon.post('/api/auth/invitations/accept', { data: { token, fullName: name, password } });
      expect(accepted.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
    } finally {
      await anon.dispose();
    }
    return { id, email, password, role, name };
  } finally {
    await deleteMails([mail.id]);
  }
}

/** `DELETE /api/users/:id {userId, confirmEmail}` in `finally`: 200 and 404 (already deleted by the flow) are fine. */
export async function disposeFreshUser(admin: APIRequestContext, user: PoolUser, options: { deletedInFlow?: boolean } = {}): Promise<void> {
  const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
  // 404 is valid only when the flow itself deleted the user
  expect(res.status(), `cleanup: DELETE /api/users/${user.id}`).toBe(options.deletedInFlow === true ? 404 : 200);
}

/** Runs EVERY cleanup (each wrapped on its own), then rethrows the first error: nothing leaks, nothing is swallowed. */
export async function cleanAll(cleanups: readonly (() => Promise<unknown>)[]): Promise<void> {
  const errors: unknown[] = [];
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw errors[0];
}

/** New context + page signed in as `user` (one `POST /api/auth/login` through the context cookie jar). */
export async function signedInPage(browser: Browser, user: { email: string; password: string }): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const login = await context.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password, rememberMe: false },
    headers: { Origin: apiBaseUrl() },
  });
  expect(login.status(), 'setup: POST /api/auth/login').toBe(204);
  return { context, page: await context.newPage() };
}

/** Fresh admin session for the UI (own context; the shared admin storage state is not used or signed out). */
export async function adminPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  return signedInPage(browser, readAdminCredentials());
}

export interface RecordedWrite {
  readonly method: string;
  readonly path: string;
}

/** Records every non-GET `/api/*` request of `page`; read it only after a certain milestone (dialog closed / response in). */
export function recordWrites(page: Page): RecordedWrite[] {
  const writes: RecordedWrite[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname.startsWith('/api/')) writes.push({ method: request.method(), path: url.pathname });
  });
  return writes;
}

/** Row of `email` in the users table (>= 1024) or card list (< 1024). */
export const userRow = (page: Page, email: string) => page.locator('tr, li').filter({ hasText: email }).first();

/** `Cookie` header from a storage state, for replaying an old session cookie on an anonymous context. */
export async function cookieHeader(api: APIRequestContext): Promise<string> {
  const state = await api.storageState();
  return state.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

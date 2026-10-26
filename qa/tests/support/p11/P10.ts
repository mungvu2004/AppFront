/**
 * QA-11 P10 helpers - `phase11_session_edge.spec.ts` (FL-11U-01..03, /admin/users disable / undo / enable / remove gate).
 * Real stack only. Sources (FE master 5fcaf502): UMT src/screens/admin/UserManagement/UserManagementTable.tsx,
 * UMD UserManagementDetail.tsx, UMH useUserManagement.ts, TOAST src/components/feedback/Toast.tsx.
 * Sessions: the admin signs in per flow (1 API login in a fresh context), never the stored admin session file.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { apiBaseUrl, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import type { PoolRole, PoolUser } from '../phase03Seed';

export { DESKTOP } from './common';

/** Mail subject of the invitation (phase03Seed.ts:61). */
const INVITE_SUBJECT = 'Lời mời tham gia AppFront';

/** One write (non-GET) request the page sent to `/api/*`. */
export interface WriteRecord {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
}

/** Admin (fresh login in its own context) with a page and a log of every non-GET `/api/` request. */
export interface AdminFlow {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly writes: WriteRecord[];
}

/** Fresh browser context signed in as the phase admin (1 login), page recording writes. Caller closes `context`. */
export async function openAdminFlow(browser: Browser, viewport: { width: number; height: number }): Promise<AdminFlow> {
  const { email, password } = readAdminCredentials();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email, password, rememberMe: false },
      headers: { Origin: apiBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (admin flow session)').toBe(204);
    const page = await context.newPage();
    const writes: WriteRecord[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() === 'GET' || !url.pathname.startsWith('/api/')) return;
      writes.push({ method: request.method(), path: url.pathname, headers: request.headers() });
    });
    return { context, page, writes };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/** Admin API client (1 login) for seeding / cleanup. Caller disposes. */
export async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/**
 * Invites a brand-new user (own address, not in the pool file), reads the real mail and accepts it.
 * dup-of: inviteAndAccept (phase03Seed.ts:314, not exported)
 */
export async function inviteFreshUser(admin: APIRequestContext, role: PoolRole, slug: string): Promise<PoolUser> {
  const email = testEmail(`p11-session-${slug}`);
  const name = `${TEST_DATA_PREFIX}p11 session ${slug}`;
  const since = new Date(Date.now() - 5_000);
  let sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  // FL-11U-02/03: the invite quota (rl:users_invite) is shared by the whole file; on 429 wait Retry-After (cap 60 s), retry x3.
  for (let attempt = 0; attempt < 3 && sent.status() === 429; attempt += 1) {
    const waitSeconds = Math.min(Number(sent.headers()['retry-after']) || 20, 60);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000)); // fixed-wait-ok: server rate-limit window
    sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  }
  expect(sent.status(), `setup: POST /api/users/invitations (${role}): ${(await sent.text()).slice(0, 200)}`).toBe(201);
  const rows = (await sent.json()) as Array<{ id?: unknown; email?: unknown }>;
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

/** Cleanup: `DELETE /api/users/:id` `{userId, confirmEmail}`; 200 / 404 accepted, anything else fails. */
export async function disposeFreshUser(admin: APIRequestContext, user: PoolUser): Promise<void> {
  const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
  expect([200, 404], `cleanup: DELETE /api/users/${user.id}`).toContain(res.status());
}

/** Browser session of `user` in `context` (one `POST /api/auth/login`). dup-of: signInPoolUser */
export async function signInFresh(context: BrowserContext, user: PoolUser): Promise<void> {
  const res = await context.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password, rememberMe: false },
    headers: { Origin: apiBaseUrl() },
  });
  expect(res.status(), 'setup: POST /api/auth/login as fresh user').toBe(204);
}

/** The /admin/users row (table row at >= 1024) holding `email`. */
export const userRow = (page: Page, email: string): Locator => page.getByRole('row').filter({ hasText: email });

/** The toast (`role=status`, TOAST:144) whose text contains `text`. */
export const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });

/** Runs every cleanup even if one throws (each wrapped), then rethrows the first error - nothing is swallowed. */
export async function runCleanups(cleanups: ReadonlyArray<() => Promise<unknown>>): Promise<void> {
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

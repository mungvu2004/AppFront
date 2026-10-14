/**
 * P11 helpers (phase 11 session-b edge): throw-away users invited by the flow itself (never pool users), a fresh admin
 * browser session, and a write-request log. Usage:
 *   const admin = await adminApi();                         // 1 login (API)
 *   const fu = await inviteFreshUser(admin, 'engineer', 'x'); // invite + Mailpit + accept
 *   try { ... } finally { await disposeFreshUser(admin, fu); await admin.dispose(); }
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { apiBaseUrl, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import type { PoolRole, PoolUser } from '../phase03Seed';

/** BE:auth_recovery/messages.py invitation subject (phase03Seed.ts INVITE_SUBJECT). */
const INVITE_SUBJECT = 'Lời mời tham gia AppBack';

/** Admin API client with its own (new) session — the shared `admin.storage.json` session is never touched. */
export const adminApi = async (): Promise<APIRequestContext> => {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
};

// dup-of: inviteAndAccept (phase03Seed.ts:313, not exported) — same flow, but the user is NOT written to the pool file.
export async function inviteFreshUser(admin: APIRequestContext, role: PoolRole, slug: string): Promise<PoolUser> {
  const email = testEmail(`p11-session-${slug}`);
  const name = `${TEST_DATA_PREFIX}p11 ${role} ${slug}`;
  const since = new Date(Date.now() - 5_000);
  const sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(sent.status(), `setup: POST /api/users/invitations (${role}): ${(await sent.text()).slice(0, 200)}`).toBe(201);
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

/** `DELETE /api/users/:id` `{userId, confirmEmail}` (BE users/schemas.py): 200 or 404 (already gone) are fine, else throws. */
export async function disposeFreshUser(admin: APIRequestContext, user: PoolUser): Promise<void> {
  const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
  expect([200, 404], `cleanup: DELETE /api/users/${user.id} → ${String(res.status())}`).toContain(res.status());
}

/** New browser context holding a NEW session of `user` (one `POST /api/auth/login`; same call as `signInPoolUser`). */
export async function signInFresh(browser: Browser, user: PoolUser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const res = await context.request.post('/api/auth/login', {
    data: { email: user.email, password: user.password, rememberMe: false },
    headers: { Origin: apiBaseUrl() },
  });
  expect(res.status(), `setup: POST /api/auth/login as ${user.email}`).toBe(204);
  return context;
}

/** New context signed in as the phase admin (own session, not `admin.storage.json`). */
export async function signInAdminFresh(browser: Browser): Promise<BrowserContext> {
  const { email, password } = readAdminCredentials();
  return signInFresh(browser, { id: '', email, password, role: 'admin', name: 'admin' });
}

/** Log of write requests (method ≠ GET/HEAD) to `/api/*`; read it only after a sure marker (dialog hidden, response in). */
export function recordWrites(page: Page): { list: () => string[]; stop: () => void } {
  const seen: string[] = [];
  const onRequest = (request: { method: () => string; url: () => string }): void => {
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname.startsWith('/api/') && method !== 'GET' && method !== 'HEAD') seen.push(`${method} ${pathname}`);
  };
  page.on('request', onRequest);
  return { list: () => [...seen], stop: () => page.off('request', onRequest) };
}

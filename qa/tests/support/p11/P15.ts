/**
 * QA-11 P15 helpers for `phase11_destroy_b_api.spec.ts` (FL-B11-05..08, API only, own data only).
 * Evidence: `A11_<row id>_<slug>.json` through `captureExchange`.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

import { captureExchange, newApiContext } from '../api';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import { type PoolRole } from '../phase03Seed';

export type Json = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** BE:auth_recovery/messages.py invitation subject (phase02_dashboard_api INVITE_SUBJECT). */
const INVITE_SUBJECT = 'Lời mời tham gia AppBack';
/** BE:auth/cookies.py refresh cookie name (phase01_auth_api REFRESH). */
export const REFRESH_COOKIE = 'appback_refresh';

export const asJson = (value: unknown, what = 'body'): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
};
export const asArray = (value: unknown, what = 'body'): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
};

/** One request + its exchange evidence `A11_<row>_<slug>.json`. */
export async function call(
  api: APIRequestContext,
  ev: string,
  method: Method,
  path: string,
  data: unknown,
  claims: readonly string[],
  headers?: Record<string, string>,
): Promise<Sent> {
  const res = await api.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    ...(headers === undefined ? {} : { headers }),
  });
  const body = await captureExchange(`A11_${ev}.json`, { method, path, body: data ?? null }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` (+ `resource`). Soft checks (observation). */
export function expectError(sent: Sent, status: number, code: string, resource?: string): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  if (resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(resource);
  return body;
}

export const newKey = (): string => randomUUID();

/** `POST /api/projects/{p}/measurements` body (BE:measurements/schemas.py:58-65, tests/_helpers.py:58-75). */
export const measurementBody = (id: string): Json => ({
  id,
  name: `${TEST_DATA_PREFIX}${id}`,
  mode: 'pointToPoint',
  points: [
    { x: 0, y: 0 },
    { x: 3000.5, y: 0 },
  ],
  rawValueMm: 3000.5,
});

/**
 * Admin invites a run-unique address with `role`, reads the mail in Mailpit, accepts with a fresh password; NOT in the
 * pool (a victim of disable/delete). Cleanup: `deleteInvitedUser`.
 * dup-of: inviteAcceptedUser (P14, planned for phase03Seed.ts) — copied from phase03Seed `inviteAndAccept`.
 */
export async function inviteAcceptedUser(
  admin: APIRequestContext,
  role: PoolRole,
  slug: string,
): Promise<{ id: string; email: string; password: string }> {
  const email = testEmail(slug);
  const name = `${TEST_DATA_PREFIX}${slug}`;
  const since = new Date(Date.now() - 5_000);
  const sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(sent.status(), `setup: POST /api/users/invitations (${role})`).toBe(201);
  const rows = asArray(await sent.json(), 'invited');
  const id = rows.map((row) => asJson(row, 'invited')).find((row) => row.email === email)?.id;
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
    return { id, email, password };
  } finally {
    await deleteMails([mail.id]);
  }
}

/** `DELETE /api/users/{id}` body `{userId, confirmEmail}` (BE users/schemas.py); 200 / 404 are fine. Hard check. */
export async function deleteInvitedUser(admin: APIRequestContext, user: { id: string; email: string }): Promise<void> {
  const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
  expect([200, 404], `cleanup: DELETE /api/users/${user.id} → ${String(res.status())}`).toContain(res.status());
}

/** Value of the refresh cookie in `api`'s own jar (for replaying a cookie after logout). */
export async function refreshCookieOf(api: APIRequestContext): Promise<string> {
  const state = await api.storageState();
  const cookie = state.cookies.find((c) => c.name === REFRESH_COOKIE);
  if (!cookie) throw new Error(`no ${REFRESH_COOKIE} cookie in the session jar`);
  return cookie.value;
}

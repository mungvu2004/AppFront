/**
 * QA-11 P14 helpers: BE destructive API flows FL-B11-01..04 (`phase11_destroy_api.spec.ts`). API layer only, no browser.
 * Every victim (floors, projects, members, users) is created by the flow itself and cleaned in `finally`.
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

import { captureExchange, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import type { PoolRole } from '../phase03Seed';

export type Json = Record<string, unknown>;
export interface VictimUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

/** Fresh admin API client (1 real login), never the shared admin storage file. */
export const adminApi = (): Promise<APIRequestContext> => {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
};

/** `Idempotency-Key` header value (core/idempotency.py: ^[A-Za-z0-9_-]{8,128}$). */
export const idemKey = (tag: string): string => `qa-p14-${tag}-${randomUUID()}`;

export const asObj = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {});

/** Parsed JSON body or `{}` (error bodies: `code`, `resource`, W7 core/errors.py). */
export async function bodyOf(res: APIResponse): Promise<Json> {
  return asObj(await res.json().catch(() => ({})));
}

/** Exchange evidence `A11_<rowId>_destroy.json` (a row may record several exchanges via `part`). */
export async function evi(
  rowId: string,
  part: string,
  method: string,
  path: string,
  data: unknown,
  res: APIResponse,
  claims: readonly string[],
): Promise<void> {
  await captureExchange(`A11_${rowId}_destroy${part ? `-${part}` : ''}.json`, { method, path, body: data ?? null }, res, claims);
}

/** Request with optional body/headers; `api.fetch` so DELETE can carry a body. */
export function send(
  api: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<APIResponse> {
  return api.fetch(path, { method, ...(data === undefined ? {} : { data }), ...(headers ? { headers } : {}) });
}

/**
 * Invite + accept a throw-away user outside the shared pool (dup-of: phase03Seed.inviteAndAccept, which is private).
 * Mirrors phase03Seed.ts:313-343 (POST /api/users/invitations -> Mailpit link `#token` -> POST /api/auth/invitations/accept).
 */
export async function inviteAcceptedUser(admin: APIRequestContext, role: PoolRole, slug: string): Promise<VictimUser> {
  const email = testEmail(slug);
  const since = new Date(Date.now() - 5_000);
  const sent = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(sent.status(), `setup: POST /api/users/invitations (${role})`).toBe(201);
  const rows = (await sent.json()) as unknown[];
  const id = rows.map(asObj).find((row) => row.email === email)?.id;
  if (typeof id !== 'string') throw new Error(`setup: invitation answer has no row for ${email}`);
  const mail = await waitForMail(email, since, 30_000, 'Lời mời tham gia AppBack');
  try {
    const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
    if (!token) throw new Error(`setup: mail "${mail.subject}" link has no #token`);
    const password = `Qa-${randomUUID()}`;
    const anon = await newApiContext();
    try {
      const accepted = await anon.post('/api/auth/invitations/accept', {
        data: { token, fullName: `${TEST_DATA_PREFIX}p14 ${slug}`, password },
      });
      expect(accepted.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
    } finally {
      await anon.dispose();
    }
    return { id, email, password };
  } finally {
    await deleteMails([mail.id]);
  }
}

/** Cleanup: soft-delete a victim; 200 (done) or 404 (already deleted by the flow) are the only accepted answers. */
export async function deleteVictim(admin: APIRequestContext, user: VictimUser): Promise<void> {
  const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
  expect([200, 404], `cleanup: DELETE /api/users/${user.id}`).toContain(res.status());
}

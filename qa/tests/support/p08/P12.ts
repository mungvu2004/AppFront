/**
 * QA-08 P12 helpers: `/api/users` API flows (FL-B08U-01..07). Own file; nothing shared is edited.
 * Evidence = `A08_<row id>_<slug>.json` via `captureExchange`.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';
import { poolUser, type PoolRole, type PoolUser } from './pool';

export type Json = Record<string, unknown>;
export const INVITE_SUBJECT = 'Lời mời tham gia AppFront';

export class Cleanup {
  private readonly fns: (() => Promise<unknown>)[] = [];
  add(fn: () => Promise<unknown>): void {
    this.fns.push(fn);
  }
  async run(): Promise<void> {
    for (const fn of this.fns.reverse()) await fn().catch(() => undefined);
  }
}

export interface Sent {
  readonly res: APIResponse;
  readonly status: number;
  readonly body: unknown;
}

export interface CallOptions {
  readonly raw?: string;
  readonly headers?: Record<string, string>;
}

export const asJson = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

/** One real request + evidence file. `raw` sends a literal (possibly malformed) JSON body. */
export async function call(
  api: APIRequestContext,
  name: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  assertions: readonly string[],
  options: CallOptions = {},
): Promise<Sent> {
  const headers = { ...(options.raw === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  const res = await api.fetch(path, { method, headers, data: options.raw === undefined ? body : Buffer.from(options.raw) });
  const parsed = await captureExchange(`A08_${name}.json`, { method, path, body: options.raw ?? body }, res, assertions);
  return { res, status: res.status(), body: parsed };
}

/** Status + `code` (+ `field`, `resource`) of an error body; `hard` = `expect`, else `expect.soft`. */
export function expectError(sent: Sent, status: number, code: string, extra: { field?: string; resource?: string } = {}, hard = false): Json {
  const check = hard ? expect : expect.soft;
  const body = asJson(sent.body);
  check(sent.status, `status (${JSON.stringify(body).slice(0, 160)})`).toBe(status);
  check(body.code, 'error code').toBe(code);
  if (extra.field !== undefined) check(body.field, 'error field').toBe(extra.field);
  if (extra.resource !== undefined) check(body.resource, 'error resource').toBe(extra.resource);
  return body;
}

export interface Session {
  readonly user: PoolUser;
  readonly api: APIRequestContext;
}

/** Seed admin is used only by `poolUser` (first fill of a slot = one invite from the seed admin); never PATCHed. */
async function seedAdmin(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const api = await signedInApi(email, password);
  cleanup.add(() => api.dispose());
  return api;
}

/** Pool user of `role` in `slot` (shared pool file) + its own signed-in client. */
export async function pooled(cleanup: Cleanup, role: PoolRole, slot: string): Promise<Session> {
  const user = await poolUser(await seedAdmin(cleanup), role, slot);
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return { user, api };
}

/** Fresh login of an already known pool user. */
export async function loginAs(cleanup: Cleanup, user: PoolUser): Promise<APIRequestContext> {
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return api;
}

export interface Invitee {
  readonly id: string;
  readonly email: string;
  readonly token: string;
}

export const tokenFromLink = (link: string): string => new URLSearchParams(new URL(link).hash.slice(1)).get('token') ?? '';

/** Token of the newest invitation mail to `email` after `since`; mail is deleted in cleanup. */
export async function tokenFor(cleanup: Cleanup, email: string, since: Date): Promise<string> {
  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  const token = tokenFromLink(linkFrom(mail, '/login/invitation'));
  expect(token, `invitation link of ${email} has a #token`).not.toBe('');
  return token;
}

/** Deletes `id` (404 fine) when the test ends. */
export function deleteLater(cleanup: Cleanup, admin: APIRequestContext, id: string, email: string): void {
  cleanup.add(() => admin.delete(`/api/users/${id}`, { data: { userId: id, confirmEmail: email } }));
}

/** One counted `users_invite` call by `admin` for a fresh `testEmail(slug)`; returns the pending row + mailed token. */
export async function inviteOne(cleanup: Cleanup, admin: APIRequestContext, slug: string, role = 'viewer'): Promise<Invitee> {
  const email = testEmail(slug);
  const since = new Date(Date.now() - 5_000);
  const res = await admin.post('/api/users/invitations', { data: { emails: [email], role } });
  expect(res.status(), `setup: invite ${slug}: ${(await res.text()).slice(0, 160)}`).toBe(201);
  const row = asJson(((await res.json()) as unknown[])[0]);
  const id = String(row.id);
  deleteLater(cleanup, admin, id, email);
  return { id, email, token: await tokenFor(cleanup, email, since) };
}

/** Accepts `token` (204 + cookie) then refreshes: a Bearer client for the new user. */
export async function acceptInvitation(cleanup: Cleanup, token: string, name: string): Promise<APIRequestContext> {
  const anon = await newApiContext();
  try {
    const accepted = await anon.post('/api/auth/invitations/accept', { data: { token, fullName: name, password: `Qa-${randomUUID()}` } });
    expect(accepted.status(), 'setup: accept invitation').toBe(204);
    const refreshed = await anon.post('/api/auth/refresh');
    expect(refreshed.status(), 'setup: refresh after accept').toBe(200);
    const bearer = asJson(await refreshed.json()).accessToken;
    const base = apiBaseUrl();
    const api = await request.newContext({ baseURL: base, storageState: await anon.storageState(), extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${String(bearer)}` } });
    cleanup.add(() => api.dispose());
    return api;
  } finally {
    await anon.dispose();
  }
}

/** POST accept with `token`, no session; evidence by `call`. */
export async function acceptAttempt(cleanup: Cleanup, name: string, token: string, assertions: readonly string[]): Promise<Sent> {
  const anon = await newApiContext();
  cleanup.add(() => anon.dispose());
  return call(anon, name, 'POST', '/api/auth/invitations/accept', { token, fullName: 'QA late', password: `Qa-${randomUUID()}` }, assertions);
}

export interface Activity {
  readonly kind: string;
  readonly objectCode: string;
  readonly objectLabel: string;
}

/** Activity of actor `id` (#40), newest first. */
export async function activityOf(admin: APIRequestContext, id: string): Promise<Activity[]> {
  const res = await admin.get(`/api/users/${id}/activity`);
  expect(res.status(), 'GET /api/users/:id/activity').toBe(200);
  return ((await res.json()) as Json[]).map((r) => ({ kind: String(r.kind), objectCode: String(r.objectCode), objectLabel: String(r.objectLabel) }));
}

export const countKind = (rows: readonly Activity[], kind: string, code: string): number => rows.filter((r) => r.kind === kind && r.objectCode === code).length;

export async function listUsers(admin: APIRequestContext): Promise<{ total: number; users: Json[] }> {
  const res = await admin.get('/api/users');
  expect(res.status(), 'GET /api/users').toBe(200);
  const body = asJson(await res.json());
  return { total: Number(body.total), users: (body.users as Json[] | undefined) ?? [] };
}

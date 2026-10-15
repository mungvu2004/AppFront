/**
 * QA-07b P9 helpers for `phase07_me_api.spec.ts` FL-A07-01..04 (GET / PATCH /api/me through the real API, no mocks).
 * `Cleanup`/`note` live in meUsers.ts, the PNG builder in png.ts (shared with P10).
 * `BE:` = `F:/App/AppBack` main dc510655, paths under `apps/api/`.
 */
import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { MeSchema } from '../../../../src/api/schemas/me';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, repSlot } from '../evidence';
import { poolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { Cleanup, note } from './meUsers';
import { png } from './png';

export { Cleanup, note, png };

export type Json = Record<string, unknown>;

export const PREFIX = TEST_DATA_PREFIX;
export const FULL_NAME_MAX = 120; // BE me/schemas.py:16
export const PHONE_MAX = 32; // BE me/schemas.py:17

export function asJson(value: unknown): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`expected a JSON object, got ${JSON.stringify(value)}`);
  return value as Json;
}

/** Non-throwing view of a body (a non-JSON answer just fails the checks that follow). */
export const errBody = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

/** A name of exactly `length` code points that starts with the run prefix (readable in the user list). */
export const padded = (length: number, fill = 'A'): string => `${PREFIX}${fill.repeat(Math.max(0, length - PREFIX.length))}`.slice(0, length);

/* ------------------------------------------------------------------ one exchange + evidence */

/** Signed avatar URLs carry a bearer signature: cut the query before anything reaches the evidence file. */
function redactedView(res: APIResponse, text: string): APIResponse {
  const clean = text.replace(/("avatarUrl"\s*:\s*"[^"?]*)\?[^"]*"/gu, '$1?<signature redacted>"');
  return { status: () => res.status(), headers: () => res.headers(), text: async () => clean } as unknown as APIResponse;
}

export interface Sent {
  readonly res: APIResponse;
  readonly text: string;
  readonly body: unknown;
}

export interface CallOptions {
  readonly headers?: Record<string, string>;
  /** Raw bytes sent as `application/json` unless `headers` says otherwise (malformed JSON, oversize bodies). */
  readonly raw?: string;
  /** What the evidence shows as the request body (large payloads are summarized). */
  readonly shown?: unknown;
}

/** One exchange + `A07_<name>.json` evidence (`name` = `<row id>_<slug>`). */
export async function call(
  api: APIRequestContext,
  name: string,
  method: string,
  path: string,
  body: unknown,
  assertions: readonly string[],
  options: CallOptions = {},
): Promise<Sent> {
  const headers = { ...(options.raw === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  const res = await api.fetch(path, {
    method,
    headers,
    ...(options.raw !== undefined ? { data: Buffer.from(options.raw) } : body === undefined ? {} : { data: body }),
  });
  const text = await res.text();
  const shown = options.shown ?? options.raw ?? body;
  const parsed = await captureExchange(`A07_${name}.json`, { method, path, body: shown }, redactedView(res, text), assertions);
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`); `field: null` = the key must be absent. */
export function expectError(sent: Sent, status: number, code: string, field?: string | null, hard = false): Json {
  const check = hard ? expect : expect.soft;
  check(sent.res.status(), `${code} status`).toBe(status);
  let body: Json = {};
  try {
    body = errBody(JSON.parse(sent.text));
  } catch {
    check(sent.text, `${code}: JSON body`).toBe('{...}');
  }
  check(body.code).toBe(code);
  check(typeof body.requestId).toBe('string');
  if (field === null) check(body, `${code}: no field`).not.toHaveProperty('field');
  else if (field !== undefined) check(body.field).toBe(field);
  return body;
}

/** MeSchema (BE me/schemas.py:21-29, W2: None keys absent): 200, exact keys, FE `MeSchema.strict()` decodes it. */
export function expectMe(sent: Sent, expected: Json, hard = false): Json {
  const check = hard ? expect : expect.soft;
  check(sent.res.status(), 'MeSchema status').toBe(200);
  let body: Json = {};
  try {
    body = errBody(JSON.parse(sent.text));
  } catch {
    check(sent.text, 'MeSchema: JSON body').toBe('{...}');
  }
  const fe = MeSchema.safeParse(body);
  check(fe.success, `FE MeSchema decodes the body: ${fe.success ? '' : JSON.stringify(fe.error.issues)}`).toBe(true);
  check(Object.keys(body).sort()).toEqual(Object.keys(expected).sort());
  const { avatarUrl, ...rest } = body;
  const { avatarUrl: wantAvatar, ...wantRest } = expected;
  check(rest).toEqual(wantRest);
  if (wantAvatar !== undefined) check(typeof avatarUrl).toBe('string');
  return body;
}

/* ------------------------------------------------------------------ users and sessions */

/** Admin client (only to find / fill pool slots; never PATCHed). One login. */
export async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

export interface Session {
  readonly user: PoolUser;
  /** Bearer + `Origin: <base>`, no cookie. */
  readonly api: APIRequestContext;
  /** Cookie jar of the login (refresh cookie), `Origin: <base>`, no Bearer: for `POST /api/auth/refresh`. */
  readonly anon: APIRequestContext;
  readonly token: string;
}

/** Pool user `slot` signed in for real: `POST /api/auth/login` (204) + `POST /api/auth/refresh` (200, access token). 1 login. */
export async function poolSession(admin: APIRequestContext, role: PoolRole, slot: string, cleanup: Cleanup): Promise<Session> {
  const user = await poolUser(admin, role, repSlot(slot));
  const anon = await newApiContext();
  cleanup.add(() => anon.dispose());
  const login = await anon.post('/api/auth/login', { data: { email: user.email, password: user.password, rememberMe: false } });
  expect(login.status(), `setup: POST /api/auth/login as pool ${role}:${slot}`).toBe(204);
  const refreshed = await anon.post('/api/auth/refresh');
  expect(refreshed.status(), 'setup: POST /api/auth/refresh').toBe(200);
  const token = String(asJson(await refreshed.json()).accessToken);
  const base = apiBaseUrl();
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${token}` } });
  cleanup.add(() => api.dispose());
  return { user, api, anon, token };
}

/** A context with EXACTLY `headers` (no Origin, no cookie unless given): for the transport rows of FL-A07-01. */
export async function bareContext(cleanup: Cleanup, headers: Record<string, string>): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: apiBaseUrl(), extraHTTPHeaders: headers });
  cleanup.add(() => ctx.dispose());
  return ctx;
}

export interface Snapshot {
  readonly fullName: string;
  readonly jobTitle: string;
  readonly phone: string;
  readonly language: string;
}

/** Reads the profile BEFORE editing; the flow restores it in `finally` with `restore`. */
export async function snapshotOf(session: Session): Promise<Snapshot> {
  const res = await session.api.get('/api/me');
  expect(res.status(), 'snapshot: GET /api/me').toBe(200);
  const me = asJson(await res.json());
  const text = (key: string): string => (typeof me[key] === 'string' ? (me[key] as string) : '');
  return { fullName: text('fullName'), jobTitle: text('jobTitle'), phone: text('phone'), language: text('language') || 'vi' };
}

/** One PATCH putting the profile back (`""` clears the two nullable keys). Best effort: failure = annotation. */
export async function restore(session: Session, snapshot: Snapshot): Promise<void> {
  try {
    const refreshed = await session.anon.post('/api/auth/refresh'); // the access token may have expired during a long flow
    const token = refreshed.status() === 200 ? String(asJson(await refreshed.json()).accessToken) : session.token;
    const res = await session.api.patch('/api/me', { data: snapshot, headers: { Authorization: `Bearer ${token}` } });
    if (res.status() !== 200) throw new Error(`PATCH /api/me -> ${String(res.status())}`);
  } catch (error) {
    note(`cleanup: profile restore failed: ${String(error)}`);
  }
}

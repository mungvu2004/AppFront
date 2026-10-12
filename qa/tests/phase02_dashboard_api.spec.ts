/**
 * Phase 2 — Dashboard BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints: POST/GET /api/projects, GET/PATCH/DELETE /api/projects/:id, GET /api/project-summaries
 * (BE `apps/api/projects/router.py`), GET /api/notifications, POST /api/notifications/read, /read-all,
 * /{id}/accept-invite (#22, SCR-06 inline "chấp nhận") (BE `apps/api/notifications/router.py`), POST /api/auth/refresh
 * (setup + W16 roles; its rules are Phase 1's, `phase01_auth_api.spec.ts`). Setup/read-back only: N3/N4 members
 * (`project_members/router.py`), DELETE /api/floors/{id} (#11, N1 rollup), GET /api/users/{id}/activity (#40).
 * Inventory + mock-pairing table: `qa/coverage/phase02-be.md`.
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot) @ e2fc4d42, paths under `apps/api/` unless noted; the
 * notification sentences (`notifications/messages.py`) are read @ bf83f815 (A6 capitals, QA-02b).
 *
 * ## Non-serial, own data
 * Every test signs in on its own, creates the projects it needs (`qa-<runId>-…` names) and deletes them in
 * `finally`. Non-admin roles are REAL users: the admin invites a run-unique `qa-<runId>-…@example.test` address
 * (`POST /api/users/invitations`), the one-time token comes from the real mail in Mailpit, the invitee accepts
 * (`POST /api/auth/invitations/accept` → session cookie) and one `POST /api/auth/refresh` gives its Bearer —
 * no login request for invitees. Cleanup: `DELETE /api/users/{id}` (soft delete, also drops memberships) + mails.
 * The admin account is only read: no password change, no failed login, `read-all` is NEVER sent as the admin
 * (it would mark the admin's own inbox read, which the UI test SCR-06 needs unread), and every
 * `POST /api/notifications/read` / `…/{id}/accept-invite` sent as the admin carries ids that are not the admin's (a
 * no-op / 404 by design). Projects the admin deletes are always this file's own `qa-<runId>-…` projects.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37; override LOGIN_IP_LIMIT=120): THIS file
 *   25 = one admin login in each of the 27 tests except the two anonymous ones ("anon" 401 gate, 1 MiB body
 *   ceiling); the Origin test makes its login by hand (same 1). 0 failed. The file runs ~3 min, so ≤ ~10 logins
 *   fall in any 60 s window. UI layer of the phase (runs before/after, never in the same window): main 1 + ui 1 +
 *   dashboard_edge 1 + wizard_edge ≤ 11 + notify_edge 19, each ≤ 7 a minute by their own headers.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:32-43), shared with every phase that
 *   runs in the same hour: THIS file 9 (role matrix 2, notifications 1, member add/remove 1, accept-invite 1, fresh
 *   engineer 1, invite message 3); `phase02_notify_edge` ≤ 6. Phase 1 spends 8, so Phase 1 + 2 = 23 ≤ 30.
 * - `recovery_ip` 10 / 900 s per IP (BE:auth_recovery/settings.py:24-25; override RECOVERY_IP_LIMIT=60), counts the
 *   invitation accepts: THIS file 9; `phase02_notify_edge` ≤ 6 (its header still counts this file as 3). Phase 2
 *   = 15 > 10 in one 900 s window → the override (60, already required by Phase 1's 32) is needed; with Phase 1 in
 *   the same window 47 ≤ 60. Without the override, this file alone (9) fits 10 only if notify_edge runs ≥ 900 s apart.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/router.py:26-33, settings.py:14-15), counted for every
 *   request that passes the edit gate (201 and 200): THIS file 7 (admin: roles 1, notif 2, member add/remove 3,
 *   accept-invite 1); notify_edge 13 → 20 ≤ 60. The invite-message test's 2 adds are made by its two fresh engineers
 *   (1 each, their own buckets). N4 (member remove) has no limiter.
 * - `POST /api/auth/refresh` 300 / 60 s per session (BE:auth/settings.py:45-46): 1 per admin login and 1 per
 *   invitee (9), each on its own new session; the UI spec's 64 refreshes are on the stored admin session, not these.
 * - Projects, floors-delete and notifications routes have NO rate limit (no `rate_limit(` in projects/ or
 *   notifications/), so the 1 MiB / 413 requests and the anonymous 401s cost nothing.
 * - Mailpit: 9 invitation mails, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE:auth/cookies.py
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase01_auth_api "invite")
/** Well-formed `prj_<ULID>` that no row has (BE:packages/core/ids.py:35,74-78). */
const MISSING_PROJECT = `prj_${'0'.repeat(26)}`;
const PROJECT_ID = /^prj_[0-9A-HJKMNP-TV-Z]{26}$/u;
const FLOOR_ID = /^L-[0-9A-HJKMNP-TV-Z]{26}$/u; // BE:floors/lookup.py:121-123
const NOTIFICATION_ID = /^ntf_[0-9A-HJKMNP-TV-Z]{26}$/u;
/** Well-formed `ntf_<ULID>` that no row has (notifications/service.py:196-203). */
const MISSING_NOTIFICATION = `ntf_${'0'.repeat(26)}`;
const FOREIGN_ORIGIN = 'http://evil.example.test';
/** JSON body ceiling of every phase-2 route (BE:core/routing.py:46,64; middleware.py:217-237). */
const BODY_LIMIT = 1024 * 1024;
/** `UserActivityOut` (BE:users/schemas.py:50-57): `id` is a decimal string. */
const ACTIVITY_KEYS = ['at', 'id', 'kind', 'objectCode', 'objectLabel'] as const;

/* Wire shapes (W2: optional keys are ABSENT, never null). */
const PROJECT_KEYS = ['createdAt', 'floors', 'id', 'members', 'name', 'status', 'updatedAt'] as const; // wire.py:77-88
const PROJECT_OPTIONAL = ['address', 'code'] as const;
const MEMBER_KEYS = ['email', 'id', 'name', 'role'] as const; // wire.py:38-49
const MEMBER_OPTIONAL = ['avatarUrl'] as const;
const FLOOR_KEYS = ['drawings', 'elevationMm', 'heightMm', 'id', 'name', 'order'] as const; // wire.py:65-74
const FLOOR_OPTIONAL = ['areaM2'] as const;
const SUMMARY_KEYS = [
  'areaM2', 'floorCount', 'id', 'members', 'name', 'status', 'updatedAt', 'wallsReviewedCount', 'wallsTotalCount',
] as const; // wire.py:98-114
const SUMMARY_OPTIONAL = ['defaultFloorId'] as const;
const NOTIFICATION_KEYS = [
  'createdAt', 'id', 'isRead', 'kind', 'message', 'objectLabel', 'place', 'projectId', 'projectName',
] as const; // notifications/schemas.py:18-31, payload.py:11-28
const NOTIFICATION_OPTIONAL = ['excerpt', 'floorId'] as const;

/** The wizard's 4 default floors in the shape `toFloorWirePayload` sends (FE src/api/contracts.ts:183-190);
 * values inside BE ranges (BE:floors/schemas.py:16-22). */
const DEFAULT_FLOORS = ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3'].map((name, order) => ({
  name,
  order,
  elevationMm: order * 3000,
  heightMm: 3000,
}));

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Role = 'viewer' | 'engineer';

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const projectName = (slug: string): string => `${PREFIX}${slug}-${uniq()}`;
/** Run-unique name padded/cut to exactly `length` characters (prefix kept). */
const nameOfLength = (length: number): string => `${projectName('len')}${'x'.repeat(length)}`.slice(0, length);

/* ------------------------------------------------------------------ phase-local helpers */

function note(description: string): void {
  test.info().annotations.push({ type: 'cleanup', description });
}

function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

/** Every `required` key present and no key outside `required` ∪ `optional` (K01: no leaked field). */
function expectKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): Json {
  const record = asJson(value);
  const keys = Object.keys(record);
  for (const key of required) expect(keys, `key "${key}"`).toContain(key);
  expect(keys.filter((key) => !required.includes(key) && !optional.includes(key)), 'unexpected keys').toEqual([]);
  return record;
}

const isTime = (value: unknown): boolean => typeof value === 'string' && !Number.isNaN(Date.parse(value));

interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `A02_<ev>.json` (secrets redacted by `captureExchange`). */
async function call(
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
  const body = await captureExchange(`A02_${ev}.json`, { method, path, body: data ?? null }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:80-85): `code` + `requestId` (+ `field` / `resource` / `count`). */
function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string; readonly resource?: string } = {},
  soft = false,
): Json {
  const check = soft ? expect.soft : expect;
  check(sent.res.status(), `${code} status`).toBe(status);
  const body = asJson(sent.body, `${code} body`);
  check(body.code).toBe(code);
  check(typeof body.requestId).toBe('string');
  if (params.field !== undefined) check(body.field).toBe(params.field);
  if (params.resource !== undefined) check(body.resource).toBe(params.resource);
  return body;
}

function expectProjectOut(value: unknown): Json {
  const project = expectKeys(value, PROJECT_KEYS, PROJECT_OPTIONAL);
  expect(String(project.id)).toMatch(PROJECT_ID);
  expect(['draft', 'processing', 'approved', 'error']).toContain(project.status); // wire.py:29
  expect(isTime(project.createdAt) && isTime(project.updatedAt), 'createdAt/updatedAt are instants').toBe(true);
  for (const member of asArray(project.members, 'members')) expectKeys(member, MEMBER_KEYS, MEMBER_OPTIONAL);
  for (const floor of asArray(project.floors, 'floors')) {
    const out = expectKeys(floor, FLOOR_KEYS, FLOOR_OPTIONAL);
    expect(String(out.id)).toMatch(FLOOR_ID);
  }
  return project;
}

const byId = (items: readonly unknown[], id: unknown): Json | undefined =>
  items.map((item) => asJson(item)).find((item) => item.id === id);

/** Cleanup steps run in reverse order; a failing step is annotated, never thrown. */
class Cleanup {
  private readonly steps: Array<() => Promise<unknown>> = [];

  add(step: () => Promise<unknown>): void {
    this.steps.push(step);
  }

  async run(): Promise<void> {
    for (const step of [...this.steps].reverse()) {
      try {
        await step();
      } catch (error) {
        note(String(error));
      }
    }
  }
}

/** Soft delete for cleanup; 404 = already deleted by the test. */
function deleteProjectStep(api: APIRequestContext, id: string): () => Promise<void> {
  return async () => {
    const res = await api.delete(`/api/projects/${id}`);
    if (res.status() !== 200 && res.status() !== 404) note(`DELETE /api/projects/${id} → ${String(res.status())}`);
  };
}

/**
 * Cleanup of a project the admin is not a member of: #27 DELETE is admin-only (BUG-513, AppBack projects/router.py:80),
 * so a member first adds the admin (N3, project.settings.edit; 200 if already a member), then the admin deletes.
 */
function adminDeleteStep(member: APIRequestContext, admin: APIRequestContext, id: string): () => Promise<void> {
  return async () => {
    await member.post(`/api/projects/${id}/members`, { data: { email: readAdminCredentials().email } });
    await deleteProjectStep(admin, id)();
  };
}

async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

/** Setup: admin creates a project (no floors unless `extra` says so) and registers its deletion. */
async function newProject(api: APIRequestContext, ev: string, cleanup: Cleanup, extra: Json = {}): Promise<Json> {
  const sent = await call(api, `${ev}_create`, 'POST', '/api/projects', { name: projectName(ev), ...extra }, [
    'setup: 201 ProjectOut (projects/router.py:54-63)',
  ]);
  expect(sent.res.status(), 'setup create').toBe(201);
  const project = expectProjectOut(sent.body);
  cleanup.add(deleteProjectStep(api, String(project.id)));
  return project;
}

async function listProjects(api: APIRequestContext, ev: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', '/api/projects', undefined, [
    '200 bare array of ProjectOut where the caller is a member, not soft-deleted (projects/service.py:71-77,159-171)',
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body).map((item) => asJson(item));
}

/** Every page of N1 at `limit=500` (the FE also reads all pages, projectsGateway.ts readAllPages). */
async function allSummaries(api: APIRequestContext, ev: string): Promise<Json[]> {
  const items: Json[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const path = `/api/project-summaries?limit=500${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const sent = await call(api, `${ev}_p${String(page)}`, 'GET', path, undefined, [
      '200 CursorPage {items, nextCursor?}; nextCursor only while rows remain (projects/service.py:193-216)',
    ]);
    expect(sent.res.status()).toBe(200);
    const body = expectKeys(sent.body, ['items'], ['nextCursor']);
    items.push(...asArray(body.items).map((item) => asJson(item)));
    if (typeof body.nextCursor !== 'string') return items;
    cursor = body.nextCursor;
  }
  throw new Error('more than 20 pages of project summaries');
}

/** `activity_log` rows of `userId` whose `objectCode` is `objectCode` (GET /api/users/{id}/activity,
 * BE:users/router.py:79-81, service.py:263-278: newest first, cap 200 — users/service.py:74). Every row is
 * checked for the exact `UserActivityOut` keys. */
async function activityOf(admin: APIRequestContext, userId: string, objectCode: string, ev: string): Promise<Json[]> {
  const sent = await call(admin, ev, 'GET', `/api/users/${userId}/activity`, undefined, [
    'read-back: 200 activity rows of the admin, newest first, keys {id, at, kind, objectCode, objectLabel}; filtered here by objectCode',
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body)
    .map((row) => expectKeys(row, ACTIVITY_KEYS))
    .filter((row) => row.objectCode === objectCode);
}

async function readProject(api: APIRequestContext, id: unknown, ev: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${String(id)}`, undefined, [claim]);
  expect(sent.res.status()).toBe(200);
  return expectProjectOut(sent.body);
}

/** `updatedAt` never increases down the list (W: ms-truncated instants, packages/core/instants.py:15-21 — equal
 * instants cannot show the `id DESC` tie-break, so only the primary key is checked). */
function expectUpdatedDesc(items: readonly Json[]): void {
  for (let i = 1; i < items.length; i += 1) {
    const prev = Date.parse(String(items[i - 1]?.updatedAt));
    const next = Date.parse(String(items[i]?.updatedAt));
    expect.soft(prev, `row ${String(i - 1)} updatedAt ≥ row ${String(i)}`).toBeGreaterThanOrEqual(next);
  }
}

const utcHour = (d: Date): string => d.toISOString().slice(0, 13);

/** `SECURITY_HEADERS` + `Cache-Control: no-store` on every response (BE:core/middleware.py:48-53,178-199). */
function expectHardenedHeaders(res: APIResponse, what: string): void {
  const headers = res.headers();
  expect.soft(headers['x-content-type-options'], `${what}: nosniff`).toBe('nosniff');
  expect.soft(headers['x-frame-options'], `${what}: DENY`).toBe('DENY');
  expect.soft(headers['referrer-policy'], `${what}: same-origin`).toBe('same-origin');
  expect.soft(headers['cache-control'] ?? '', `${what}: no-store`).toContain('no-store');
}

/** The creator is the only member of a fresh project (projects/service.py:255). */
function creatorId(project: Json): string {
  const members = asArray(project.members, 'members').map((member) => asJson(member));
  expect(members).toHaveLength(1);
  return String(members[0]?.id);
}

/* ---- real non-admin users (invitation → Mailpit → accept → refresh) */

interface Invited {
  readonly id: string;
  readonly email: string;
  readonly token: string;
  readonly mailId: string;
}

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly api: APIRequestContext;
}

function tokenFrom(mail: Mail): string {
  // `{PUBLIC_BASE_URL}/login/invitation#token=…` (BE:auth_recovery/messages.py; phase01_auth_api `tokenFrom`).
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error(`mail "${mail.subject}" link has no #token`);
  return token;
}

/** Admin invites one user with `role` (BE:users/router.py:55-62); registers user + mail cleanup at once. */
async function invite(admin: APIRequestContext, role: Role, ev: string, cleanup: Cleanup): Promise<Invited> {
  const email = testEmail(ev);
  const since = new Date(Date.now() - 5_000);
  const sent = await call(admin, `${ev}_invite`, 'POST', '/api/users/invitations', { emails: [email], role }, [
    `setup: admin invites a run-unique @example.test ${role} → 201, one pending user`,
  ]);
  expect(sent.res.status()).toBe(201);
  const user = asArray(sent.body).map((u) => asJson(u)).find((u) => u.email === email);
  expect(user?.status).toBe('pending');
  const id = String(user?.id);
  cleanup.add(async () => {
    const res = await admin.delete(`/api/users/${id}`, { data: { userId: id, confirmEmail: email } });
    if (res.status() !== 200) note(`DELETE /api/users/${id} → ${String(res.status())}`);
  });
  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  return { id, email, token: tokenFrom(mail), mailId: mail.id };
}

/** Accept (1 recovery request) → refresh with the new cookie → Bearer client. W16 roles = the invited role. */
async function sessionOf(invited: Invited, role: Role, ev: string, cleanup: Cleanup, fullName?: string): Promise<TestUser> {
  const anon = await newApiContext();
  const name = fullName ?? `${PREFIX}${ev}`;
  let token: string;
  try {
    const accept = await call(
      anon,
      `${ev}_accept`,
      'POST',
      '/api/auth/invitations/accept',
      { token: invited.token, fullName: name, password: `Qa-${randomUUID()}` },
      ['setup: invitee accepts with the real mailed token → 204 + refresh cookie (auth_recovery/router.py)'],
    );
    expect(accept.res.status()).toBe(204);
    const line = accept.res
      .headersArray()
      .find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${REFRESH}=`));
    if (!line) throw new Error('accept: no refresh cookie');
    const cookie = line.value.slice(REFRESH.length + 1).split(';')[0] ?? '';
    const refreshed = await call(anon, `${ev}_refresh`, 'POST', '/api/auth/refresh', undefined, [
      `200 W16 {accessToken, expiresAt, roles, user}; roles = ["${role}"] = the system role (auth/router.py)`,
    ], { Cookie: `${REFRESH}=${cookie}` });
    expect(refreshed.res.status()).toBe(200);
    const body = expectKeys(refreshed.body, ['accessToken', 'expiresAt', 'roles', 'user']);
    expect(body.roles).toEqual([role]);
    expect(asJson(body.user).id).toBe(invited.id);
    const res = await refreshed.res.json() as Json; // captured body has the token redacted
    token = String(res.accessToken);
  } finally {
    await anon.dispose();
  }
  const base = apiBaseUrl();
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${token}` } });
  cleanup.add(() => api.dispose());
  return { id: invited.id, email: invited.email, name, api };
}

async function addMember(admin: APIRequestContext, projectId: unknown, email: string, ev: string): Promise<void> {
  const sent = await call(admin, ev, 'POST', `/api/projects/${String(projectId)}/members`, { email }, [
    'setup: N3 adds the user → 201 UserOut (project_members/router.py:42-70); the invite sink notifies them',
  ]);
  expect(sent.res.status()).toBe(201);
}

/** N4 (BE:project_members/router.py:73-80, service.py:97-131): 200 `UserOut` of the removed member. */
async function removeMember(admin: APIRequestContext, projectId: unknown, userId: string, ev: string): Promise<Json> {
  const sent = await call(admin, ev, 'DELETE', `/api/projects/${String(projectId)}/members/${userId}`, undefined, [
    'setup: N4 removes the member → 200 UserOut built before the removal (project_members/service.py:106-131)',
  ]);
  expect(sent.res.status()).toBe(200);
  const out = expectKeys(sent.body, MEMBER_KEYS, MEMBER_OPTIONAL);
  expect(out.id).toBe(userId);
  return out;
}

async function inbox(api: APIRequestContext, ev: string, claim: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', '/api/notifications', undefined, [claim]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body).map((item) => expectKeys(item, NOTIFICATION_KEYS, NOTIFICATION_OPTIONAL));
}

async function expectNoContent(sent: Sent): Promise<void> {
  expect(sent.res.status()).toBe(204);
  expect(await sent.res.text()).toBe('');
}

/* ------------------------------------------------------------------ authentication gate */

test.describe('A02 authentication gate (protected_router, BE:core/routing.py:129-135,255-257)', () => {
  test('A02 · anonymous or forged Bearer → 401 UNAUTHENTICATED on all nine phase-2 routes, before the body is read', async () => {
    // `_principal_of` runs first in every AppRoute handler: no `Bearer <token>` → 401 before any body/DB work
    // (W10, routing.py:5-8). A forged token → verifier 401 UNAUTHENTICATED (auth/verifier.py:6,27-28).
    const anon = await newApiContext();
    const forged = await newApiContext({ Authorization: 'Bearer qa-not-a-jwt' });
    const basic = await newApiContext({ Authorization: 'Basic cWE6cWE=' });
    try {
      const routes: ReadonlyArray<readonly [Method, string, unknown]> = [
        ['GET', '/api/projects', undefined],
        ['POST', '/api/projects', { name: projectName('anon') }],
        ['GET', `/api/projects/${MISSING_PROJECT}`, undefined],
        ['PATCH', `/api/projects/${MISSING_PROJECT}`, { name: projectName('anon') }],
        ['DELETE', `/api/projects/${MISSING_PROJECT}`, undefined],
        ['GET', '/api/project-summaries', undefined],
        ['GET', '/api/notifications', undefined],
        ['POST', '/api/notifications/read', { ids: ['ntf_x'] }],
        ['POST', '/api/notifications/read-all', {}],
      ];
      for (const [method, path, data] of routes) {
        const slug = `${method}${path.replace(/[^A-Za-z0-9]+/gu, '_')}`;
        const sent = await call(anon, `anon_401_${slug}`, method, path, data, [
          '401 code UNAUTHENTICATED: no Authorization header (routing.py:129-135)',
        ]);
        expectError(sent, 401, 'UNAUTHENTICATED', {}, true);
      }

      // A truncated JSON body is never parsed: 401, not 400 MALFORMED_JSON.
      const raw = '{"name":';
      const res = await anon.post('/api/projects', { data: Buffer.from(raw), headers: { 'Content-Type': 'application/json' } });
      const body = await captureExchange('A02_anon_401_malformed_body.json', { method: 'POST', path: '/api/projects', body: raw }, res, [
        '401 UNAUTHENTICATED even with a malformed JSON body: authentication runs before the body is read (W10)',
      ]);
      expectError({ res, body }, 401, 'UNAUTHENTICATED');

      for (const [label, api] of [['forged_bearer', forged], ['basic_scheme', basic]] as const) {
        for (const path of ['/api/projects', '/api/notifications']) {
          const sent = await call(api, `${label}_401${path.replace(/\//gu, '_')}`, 'GET', path, undefined, [
            `401 UNAUTHENTICATED: ${label === 'basic_scheme' ? 'scheme is not Bearer (routing.py:131-133)' : 'token fails JwtTokenVerifier (verifier.py:6)'}`,
          ]);
          expectError(sent, 401, 'UNAUTHENTICATED', {}, true);
        }
      }
    } finally {
      await Promise.all([anon.dispose(), forged.dispose(), basic.dispose()]);
    }
  });
});

/* ------------------------------------------------------------------ POST /api/projects */

test.describe('A02 POST /api/projects (#25, BE:projects/router.py:54-63, service.py:238-260)', () => {
  test('A02 · create with the wizard\'s 4 floors → 201 ProjectOut; read back by GET /projects/:id, GET /projects, GET /project-summaries; activity "project.create"', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      // Name with padding + a decomposed "é" (e + U+0301): trim → NFC (schemas.py:31-39, packages/core/text.py:34-40).
      const base = projectName('create');
      const body = { name: `  ${base}-cafe\u0301  `, code: '  QA-02  ', address: ` ${PREFIX}addr `, floors: DEFAULT_FLOORS };
      const created = await call(admin, 'create_201', 'POST', '/api/projects', body, [
        '201 ProjectOut: name/code/address trimmed + NFC; creator is the only member (role admin)',
        '4 floors from the create_floors hook (floors/view_parts.py:56-79), ids L-<ULID>, drawings []',
        'status "draft": floors exist but no wall reviewed (summaries.py:182-197); no currentVersion/progress/deletedAt keys (wire.py)',
      ]);
      expect(created.res.status()).toBe(201);
      const project = expectProjectOut(created.body);
      cleanup.add(deleteProjectStep(admin, String(project.id)));
      expect(Object.keys(project).sort()).toEqual([...PROJECT_KEYS, ...PROJECT_OPTIONAL].sort());
      expect(project.name).toBe(`${base}-caf\u00e9`);
      expect(project.code).toBe('QA-02');
      expect(project.address).toBe(`${PREFIX}addr`);
      expect(project.status).toBe('draft');
      const members = asArray(project.members).map((m) => asJson(m));
      expect(members).toHaveLength(1);
      expect(members[0]?.role).toBe('admin');
      const floors = asArray(project.floors).map((f) => asJson(f)).sort((a, b) => Number(a.order) - Number(b.order));
      expect(floors.map((f) => [f.name, f.order, f.elevationMm, f.heightMm])).toEqual(
        DEFAULT_FLOORS.map((f) => [f.name, f.order, f.elevationMm, f.heightMm]),
      );
      for (const floor of floors) {
        expect(floor.drawings).toEqual([]);
        expect(floor).not.toHaveProperty('areaM2');
      }

      // #24 read-back: same body (no write in between).
      const read = await call(admin, 'create_read_back', 'GET', `/api/projects/${String(project.id)}`, undefined, [
        '200 #24 returns the same ProjectOut as the 201 (projects/router.py:48-51)',
      ]);
      expect(read.res.status()).toBe(200);
      expect(read.body).toEqual(project);

      // #23 list.
      expect(byId(await listProjects(admin, 'create_list'), project.id), 'GET /api/projects lists it').toEqual(project);

      // N1 summary: rollup of 4 hidden=false rows, nothing uploaded (summaries.py:200-251).
      const summary = byId(await allSummaries(admin, 'create_summaries'), project.id);
      expect(summary, 'GET /api/project-summaries lists it').toBeDefined();
      const out = expectKeys(summary, SUMMARY_KEYS, SUMMARY_OPTIONAL);
      expect(out).toMatchObject({ name: project.name, floorCount: 4, areaM2: 0, status: 'processing', wallsReviewedCount: 0, wallsTotalCount: 0 });
      expect(out.updatedAt).toBe(project.updatedAt);
      // default floor = lowest `floor_order` when every floor is "reviewed" 0/0 (summaries.py:224-227).
      expect(out.defaultFloorId).toBe(floors[0]?.id);
      for (const member of asArray(out.members)) expectKeys(member, ['id', 'name']); // no email (wire.py:91-95)

      // Side effect: one activity row (service.py:257,335-347; access/kinds.py:27).
      const rows = await activityOf(admin, creatorId(project), String(project.id), 'create_activity');
      expect(rows.map((r) => [r.kind, r.objectLabel])).toEqual([['project.create', project.name]]);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · create body rules → 422 VALIDATION with the field (name/code/address/floors), the max boundaries accepted, hook errors roll back', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const floor = DEFAULT_FLOORS[0]!;
      const valid = (slug: string): string => projectName(`rule-${slug}`);
      // schemas.py:25-28 (name 3-80, code 1-32, address 1-200), :31-39 (trim+NFC, Cc + bidi incl. LRM/RLM → error),
      // :79-84 (explicit null → 422), core/wire.py:46 (extra="forbid"); floors: Pydantic FloorDraftIn (:57-66) then the
      // hook (floors/view_parts.py:37-53,63-64: order 0-999, heightMm 2000-10000, ≤ FLOORS_MAX 50 floors/settings.py:18).
      const cases: ReadonlyArray<{ readonly slug: string; readonly body: Json; readonly field: string }> = [
        { slug: 'name_missing', body: {}, field: 'name' },
        { slug: 'name_short_after_trim', body: { name: '  ab  ' }, field: 'name' },
        { slug: 'name_81', body: { name: nameOfLength(81) }, field: 'name' },
        { slug: 'name_null', body: { name: null }, field: 'name' },
        { slug: 'name_number', body: { name: 123 }, field: 'name' },
        { slug: 'name_control_char', body: { name: `${valid('cc')}\u0007` }, field: 'name' },
        { slug: 'name_bidi_override', body: { name: `${valid('rlo')}\u202e` }, field: 'name' },
        { slug: 'name_bidi_mark', body: { name: `${valid('lrm')}\u200e` }, field: 'name' },
        { slug: 'code_null', body: { name: valid('code-null'), code: null }, field: 'code' },
        { slug: 'code_blank', body: { name: valid('code-blank'), code: '   ' }, field: 'code' },
        { slug: 'code_33', body: { name: valid('code-33'), code: 'C'.repeat(33) }, field: 'code' },
        { slug: 'address_201', body: { name: valid('addr-201'), address: 'A'.repeat(201) }, field: 'address' },
        { slug: 'extra_key', body: { name: valid('extra'), foo: 1 }, field: 'foo' },
        { slug: 'floor_name_blank', body: { name: valid('floor-name'), floors: [{ ...floor, name: '  ' }] }, field: 'floors.0.name' },
        { slug: 'floor_height_1999', body: { name: valid('floor-h'), floors: [{ ...floor, heightMm: 1999 }] }, field: 'floors.0.heightMm' },
        { slug: 'floor_order_1000', body: { name: valid('floor-o'), floors: [{ ...floor, order: 1000 }] }, field: 'floors.0.order' },
        {
          slug: 'floors_51',
          body: { name: valid('floors-51'), floors: Array.from({ length: 51 }, (_, i) => ({ ...floor, name: `T${String(i)}`, order: i })) },
          field: 'floors',
        },
      ];
      for (const c of cases) {
        const sent = await call(admin, `create_422_${c.slug}`, 'POST', '/api/projects', c.body, [
          `422 code VALIDATION field "${c.field}"`,
        ]);
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
        expectError(sent, 422, 'VALIDATION', { field: c.field }, true);
      }

      // Hook errors are raised after the project row was flushed: AppRoute rolls the whole #25 back (service.py:9-11,
      // 228-235; core/routing.py:14-16). No rejected name may exist afterwards.
      const listed = new Set((await listProjects(admin, 'create_422_rollback_list')).map((p) => p.name));
      for (const c of cases) {
        if (typeof c.body.name === 'string') expect.soft(listed.has(c.body.name.trim()), `${c.slug} left no project`).toBe(false);
      }

      // Max boundaries accepted together: name 80, code 32, address 200, floor ranges at both ends.
      const name = nameOfLength(80);
      const edges = [
        { name: 'Tầng trệt', order: 0, elevationMm: -30_000, heightMm: 2_000 },
        { name: 'Tầng 1', order: 999, elevationMm: 300_000, heightMm: 10_000 },
      ];
      const ok = await call(admin, 'create_201_max_boundaries', 'POST', '/api/projects', {
        name, code: 'C'.repeat(32), address: 'A'.repeat(200), floors: edges,
      }, ['201: name 80, code 32, address 200, order 0/999, elevationMm -30000/300000, heightMm 2000/10000 all accepted']);
      expect(ok.res.status()).toBe(201);
      const project = expectProjectOut(ok.body);
      cleanup.add(deleteProjectStep(admin, String(project.id)));
      expect(project.name).toBe(name);
      expect(asArray(project.floors).map((f) => asJson(f)).sort((a, b) => Number(a.order) - Number(b.order)).map((f) => [f.order, f.elevationMm, f.heightMm]))
        .toEqual(edges.map((f) => [f.order, f.elevationMm, f.heightMm]));
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · Idempotency-Key on create: replay → same project, other body → 422 IDEMPOTENCY_KEY_REUSED, bad key → 422 field idempotencyKey; same name without a key → two projects', async () => {
    // core/routing.py:166-187,223-228 (POST on a protected route claims the key), core/idempotency.py:79-83 (key
    // ^[A-Za-z0-9_-]{8,128}$, packages/db/models/idempotency.py:35), :225-234 (same digest → replay of the stored
    // response, other digest → 422), service.py:243-244 (no unique-name rule, never 409).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const key = `qa-${uniq()}${uniq()}`;
      const first = { name: projectName('idem') };
      const one = await call(admin, 'idem_first', 'POST', '/api/projects', first, ['201 first run with Idempotency-Key'], { 'Idempotency-Key': key });
      expect(one.res.status()).toBe(201);
      const project = expectProjectOut(one.body);
      cleanup.add(deleteProjectStep(admin, String(project.id)));

      const two = await call(admin, 'idem_replay', 'POST', '/api/projects', first, [
        '201 replay: same key + same body → the stored response, same project id, handler not run again',
      ], { 'Idempotency-Key': key });
      expect(two.res.status()).toBe(201);
      expect(two.body).toEqual(one.body);

      const other = { name: projectName('idem-other') };
      const reused = await call(admin, 'idem_reused', 'POST', '/api/projects', other, [
        '422 code IDEMPOTENCY_KEY_REUSED: same key, different body (idempotency.py:230-231)',
      ], { 'Idempotency-Key': key });
      if (reused.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(reused.body).id)));
      expectError(reused, 422, 'IDEMPOTENCY_KEY_REUSED', {}, true);

      const badKeyBody = { name: projectName('idem-badkey') };
      const bad = await call(admin, 'idem_bad_key', 'POST', '/api/projects', badKeyBody, [
        '422 VALIDATION field "idempotencyKey" for a 5-character key (idempotency.py:48,79-83)',
      ], { 'Idempotency-Key': 'short' });
      if (bad.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(bad.body).id)));
      expectError(bad, 422, 'VALIDATION', { field: 'idempotencyKey' }, true);

      const twin = { name: projectName('twin') };
      const twinA = await call(admin, 'twin_a', 'POST', '/api/projects', twin, ['201 first project with this name']);
      const twinB = await call(admin, 'twin_b', 'POST', '/api/projects', twin, ['201 again: no unique-name rule (service.py:243-244)']);
      for (const sent of [twinA, twinB]) {
        expect.soft(sent.res.status()).toBe(201);
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
      }
      expect(asJson(twinA.body).id).not.toBe(asJson(twinB.body).id);

      const names = (await listProjects(admin, 'idem_list')).map((p) => p.name);
      expect(names.filter((n) => n === first.name), 'one project for the replayed key').toHaveLength(1);
      expect(names).not.toContain(other.name);
      expect(names).not.toContain(badKeyBody.name);
      expect(names.filter((n) => n === twin.name)).toHaveLength(2);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ PATCH /api/projects/:id */

test.describe('A02 PATCH /api/projects/:id (#26, BE:projects/router.py:66-76, service.py:263-309)', () => {
  test('A02 · rename PATCH → 200 + updatedAt + activity; rename back (the UI undo); {} / same value / W18 echo → 200 without a write', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'rename', cleanup);
      const path = `/api/projects/${String(project.id)}`;
      const original = String(project.name);
      const renamed = `${original}-R`;

      const rename = await call(admin, 'rename_200', 'PATCH', path, { name: renamed }, [
        '200 ProjectOut with the new name; updatedAt pushed (touch_project, summaries.py:177-179)',
      ]);
      expect(rename.res.status()).toBe(200);
      const after = expectProjectOut(rename.body);
      expect(after.name).toBe(renamed);
      expect(Date.parse(String(after.updatedAt))).toBeGreaterThan(Date.parse(String(project.updatedAt)));

      // The dashboard's rename toast "Hoàn tác" sends the old name back (phase02_dashboard "rename + undo").
      const undo = await call(admin, 'rename_undo_200', 'PATCH', path, { name: original }, ['200 name restored']);
      expect(undo.res.status()).toBe(200);
      const restored = expectProjectOut(undo.body);
      expect(restored.name).toBe(original);

      // No-ops: `{}`, the same value, and the FE echo of read-only keys (W18 status/members/floors/progress/
      // currentVersion, schemas.py:69-77,94-98) — 200, nothing written, updatedAt unchanged (service.py:299-309).
      const echo = {
        name: original,
        status: 'approved',
        members: [],
        floors: [],
        progress: { id: 'x', progressPercent: 100, status: 'done', step: 'x' },
        currentVersion: { id: 'x', projectId: String(project.id), sequence: 1, createdAt: String(project.createdAt), creatorId: 'x' },
      };
      for (const [slug, body] of [['empty', {}], ['same_name', { name: original }], ['w18_echo', echo]] as const) {
        const sent = await call(admin, `rename_noop_${slug}`, 'PATCH', path, body, [
          '200 unchanged ProjectOut: no field differs, so no UPDATE, no activity row, updatedAt not pushed',
        ]);
        expect(sent.res.status()).toBe(200);
        const out = expectProjectOut(sent.body);
        expect.soft(out.updatedAt, `${slug}: updatedAt`).toBe(restored.updatedAt);
        expect.soft(out.status, `${slug}: status ignored`).toBe('draft');
        expect.soft(out.members, `${slug}: members ignored`).toEqual(project.members);
      }

      const fields = await call(admin, 'patch_code_address_200', 'PATCH', path, { code: ' QA-26 ', address: `${PREFIX}addr` }, [
        '200 code/address written (trimmed); activity label is the unchanged name (service.py:285)',
      ]);
      expect(fields.res.status()).toBe(200);
      expect(asJson(fields.body)).toMatchObject({ name: original, code: 'QA-26', address: `${PREFIX}addr` });

      const rows = await activityOf(admin, creatorId(project), String(project.id), 'rename_activity');
      expect(rows.map((r) => [r.kind, r.objectLabel])).toEqual([
        ['project.update', original],
        ['project.update', original],
        ['project.update', renamed],
        ['project.create', original],
      ]);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · PATCH rules: explicit null / short name / extra key → 422 field; projectId ≠ path → 422 PATH_BODY_MISMATCH; malformed or unknown id → 404 resource project', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'patch-rules', cleanup);
      const path = `/api/projects/${String(project.id)}`;
      const cases: ReadonlyArray<readonly [string, Json, string]> = [
        ['name_null', { name: null }, 'name'], // schemas.py:42-46,79-84
        ['code_null', { code: null }, 'code'],
        ['address_null', { address: null }, 'address'],
        ['name_short', { name: 'ab' }, 'name'], // :25
        ['code_blank', { code: '  ' }, 'code'],
        ['extra_key', { foo: 1 }, 'foo'], // core/wire.py:46
      ];
      for (const [slug, body, field] of cases) {
        const sent = await call(admin, `patch_422_${slug}`, 'PATCH', path, body, [`422 code VALIDATION field "${field}"`]);
        expectError(sent, 422, 'VALIDATION', { field }, true);
      }

      const mismatch = await call(admin, 'patch_422_path_body_mismatch', 'PATCH', path, { projectId: MISSING_PROJECT, name: `${String(project.name)}-x` }, [
        '422 code PATH_BODY_MISMATCH field "projectId": body key ≠ path param (W21, core/routing.py:138-151)',
      ]);
      expectError(mismatch, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' }, true);

      // projects/access.py:28-33 (not prj_<ULID> → 404 without a query), :82-83 (no live member row → 404), K08.
      for (const [slug, id] of [['malformed', 'not-a-project'], ['unknown', MISSING_PROJECT]] as const) {
        const sent = await call(admin, `patch_404_${slug}_id`, 'PATCH', `/api/projects/${id}`, { name: projectName('ghost') }, [
          '404 code NOT_FOUND resource "project"',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' }, true);
        const read = await call(admin, `get_404_${slug}_id`, 'GET', `/api/projects/${id}`, undefined, ['404 NOT_FOUND resource "project"']);
        expectError(read, 404, 'NOT_FOUND', { resource: 'project' }, true);
      }

      const after = await call(admin, 'patch_rules_read_back', 'GET', path, undefined, ['200: nothing above changed the project']);
      expect(after.res.status()).toBe(200);
      expect(after.body).toEqual(project);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ DELETE /api/projects/:id */

test.describe('A02 DELETE /api/projects/:id (#27, BE:projects/router.py:79-84, service.py:312-332)', () => {
  test('A02 · DELETE → 200 snapshot; then GET/PATCH/DELETE 404, gone from GET /projects and /project-summaries; activity "project.delete"', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'delete', cleanup, { floors: DEFAULT_FLOORS.slice(0, 1) });
      const path = `/api/projects/${String(project.id)}`;

      const deleted = await call(admin, 'delete_200', 'DELETE', path, undefined, [
        '200 body = the ProjectOut built BEFORE deleted_at is set (service.py:315-332)',
      ]);
      expect(deleted.res.status()).toBe(200);
      expect(expectProjectOut(deleted.body)).toEqual(project);

      for (const [slug, method, body] of [['get', 'GET', undefined], ['patch', 'PATCH', { name: projectName('dead') }], ['delete_again', 'DELETE', undefined]] as const) {
        const sent = await call(admin, `delete_then_${slug}_404`, method, path, body, [
          '404 NOT_FOUND resource "project": soft-deleted rows fail require_project (access.py:62-72,82-83)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' }, true);
      }
      expect(byId(await listProjects(admin, 'delete_list'), project.id), 'not in GET /api/projects').toBeUndefined();
      expect(byId(await allSummaries(admin, 'delete_summaries'), project.id), 'not in N1').toBeUndefined();

      const malformed = await call(admin, 'delete_404_malformed_id', 'DELETE', '/api/projects/not-a-project', undefined, ['404 NOT_FOUND resource "project"']);
      expectError(malformed, 404, 'NOT_FOUND', { resource: 'project' }, true);

      const rows = await activityOf(admin, creatorId(project), String(project.id), 'delete_activity');
      expect(rows.map((r) => [r.kind, r.objectLabel])).toEqual([['project.delete', project.name], ['project.create', project.name]]);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ GET /api/project-summaries */

test.describe('A02 GET /api/project-summaries (N1, BE:projects/router.py:32,38,87-92, core/pagination.py)', () => {
  test('A02 · N1: limit 1..500 (0, 501, "abc" → 422 field limit), id ASC cursor paging, forged cursor → 422 CURSOR_INVALID, empty-project rollup', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const a = await newProject(admin, 'sum-a', cleanup);
      const b = await newProject(admin, 'sum-b', cleanup);

      for (const [slug, limit] of [['0', '0'], ['501', '501'], ['abc', 'abc']] as const) {
        const sent = await call(admin, `summaries_422_limit_${slug}`, 'GET', `/api/project-summaries?limit=${limit}`, undefined, [
          '422 VALIDATION field "limit": Query(ge=1, le=500) (pagination.py:56-61; router.py:32)',
        ]);
        expectError(sent, 422, 'VALIDATION', { field: 'limit' }, true);
      }
      const max = await call(admin, 'summaries_200_limit_500', 'GET', '/api/project-summaries?limit=500', undefined, ['200 at the 500 ceiling']);
      expect(max.res.status()).toBe(200);
      const fallback = await call(admin, 'summaries_200_default_limit', 'GET', '/api/project-summaries', undefined, ['200 with at most 50 items (DEFAULT_LIMIT, pagination.py:26,58)']);
      expect(fallback.res.status()).toBe(200);
      expect(asArray(asJson(fallback.body).items).length).toBeLessThanOrEqual(50);

      const page1 = await call(admin, 'summaries_page1', 'GET', '/api/project-summaries?limit=1', undefined, [
        '200 one item + nextCursor (the admin has ≥ 2 projects: this test made two)',
      ]);
      expect(page1.res.status()).toBe(200);
      const first = asJson(page1.body);
      expect(asArray(first.items)).toHaveLength(1);
      const cursor = String(first.nextCursor);
      expect(typeof first.nextCursor).toBe('string');
      const page2 = await call(admin, 'summaries_page2', 'GET', `/api/project-summaries?limit=1&cursor=${encodeURIComponent(cursor)}`, undefined, [
        '200 next item, id greater than page 1 (id ASC, service.py:180-190)',
      ]);
      expect(page2.res.status()).toBe(200);
      const firstId = String(asJson(asArray(first.items)[0]).id);
      const secondId = String(asJson(asArray(asJson(page2.body).items)[0]).id);
      expect(secondId > firstId, `${secondId} > ${firstId}`).toBe(true);

      // Cursor = base64url(json).base64url(HMAC); any change → one answer (pagination.py:96-113).
      const [head, mac] = cursor.split('.');
      const flipped = `${head ?? ''}.${mac?.startsWith('A') ? 'B' : 'A'}${mac?.slice(1) ?? ''}`;
      for (const [slug, value] of [['garbage', 'not-a-cursor'], ['bad_mac', flipped]] as const) {
        const sent = await call(admin, `summaries_422_cursor_${slug}`, 'GET', `/api/project-summaries?cursor=${encodeURIComponent(value)}`, undefined, [
          '422 code CURSOR_INVALID (no reason given)',
        ]);
        expectError(sent, 422, 'CURSOR_INVALID', {}, true);
      }

      const all = await allSummaries(admin, 'summaries_all');
      const ids = all.map((item) => String(item.id));
      expect(ids, 'id ASC, no duplicates').toEqual([...new Set(ids)].sort());
      for (const project of [a, b]) {
        const summary = expectKeys(byId(all, project.id), SUMMARY_KEYS, SUMMARY_OPTIONAL);
        // No floor row → `_EMPTY_ROLLUP` (summaries.py:32-40): 0 floors, processing, NO defaultFloorId key (W2).
        expect(summary).toMatchObject({ name: project.name, floorCount: 0, areaM2: 0, status: 'processing', wallsReviewedCount: 0, wallsTotalCount: 0 });
        expect(summary).not.toHaveProperty('defaultFloorId');
        expect(summary.updatedAt).toBe(project.updatedAt);
        expect(asArray(summary.members).map((m) => expectKeys(m, ['id', 'name']).id)).toEqual([creatorId(project)]);
      }
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ roles and owners */

test.describe('A02 role / owner matrix (require_permission + require_project, BE:projects/access.py, access/deps.py:65-74)', () => {
  test('A02 · role/owner matrix: viewer member 403 FORBIDDEN on writes, non-members 404 NOT_FOUND (even the admin), engineer creates/edits its own (delete is admin-only, BUG-513), cursor bound to its user', async () => {
    // permissions/matrix.py:50-51 (project.create + project.settings.edit: admin, engineer; not viewer); access.py:45-86
    // (one query: live project AND member, else 404 — then the permission, else 403; K08: 404 beats 403, access.py:62-85).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const pa = await newProject(admin, 'role-admin', cleanup);
      await newProject(admin, 'role-admin2', cleanup); // guarantees a 2nd page for the cursor check
      const viewer = await sessionOf(await invite(admin, 'viewer', 'role-viewer', cleanup), 'viewer', 'role_viewer', cleanup);
      const engineer = await sessionOf(await invite(admin, 'engineer', 'role-engineer', cleanup), 'engineer', 'role_engineer', cleanup);
      await addMember(admin, pa.id, viewer.email, 'role_add_viewer');
      const paPath = `/api/projects/${String(pa.id)}`;
      const before = await call(admin, 'role_pa_before', 'GET', paPath, undefined, ['200 admin reads its project after the member add']);
      expect(before.res.status()).toBe(200);

      // Viewer: system key project.create → 403 FORBIDDEN without `resource`.
      const vCreate = await call(viewer.api, 'role_viewer_create_403', 'POST', '/api/projects', { name: projectName('role-viewer-create') }, [
        '403 code FORBIDDEN, no resource key: viewer lacks project.create (access/deps.py:39-43,65-74)',
      ]);
      if (vCreate.res.status() === 201) note(`viewer created ${String(asJson(vCreate.body).id)} (bug) — not deletable by the admin (K08)`);
      expect.soft(expectError(vCreate, 403, 'FORBIDDEN', {}, true)).not.toHaveProperty('resource');

      // Viewer member of PA: read 200, writes 403.
      const vRead = await call(viewer.api, 'role_viewer_member_get_200', 'GET', paPath, undefined, ['200: any member reads (#24, access.py require_project())']);
      expect.soft(vRead.res.status()).toBe(200);
      for (const [slug, method, body] of [['patch', 'PATCH', { name: projectName('role-viewer-rename') }], ['delete', 'DELETE', undefined]] as const) {
        const sent = await call(viewer.api, `role_viewer_member_${slug}_403`, method, paPath, body, [
          '403 FORBIDDEN: member, but viewer lacks project.settings.edit (access.py:84-85)',
        ]);
        expect.soft(expectError(sent, 403, 'FORBIDDEN', {}, true)).not.toHaveProperty('resource');
      }
      expect.soft(byId(await listProjects(viewer.api, 'role_viewer_list'), pa.id), 'viewer lists PA').toBeDefined();
      expect.soft(byId(await allSummaries(viewer.api, 'role_viewer_summaries'), pa.id), 'viewer N1 has PA').toBeDefined();

      // Engineer, NOT a member of PA: 404 everywhere (IDOR), PA absent from its lists.
      for (const [slug, method, body] of [['get', 'GET', undefined], ['patch', 'PATCH', { name: projectName('role-eng-idor') }], ['delete', 'DELETE', undefined]] as const) {
        const sent = await call(engineer.api, `role_engineer_nonmember_${slug}_404`, method, paPath, body, [
          '404 NOT_FOUND resource "project": not a member, even with the permission (K08)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' }, true);
      }
      expect.soft(byId(await listProjects(engineer.api, 'role_engineer_list'), pa.id), 'engineer does not list PA').toBeUndefined();
      expect.soft(byId(await allSummaries(engineer.api, 'role_engineer_summaries'), pa.id), 'engineer N1 lacks PA').toBeUndefined();

      // PA untouched by the refused writes.
      const after = await call(admin, 'role_pa_after', 'GET', paPath, undefined, ['200 PA unchanged after the refused viewer/engineer writes']);
      expect(after.body).toEqual(before.body);

      // Engineer creates its own project (project.create: engineer allowed).
      const peSent = await call(engineer.api, 'role_engineer_create_201', 'POST', '/api/projects', { name: projectName('role-engineer') }, [
        '201: engineer holds project.create; it is the only member, role engineer',
      ]);
      expect(peSent.res.status()).toBe(201);
      const pe = expectProjectOut(peSent.body);
      cleanup.add(adminDeleteStep(engineer.api, admin, String(pe.id))); // the admin must stay a non-member until then
      expect(asArray(pe.members).map((m) => [asJson(m).id, asJson(m).role])).toEqual([[engineer.id, 'engineer']]);
      const pePath = `/api/projects/${String(pe.id)}`;

      // The system admin is not a member of PE → 404, never 403 (K08, access.py:3-6,82-83).
      for (const [slug, method, body] of [['get', 'GET', undefined], ['patch', 'PATCH', { name: projectName('role-admin-idor') }], ['delete', 'DELETE', undefined]] as const) {
        const sent = await call(admin, `role_admin_nonmember_${slug}_404`, method, pePath, body, ['404 NOT_FOUND resource "project" even for the system admin (K08)']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' }, true);
      }

      // A cursor is signed with the caller's id (service.py:180-190, `filters={"user": sub}`): another user's → 422.
      const adminPage = await call(admin, 'role_admin_cursor', 'GET', '/api/project-summaries?limit=1', undefined, ['200 admin page 1 with nextCursor']);
      const adminCursor = String(asJson(adminPage.body).nextCursor);
      const stolen = await call(engineer.api, 'role_engineer_foreign_cursor_422', 'GET', `/api/project-summaries?limit=1&cursor=${encodeURIComponent(adminCursor)}`, undefined, [
        '422 CURSOR_INVALID: the admin\'s cursor in the engineer\'s request (filters digest differs)',
      ]);
      expectError(stolen, 422, 'CURSOR_INVALID', {}, true);

      // Engineer member edits PE (project.settings.edit) but cannot delete it: #27 needs the system role admin, as the FE
      // offers delete only to admins (BUG-513, AppBack projects/router.py:80, access.py:88-98).
      const eRename = await call(engineer.api, 'role_engineer_patch_200', 'PATCH', pePath, { name: `${String(pe.name)}-R` }, ['200 engineer renames its project']);
      expect.soft(eRename.res.status()).toBe(200);
      const eDelete = await call(engineer.api, 'role_engineer_delete_403', 'DELETE', pePath, undefined, ['403 FORBIDDEN: engineer member, not an admin (#27 admin-only)']);
      expect.soft(expectError(eDelete, 403, 'FORBIDDEN', {}, true)).not.toHaveProperty('resource');
      const kept = await call(engineer.api, 'role_engineer_get_after_delete_200', 'GET', pePath, undefined, ['200: the refused delete left PE in place']);
      expect.soft(kept.res.status()).toBe(200);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ notifications */

test.describe('A02 notifications (#19-#21, BE:notifications/router.py:25-45, service.py:53-60,162-188)', () => {
  test('A02 · notifications: member add → projectInvite for the invitee only; mark-read (own ids only, idempotent), newest first, read-all, hidden once the project is deleted', async () => {
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const p1 = await newProject(admin, 'notif-p1', cleanup);
      const p2 = await newProject(admin, 'notif-p2', cleanup);
      const user = await sessionOf(await invite(admin, 'viewer', 'notif', cleanup), 'viewer', 'notif', cleanup);

      // N3 → ProjectInviteNotifier inside the same transaction (notifications/invite_sinks.py:20-50).
      await addMember(admin, p1.id, user.email, 'notif_add_p1');
      const first = await inbox(user.api, 'notif_list_after_add', '200: exactly one projectInvite, unread, keys of NotificationOut only (no userId/dedupeKey/streamId)');
      expect(first).toHaveLength(1);
      const n1 = first[0]!;
      expect(String(n1.id)).toMatch(NOTIFICATION_ID);
      expect(n1).toMatchObject({
        kind: 'projectInvite',
        place: 'projectSettings', // packages/db/models/notifications.py:31
        projectId: p1.id,
        projectName: p1.name,
        objectLabel: p1.name,
        isRead: false,
      });
      expect(n1).not.toHaveProperty('floorId');
      expect(n1).not.toHaveProperty('excerpt');
      expect(String(n1.message)).toMatch(/^(.+ đã thêm bạn vào dự án|Bạn vừa được thêm vào dự án)$/u); // messages.py:25-28 (A6 capital, AppBack bf83f815)
      expect(isTime(n1.createdAt)).toBe(true);

      // IDOR: the admin neither sees nor marks the invitee's row (`user_id` in every WHERE, service.py:162-179).
      const adminItems = await inbox(admin, 'notif_admin_list', '200 admin inbox: never contains the invitee\'s notification');
      expect(byId(adminItems, n1.id)).toBeUndefined();
      await expectNoContent(await call(admin, 'notif_admin_mark_foreign_204', 'POST', '/api/notifications/read', { ids: [n1.id] }, [
        '204: an id that is not the caller\'s is silently ignored (router.py:36)',
      ]));
      expect(byId(await inbox(user.api, 'notif_list_after_foreign_mark', '200: still unread after the admin\'s attempt'), n1.id)?.isRead).toBe(false);

      // Own mark-read, then the same call again (idempotent).
      for (const slug of ['notif_mark_read_204', 'notif_mark_read_again_204']) {
        await expectNoContent(await call(user.api, slug, 'POST', '/api/notifications/read', { ids: [n1.id] }, ['204 empty body; isRead true afterwards']));
      }
      expect(byId(await inbox(user.api, 'notif_list_after_mark', '200: isRead true'), n1.id)?.isRead).toBe(true);

      // Second invite → newest first (created_at DESC, id DESC, service.py:162-170).
      await addMember(admin, p2.id, user.email, 'notif_add_p2');
      const two = await inbox(user.api, 'notif_list_two', '200: two rows, the newer (p2) first, it is unread');
      expect(two.map((n) => n.projectId)).toEqual([p2.id, p1.id]);
      expect(two[0]?.isRead).toBe(false);

      await expectNoContent(await call(user.api, 'notif_read_all_204', 'POST', '/api/notifications/read-all', {}, [
        '204: every unread row of the caller becomes read (service.py:182-188)',
      ]));
      const allRead = await inbox(user.api, 'notif_list_after_read_all', '200: every row isRead true');
      expect(allRead.map((n) => n.isRead)).toEqual([true, true]);

      // visible_to_owner: project not soft-deleted AND still a member (service.py:53-60).
      const deleted = await call(admin, 'notif_delete_p1', 'DELETE', `/api/projects/${String(p1.id)}`, undefined, ['200 admin deletes p1']);
      expect(deleted.res.status()).toBe(200);
      const left = await inbox(user.api, 'notif_list_after_delete', '200: the p1 notification is hidden, p2 stays');
      expect(left.map((n) => n.projectId)).toEqual([p2.id]);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · notification write bodies: ids rules → 422 field ids, extra key → 422 field, 200 unknown ids → 204 no-op, read-all with a key → 422', async () => {
    // schemas.py:34-57: ids = array of 1..200 (NOTIFICATIONS_MARK_MAX, settings.py:9,18) strings of 1..64; every
    // violation reported as field "ids"; NotificationEmptyBody accepts only `{}` (WireRequest extra="forbid").
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const id64 = (i: number): string => `${PREFIX}${String(i)}-`.padEnd(64, 'x');
      const cases: ReadonlyArray<readonly [string, unknown, string]> = [
        ['ids_missing', {}, 'ids'],
        ['ids_empty', { ids: [] }, 'ids'],
        ['ids_string', { ids: 'ntf_x' }, 'ids'],
        ['ids_number_item', { ids: [1] }, 'ids'],
        ['ids_empty_item', { ids: [''] }, 'ids'],
        ['ids_65_chars', { ids: [`${id64(0)}x`] }, 'ids'],
        ['ids_201', { ids: Array.from({ length: 201 }, (_, i) => id64(i)) }, 'ids'],
        ['extra_key', { ids: [id64(0)], foo: 1 }, 'foo'],
      ];
      for (const [slug, body, field] of cases) {
        const sent = await call(admin, `notif_read_422_${slug}`, 'POST', '/api/notifications/read', body, [`422 VALIDATION field "${field}"`]);
        expectError(sent, 422, 'VALIDATION', { field }, true);
      }

      // Boundary accepted: 200 ids of 64 chars that match no row → 204 and nothing changes (UPDATE … WHERE user_id).
      await expectNoContent(await call(admin, 'notif_read_204_200_unknown_ids', 'POST', '/api/notifications/read', {
        ids: Array.from({ length: 200 }, (_, i) => id64(i)),
      }, ['204: 200 ids × 64 chars accepted; none is the admin\'s, so no row changes']));

      const readAll = await call(admin, 'notif_read_all_422_extra_key', 'POST', '/api/notifications/read-all', { foo: 1 }, [
        '422 VALIDATION field "foo": read-all takes only {} (schemas.py:56-57) — nothing marked',
      ]);
      expectError(readAll, 422, 'VALIDATION', { field: 'foo' }, true);
    } finally {
      await cleanup.run();
    }
  });
});

/* ================================================================== gap tests (pass 2, BE @ e2fc4d42) */

/* ------------------------------------------------------------------ GET /api/projects order */

test.describe('A02 GET /api/projects order and cap (#23, BE:projects/service.py:159-171, settings.py:22)', () => {
  test('A02 · #23 order: updated_at DESC — the newest create first, a rename moves a project above the later ones; never more than PROJECTS_LIST_MAX 500 rows', async () => {
    // service.py:165-169: `ORDER BY updated_at DESC, id DESC LIMIT projects_list_max` (settings.py:22 → 500).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const a = await newProject(admin, 'order-a', cleanup);
      const b = await newProject(admin, 'order-b', cleanup);
      const c = await newProject(admin, 'order-c', cleanup);
      const rank = (list: readonly Json[], p: Json): number => list.findIndex((item) => item.id === p.id);

      const initial = await listProjects(admin, 'order_list_initial');
      expect(rank(initial, c), 'C (newest) before B').toBeLessThan(rank(initial, b));
      expect(rank(initial, b), 'B before A').toBeLessThan(rank(initial, a));
      expect(rank(initial, a)).toBeGreaterThanOrEqual(0);
      expect(initial.length, 'cap PROJECTS_LIST_MAX').toBeLessThanOrEqual(500);
      expectUpdatedDesc(initial);

      // touch_project on a real change (service.py:272-287, summaries.py:177-179) → A is now the newest.
      const renamed = await call(admin, 'order_rename_a', 'PATCH', `/api/projects/${String(a.id)}`, { name: `${String(a.name)}-R` }, [
        '200: the rename pushes A.updatedAt past C and B',
      ]);
      expect(renamed.res.status()).toBe(200);
      const after = await listProjects(admin, 'order_list_after_rename');
      expect(rank(after, a), 'A before C').toBeLessThan(rank(after, c));
      expect(rank(after, c), 'C still before B').toBeLessThan(rank(after, b));
      expect(after.length).toBeLessThanOrEqual(500);
      expectUpdatedDesc(after);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ POST /api/projects text and floors */

test.describe('A02 POST /api/projects text, code and floors rules (#25, BE:projects/schemas.py, floors/view_parts.py)', () => {
  test('A02 · name/code/address text: length counts code points after NFC (80 NFD "é", 80 astral emoji accepted; 81 refused), U+200B, inner spaces and case kept; tab, newline, U+2067 → 422 name; RLO code, LRM address, NBSP-only address → 422 field', async () => {
    // schemas.py:31-39 clean_text (trim → NFC → Cc/bidi incl. LRM/RLM) runs BEFORE StringConstraints (:51-53);
    // packages/core/text.py:6-9 blocked = U+202A-202E, U+2066-2069 (+ U+200E/200F with bidi_marks), :22-31 + Cc;
    // other Cf (U+200B) passes. Python `str.strip()` also strips U+00A0. Python `len` counts code points.
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const base = projectName('uni');
      const accepted: ReadonlyArray<{ readonly slug: string; readonly body: Json; readonly expect: Json }> = [
        {
          slug: 'nfd_80',
          body: { name: `${base}${'é'.repeat(80 - base.length)}` },
          expect: { name: `${base}${'é'.repeat(80 - base.length)}` },
        },
        {
          slug: 'astral_80',
          body: { name: `${base}${'\u{1F3E0}'.repeat(80 - base.length)}` },
          expect: { name: `${base}${'\u{1F3E0}'.repeat(80 - base.length)}` },
        },
        {
          slug: 'zwsp_spaces_case',
          body: { name: `${base}-a​b  c-MiXeD`, code: 'Ab-Cd', address: ` ${PREFIX}addr ` },
          expect: { name: `${base}-a​b  c-MiXeD`, code: 'Ab-Cd', address: `${PREFIX}addr` },
        },
      ];
      for (const c of accepted) {
        const sent = await call(admin, `text_201_${c.slug}`, 'POST', '/api/projects', c.body, [
          `201: stored as ${JSON.stringify(c.expect)} (trim + NFC, no case folding, Cf other than bidi kept)`,
        ]);
        expect.soft(sent.res.status(), c.slug).toBe(201);
        if (sent.res.status() !== 201) continue;
        const project = expectProjectOut(sent.body);
        cleanup.add(deleteProjectStep(admin, String(project.id)));
        expect.soft(project, c.slug).toMatchObject(c.expect);
      }
      expect([...String(accepted[1]?.expect.name)].length, 'astral name = 80 code points').toBe(80);
      expect(String(accepted[1]?.expect.name).length, 'but more than 80 UTF-16 units').toBeGreaterThan(80);

      const rejected: ReadonlyArray<readonly [string, Json, string]> = [
        ['astral_81', { name: `${base}${'\u{1F3E0}'.repeat(81 - base.length)}` }, 'name'],
        ['tab', { name: `${base}\tx` }, 'name'],
        ['newline', { name: `${base}\nx` }, 'name'],
        ['rli_2067', { name: `${base}⁧x` }, 'name'],
        ['code_rlo', { name: `${base}-code`, code: 'QA‮01' }, 'code'],
        ['address_lrm', { name: `${base}-addr`, address: `addr‎` }, 'address'],
        ['address_nbsp_only', { name: `${base}-nbsp`, address: '  ' }, 'address'],
      ];
      for (const [slug, body, field] of rejected) {
        const sent = await call(admin, `text_422_${slug}`, 'POST', '/api/projects', body, [`422 VALIDATION field "${field}"`]);
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
        expectError(sent, 422, 'VALIDATION', { field }, true);
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · code is not unique: the same code twice for one owner → 201 + 201, a case variant → 201, PATCH a code onto another project\'s code → 200', async () => {
    // packages/db/models/projects.py:39-41: name/code/address are plain Text columns, no unique index; no 409 in
    // projects/ (service.py:243-244). Codes keep their case (no casefold in schemas.py:31-39).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const code = `QA-${uniq().toUpperCase()}`.slice(0, 32);
      const one = await newProject(admin, 'code-1', cleanup, { code });
      const two = await newProject(admin, 'code-2', cleanup, { code });
      const lower = await newProject(admin, 'code-3', cleanup, { code: code.toLowerCase() });
      expect([one.code, two.code, lower.code]).toEqual([code, code, code.toLowerCase()]);
      expect(one.id).not.toBe(two.id);

      const patched = await call(admin, 'code_patch_to_taken', 'PATCH', `/api/projects/${String(lower.id)}`, { code }, [
        '200: a code already used by two other projects is accepted (case-sensitive compare service.py:263-269 → a write)',
      ]);
      expect(patched.res.status()).toBe(200);
      expect(asJson(patched.body).code).toBe(code);
      const listed = (await listProjects(admin, 'code_list')).filter((p) => p.code === code).map((p) => p.id);
      expect(new Set(listed)).toEqual(new Set([one.id, two.id, lower.id]));
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · floors bounds: 50 floors, duplicate orders, 120-char name, [] and echoed id/drawings/areaM2 accepted; order −1, elevation ±limit+1, height 10001 / 2500.5 / missing, name 121 / RLO, 2nd floor, extra key → 422 floors.<i>.<key>; nothing left behind', async () => {
    // Pydantic FloorDraftIn (projects/schemas.py:57-66 — int fields, extra="forbid", W18 id/drawings/areaM2 JsonValue)
    // then the hook (floors/view_parts.py:45-55,58-83: clean_name 1-120 floors/schemas.py:16,26-33; clean_mm ranges
    // :17-22,36-47; > FLOORS_MAX 50 settings.py:18 → field "floors"). No unique (project, order): models/floors.py:37-56.
    // `floors: []` skips the hook (projects/service.py:233-235). Hook errors roll #25 back (service.py:9-11).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const floor = { name: 'Tầng 1', order: 1, elevationMm: 0, heightMm: 3000 };
      const valid = (slug: string): string => projectName(`floors-${slug}`);
      const rejected: ReadonlyArray<readonly [string, unknown, string]> = [
        ['order_minus_1', [{ ...floor, order: -1 }], 'floors.0.order'],
        ['elevation_minus_30001', [{ ...floor, elevationMm: -30_001 }], 'floors.0.elevationMm'],
        ['elevation_300001', [{ ...floor, elevationMm: 300_001 }], 'floors.0.elevationMm'],
        ['height_10001', [{ ...floor, heightMm: 10_001 }], 'floors.0.heightMm'],
        ['height_fraction', [{ ...floor, heightMm: 2500.5 }], 'floors.0.heightMm'],
        ['height_missing', [{ name: floor.name, order: 1, elevationMm: 0 }], 'floors.0.heightMm'],
        ['name_121', [{ ...floor, name: 'T'.repeat(121) }], 'floors.0.name'],
        ['name_rlo', [{ ...floor, name: 'Tầng‮1' }], 'floors.0.name'],
        ['second_floor', [floor, { ...floor, name: 'Tầng 2', order: 2, heightMm: 1999 }], 'floors.1.heightMm'],
        ['extra_key', [{ ...floor, foo: 1 }], 'floors.0.foo'],
        ['not_array', 'x', 'floors'],
      ];
      const names: string[] = [];
      for (const [slug, floors, field] of rejected) {
        const name = valid(slug);
        names.push(name);
        const sent = await call(admin, `floors_422_${slug}`, 'POST', '/api/projects', { name, floors }, [`422 VALIDATION field "${field}"`]);
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
        expectError(sent, 422, 'VALIDATION', { field }, true);
      }
      const listed = new Set((await listProjects(admin, 'floors_422_rollback_list')).map((p) => p.name));
      for (const name of names) expect.soft(listed.has(name), `${name} not created`).toBe(false);

      const fifty = Array.from({ length: 50 }, (_, i) => ({ name: `T${String(i)}`, order: i, elevationMm: i * 3000, heightMm: 3000 }));
      const cap = await newProject(admin, 'floors-50', cleanup, { floors: fifty });
      expect(asArray(cap.floors), 'FLOORS_MAX 50 accepted').toHaveLength(50);

      const dup = await newProject(admin, 'floors-dup', cleanup, {
        floors: [{ ...floor, name: 'A' }, { ...floor, name: 'B', elevationMm: 3000 }],
      });
      const dupFloors = asArray(dup.floors).map((f) => asJson(f));
      expect(dupFloors.map((f) => f.order), 'both floors keep order 1').toEqual([1, 1]);
      expect(dupFloors.map((f) => f.name).sort()).toEqual(['A', 'B']);

      const long = await newProject(admin, 'floors-120', cleanup, { floors: [{ ...floor, name: 'N'.repeat(120) }] });
      expect(asJson(asArray(long.floors)[0]).name).toBe('N'.repeat(120));

      const empty = await newProject(admin, 'floors-empty', cleanup, { floors: [] });
      expect(empty.floors).toEqual([]);
      expect(empty.status).toBe('draft');

      const echo = await newProject(admin, 'floors-echo', cleanup, {
        floors: [{ ...floor, id: 'L-QAECHO0000000000', drawings: [{ id: 'x' }], areaM2: 12.5 }],
      });
      const echoed = asJson(asArray(echo.floors)[0]);
      expect(String(echoed.id), 'server-made id, the sent one ignored').toMatch(FLOOR_ID);
      expect(echoed.id).not.toBe('L-QAECHO0000000000');
      expect(echoed.drawings).toEqual([]);
      expect(echoed).not.toHaveProperty('areaM2');
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ PATCH field by field */

test.describe('A02 PATCH /api/projects/:id field by field (#26, BE:projects/service.py:263-309)', () => {
  test('A02 · PATCH one field at a time: name / code / address each change alone; case change is a write, padded same name is not; max lengths at the edge; 81 / 33 / 201 / blank and projectId (even = path) → 422 field', async () => {
    // service.py:56,263-269: only fields sent AND different (case-sensitive `!=`) are written; one activity row per
    // writing PATCH labelled with the current name (:285). schemas.py:25-28,51-53 bounds after trim.
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'fields', cleanup, { code: 'QA-F0', address: `${PREFIX}addr-0` });
      const path = `/api/projects/${String(project.id)}`;
      let current = project;
      const pick = (p: Json): Json => ({ name: p.name, code: p.code, address: p.address });
      const patch = async (slug: string, body: Json, expected: Json, writes: boolean): Promise<void> => {
        const sent = await call(admin, `fields_${slug}`, 'PATCH', path, body, [
          `200: ${JSON.stringify(expected)}; ${writes ? 'a write: updatedAt pushed, one activity row' : 'no write: updatedAt unchanged'}`,
        ]);
        expect(sent.res.status(), slug).toBe(200);
        const out = expectProjectOut(sent.body);
        expect(out, slug).toMatchObject({ ...pick(current), ...expected });
        if (writes) expect(Date.parse(String(out.updatedAt)), `${slug}: updatedAt pushed`).toBeGreaterThan(Date.parse(String(current.updatedAt)));
        else expect(out.updatedAt, `${slug}: updatedAt kept`).toBe(current.updatedAt);
        current = out;
      };
      const name1 = `${String(project.name)}-n1`;

      await patch('name_only', { name: name1 }, { name: name1 }, true);
      await patch('code_only', { code: 'QA-F1' }, { code: 'QA-F1' }, true);
      await patch('address_only', { address: `${PREFIX}addr-1` }, { address: `${PREFIX}addr-1` }, true);
      await patch('name_case_lower', { name: `${name1}-case` }, { name: `${name1}-case` }, true);
      await patch('name_case_upper', { name: `${name1}-CASE` }, { name: `${name1}-CASE` }, true);
      await patch('name_padded_same', { name: `   ${name1}-CASE  ` }, {}, false);
      const name80 = nameOfLength(80);
      await patch('max_lengths', { name: name80, code: 'C'.repeat(32), address: 'A'.repeat(200) }, { name: name80, code: 'C'.repeat(32), address: 'A'.repeat(200) }, true);

      for (const [slug, body, field] of [
        ['name_81', { name: nameOfLength(81) }, 'name'],
        ['code_33', { code: 'C'.repeat(33) }, 'code'],
        ['address_201', { address: 'A'.repeat(201) }, 'address'],
        ['address_blank', { address: '   ' }, 'address'],
        // W21 guard passes when projectId = path (routing.py:138-151), then ProjectUpdateIn has no such key (extra="forbid").
        ['project_id_equal_path', { projectId: String(project.id), code: 'QA-F2' }, 'projectId'],
      ] as const) {
        const sent = await call(admin, `fields_422_${slug}`, 'PATCH', path, body, [`422 VALIDATION field "${field}"; nothing written`]);
        expectError(sent, 422, 'VALIDATION', { field }, true);
      }
      const final = await readProject(admin, project.id, 'fields_read_back', '200: the last accepted PATCH is the state; the 422s wrote nothing');
      expect(final).toEqual(current);

      const rows = await activityOf(admin, creatorId(project), String(project.id), 'fields_activity');
      expect(rows.map((r) => r.kind)).toEqual([...Array.from({ length: 6 }, () => 'project.update'), 'project.create']);
      expect(rows[0]?.objectLabel, 'label = the name after the write').toBe(name80);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ idempotency edges */

test.describe('A02 Idempotency-Key edges (BE:core/routing.py:166-187,227-232,333-371; core/idempotency.py)', () => {
  test('A02 · key format 8..128 [A-Za-z0-9_-] (7, 129, "." → 422 idempotencyKey); a 422 body does not burn the key; same key on PATCH is its own claim; the PATCH key on another project → 422 IDEMPOTENCY_KEY_REUSED; PATCH replay writes once', async () => {
    // KEY_PATTERN packages/db/models/idempotency.py:35; check_key idempotency.py:79-83. Claim scope = (user, method,
    // route template, key) idempotency.py:166-168; digest = method + REAL path + query + body :86-101. The guard runs
    // after the permission dependencies and before the Pydantic 422 (routing.py:3-14); a raised error → `_abort`
    // deletes the in-progress claim (routing.py:276-278,333-351, idempotency.py:265-280).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    const fresh = (length: number): string => `${uniq()}${uniq()}${uniq()}${'k'.repeat(128)}`.slice(0, length);
    try {
      const names: string[] = [];
      for (const [slug, key] of [['7_chars', fresh(7)], ['129_chars', fresh(129)], ['dot', `qa.${fresh(10)}`]] as const) {
        const name = projectName(`idem-${slug}`);
        names.push(name);
        const sent = await call(admin, `idem_key_422_${slug}`, 'POST', '/api/projects', { name }, [
          '422 VALIDATION field "idempotencyKey" (fail-closed, nothing created)',
        ], { 'Idempotency-Key': key });
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
        expectError(sent, 422, 'VALIDATION', { field: 'idempotencyKey' }, true);
      }
      for (const [slug, length] of [['8_chars', 8], ['128_chars', 128]] as const) {
        const sent = await call(admin, `idem_key_201_${slug}`, 'POST', '/api/projects', { name: projectName(`idem-${slug}`) }, [
          `201: a ${String(length)}-character key is inside the pattern`,
        ], { 'Idempotency-Key': fresh(length) });
        expect.soft(sent.res.status(), slug).toBe(201);
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(sent.body).id)));
      }

      // A 422 VALIDATION run discards its claim → the same key with a fixed body runs for real.
      const key = fresh(40);
      const badName = await call(admin, 'idem_422_then', 'POST', '/api/projects', { name: 'ab' }, [
        '422 VALIDATION field "name" with the key (claim discarded by _abort)',
      ], { 'Idempotency-Key': key });
      expectError(badName, 422, 'VALIDATION', { field: 'name' }, true);
      const fixedName = projectName('idem-fixed');
      const fixed = await call(admin, 'idem_422_then_201', 'POST', '/api/projects', { name: fixedName }, [
        '201 with the SAME key: the failed run did not store anything for it',
      ], { 'Idempotency-Key': key });
      expect(fixed.res.status()).toBe(201);
      const p1 = expectProjectOut(fixed.body);
      cleanup.add(deleteProjectStep(admin, String(p1.id)));
      const p2 = await newProject(admin, 'idem-p2', cleanup);

      // Same key on PATCH (other method + route template) → a separate claim → runs.
      const rename = { name: `${fixedName}-R` };
      const patched = await call(admin, 'idem_patch_same_key', 'PATCH', `/api/projects/${String(p1.id)}`, rename, [
        '200: the POST key reused on PATCH is a different claim (method/route in the unique scope)',
      ], { 'Idempotency-Key': key });
      expect(patched.res.status()).toBe(200);
      const replay = await call(admin, 'idem_patch_replay', 'PATCH', `/api/projects/${String(p1.id)}`, rename, [
        '200 replay: the stored response, handler not run (no 2nd activity row)',
      ], { 'Idempotency-Key': key });
      expect(replay.res.status()).toBe(200);
      expect(replay.body).toEqual(patched.body);
      const other = await call(admin, 'idem_patch_other_project', 'PATCH', `/api/projects/${String(p2.id)}`, rename, [
        '422 IDEMPOTENCY_KEY_REUSED: same key + same body but another project path → other digest',
      ], { 'Idempotency-Key': key });
      expectError(other, 422, 'IDEMPOTENCY_KEY_REUSED', {}, true);
      expect((await readProject(admin, p2.id, 'idem_p2_read_back', '200: P2 not renamed')).name).toBe(p2.name);

      const rows = await activityOf(admin, creatorId(p1), String(p1.id), 'idem_activity');
      expect(rows.map((r) => r.kind), 'one update for PATCH + replay').toEqual(['project.update', 'project.create']);
      const listed = new Set((await listProjects(admin, 'idem_edges_list')).map((p) => p.name));
      for (const name of names) expect.soft(listed.has(name), `${name} not created`).toBe(false);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · DELETE twice with the same Idempotency-Key: the 2nd DELETE is 404 (the membership gate runs before the replay lookup), not the stored 200; the key on another live project → 422 IDEMPOTENCY_KEY_REUSED; one "project.delete" row', async () => {
    // DELETE is a write on a protected route → idempotency "auto" (routing.py:54,227-232), but the guard is appended
    // AFTER the route dependencies (routing.py:9-12,233-236): require_project("project.settings.edit") on a
    // soft-deleted project raises 404 first (access.py:62-72,82-83), so the stored 200 is never replayed. For a live
    // project the guard runs: other path → other digest → 422 (idempotency.py:86-101,225-231).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'del-idem', cleanup);
      const other = await newProject(admin, 'del-idem-other', cleanup);
      const path = `/api/projects/${String(project.id)}`;
      const key = `qa-del-${uniq()}${uniq()}`;
      const first = await call(admin, 'del_idem_first', 'DELETE', path, undefined, ['200 snapshot'], { 'Idempotency-Key': key });
      expect(first.res.status()).toBe(200);
      expect(first.body).toEqual(project);
      const again = await call(admin, 'del_idem_same_key_404', 'DELETE', path, undefined, [
        '404 NOT_FOUND resource "project": the gate refuses the deleted project before the key is looked up (FE: 404 = already done)',
      ], { 'Idempotency-Key': key });
      expectError(again, 404, 'NOT_FOUND', { resource: 'project' }, true);
      const reused = await call(admin, 'del_idem_other_project_422', 'DELETE', `/api/projects/${String(other.id)}`, undefined, [
        '422 IDEMPOTENCY_KEY_REUSED: the key is stored for another path; the other project survives',
      ], { 'Idempotency-Key': key });
      expectError(reused, 422, 'IDEMPOTENCY_KEY_REUSED', {}, true);
      await readProject(admin, other.id, 'del_idem_other_alive', '200: the other project is still live');

      const rows = await activityOf(admin, creatorId(project), String(project.id), 'del_idem_activity');
      expect(rows.map((r) => r.kind)).toEqual(['project.delete', 'project.create']);
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ transport rules */

test.describe('A02 transport rules (body limit, Origin, headers; BE:core/middleware.py, core/origin.py)', () => {
  test('A02 · body ceiling 1 MiB: exactly 1 048 576 bytes reaches the route (anonymous → 401), 1 byte more → 413 PAYLOAD_TOO_LARGE before authentication, on #25 and #20', async () => {
    // middleware.py:217-237: `Content-Length > limit` → simple_error(PAYLOAD_TOO_LARGE) before any route code
    // (errors.py:102-104 W7 body); limit = route body_limit = DEFAULT_BODY_LIMIT (routing.py:46,64). nginx allows 8m
    // (deploy/nginx/snippets/app_locations.conf:3). No login: the 413 needs none.
    const anon = await newApiContext();
    try {
      for (const path of ['/api/projects', '/api/notifications/read']) {
        const slug = path.replace(/[^a-z]+/gu, '_');
        for (const size of [BODY_LIMIT, BODY_LIMIT + 1]) {
          const head = path === '/api/projects' ? '{"name":"' : '{"ids":["';
          const tail = path === '/api/projects' ? '"}' : '"]}';
          const raw = `${head}${'x'.repeat(size - head.length - tail.length)}${tail}`;
          expect(Buffer.byteLength(raw)).toBe(size);
          const res = await anon.fetch(path, { method: 'POST', data: Buffer.from(raw), headers: { 'Content-Type': 'application/json' } });
          const over = size > BODY_LIMIT;
          const body = await captureExchange(`A02_body_limit${slug}${String(size)}.json`, {
            method: 'POST', path, body: `<${String(size)} bytes of JSON>`,
          }, res, [
            over ? '413 code PAYLOAD_TOO_LARGE (W7 {code, requestId}) before the 401 check' : '401 UNAUTHENTICATED: at the limit the body passes the ceiling, then auth fails',
          ]);
          if (over) expectError({ res, body }, 413, 'PAYLOAD_TOO_LARGE', {}, true);
          else expectError({ res, body }, 401, 'UNAUTHENTICATED', {}, true);
          expectHardenedHeaders(res, `${path} ${String(size)}`);
        }
      }
    } finally {
      await anon.dispose();
    }
  });

  test('A02 · Bearer writes ignore Origin (no CSRF surface): no Origin / foreign Origin on POST, PATCH, DELETE → 201/200/200; the refresh cookie alone is no credential → 401 on read and write', async () => {
    // core/origin.py:1-10,53-61: `require_origin` is only on cookie routes (/api/auth/*); protected routes read ONLY
    // `Authorization: Bearer` (routing.py:129-135) — a browser-attached cookie cannot authenticate them.
    const { email, password } = readAdminCredentials();
    const anon = await newApiContext();
    const base = apiBaseUrl();
    let token = '';
    let cookie = '';
    try {
      const login = await anon.post('/api/auth/login', { data: { email, password, rememberMe: false } });
      expect(login.status(), 'setup: admin login').toBe(204);
      const refreshed = await anon.post('/api/auth/refresh');
      await captureExchange('A02_origin_setup_refresh.json', { method: 'POST', path: '/api/auth/refresh' }, refreshed, [
        'setup: 200 W16 with a Bearer (redacted) + rotated refresh cookie',
      ]);
      expect(refreshed.status()).toBe(200);
      token = String(((await refreshed.json()) as Json).accessToken);
      const line = refreshed.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${REFRESH}=`));
      cookie = line?.value.slice(REFRESH.length + 1).split(';')[0] ?? '';
      expect(cookie, 'setup: rotated refresh cookie').not.toBe('');
    } finally {
      await anon.dispose();
    }
    const bearer = await request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `Bearer ${token}` } }); // NO Origin
    const bare = await request.newContext({ baseURL: base });
    const cleanup = new Cleanup();
    cleanup.add(() => Promise.all([bearer.dispose(), bare.dispose()]));
    try {
      const created = await call(bearer, 'origin_none_create_201', 'POST', '/api/projects', { name: projectName('origin') }, [
        '201 without any Origin header (Bearer route, no require_origin)',
      ]);
      expect(created.res.status()).toBe(201);
      const project = expectProjectOut(created.body);
      cleanup.add(deleteProjectStep(bearer, String(project.id)));
      const path = `/api/projects/${String(project.id)}`;
      const patched = await call(bearer, 'origin_foreign_patch_200', 'PATCH', path, { name: `${String(project.name)}-R` }, [
        `200 with Origin ${FOREIGN_ORIGIN}`,
      ], { Origin: FOREIGN_ORIGIN });
      expect(patched.res.status()).toBe(200);
      const read = await call(bearer, 'origin_foreign_read_200', 'POST', '/api/notifications/read', { ids: [MISSING_NOTIFICATION] }, [
        `204 with Origin ${FOREIGN_ORIGIN} (an id that is nobody's: no row changes)`,
      ], { Origin: FOREIGN_ORIGIN });
      await expectNoContent(read);

      for (const [slug, method, target, data] of [
        ['get_projects', 'GET', '/api/projects', undefined],
        ['create', 'POST', '/api/projects', { name: projectName('cookie-only') }],
        ['patch', 'PATCH', path, { name: projectName('cookie-only') }],
      ] as const) {
        const sent = await call(bare, `origin_cookie_only_${slug}_401`, method, target, data, [
          '401 UNAUTHENTICATED: same Origin + the refresh cookie but no Bearer (routing.py:129-133)',
        ], { Origin: base, Cookie: `${REFRESH}=${cookie}` });
        if (sent.res.status() === 201) cleanup.add(deleteProjectStep(bearer, String(asJson(sent.body).id)));
        expectError(sent, 401, 'UNAUTHENTICATED', {}, true);
      }
      expect((await readProject(bearer, project.id, 'origin_read_back', '200: the cookie-only PATCH changed nothing')).name).toBe(`${String(project.name)}-R`);

      const deleted = await call(bearer, 'origin_foreign_delete_200', 'DELETE', path, undefined, [`200 with Origin ${FOREIGN_ORIGIN}`], { Origin: FOREIGN_ORIGIN });
      expect(deleted.res.status()).toBe(200);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · response headers and body parsing: nosniff / DENY / same-origin / no-store on 200, 201, 422; no ETag and no rate-limit headers; If-Match / If-None-Match ignored (last-write-wins); truncated JSON → 400 MALFORMED_JSON; array body → 422 VALIDATION without field', async () => {
    // middleware.py:48-53,178-199 (headers); no ETag / If-Match handling anywhere in apps/ or packages/ (grep), #26 is
    // "last-write-wins" (projects/router.py:75); projects/notifications have no `rate_limit(` dependency and
    // ratelimit.py:92-94 only sets Retry-After on 429. core/errors.py:169-175 (json_invalid → 400 MALFORMED_JSON),
    // :136-157,176-178 (loc ("body",) → no `field`).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    const noLimitHeaders = (res: APIResponse, what: string): void => {
      const names = Object.keys(res.headers());
      expect.soft(names.filter((n) => /ratelimit|retry-after/iu.test(n)), `${what}: no rate-limit headers`).toEqual([]);
      expect.soft(res.headers().etag, `${what}: no ETag`).toBeUndefined();
    };
    try {
      const list = await call(admin, 'headers_list_200', 'GET', '/api/projects', undefined, ['200 with the hardened headers, no ETag']);
      expect(list.res.status()).toBe(200);
      expectHardenedHeaders(list.res, 'GET /api/projects');
      noLimitHeaders(list.res, 'GET /api/projects');

      const created = await call(admin, 'headers_create_201', 'POST', '/api/projects', { name: projectName('headers') }, ['201 with the hardened headers']);
      expect(created.res.status()).toBe(201);
      const project = expectProjectOut(created.body);
      cleanup.add(deleteProjectStep(admin, String(project.id)));
      expectHardenedHeaders(created.res, 'POST /api/projects');
      noLimitHeaders(created.res, 'POST /api/projects');

      const path = `/api/projects/${String(project.id)}`;
      const stale = await call(admin, 'headers_if_match_stale_200', 'PATCH', path, { name: `${String(project.name)}-A` }, [
        '200 applied: a stale If-Match is not checked (no 412/428)',
      ], { 'If-Match': '"qa-stale-etag"' });
      expect(stale.res.status()).toBe(200);
      expect(asJson(stale.body).name).toBe(`${String(project.name)}-A`);
      const star = await call(admin, 'headers_if_none_match_200', 'PATCH', path, { name: `${String(project.name)}-B` }, [
        '200 applied: If-None-Match: * is ignored too',
      ], { 'If-None-Match': '*' });
      expect(star.res.status()).toBe(200);
      expect(asJson(star.body).name).toBe(`${String(project.name)}-B`);

      const raw = '{"name":';
      const res = await admin.fetch('/api/projects', { method: 'POST', data: Buffer.from(raw), headers: { 'Content-Type': 'application/json' } });
      const body = await captureExchange('A02_headers_malformed_json_400.json', { method: 'POST', path: '/api/projects', body: raw }, res, [
        '400 code MALFORMED_JSON with a valid Bearer (errors.py:172-173)',
      ]);
      expectError({ res, body }, 400, 'MALFORMED_JSON', {}, true);
      expectHardenedHeaders(res, '400');

      const array = await call(admin, 'headers_array_body_422', 'POST', '/api/projects', [], ['422 VALIDATION, no `field` key (root loc)']);
      if (array.res.status() === 201) cleanup.add(deleteProjectStep(admin, String(asJson(array.body).id)));
      expect.soft(expectError(array, 422, 'VALIDATION', {}, true)).not.toHaveProperty('field');
      expectHardenedHeaders(array.res, '422');
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ N1 rollups with floors */

test.describe('A02 GET /api/project-summaries rollups (N1, BE:projects/summaries.py:182-251)', () => {
  test('A02 · N1 rollup follows the floors: 3 floors → floorCount 3, defaultFloorId = lowest order; floor deleted → 2 and the next order, updatedAt pushed; all deleted → 0 and no defaultFloorId; #24 status stays "draft"', async () => {
    // summaries.py:200-251 (GROUP BY of non-hidden rows; default floor = array_agg ORDER BY reviewed_all, floor_order,
    // id → lowest order when every floor is 0/0), :32-40 (_EMPTY_ROLLUP), :182-197 (no upload → processing / draft);
    // DELETE /api/floors/{id} (#11, floors/router.py:38-42) hides the row (floors/service.py:173-184, summaries.py:96-98)
    // and touches the project. `qc`/`done`/`approved`/`error` need an upload + pipeline (Phase 3).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const drafts = [
        { name: 'Tầng 5', order: 5, elevationMm: 6000, heightMm: 3000 },
        { name: 'Tầng 2', order: 2, elevationMm: 0, heightMm: 3000 },
        { name: 'Tầng 9', order: 9, elevationMm: 9000, heightMm: 3000 },
      ];
      const project = await newProject(admin, 'rollup', cleanup, { floors: drafts });
      const idOf = (order: number): string =>
        String(asArray(project.floors).map((f) => asJson(f)).find((f) => f.order === order)?.id);
      const summaryOf = async (ev: string): Promise<Json> =>
        expectKeys(byId(await allSummaries(admin, ev), project.id), SUMMARY_KEYS, SUMMARY_OPTIONAL);

      const s3 = await summaryOf('rollup_3_floors');
      expect(s3).toMatchObject({ floorCount: 3, areaM2: 0, status: 'processing', wallsReviewedCount: 0, wallsTotalCount: 0, defaultFloorId: idOf(2) });
      expect(project.status).toBe('draft');

      let last = s3;
      for (const [step, order, expected] of [
        ['rollup_delete_order2', 2, { floorCount: 2, defaultFloorId: idOf(5) }],
        ['rollup_delete_order5', 5, { floorCount: 1, defaultFloorId: idOf(9) }],
        ['rollup_delete_order9', 9, { floorCount: 0 }],
      ] as const) {
        const del = await call(admin, step, 'DELETE', `/api/floors/${idOf(order)}`, undefined, [
          `setup: 200 FloorOut snapshot of the order-${String(order)} floor (floors/router.py:38-42)`,
        ]);
        expect(del.res.status()).toBe(200);
        expect(asJson(del.body).id).toBe(idOf(order));
        const summary = await summaryOf(`${step}_summaries`);
        expect(summary).toMatchObject({ ...expected, areaM2: 0, status: 'processing', wallsReviewedCount: 0, wallsTotalCount: 0 });
        if (expected.floorCount === 0) expect(summary, 'empty rollup: no defaultFloorId key (W2)').not.toHaveProperty('defaultFloorId');
        expect(Date.parse(String(summary.updatedAt)), `${step}: touch_project`).toBeGreaterThan(Date.parse(String(last.updatedAt)));
        const read = await readProject(admin, project.id, `${step}_read`, '200 #24: same updatedAt, floors without the deleted one, status draft');
        expect(read.updatedAt).toBe(summary.updatedAt);
        expect(read.status).toBe('draft');
        expect(asArray(read.floors)).toHaveLength(expected.floorCount);
        last = summary;
      }
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ members ↔ notifications */

test.describe('A02 member add/remove → notifications (N3/N4 + #19/#22, BE:notifications/service.py:53-60, invite_sinks.py)', () => {
  test('A02 · N3 → one projectInvite with the cleaned project name; N3 again → 200, no row; N4 → row hidden and project 404 for the ex-member; re-add in the same UTC hour → no new row, the old one (still read) is back; member.add/remove activity rows', async () => {
    // invite_sinks.py:23-50 (dedupe key projectInvite:<project>:<user>:<UTC YYYYmmddHH>), service.py:105-159 (ON CONFLICT
    // → None), :53-60 (visible = project live AND member), messages.py:13-21 (clean_label: drop Cc/Cf, collapse
    // spaces), project_members/service.py:61-94 (201 new / 200 existing; touch + activity only when new), :97-131 (N4),
    // projects/memberships.py:95-112 (members by user_id ASC).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const base = projectName('members');
      const project = await newProject(admin, 'members', cleanup, { name: `${base}  a​b` });
      expect(project.name).toBe(`${base}  a​b`);
      const user = await sessionOf(await invite(admin, 'viewer', 'members', cleanup), 'viewer', 'members', cleanup);
      const hourBefore = utcHour(new Date());

      await addMember(admin, project.id, user.email, 'members_add_1');
      const afterAdd = await readProject(admin, project.id, 'members_read_after_add', '200: two members sorted by user id; updatedAt pushed by N3');
      const ids = asArray(afterAdd.members).map((m) => String(asJson(m).id));
      expect(ids).toEqual([...ids].sort());
      expect(ids).toContain(user.id);
      expect(Date.parse(String(afterAdd.updatedAt))).toBeGreaterThan(Date.parse(String(project.updatedAt)));

      const [row] = await inbox(user.api, 'members_inbox_after_add', '200: one projectInvite; projectName/objectLabel = clean_label(name): U+200B dropped, spaces collapsed');
      expect(row).toBeDefined();
      expect(row).toMatchObject({ kind: 'projectInvite', projectId: project.id, projectName: `${base} ab`, objectLabel: `${base} ab`, isRead: false });

      const again = await call(admin, 'members_add_again_200', 'POST', `/api/projects/${String(project.id)}/members`, { email: user.email }, [
        '200 (not 201): already a member — no activity, no notification, no touch (router.py:68-69, service.py:79-94)',
      ]);
      expect(again.res.status()).toBe(200);
      expect(expectKeys(again.body, MEMBER_KEYS, MEMBER_OPTIONAL).id).toBe(user.id);
      expect((await readProject(admin, project.id, 'members_read_after_again', '200: updatedAt not pushed by the 200')).updatedAt).toBe(afterAdd.updatedAt);
      expect(await inbox(user.api, 'members_inbox_after_again', '200: still exactly one row')).toHaveLength(1);

      await expectNoContent(await call(user.api, 'members_mark_read', 'POST', '/api/notifications/read', { ids: [row?.id] }, ['204: the member reads it']));

      await removeMember(admin, project.id, user.id, 'members_remove');
      expect(await inbox(user.api, 'members_inbox_after_remove', '200: [] — the row is hidden once the user is not a member')).toEqual([]);
      const gone = await call(user.api, 'members_ex_member_get_404', 'GET', `/api/projects/${String(project.id)}`, undefined, [
        '404 NOT_FOUND resource "project" for the removed member (access.py:82-83)',
      ]);
      expectError(gone, 404, 'NOT_FOUND', { resource: 'project' }, true);
      expect(byId(await allSummaries(user.api, 'members_ex_member_summaries'), project.id), 'not in N1 any more').toBeUndefined();

      await addMember(admin, project.id, user.email, 'members_add_2');
      const hourAfter = utcHour(new Date());
      const back = await inbox(user.api, 'members_inbox_after_readd', '200: dedupe within the UTC hour → the same (read) row, no new one');
      if (hourBefore === hourAfter) {
        expect(back.map((n) => [n.id, n.isRead])).toEqual([[row?.id, true]]);
      } else {
        note(`UTC hour changed (${hourBefore} → ${hourAfter}): a second projectInvite is expected by design`);
        expect(back.map((n) => n.id)).toContain(row?.id);
        expect(back).toHaveLength(2);
      }

      // The invitation itself logs `user.invite` with the same objectCode (users/service.py:188-197,386): keep member.*.
      const rows = (await activityOf(admin, creatorId(project), user.id, 'members_activity')).filter((r) => String(r.kind).startsWith('member.'));
      expect(rows.map((r) => [r.kind, r.objectLabel])).toEqual([
        ['member.add', user.email],
        ['member.remove', user.email],
        ['member.add', user.email],
      ]);
      for (const r of rows) {
        expect(String(r.id)).toMatch(/^\d+$/u);
        expect(isTime(r.at)).toBe(true);
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · #22 accept-invite: own projectInvite → 200 NotificationOut isRead true, again → 200 same; W21 notificationId ≠ path → 422 PATH_BODY_MISMATCH, = path → 422 field; malformed / unknown / someone else\'s id → 404 resource notification; hidden after N4 → 404; anonymous → 401', async () => {
    // notifications/router.py:48-54, service.py:191-210 (404 for bad id, other user, hidden; idempotent; read flag only),
    // schemas.py:56-57 (NotificationEmptyBody `{}` strict), core/routing.py:138-151 (W21 guard before Pydantic 422).
    // NOTIFICATION_NOT_INVITE (errors.py:5) needs a non-invite row = pipeline (Phase 3): not producible here.
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    const anon = await newApiContext();
    cleanup.add(() => anon.dispose());
    try {
      const project = await newProject(admin, 'accept', cleanup);
      const user = await sessionOf(await invite(admin, 'viewer', 'accept', cleanup), 'viewer', 'accept', cleanup);
      await addMember(admin, project.id, user.email, 'accept_add');
      const [row] = await inbox(user.api, 'accept_inbox', '200: one unread projectInvite');
      const id = String(row?.id);
      const path = `/api/notifications/${id}/accept-invite`;

      const unauth = await call(anon, 'accept_anon_401', 'POST', path, {}, ['401 UNAUTHENTICATED (protected_router)']);
      expectError(unauth, 401, 'UNAUTHENTICATED', {}, true);

      const mismatch = await call(user.api, 'accept_422_path_body_mismatch', 'POST', path, { notificationId: MISSING_NOTIFICATION }, [
        '422 PATH_BODY_MISMATCH field "notificationId" (guard runs before Pydantic)',
      ]);
      expectError(mismatch, 422, 'PATH_BODY_MISMATCH', { field: 'notificationId' }, true);
      const echo = await call(user.api, 'accept_422_equal_key', 'POST', path, { notificationId: id }, [
        '422 VALIDATION field "notificationId": guard passes, then the strict `{}` body refuses the key',
      ]);
      expectError(echo, 422, 'VALIDATION', { field: 'notificationId' }, true);
      expect(byId(await inbox(user.api, 'accept_inbox_after_422', '200: still unread after the 422s'), id)?.isRead).toBe(false);

      const accepted = await call(user.api, 'accept_200', 'POST', path, {}, ['200 NotificationOut, isRead true, membership untouched']);
      expect(accepted.res.status()).toBe(200);
      const out = expectKeys(accepted.body, NOTIFICATION_KEYS, NOTIFICATION_OPTIONAL);
      expect(out).toMatchObject({ id, kind: 'projectInvite', projectId: project.id, isRead: true });
      const twice = await call(user.api, 'accept_again_200', 'POST', path, {}, ['200 idempotent: same body']);
      expect(twice.res.status()).toBe(200);
      expect(twice.body).toEqual(accepted.body);
      expect(byId(await inbox(user.api, 'accept_inbox_after', '200: isRead true'), id)?.isRead).toBe(true);
      await readProject(user.api, project.id, 'accept_member_still', '200: still a member (accept changes no membership)');

      for (const [slug, api, target] of [
        ['malformed', user.api, '/api/notifications/not-an-id/accept-invite'],
        ['unknown', user.api, `/api/notifications/${MISSING_NOTIFICATION}/accept-invite`],
        ['foreign_admin', admin, path],
      ] as const) {
        const sent = await call(api, `accept_404_${slug}`, 'POST', target, {}, ['404 NOT_FOUND resource "notification"']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'notification' }, true);
      }

      await removeMember(admin, project.id, user.id, 'accept_remove');
      const hidden = await call(user.api, 'accept_404_hidden', 'POST', path, {}, ['404: the row is hidden once the user left the project']);
      expectError(hidden, 404, 'NOT_FOUND', { resource: 'notification' }, true);
    } finally {
      await cleanup.run();
    }
  });

  test('A02 · projectInvite message per actor (A6, AppBack bf83f815): a named engineer → "<clean_label(name)> đã thêm bạn vào dự án" with the name kept as typed (lowercase start, U+200B dropped, spaces collapsed); an engineer whose name cleans to "" (U+200B only) → exactly "Bạn vừa được thêm vào dự án"; #22 returns the stored sentence', async () => {
    // BE:notifications/invite_sinks.py:34-47 (actor = the N3 caller, its live `users.name`; self-add skipped),
    // messages.py:18-28 (clean_label drops Cc/Cf and collapses spaces; empty → the fixed sentence, capitalised by bf83f815;
    // a name-led sentence keeps the name as is), auth_recovery/router.py:64-69,98-102 (fullName = clean_text: strip + NFC,
    // only Cc and bidi overrides refused — U+200B is Cf and passes, length 1), packages/core/text.py:6-9,22-46.
    // N3 by an engineer: `project.settings.edit` on its own project (matrix.py:51, access.py:78-86); `members_add` is per
    // actor, so these 2 adds use the two engineers' own buckets. The U+200B-only actor cannot carry the run prefix in its
    // name (any visible character survives clean_label): its email carries it (testEmail).
    // Not producible: the soft-deleted-actor branch (invite_sinks.py:37, a deleted user has no live session) and
    // `aiCompleted` / `violationFound` sentences (pipeline; `violation_found` has no caller outside tests at bf83f815).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const viewer = await sessionOf(await invite(admin, 'viewer', 'msg-invitee', cleanup), 'viewer', 'msg-invitee', cleanup);
      const typed = `  ${PREFIX}msg-named  a\u200Bb  `;
      const named = await sessionOf(await invite(admin, 'engineer', 'msg-named', cleanup), 'engineer', 'msg-named', cleanup, typed);
      const blank = await sessionOf(await invite(admin, 'engineer', 'msg-blank', cleanup), 'engineer', 'msg-blank', cleanup, '\u200B');
      const pNamed = await newProject(named.api, 'msg-named', cleanup);
      const pBlank = await newProject(blank.api, 'msg-blank', cleanup);

      for (const [actor, project, slug] of [[named, pNamed, 'msg_named_add'], [blank, pBlank, 'msg_blank_add']] as const) {
        const sent = await call(actor.api, slug, 'POST', `/api/projects/${String(project.id)}/members`, { email: viewer.email }, [
          '201 UserOut: an engineer adds a member to its own project (project_members/router.py:42-70); the invite sink notifies the invitee',
        ]);
        expect(sent.res.status()).toBe(201);
      }

      const rows = await inbox(viewer.api, 'msg_inbox', '200: one projectInvite per project; message = the actor sentence (messages.py:25-28)');
      expect(rows).toHaveLength(2);
      const fromNamed = rows.find((n) => n.projectId === pNamed.id);
      const fromBlank = rows.find((n) => n.projectId === pBlank.id);
      expect(fromNamed).toMatchObject({ kind: 'projectInvite', isRead: false, message: `${PREFIX}msg-named ab đã thêm bạn vào dự án` });
      expect(fromBlank).toMatchObject({ kind: 'projectInvite', isRead: false, message: 'Bạn vừa được thêm vào dự án' });

      // The sentence is stored on the row (notify, service.py:105-159), so #22 answers the same text.
      const accepted = await call(viewer.api, 'msg_blank_accept_200', 'POST', `/api/notifications/${String(fromBlank?.id)}/accept-invite`, {}, [
        '200 NotificationOut, isRead true, message "Bạn vừa được thêm vào dự án" (service.py:191-210)',
      ]);
      expect(accepted.res.status()).toBe(200);
      expect(expectKeys(accepted.body, NOTIFICATION_KEYS, NOTIFICATION_OPTIONAL)).toMatchObject({
        id: fromBlank?.id,
        isRead: true,
        message: 'Bạn vừa được thêm vào dự án',
      });
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ fresh user (pairs the mocked empty N1) */

test.describe('A02 a user without any project (pairs E02 "[mocked response] no project")', () => {
  test('A02 · fresh engineer: N1 → exactly {items: []} (no nextCursor), #23 → [], #19 → []; its first project → one item; deleted → {items: []} again', async () => {
    // service.py:71-77,208-216 (member projects only; nextCursor only when a row remains), notifications/service.py:162-170.
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const user = await sessionOf(await invite(admin, 'engineer', 'fresh', cleanup), 'engineer', 'fresh', cleanup);
      for (const [slug, path] of [['default', '/api/project-summaries'], ['limit_1', '/api/project-summaries?limit=1']] as const) {
        const sent = await call(user.api, `fresh_summaries_${slug}`, 'GET', path, undefined, ['200 body exactly {"items": []} — the FE empty state']);
        expect(sent.res.status()).toBe(200);
        expect(sent.body).toEqual({ items: [] });
      }
      const list = await call(user.api, 'fresh_projects', 'GET', '/api/projects', undefined, ['200 []']);
      expect(list.body).toEqual([]);
      expect(await inbox(user.api, 'fresh_notifications', '200 [] (no notification for a fresh user)')).toEqual([]);

      const created = await call(user.api, 'fresh_create_201', 'POST', '/api/projects', { name: projectName('fresh') }, ['201: the empty state\'s "Tạo dự án mới" path']);
      expect(created.res.status()).toBe(201);
      const project = expectProjectOut(created.body);
      cleanup.add(adminDeleteStep(user.api, admin, String(project.id)));
      const one = await call(user.api, 'fresh_summaries_one', 'GET', '/api/project-summaries', undefined, ['200: one item, no nextCursor']);
      const body = expectKeys(one.body, ['items'], []);
      expect(asArray(body.items).map((i) => asJson(i).id)).toEqual([project.id]);

      // BUG-513: #27 is admin-only — the engineer adds the admin (N3, project.settings.edit), the admin deletes.
      const joined = await call(user.api, 'fresh_add_admin_201', 'POST', `/api/projects/${String(project.id)}/members`, { email: readAdminCredentials().email }, [
        '201: the engineer adds the admin so an admin member can delete (#27 require_project("admin"))',
      ]);
      expect(joined.res.status()).toBe(201);
      const deleted = await call(admin, 'fresh_delete_by_admin_200', 'DELETE', `/api/projects/${String(project.id)}`, undefined, ['200 admin member deletes']);
      expect(deleted.res.status()).toBe(200);
      const empty = await call(user.api, 'fresh_summaries_empty_again', 'GET', '/api/project-summaries', undefined, ['200 {"items": []} again']);
      expect(empty.body).toEqual({ items: [] });
    } finally {
      await cleanup.run();
    }
  });
});

/* ------------------------------------------------------------------ activity rows */

test.describe('A02 activity rows of the project writes (#40 read-back, BE:users/schemas.py:50-57, users/service.py:263-278)', () => {
  test('A02 · activity rows: exact keys {id, at, kind, objectCode, objectLabel}, decimal id, newest first; create / update / update / delete labels follow the name at each write', async () => {
    // projects/service.py:257,285,331,335-347 (labels), access/kinds.py:27-29 (kinds), users/service.py:263-278
    // (ORDER BY at DESC, id DESC).
    const cleanup = new Cleanup();
    const admin = await adminApi(cleanup);
    try {
      const project = await newProject(admin, 'activity', cleanup);
      const path = `/api/projects/${String(project.id)}`;
      const renamed = `${String(project.name)}-R`;
      for (const [slug, method, body] of [
        ['activity_rename', 'PATCH', { name: renamed }],
        ['activity_code', 'PATCH', { code: 'QA-ACT' }],
        ['activity_delete', 'DELETE', undefined],
      ] as const) {
        const sent = await call(admin, slug, method, path, body, ['200: one activity row each']);
        expect(sent.res.status()).toBe(200);
      }
      const rows = await activityOf(admin, creatorId(project), String(project.id), 'activity_rows');
      expect(rows.map((r) => [r.kind, r.objectLabel])).toEqual([
        ['project.delete', renamed],
        ['project.update', renamed],
        ['project.update', renamed],
        ['project.create', project.name],
      ]);
      for (const r of rows) {
        expect(String(r.id)).toMatch(/^\d+$/u);
        expect(isTime(r.at)).toBe(true);
      }
      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1]!;
        const next = rows[i]!;
        expect(Date.parse(String(prev.at))).toBeGreaterThanOrEqual(Date.parse(String(next.at)));
        expect(BigInt(String(prev.id)) > BigInt(String(next.id)), 'id DESC (identity grows with time)').toBe(true);
      }
    } finally {
      await cleanup.run();
    }
  });
});

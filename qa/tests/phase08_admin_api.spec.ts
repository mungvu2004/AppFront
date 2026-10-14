/**
 * Phase 8 — Admin BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the SCR-34..SCR-37 screens call (FE `src/api/endpoints.ts`, clients `src/api/adminMlClient.ts`,
 * `src/api/adminMlJobsClient.ts`), every 2xx body decoded with the FE zod schemas (`src/api/schemas/library.ts`,
 * `adminMl.ts`, `users.ts`) — FE <-> BE contract:
 *   GET    /api/library, /api/library/{itemId}                           BE library/router.py:17-28, service.py:24-90
 *   GET    /api/admin/ml/model-families                                  BE admin_ml_registry/router.py:38-41, service.py:55-65
 *   PUT    /api/admin/ml/model-families/{family}/active (N24)            BE admin_ml_registry/router.py:44-61, service.py:124-171
 *   GET    /api/admin/ml/model-versions                                  BE admin_ml_registry/router.py:64-71, service.py:174-200
 *   GET    /api/admin/ml/training-jobs (+ POST, {id}, {id}/metrics|logs) BE admin_ml_jobs/router.py:40-94, service.py:91-327
 *   GET    /api/admin/ml/datasets, /datasets/{id}/versions               BE admin_ml_datasets/router.py:33-56, service.py:54-141
 *   GET    /api/users, /users/{id}/memberships|activity                  BE users/router.py:49-82, service.py:240-278
 *   POST   /api/users/invitations, PATCH /users/{id}/role, POST /users/{id}/disable|enable, DELETE /users/{id}
 *                                                                        BE users/router.py:55-123, service.py:284-460
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, HEAD 2ee030c5 = origin/main), paths under `apps/api/`.
 * Inventory + mock-pairing table: `qa/coverage/phase08-be.md`.
 *
 * ## Global state is never changed
 * N24 is only sent in shapes that the BE refuses or answers as a no-op (same version already active → current row,
 * service.py:155-156): 428 / 422 / 404 / 409 and the same-version re-activation. `versionId:null` is only sent to the
 * opening family (→ 422 before any write, service.py:150-152), never to walls. Real activation + restore is the UI
 * spec's job (`phase08_admin.spec.ts` SCR-36, rule R2). POST training-jobs is only sent with bodies that fail before
 * the INSERT (service.py:161-163); the guard `refuseIfCreatable` throws before a body that could create a job.
 * The admin account is only read, used to invite / manage the test users, and sent ONE self PATCH with its own
 * role `admin` (a no-op even if the guard were broken). Self disable / self delete are NOT sent (covered by BE pytest).
 *
 * ## Non-serial, own data
 * ONE `POST /api/users/invitations` per worker invites the seven run-unique `qa-<runId>-<slot>-…@example.test` slots
 * as `viewer` (lazy `batch()`); a test that needs a signed-in user reads ITS invitation token from Mailpit and accepts
 * it. Every claimed slot is soft-deleted (`DELETE /api/users/{id}`) and its mail removed in `finally`; `afterAll`
 * deletes the slots no test claimed (a `--grep` subset).
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `users_invite` 30 / 3600 s per ADMIN, counted before body validation (BE users/router.py:32-46,
 *   core/ratelimit.py:105-140): THIS file 1 (`batch()`, +1 per worker restart after a failure) + "invitations" 2
 *   (taken email, malformed email) = 3. Phase-8 main `phase08_admin.spec.ts`: 0 (its invite row is opt-in, skipped);
 *   ui `phase08_admin_ui.spec.ts`: 1 (its header, SCR-37 long-data viewer). Phase 8 = 4 ≤ 30. NOTE: phases 1-7 already spend 30 in one hour (phase07 api header) — a phase-8 run inside the
 *   same 3600 s window as a full phases 1-7 run gets 429 on `batch()`; wait for the window.
 *   Viewer / engineer calls to the invite route stop at 403 (`require_permission` runs before the limiter, router.py:46).
 * - `recovery_ip` 10 / 900 s per IP (auth_recovery/settings.py:24; override 60): 4 invitation accepts (viewer, engineer,
 *   role, state) + 1 refused accept of a revoked token (pending) = 5 ≤ 10 (fits even without the override). UI 0.
 * - `POST /api/auth/login` per IP 30 / 60 s (auth/settings.py:36; override 120): THIS file 1 (admin `signedInApi` in
 *   `batch()`, +1 per worker restart) + main 1 (`signInAdmin`) + ui 1 (`signedInApi`) = 3. No failed login anywhere.
 * - `POST /api/auth/refresh`: 4 (one per accepted user), each on its own fresh session.
 * - No other rate limit on any phase-8 route (grep `rate_limit` in the library, admin_ml_registry / _jobs / _datasets and users modules: only users/router.py).
 * - Mailpit: 7 invitation mails, deleted in `finally` / `afterAll`.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import { z, type ZodTypeAny } from 'zod';

import {
  DatasetPageSchema,
  DatasetVersionPageSchema,
  ModelFamilyPageSchema,
  ModelFamilySchema,
  ModelVersionPageSchema,
  TrainingJobPageSchema,
  TrainingJobSchema,
  TrainingLogPageSchema,
  TrainingMetricPageSchema,
} from '../../src/api/schemas/adminMl';
import { LibraryItemSchema } from '../../src/api/schemas/library';
import { AdminUserListSchema, AdminUserSchema, UserActivitySchema, UserMembershipSchema } from '../../src/api/schemas/users';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE auth_recovery/messages.py:31
const ULID0 = '0'.repeat(26); // Crockford ULID body (packages/core/ids.py:35) that no row carries
const NO_USER = `usr_${ULID0}`;
const NO_JOB = `job_${ULID0}`;
const NO_DATASET = `dst_${ULID0}`;
const NO_DATASET_VERSION = `dsv_${ULID0}`;
const NO_MODEL_VERSION = `mdl_${ULID0}`;
const OPENING = 'openingAndFurnitureDetection';
const WALLS = 'wallSegmentation';
const FAMILIES = [WALLS, OPENING, 'dimensionReading'] as const; // packages/ml_contracts/families.py:19-23 (order)
const ML = '/api/admin/ml';

type Json = Record<string, unknown>;

/* ------------------------------------------------------------------ phase-local helpers */

const asJson = (value: unknown): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`expected a JSON object, got ${JSON.stringify(value)}`);
  return value as Json;
};
const asArray = (value: unknown, what: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: expected a JSON array, got ${JSON.stringify(value)?.slice(0, 200)}`);
  return value;
};
const itemsOf = (value: unknown, what: string): Json[] => asArray(asJson(value).items, `${what}.items`).map(asJson);

/** Runs registered cleanups in reverse order; a failing cleanup is annotated, never thrown over the test's error. */
class Cleanup {
  private readonly steps: (() => Promise<unknown>)[] = [];
  add(step: () => Promise<unknown>): void {
    this.steps.push(step);
  }
  async run(): Promise<void> {
    for (const step of this.steps.reverse()) {
      try {
        await step();
      } catch (error) {
        test.info().annotations.push({ type: 'cleanup', description: String(error) });
      }
    }
  }
}

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/**
 * Signed object URLs (`modelUrl`, `previewUrl` — library/service.py:33-66; `avatarUrl` — users/service.py:220-229) are
 * bearer links: their query string (the signature) is cut before anything is written to evidence.
 */
function redactedView(res: APIResponse, text: string): APIResponse {
  const clean = text.replace(/("(?:avatarUrl|modelUrl|previewUrl)"\s*:\s*"[^"?]*)\?[^"]*"/gu, '$1?<signature redacted>"');
  return { status: () => res.status(), headers: () => res.headers(), text: async () => clean } as unknown as APIResponse;
}

interface Sent {
  readonly res: APIResponse;
  readonly text: string;
  readonly body: unknown;
}

interface CallOptions {
  readonly headers?: Record<string, string>;
  /** Raw bytes sent as `application/json` (malformed JSON). */
  readonly raw?: string;
}

/** One exchange + its `A08_<slug>.json` evidence. */
async function call(
  api: APIRequestContext,
  slug: string,
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
  const parsed = await captureExchange(`A08_${slug}.json`, { method, path, body: options.raw ?? body }, redactedView(res, text), assertions);
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`/`resource`); `null` = the key must be absent. */
function expectError(sent: Sent, status: number, code: string, field?: string | null, resource?: string): Json {
  expect(sent.res.status(), `${code} status`).toBe(status);
  const body = asJson(JSON.parse(sent.text));
  expect(body.code).toBe(code);
  expect(typeof body.requestId).toBe('string');
  if (field === null) expect(body, `${code}: no field`).not.toHaveProperty('field');
  else if (field !== undefined) expect(body.field).toBe(field);
  if (resource !== undefined) expect(body.resource).toBe(resource);
  return body;
}

/** 2xx + the FE zod schema (strict) decodes the wire body. */
function expectDecodes(sent: Sent, status: number, schema: ZodTypeAny, what: string): unknown {
  expect(sent.res.status(), `${what} status`).toBe(status);
  const parsed = schema.safeParse(sent.body);
  expect(parsed.success, `FE ${what} decodes the body: ${parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 5))}`).toBe(true);
  return sent.body;
}

function setCookieValue(res: APIResponse, name: string): string {
  const line = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value)
    .find((v) => v.startsWith(`${name}=`));
  if (!line) throw new Error(`no Set-Cookie ${name} (status ${res.status()})`);
  return line.slice(name.length + 1).split(';')[0]!;
}

/** A Bearer reader that stops working once its session/owner/ver is invalid: polls (principal cache ≤ 5 s, auth/settings.py:35). */
async function expectBearerRevoked(api: APIRequestContext, slug: string, why: string): Promise<void> {
  await expect
    .poll(async () => (await api.get('/api/me')).status(), { message: `${why}: Bearer → 401 within the principal cache TTL`, timeout: 15_000, intervals: [500, 1_000] })
    .toBe(401);
  const sent = await call(api, slug, 'GET', '/api/me', undefined, [`${why} → the old access token gets 401 SESSION_REVOKED (auth/sessions.py:605-621)`]);
  expectError(sent, 401, 'SESSION_REVOKED');
}

/* ------------------------------------------------------------------ users: one invitation batch per worker */

const SLOTS = ['viewer', 'engineer', 'role', 'state', 'pend', 'del', 'read'] as const;
type Slot = (typeof SLOTS)[number];

interface SlotUser {
  readonly id: string;
  readonly email: string;
}

interface Batch {
  readonly admin: APIRequestContext;
  readonly adminId: string;
  readonly since: Date;
  readonly users: ReadonlyMap<Slot, SlotUser>;
  readonly claimed: Set<Slot>;
}

let batchPromise: Promise<Batch> | undefined;

/**
 * Admin signs in once and invites the seven slots in ONE request (BE users/router.py:55-62 → service.py:390-418).
 * The upper-case copy of the first address proves the dedupe by `normalize_email` (service.py:407-410, K20): one row
 * per unique address, in input order.
 */
function batch(): Promise<Batch> {
  batchPromise ??= (async () => {
    const { email, password } = readAdminCredentials();
    const admin = await signedInApi(email, password);
    const emails = SLOTS.map((slot) => testEmail(slot));
    const since = new Date(Date.now() - 5_000);
    const body = { emails: [...emails, emails[0]!.toUpperCase()], role: 'viewer' };
    const sent = await call(admin, 'setup_invite_batch', 'POST', '/api/users/invitations', body, [
      '201 AdminUser[]: one row per unique normalized address (the upper-case duplicate is dropped), input order kept (service.py:407-418)',
      'every row pending, role viewer, invitedAt + inviteExpiresAt present (service.py:203-217), FE AdminUserSchema decodes each',
    ]);
    expectDecodes(sent, 201, z.array(AdminUserSchema), 'AdminUser[]');
    const rows = asArray(sent.body, 'invite').map(asJson);
    expect(rows.map((r) => r.email)).toEqual(emails);
    for (const row of rows) {
      expect(row.status).toBe('pending');
      expect(row.role).toBe('viewer');
      expect(typeof row.invitedAt).toBe('string');
      expect(typeof row.inviteExpiresAt).toBe('string');
      expect(row.projectCount).toBe(0);
    }
    const list = await admin.get('/api/users');
    const adminRow = asArray(asJson(await list.json()).users, 'users').map(asJson).find((u) => String(u.email).toLowerCase() === email.toLowerCase());
    if (!adminRow) throw new Error('GET /api/users: the signed-in admin is not listed');
    const users = new Map(SLOTS.map((slot, i) => [slot, { id: String(rows[i]!.id), email: emails[i]! }] as const));
    return { admin, adminId: String(adminRow.id), since, users, claimed: new Set<Slot>() };
  })();
  return batchPromise;
}

interface Member extends SlotUser {
  /** The mailed invitation token (secret: only sent in bodies `captureExchange` redacts). */
  readonly token: string;
}

/** The test's own invited user: cleanup registered (soft delete + mail), the real invitation mail read from Mailpit. */
async function claim(slot: Slot, cleanup: Cleanup): Promise<Member & { readonly admin: APIRequestContext; readonly adminId: string }> {
  const b = await batch();
  const user = b.users.get(slot)!;
  b.claimed.add(slot);
  cleanup.add(async () => {
    const res = await b.admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
    if (res.status() !== 200 && slot !== 'del') note(`cleanup DELETE /api/users/${user.id} → ${res.status()}`);
  });
  const mail = await waitForMail(user.email, b.since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation link has no #token');
  return { ...user, token, admin: b.admin, adminId: b.adminId };
}

/** Accept with the real token (204 + refresh cookie, auth_recovery/router.py:338-355) → refresh → Bearer client. */
async function accept(slot: Slot, member: Member, cleanup: Cleanup): Promise<APIRequestContext> {
  const anon = await newApiContext();
  try {
    const body = { token: member.token, fullName: `${PREFIX}${slot}`, password: `Qa-${randomUUID()}` };
    const accepted = await call(anon, `${slot}_setup_accept`, 'POST', '/api/auth/invitations/accept', body, [
      'setup: invitee accepts with the real mailed token → 204 + refresh cookie',
    ]);
    expect(accepted.res.status()).toBe(204);
    const refreshed = await call(anon, `${slot}_setup_refresh`, 'POST', '/api/auth/refresh', undefined, ['setup: 200 + access token'], {
      headers: { Cookie: `${REFRESH}=${setCookieValue(accepted.res, REFRESH)}` },
    });
    expect(refreshed.res.status()).toBe(200);
    const bearer = String(asJson(refreshed.body).accessToken);
    const base = apiBaseUrl();
    const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${bearer}` } });
    cleanup.add(() => api.dispose());
    return api;
  } finally {
    await anon.dispose();
  }
}

test.afterAll(async () => {
  if (!batchPromise) return;
  const b = await batchPromise.catch(() => undefined);
  if (!b) return;
  for (const slot of SLOTS) {
    if (b.claimed.has(slot)) continue;
    const user = b.users.get(slot)!;
    try {
      await b.admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
      const mail = await waitForMail(user.email, b.since, 15_000, INVITE_SUBJECT).catch(() => undefined);
      if (mail) await deleteMails([mail.id]);
    } catch (error) {
      console.error(`[phase08 api] cleanup of unclaimed slot ${slot} failed: ${String(error)}`);
    }
  }
  await b.admin.dispose();
  batchPromise = undefined;
});

/** Admin client of the worker batch (reads + safe writes; no test user of its own). */
async function adminApi(): Promise<APIRequestContext> {
  return (await batch()).admin;
}

/** Activity rows the admin wrote about `targetId` of one kind (users/service.py:188-197 → access/kinds.py:36-41). */
async function adminActivityAbout(admin: APIRequestContext, adminId: string, targetId: string, kind: string, slug: string): Promise<Json[]> {
  const sent = await call(admin, slug, 'GET', `/api/users/${adminId}/activity`, undefined, [
    `200 UserActivity[] newest first (service.py:263-278); rows of kind "${kind}" with objectCode = the target id`,
  ]);
  expectDecodes(sent, 200, z.array(UserActivitySchema), 'UserActivity[]');
  return asArray(sent.body, 'activity')
    .map(asJson)
    .filter((row) => row.kind === kind && row.objectCode === targetId);
}

/** The row of one user in GET /api/users (or undefined). */
async function listedUser(admin: APIRequestContext, id: string, slug: string, assertion: string): Promise<Json | undefined> {
  const sent = await call(admin, slug, 'GET', '/api/users', undefined, [assertion]);
  expectDecodes(sent, 200, AdminUserListSchema, 'AdminUserList');
  return asArray(asJson(sent.body).users, 'users').map(asJson).find((u) => u.id === id);
}

/* ------------------------------------------------------------------ the 20 endpoints (auth matrix) */

interface Route {
  readonly slug: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  /** Body for an authenticated caller (shape valid where it matters; the 403 must come before it is read). */
  readonly body?: unknown;
}

/** Every admin-only route of phase 8, pointed at real ids where a real target makes the 403 meaningful. */
function adminRoutes(target: SlotUser, opening: { revision: number; activeVersionId?: string }): Route[] {
  return [
    { slug: 'families', method: 'GET', path: `${ML}/model-families` },
    { slug: 'activate', method: 'PUT', path: `${ML}/model-families/${OPENING}/active`, body: { baseVersion: opening.revision, body: { versionId: opening.activeVersionId ?? NO_MODEL_VERSION } } },
    { slug: 'versions', method: 'GET', path: `${ML}/model-versions` },
    { slug: 'jobs', method: 'GET', path: `${ML}/training-jobs` },
    { slug: 'job_create', method: 'POST', path: `${ML}/training-jobs`, body: { family: OPENING, datasetVersionId: NO_DATASET_VERSION, baseModel: 'yolov8n', epochs: 1 } },
    { slug: 'job', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}` },
    { slug: 'job_metrics', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}/metrics` },
    { slug: 'job_logs', method: 'GET', path: `${ML}/training-jobs/${NO_JOB}/logs` },
    { slug: 'datasets', method: 'GET', path: `${ML}/datasets` },
    { slug: 'dataset_versions', method: 'GET', path: `${ML}/datasets/${NO_DATASET}/versions` },
    { slug: 'users', method: 'GET', path: '/api/users' },
    { slug: 'memberships', method: 'GET', path: `/api/users/${target.id}/memberships` },
    { slug: 'activity', method: 'GET', path: `/api/users/${target.id}/activity` },
    { slug: 'invite', method: 'POST', path: '/api/users/invitations', body: { emails: [testEmail('denied')], role: 'viewer' } },
    { slug: 'role', method: 'PATCH', path: `/api/users/${target.id}/role`, body: { role: 'admin', userId: target.id } },
    { slug: 'disable', method: 'POST', path: `/api/users/${target.id}/disable`, body: {} },
    { slug: 'enable', method: 'POST', path: `/api/users/${target.id}/enable`, body: {} },
    { slug: 'delete', method: 'DELETE', path: `/api/users/${target.id}`, body: { userId: target.id, confirmEmail: target.email } },
  ];
}

/* ------------------------------------------------------------------ tests */

test.describe('A08 phase-8 backend (library, ML registry / jobs / datasets, users)', () => {
  test('A08 · anonymous: all 20 phase-8 routes → 401 UNAUTHENTICATED before the body is read', async () => {
    // core/routing.py:129-135,261-263: the Bearer is read before session, body and dependencies (W10).
    const anon = await newApiContext();
    try {
      const fake: SlotUser = { id: NO_USER, email: `${PREFIX}anon@example.test` };
      const routes: Route[] = [
        { slug: 'library', method: 'GET', path: '/api/library' },
        { slug: 'library_item', method: 'GET', path: '/api/library/qa-none' },
        ...adminRoutes(fake, { revision: 0 }),
      ];
      expect(routes).toHaveLength(20);
      for (const route of routes) {
        const write = route.method !== 'GET';
        const sent = await call(anon, `anon_${route.slug}`, route.method, route.path, undefined, [
          `no Authorization → 401 UNAUTHENTICATED (routing.py:131-133)${write ? '; truncated JSON body still 401, never 400 (auth before the body)' : ''}`,
        ], write ? { raw: '{"x":' } : {});
        expectError(sent, 401, 'UNAUTHENTICATED');
      }
      const bad = await call(anon, 'anon_users_garbage_bearer', 'GET', '/api/users', undefined, ['Bearer that is not a JWT → 401 UNAUTHENTICATED'], {
        headers: { Authorization: 'Bearer not-a-jwt' },
      });
      expectError(bad, 401, 'UNAUTHENTICATED');
    } finally {
      await anon.dispose();
    }
  });

  test('A08 · viewer + engineer: admin ML and /users routes → 403 FORBIDDEN before the body; /library → 200 for both', async () => {
    test.setTimeout(180_000);
    const cleanup = new Cleanup();
    try {
      const viewer = await claim('viewer', cleanup);
      const engineer = await claim('engineer', cleanup);
      const { admin } = viewer;
      // Setup: engineer slot gets its role BEFORE accepting, so its session snapshot carries `engineer` (sessions.py:605-621).
      const promote = await call(admin, 'matrix_setup_engineer_role', 'PATCH', `/api/users/${engineer.id}/role`, { role: 'engineer', userId: engineer.id }, [
        'setup: admin sets the engineer slot to engineer → 200 role engineer (users/service.py:284-294)',
      ]);
      expect(promote.res.status()).toBe(200);
      expect(asJson(promote.body).role).toBe('engineer');
      const families = itemsOf((await call(admin, 'matrix_setup_families', 'GET', `${ML}/model-families`, undefined, ['setup: current opening revision/active (sent back as a no-op body)'])).body, 'families');
      const opening = families.find((f) => f.family === OPENING)!;
      const openingState = { revision: Number(opening.revision), ...(typeof opening.activeVersionId === 'string' ? { activeVersionId: opening.activeVersionId } : {}) };

      for (const [role, member] of [['viewer', viewer], ['engineer', engineer]] as const) {
        const api = await accept(role, member, cleanup);
        // The other test user is the target of the user-management writes: a real row, so a 403 means "not allowed", not "not found".
        const target = role === 'viewer' ? engineer : viewer;
        for (const route of adminRoutes(target, openingState)) {
          const sent = await call(api, `${role}_${route.slug}`, route.method, route.path, route.body, [
            `${role} → 403 FORBIDDEN without resource: router-level require_admin / require_permission("user.manage") (access/deps.py:30-45,65-77)`,
            ...(route.body === undefined ? [] : ['the 403 comes before body validation and before the users_invite limiter (users/router.py:45-46)']),
          ]);
          const body = expectError(sent, 403, 'FORBIDDEN');
          expect(body).not.toHaveProperty('resource');
        }
        // Library has no role gate (library/router.py:1-4: only current_principal) — every signed-in role reads it.
        const lib = await call(api, `${role}_library`, 'GET', '/api/library', undefined, [`${role} → 200 LibraryItem[] (no role gate, router.py:17-20)`]);
        expectDecodes(lib, 200, z.array(LibraryItemSchema), 'LibraryItem[]');
        note(`${role}: BE serves /api/library (200); the FE gates the SCR-34 screen itself (plan Phase 9: engineer forbidden by library.manage)`);
      }

      // Nothing changed on the targets: both still listed, roles unchanged (viewer viewer, engineer engineer), not disabled.
      const v = await listedUser(admin, viewer.id, 'matrix_after_users', 'after the 403s: both targets still listed, role + status unchanged');
      const e = await listedUser(admin, engineer.id, 'matrix_after_users_2', 'same read, engineer row');
      expect(v?.role).toBe('viewer');
      expect(e?.role).toBe('engineer');
      expect(v?.status).toBe('active');
      expect(e?.status).toBe('active');
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · library: GET /library decodes as FE LibraryItem[], detail equals its list row, bad / unknown id → 404 libraryItem', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const list = await call(admin, 'library_list', 'GET', '/api/library', undefined, [
        '200 bare array (legacy list, router.py:17-20), FE z.array(LibraryItemSchema) strict decodes it',
        'order (sortOrder, id) — not observable on the wire; ≤ LIBRARY_LIST_MAX 500 (settings.py:18)',
      ]);
      expectDecodes(list, 200, z.array(LibraryItemSchema), 'LibraryItem[]');
      const items = asArray(list.body, 'library').map(asJson);
      expect(items.length).toBeLessThanOrEqual(500);
      for (const item of items) {
        expect(item, 'K01: no furnitureKind / ownerId / publishedAt on the wire (schemas.py:1-4)').not.toHaveProperty('ownerId');
        expect(item).not.toHaveProperty('publishedAt');
        expect(item).not.toHaveProperty('furnitureKind');
        expect(item.previewUrl, 'W2: previewUrl absent, never null (schemas.py:3-4)').not.toBeNull();
      }

      for (const [slug, id, why] of [
        ['library_item_bad_pattern', 'Bad_ID', 'id outside ^[a-z0-9]+(-[a-z0-9]+)*$ → 404 without a query (service.py:83-84, catalogue.py:26)'],
        ['library_item_unknown', `${PREFIX}none-item`.toLowerCase().replace(/[^a-z0-9-]/gu, '-'), 'well-formed id with no visible row → 404 (service.py:85-89)'],
      ] as const) {
        const sent = await call(admin, slug, 'GET', `/api/library/${id}`, undefined, [`${why}; body NOT_FOUND resource "libraryItem" (service.py:21)`]);
        expectError(sent, 404, 'NOT_FOUND', null, 'libraryItem');
      }

      const first = items[0];
      if (first === undefined) {
        note('environment: library is empty — detail read of a real item not possible (404 branches checked)');
        return;
      }
      const detail = await call(admin, 'library_item', 'GET', `/api/library/${String(first.id)}`, undefined, [
        '200 one LibraryItem (#15, service.py:81-90) equal to its list row except the per-call signed URLs',
      ]);
      expectDecodes(detail, 200, LibraryItemSchema, 'LibraryItem');
      const strip = ({ modelUrl: _m, previewUrl: _p, ...rest }: Json): Json => rest;
      expect(strip(asJson(detail.body))).toEqual(strip(first));
      expect(Object.keys(asJson(detail.body)).sort()).toEqual(Object.keys(first).sort());
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · registry read: model-families (3 families, FE schema, no nextCursor), model-versions filter / limit / cursor rules', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const fam = await call(admin, 'families', 'GET', `${ML}/model-families`, undefined, [
        '200 {items} with exactly the three families in FAMILY_ORDER, never nextCursor (service.py:55-65)',
        'activeVersionId absent (not null) when a family runs the classic path (schemas.py:47-52, W2)',
      ]);
      expectDecodes(fam, 200, ModelFamilyPageSchema, 'ModelFamilyPage');
      const families = itemsOf(fam.body, 'families');
      expect(families.map((f) => f.family)).toEqual([...FAMILIES]);
      expect(asJson(fam.body)).not.toHaveProperty('nextCursor');
      for (const f of families) expect(f.activeVersionId).not.toBeNull();

      const all = await call(admin, 'versions', 'GET', `${ML}/model-versions`, undefined, [
        '200 ModelVersionPage, newest first by (createdAt, id) (service.py:174-200); K01 internal columns absent (schemas.py:1-10)',
      ]);
      expectDecodes(all, 200, ModelVersionPageSchema, 'ModelVersionPage');
      const versions = itemsOf(all.body, 'versions');
      const created = versions.map((v) => Date.parse(String(v.createdAt)));
      expect(created, 'createdAt descending').toEqual([...created].sort((a, b) => b - a));
      for (const v of versions) {
        for (const key of ['weightsKey', 'pinnedName', 'evaluationAttempts', 'evaluationErrorCode']) expect(v).not.toHaveProperty(key);
        expect(v.metrics !== undefined, 'metrics present ⇔ completed (schemas.py:9-10)').toBe(v.evaluationStatus === 'completed');
      }
      for (const family of FAMILIES) {
        const byFamily = await call(admin, `versions_family_${family}`, 'GET', `${ML}/model-versions?family=${family}`, undefined, [`?family=${family} → only that family (service.py:186-187)`]);
        expectDecodes(byFamily, 200, ModelVersionPageSchema, 'ModelVersionPage');
        for (const v of itemsOf(byFamily.body, 'versions')) expect(v.family).toBe(family);
      }

      expectError(await call(admin, 'versions_family_unknown', 'GET', `${ML}/model-versions?family=doors`, undefined, ['unknown family → 422 VALIDATION field "family" (service.py:182-183)']), 422, 'VALIDATION', 'family');
      expectError(await call(admin, 'versions_limit_0', 'GET', `${ML}/model-versions?limit=0`, undefined, ['limit < 1 → 422 VALIDATION field "limit" (pagination.py:56-58)']), 422, 'VALIDATION', 'limit');
      expectError(await call(admin, 'versions_limit_201', 'GET', `${ML}/model-versions?limit=201`, undefined, ['limit > VERSION_LIST_MAX_LIMIT 200 → 422 field "limit" (router.py:35,67)']), 422, 'VALIDATION', 'limit');
      expect((await call(admin, 'versions_limit_200', 'GET', `${ML}/model-versions?limit=200`, undefined, ['limit = 200 (the cap) → 200'])).res.status()).toBe(200);
      expectError(await call(admin, 'versions_cursor_garbage', 'GET', `${ML}/model-versions?cursor=garbage`, undefined, ['unsigned cursor → 422 CURSOR_INVALID, no field (pagination.py:96-113)']), 422, 'CURSOR_INVALID', null);

      if (versions.length < 2) {
        note(`environment: ${versions.length} model version(s) — cursor paging needs ≥ 2 (garbage-cursor branch checked)`);
        return;
      }
      const p1 = await call(admin, 'versions_page1', 'GET', `${ML}/model-versions?limit=1`, undefined, ['limit=1 with ≥ 2 rows → 1 item + nextCursor (service.py:192-200)']);
      expectDecodes(p1, 200, ModelVersionPageSchema, 'ModelVersionPage');
      const cursor = String(asJson(p1.body).nextCursor);
      expect(itemsOf(p1.body, 'p1')).toHaveLength(1);
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
      const p2 = await call(admin, 'versions_page2', 'GET', `${ML}/model-versions?limit=1&cursor=${encodeURIComponent(cursor)}`, undefined, ['the cursor continues strictly after the page-1 row (tuple compare, service.py:188-191)']);
      expectDecodes(p2, 200, ModelVersionPageSchema, 'ModelVersionPage');
      expect(itemsOf(p2.body, 'p2')[0]?.id).toBe(versions[1]?.id);
      expectError(
        await call(admin, 'versions_cursor_other_filter', 'GET', `${ML}/model-versions?limit=1&family=${OPENING}&cursor=${encodeURIComponent(cursor)}`, undefined, ['cursor signed for another filter set → 422 CURSOR_INVALID (pagination.py:106-107)']),
        422,
        'CURSOR_INVALID',
        null,
      );
      expectError(
        await call(admin, 'jobs_cursor_from_versions', 'GET', `${ML}/training-jobs?cursor=${encodeURIComponent(cursor)}`, undefined, ['a model-versions cursor on training-jobs (other op) → 422 CURSOR_INVALID']),
        422,
        'CURSOR_INVALID',
        null,
      );
      const tampered = `${cursor.split('.')[0]!}x.${cursor.split('.')[1]!}`;
      expectError(await call(admin, 'versions_cursor_tampered', 'GET', `${ML}/model-versions?cursor=${encodeURIComponent(tampered)}`, undefined, ['payload edited, MAC kept → 422 CURSOR_INVALID']), 422, 'CURSOR_INVALID', null);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · registry N24 without changing anything: 428, strict baseVersion, unknown key, 404 family / version, 409 stale, 422 null / other family / not activatable, same-version no-op', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const read = async (slug: string, why: string): Promise<Json[]> => {
        const sent = await call(admin, slug, 'GET', `${ML}/model-families`, undefined, [why]);
        expectDecodes(sent, 200, ModelFamilyPageSchema, 'ModelFamilyPage');
        return itemsOf(sent.body, 'families');
      };
      const before = await read('activate_before', 'baseline: revision + activeVersionId of every family');
      const opening = before.find((f) => f.family === OPENING)!;
      const R = Number(opening.revision);
      const active = typeof opening.activeVersionId === 'string' ? opening.activeVersionId : undefined;
      const put = (slug: string, body: unknown, why: readonly string[], family = OPENING, options: CallOptions = {}): Promise<Sent> =>
        call(admin, slug, 'PUT', `${ML}/model-families/${family}/active`, body, why, options);

      expectError(await put('activate_no_base_version', { body: { versionId: null } }, ['no baseVersion → 428 PRECONDITION_REQUIRED before Pydantic (routing.py:154-163, router.py:45)']), 428, 'PRECONDITION_REQUIRED');
      expectError(await put('activate_body_not_object', undefined, ['JSON array body → 428 (guard needs an object with baseVersion, routing.py:159-161)'], OPENING, { raw: '[1]' }), 428, 'PRECONDITION_REQUIRED');
      expectError(await put('activate_base_version_string', { baseVersion: String(R), body: { versionId: null } }, ['baseVersion "R" (string) → 422 VALIDATION field baseVersion (strict int, schemas.py:95)']), 422, 'VALIDATION', 'baseVersion');
      expectError(await put('activate_base_version_negative', { baseVersion: -1, body: { versionId: null } }, ['baseVersion -1 → 422 field baseVersion (ge=0)']), 422, 'VALIDATION', 'baseVersion');
      expectError(await put('activate_unknown_key', { baseVersion: R, body: { versionId: null }, force: true }, ['unknown outer key → 422 VALIDATION field "force" (extra=forbid, C03)']), 422, 'VALIDATION', 'force');
      expectError(await put('activate_missing_version_id', { baseVersion: R, body: {} }, ['body without versionId (required, nullable) → 422 field "body.versionId" (schemas.py:78-85)']), 422, 'VALIDATION', 'body.versionId');
      expectError(await put('activate_unknown_family', { baseVersion: R, body: { versionId: null } }, ['family outside the three → 404 NOT_FOUND resource modelFamily (service.py:141-142)'], 'doors'), 404, 'NOT_FOUND', null, 'modelFamily');

      const stale = expectError(await put('activate_stale_base_version', { baseVersion: R + 1, body: { versionId: active ?? null } }, [
        'baseVersion ≠ revision (and not the writer\'s own repeat) → 409 VERSION_CONFLICT currentVersion = revision, remoteChanges [] (service.py:145-148)',
      ]), 409, 'VERSION_CONFLICT');
      expect(stale.currentVersion).toBe(R);
      expect(stale.remoteChanges).toEqual([]);

      expectError(await put('activate_null_non_walls', { baseVersion: R, body: { versionId: null } }, ['versionId:null for a family other than walls → 422 MODEL_VERSION_FAMILY_MISMATCH (service.py:150-152)']), 422, 'MODEL_VERSION_FAMILY_MISMATCH', null);
      expectError(await put('activate_unknown_version', { baseVersion: R, body: { versionId: NO_MODEL_VERSION } }, ['well-formed id, no row → 404 NOT_FOUND resource modelVersion (service.py:95-98)']), 404, 'NOT_FOUND', null, 'modelVersion');

      const versions = itemsOf((await call(admin, 'activate_versions', 'GET', `${ML}/model-versions?limit=200`, undefined, ['setup: candidate rows for the 422 branches'])).body, 'versions');
      const otherFamily = versions.find((v) => v.family !== OPENING);
      if (otherFamily) {
        expectError(await put('activate_other_family_version', { baseVersion: R, body: { versionId: otherFamily.id } }, [`version of ${String(otherFamily.family)} → 422 MODEL_VERSION_FAMILY_MISMATCH (service.py:99-100)`]), 422, 'MODEL_VERSION_FAMILY_MISMATCH', null);
      } else note('environment: no model version outside the opening family — MODEL_VERSION_FAMILY_MISMATCH (other family) not exercised');
      const notOnnx = versions.find((v) => v.family === OPENING && v.weightsFormat !== 'onnx');
      if (notOnnx) {
        expectError(await put('activate_not_onnx', { baseVersion: R, body: { versionId: notOnnx.id } }, ['opening version not onnx → 422 MODEL_FORMAT_UNSUPPORTED (checked before evaluation, service.py:101-102)']), 422, 'MODEL_FORMAT_UNSUPPORTED', null);
      } else note('environment: no non-onnx opening version — MODEL_FORMAT_UNSUPPORTED not exercised');
      const notEvaluated = versions.find((v) => v.family === OPENING && v.weightsFormat === 'onnx' && v.evaluationStatus !== 'completed');
      if (notEvaluated) {
        expectError(await put('activate_not_evaluated', { baseVersion: R, body: { versionId: notEvaluated.id } }, ['onnx opening version not completed → 422 MODEL_VERSION_NOT_EVALUATED (service.py:103-104)']), 422, 'MODEL_VERSION_NOT_EVALUATED', null);
      } else note('environment: no un-evaluated onnx opening version — MODEL_VERSION_NOT_EVALUATED not exercised');

      if (active !== undefined) {
        const same = await put('activate_same_version_noop', { baseVersion: R, body: { versionId: active } }, [
          're-activating the version that is already active → 200 current row, revision NOT bumped, no activity (service.py:155-156)',
        ]);
        expectDecodes(same, 200, ModelFamilySchema, 'ModelFamily');
        expect(asJson(same.body)).toEqual({ activeVersionId: active, family: OPENING, revision: R });
      } else note(`environment: ${OPENING} has no active version — same-version no-op not exercised`);

      const after = await read('activate_after', 'every family unchanged: same revision and activeVersionId as the baseline (no write happened)');
      expect(after).toEqual(before);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · training jobs read: list filters / 422 / cursor, job + metrics + logs 404 and query bounds, existing job contract', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const jobs = `${ML}/training-jobs`;
      const list = await call(admin, 'jobs', 'GET', jobs, undefined, ['200 TrainingJobPage newest first (service.py:91-115); K01 bridge columns absent (schemas.py:1-12)']);
      expectDecodes(list, 200, TrainingJobPageSchema, 'TrainingJobPage');
      const rows = itemsOf(list.body, 'jobs');
      for (const row of rows) for (const key of ['lastHeartbeatAt', 'artifactsPurgedAt', 'requeueCount', 'updatedAt']) expect(row).not.toHaveProperty(key);
      const succeeded = await call(admin, 'jobs_status_succeeded', 'GET', `${jobs}?status=succeeded`, undefined, ['?status=succeeded → only succeeded rows (the SCR-35 "Xong" filter)']);
      expectDecodes(succeeded, 200, TrainingJobPageSchema, 'TrainingJobPage');
      for (const row of itemsOf(succeeded.body, 'jobs')) expect(row.status).toBe('succeeded');
      const walls = await call(admin, 'jobs_family_walls', 'GET', `${jobs}?family=${WALLS}`, undefined, ['?family=wallSegmentation → only that family']);
      for (const row of itemsOf(walls.body, 'jobs')) expect(row.family).toBe(WALLS);
      expectError(await call(admin, 'jobs_family_not_trainable', 'GET', `${jobs}?family=dimensionReading`, undefined, ['dimensionReading is not trainable → 422 VALIDATION field "family" (service.py:93-94, families.py:24)']), 422, 'VALIDATION', 'family');
      expectError(await call(admin, 'jobs_status_unknown', 'GET', `${jobs}?status=done`, undefined, ['unknown status → 422 VALIDATION field "status" (service.py:95-96)']), 422, 'VALIDATION', 'status');
      expectError(await call(admin, 'jobs_limit_201', 'GET', `${jobs}?limit=201`, undefined, ['limit > 200 → 422 field "limit" (router.py:43)']), 422, 'VALIDATION', 'limit');
      expectError(await call(admin, 'jobs_cursor_garbage', 'GET', `${jobs}?cursor=abc.def`, undefined, ['bad cursor → 422 CURSOR_INVALID']), 422, 'CURSOR_INVALID', null);

      for (const [slug, id] of [['job_unknown', NO_JOB], ['job_bad_pattern', 'garbage']] as const) {
        expectError(await call(admin, slug, 'GET', `${jobs}/${id}`, undefined, ['no row / wrong pattern → 404 NOT_FOUND resource trainingJob, never 422 (service.py:75-88)']), 404, 'NOT_FOUND', null, 'trainingJob');
      }
      for (const stream of ['metrics', 'logs'] as const) {
        expectError(await call(admin, `job_${stream}_unknown`, 'GET', `${jobs}/${NO_JOB}/${stream}?limit=200`, undefined, [`${stream} of a missing job → 404 trainingJob, job read first (service.py:287,314)`]), 404, 'NOT_FOUND', null, 'trainingJob');
        expectError(await call(admin, `job_${stream}_since_below`, 'GET', `${jobs}/${NO_JOB}/${stream}?since=-2`, undefined, ['since < -1 → 422 field "since" (router.py:33-36), query checked before the handler']), 422, 'VALIDATION', 'since');
        expectError(await call(admin, `job_${stream}_limit_0`, 'GET', `${jobs}/${NO_JOB}/${stream}?limit=0`, undefined, ['limit 0 → 422 field "limit" (router.py:37)']), 422, 'VALIDATION', 'limit');
        expectError(await call(admin, `job_${stream}_limit_201`, 'GET', `${jobs}/${NO_JOB}/${stream}?limit=201`, undefined, ['limit 201 → 422 field "limit" (MAX_LIMIT 200; the FE always sends 200, useTrainingJobs.ts:94)']), 422, 'VALIDATION', 'limit');
      }

      const job = rows[0];
      if (job === undefined) {
        note('environment: no training job — job / metrics / logs of a real job not exercised (404 + bounds checked)');
        return;
      }
      const id = String(job.id);
      const one = await call(admin, 'job_read', 'GET', `${jobs}/${id}`, undefined, ['200 TrainingJob equal to its list row (service.py:118-120)']);
      expectDecodes(one, 200, TrainingJobSchema, 'TrainingJob');
      expect(asJson(one.body)).toEqual(job);

      const metrics = await call(admin, 'job_metrics', 'GET', `${jobs}/${id}/metrics?since=-1&limit=200`, undefined, [
        '200 TrainingMetricPage, step ascending and > since; nextCursor = decimal string of the last step, absent only past the late window (service.py:283-305)',
      ]);
      expectDecodes(metrics, 200, TrainingMetricPageSchema, 'TrainingMetricPage');
      const points = itemsOf(metrics.body, 'metrics');
      const steps = points.map((p) => Number(p.step));
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      const mCursor = asJson(metrics.body).nextCursor;
      if (mCursor !== undefined) expect(String(mCursor)).toBe(String(steps.at(-1) ?? -1));

      const logs = await call(admin, 'job_logs', 'GET', `${jobs}/${id}/logs?since=-1&limit=200`, undefined, ['200 TrainingLogPage, seq ascending, nextCursor rule as metrics (service.py:308-327)']);
      expectDecodes(logs, 200, TrainingLogPageSchema, 'TrainingLogPage');
      const seqs = itemsOf(logs.body, 'logs').map((l) => Number(l.seq));
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      const lCursor = asJson(logs.body).nextCursor;
      if (lCursor !== undefined) {
        expect(String(lCursor)).toBe(String(seqs.at(-1) ?? -1));
        const next = await call(admin, 'job_logs_since', 'GET', `${jobs}/${id}/logs?since=${String(lCursor)}&limit=200`, undefined, ['since = nextCursor → only seq > since (exclusive, service.py:319)']);
        expectDecodes(next, 200, TrainingLogPageSchema, 'TrainingLogPage');
        for (const line of itemsOf(next.body, 'logs')) expect(Number(line.seq)).toBeGreaterThan(Number(lCursor));
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · training job create, nothing created: body rules 422, TRAINING_BASE_MODEL_MISMATCH, unknown dataset version 404, list unchanged', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const jobs = `${ML}/training-jobs`;
      const newest = async (slug: string, why: string): Promise<string | undefined> => {
        const sent = await call(admin, slug, 'GET', `${jobs}?limit=1`, undefined, [why]);
        expect(sent.res.status()).toBe(200);
        const first = itemsOf(sent.body, 'jobs')[0];
        return first === undefined ? undefined : String(first.id);
      };
      const before = await newest('job_create_before', 'baseline: newest job id');
      const valid = { family: OPENING, datasetVersionId: NO_DATASET_VERSION, baseModel: 'yolov8n', epochs: 1 };
      const post = (slug: string, body: unknown, why: string): Promise<Sent> => call(admin, slug, 'POST', jobs, body, [why, 'no Idempotency-Key → plain run, nothing stored (routing.py:166-175)']);

      expectError(await post('job_create_epochs_0', { ...valid, epochs: 0 }, 'epochs 0 → 422 field "epochs" (1-300, schemas.py:28)'), 422, 'VALIDATION', 'epochs');
      expectError(await post('job_create_epochs_301', { ...valid, epochs: 301 }, 'epochs 301 → 422 field "epochs" (EPOCHS_MAX 300)'), 422, 'VALIDATION', 'epochs');
      expectError(await post('job_create_family_not_trainable', { ...valid, family: 'dimensionReading' }, 'family dimensionReading → 422 field "family" (TrainableFamily, schemas.py:92)'), 422, 'VALIDATION', 'family');
      expectError(await post('job_create_bad_dataset_version_id', { ...valid, datasetVersionId: 'dsv_bad' }, 'datasetVersionId not dsv_<ULID> → 422 field "datasetVersionId", not 404 (schemas.py:10-11,25)'), 422, 'VALIDATION', 'datasetVersionId');
      expectError(await post('job_create_unknown_key', { ...valid, creatorId: NO_USER }, 'creatorId in the body → 422 field "creatorId" (extra=forbid; creator comes from the Principal, K05)'), 422, 'VALIDATION', 'creatorId');
      expectError(await post('job_create_base_model_mismatch', { ...valid, baseModel: 'mitB0' }, 'mitB0 is a walls model → 422 TRAINING_BASE_MODEL_MISMATCH, checked before the dataset lookup (service.py:161-162)'), 422, 'TRAINING_BASE_MODEL_MISMATCH', null);
      expectError(await post('job_create_unknown_dataset_version', valid, 'well-formed dsv id with no row → 404 NOT_FOUND resource datasetVersion (service.py:135-137)'), 404, 'NOT_FOUND', null, 'datasetVersion');

      // Real dataset versions: only bodies that fail BEFORE the insert (not ready → 422; ready but other family → 422).
      const datasets = itemsOf((await call(admin, 'job_create_datasets', 'GET', `${ML}/datasets?limit=200`, undefined, ['setup: datasets for the 422 branches'])).body, 'datasets');
      let notReadyDone = false;
      let mismatchDone = false;
      for (const dataset of datasets) {
        if (notReadyDone && mismatchDone) break;
        const dvs = itemsOf(await (await admin.get(`${ML}/datasets/${String(dataset.id)}/versions?limit=200`)).json(), 'dataset versions');
        for (const dv of dvs) {
          const family = dataset.family === WALLS ? OPENING : WALLS; // never the dataset's own family
          const baseModel = family === WALLS ? 'mitB0' : 'yolov8n';
          if (!notReadyDone && dv.status !== 'ready') {
            expectError(await post('job_create_dataset_not_ready', { family, datasetVersionId: dv.id, baseModel, epochs: 1 }, `dataset version ${String(dv.status)} → 422 DATASET_VERSION_NOT_READY (service.py:140-141)`), 422, 'DATASET_VERSION_NOT_READY', null);
            notReadyDone = true;
          } else if (!mismatchDone && dv.status === 'ready' && dataset.family !== family) {
            expectError(await post('job_create_dataset_family_mismatch', { family, datasetVersionId: dv.id, baseModel, epochs: 1 }, `ready version of a ${String(dataset.family)} dataset with family ${family} → 422 DATASET_FAMILY_MISMATCH (service.py:142-143)`), 422, 'DATASET_FAMILY_MISMATCH', null);
            mismatchDone = true;
          }
        }
      }
      if (!notReadyDone) note('environment: no building/failed dataset version — DATASET_VERSION_NOT_READY not exercised');
      if (!mismatchDone) note('environment: no ready dataset version — DATASET_FAMILY_MISMATCH not exercised');

      expect(await newest('job_create_after', 'newest job id unchanged: no job was created (service.py:164-195 never reached)')).toBe(before);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · datasets read: list + family filter + 422 + cursor, versions 404 / contract / sequence order', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const list = await call(admin, 'datasets', 'GET', `${ML}/datasets`, undefined, ['200 DatasetPage newest first (service.py:54-77); K01: no createdBy / nameKey']);
      expectDecodes(list, 200, DatasetPageSchema, 'DatasetPage');
      const datasets = itemsOf(list.body, 'datasets');
      for (const d of datasets) {
        expect(d).not.toHaveProperty('createdBy');
        expect(d).not.toHaveProperty('nameKey');
      }
      for (const family of FAMILIES) {
        const sent = await call(admin, `datasets_family_${family}`, 'GET', `${ML}/datasets?family=${family}`, undefined, [`?family=${family} → only that family`]);
        expectDecodes(sent, 200, DatasetPageSchema, 'DatasetPage');
        for (const d of itemsOf(sent.body, 'datasets')) expect(d.family).toBe(family);
      }
      expectError(await call(admin, 'datasets_family_unknown', 'GET', `${ML}/datasets?family=doors`, undefined, ['unknown family → 422 VALIDATION field "family" (service.py:59-60)']), 422, 'VALIDATION', 'family');
      expectError(await call(admin, 'datasets_limit_0', 'GET', `${ML}/datasets?limit=0`, undefined, ['limit 0 → 422 field "limit" (page_params, router.py:36)']), 422, 'VALIDATION', 'limit');
      expectError(await call(admin, 'datasets_cursor_garbage', 'GET', `${ML}/datasets?cursor=x.y`, undefined, ['bad cursor → 422 CURSOR_INVALID']), 422, 'CURSOR_INVALID', null);
      for (const [slug, id] of [['dataset_versions_unknown', NO_DATASET], ['dataset_versions_bad_pattern', 'garbage']] as const) {
        expectError(await call(admin, slug, 'GET', `${ML}/datasets/${id}/versions`, undefined, ['no dataset / wrong pattern → 404 NOT_FOUND resource dataset (service.py:49-51,116-121)']), 404, 'NOT_FOUND', null, 'dataset');
      }

      const dataset = datasets[0];
      if (dataset === undefined) {
        note('environment: no dataset — versions of a real dataset not exercised (404 branches checked)');
        return;
      }
      const versions = await call(admin, 'dataset_versions', 'GET', `${ML}/datasets/${String(dataset.id)}/versions`, undefined, [
        '200 DatasetVersionPage, sequence descending (service.py:124-141); manifestSha256/splitCounts ⇔ ready, failureCode ⇔ failed (schemas.py:7-8)',
      ]);
      expectDecodes(versions, 200, DatasetVersionPageSchema, 'DatasetVersionPage');
      const rows = itemsOf(versions.body, 'dataset versions');
      const seq = rows.map((r) => Number(r.sequence));
      expect(seq).toEqual([...seq].sort((a, b) => b - a));
      for (const row of rows) {
        expect(row.datasetId).toBe(dataset.id);
        expect(row.manifestSha256 !== undefined).toBe(row.status === 'ready');
        expect(row.failureCode !== undefined).toBe(row.status === 'failed');
        for (const key of ['projectIds', 'requeueCount', 'createdBy', 'buildStartedAt']) expect(row).not.toHaveProperty(key);
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · users read: GET /users contract, pending invitee row, memberships + activity (FE schemas, 404 unknown user, invite rows in the admin activity)', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('read', cleanup);
      const { admin, adminId } = m;
      const { email: adminEmail } = readAdminCredentials();
      const list = await call(admin, 'users_list', 'GET', '/api/users', undefined, [
        '200 {total, users} non-deleted users (created_at, id) ASC (service.py:240-246); FE AdminUserListSchema strict decodes it',
        'lastActiveAt always present (KeepNull, schemas.py:28); invitedAt/inviteExpiresAt only for pending (service.py:203-217)',
      ]);
      expectDecodes(list, 200, AdminUserListSchema, 'AdminUserList');
      const body = asJson(list.body);
      const users = asArray(body.users, 'users').map(asJson);
      expect(Number(body.total)).toBeGreaterThanOrEqual(users.length);
      for (const u of users) {
        expect(u).toHaveProperty('lastActiveAt');
        if (u.status !== 'pending') {
          expect(u).not.toHaveProperty('invitedAt');
          expect(u).not.toHaveProperty('inviteExpiresAt');
        }
      }
      const self = users.find((u) => u.id === adminId)!;
      expect(String(self.email).toLowerCase()).toBe(adminEmail.toLowerCase());
      expect(self.role).toBe('admin');
      expect(self.status).toBe('active');
      const mine = users.find((u) => u.id === m.id);
      expect(mine, 'the invitee is listed').toBeDefined();
      expect(mine!.status).toBe('pending');
      expect(mine!.lastActiveAt).toBeNull();
      expect(Date.parse(String(mine!.inviteExpiresAt))).toBeGreaterThan(Date.parse(String(mine!.invitedAt)));

      const memberships = await call(admin, 'memberships_invitee', 'GET', `/api/users/${m.id}/memberships`, undefined, ['fresh invitee → 200 [] (service.py:255-260)']);
      expectDecodes(memberships, 200, z.array(UserMembershipSchema), 'UserMembership[]');
      expect(memberships.body).toEqual([]);
      const adminMemberships = await call(admin, 'memberships_admin', 'GET', `/api/users/${adminId}/memberships`, undefined, ['admin → 200 UserMembership[]; role = the user\'s current SYSTEM role (service.py:259-260)']);
      expectDecodes(adminMemberships, 200, z.array(UserMembershipSchema), 'UserMembership[]');
      for (const row of asArray(adminMemberships.body, 'memberships').map(asJson)) expect(row.role).toBe('admin');
      expectError(await call(admin, 'memberships_unknown', 'GET', `/api/users/${NO_USER}/memberships`, undefined, ['unknown user → 404 NOT_FOUND resource user (service.py:92-96,249-252)']), 404, 'NOT_FOUND', null, 'user');

      const activity = await call(admin, 'activity_invitee', 'GET', `/api/users/${m.id}/activity`, undefined, ['invitee never acted → 200 [] (rows are by actor_id, service.py:263-271)']);
      expectDecodes(activity, 200, z.array(UserActivitySchema), 'UserActivity[]');
      expect(activity.body).toEqual([]);
      const invites = await adminActivityAbout(admin, adminId, m.id, 'user.invite', 'activity_admin');
      expect(invites, 'one user.invite row about the invitee, label = its email (service.py:385-386,188-197)').toHaveLength(1);
      expect(invites[0]!.objectLabel).toBe(m.email);
      expect(String(invites[0]!.id)).toMatch(/^\d+$/u);
      expectError(await call(admin, 'activity_unknown', 'GET', `/api/users/${NO_USER}/activity`, undefined, ['unknown user → 404 NOT_FOUND resource user']), 404, 'NOT_FOUND', null, 'user');
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · invitations: an already-active email fails the whole batch (USER_EMAIL_TAKEN, nothing created), malformed email → 422', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi();
      const { email: adminEmail } = readAdminCredentials();
      const fresh = testEmail('rollback');
      const taken = await call(admin, 'invite_taken_email', 'POST', '/api/users/invitations', { emails: [fresh, adminEmail], role: 'viewer' }, [
        'an address of an active user → 422 USER_EMAIL_TAKEN field "emails" (service.py:123-126); whole batch rolled back (service.py:399-403)',
        'counts 1 in users_invite (limiter runs before the service, users/router.py:46)',
      ]);
      expectError(taken, 422, 'USER_EMAIL_TAKEN', 'emails');
      const b = await batch();
      const users = await call(admin, 'invite_taken_after', 'GET', '/api/users', undefined, ['the fresh address of the refused batch is NOT listed (rollback, K17: no mail either)']);
      expect(asArray(asJson(users.body).users, 'users').map(asJson).some((u) => u.email === fresh)).toBe(false);
      const malformed = await call(admin, 'invite_malformed_email', 'POST', '/api/users/invitations', { emails: ['not-an-email'], role: 'viewer' }, [
        'malformed address → 422 VALIDATION field "emails" (list-level validator, schemas.py:90-94, K37)',
      ]);
      expectError(malformed, 422, 'VALIDATION', 'emails');
      // No mail for the refused address (K17: send after commit only).
      await expect(waitForMail(fresh, b.since, 3_000, INVITE_SUBJECT)).rejects.toThrow(/No mail/u);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · self guard: PATCH own role (admin → admin) → 422 USER_LAST_ADMIN / USER_SELF_MODIFICATION, nothing written', async () => {
    const cleanup = new Cleanup();
    try {
      const b = await batch();
      const listed = await call(b.admin, 'self_users', 'GET', '/api/users', undefined, ['count active admins: the answer depends on it (service.py:148-156)']);
      const admins = asArray(asJson(listed.body).users, 'users').map(asJson).filter((u) => u.role === 'admin' && u.status === 'active');
      const expected = admins.length === 1 ? 'USER_LAST_ADMIN' : 'USER_SELF_MODIFICATION';
      const sent = await call(b.admin, 'self_role', 'PATCH', `/api/users/${b.adminId}/role`, { role: 'admin', userId: b.adminId }, [
        `actor = target with ${admins.length} active admin(s) → 422 ${expected} before any write (forbid_self, service.py:148-156,288-289)`,
        'role "admin" = the current role: even a broken guard would write nothing',
      ]);
      expectError(sent, 422, expected, null);
      const after = await listedUser(b.admin, b.adminId, 'self_after', 'admin row unchanged: role admin, active');
      expect(after?.role).toBe('admin');
      expect(after?.status).toBe('active');
      const roleRows = await adminActivityAbout(b.admin, b.adminId, b.adminId, 'user.role_change', 'self_activity');
      expect(roleRows.filter((r) => Date.parse(String(r.at)) >= b.since.getTime()), 'no role_change row about the admin in this run').toHaveLength(0);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · role change: body rules, W21 path/body guard, 404, viewer → engineer revokes the old access token, same role writes nothing', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('role', cleanup);
      const { admin, adminId } = m;
      const api = await accept('role', m, cleanup);
      expect((await call(api, 'role_probe_before', 'GET', '/api/me', undefined, ['the invitee\'s Bearer works before the change'])).res.status()).toBe(200);
      const path = `/api/users/${m.id}/role`;

      expectError(await call(admin, 'role_unknown_role', 'PATCH', path, { role: 'owner', userId: m.id }, ['role outside admin/engineer/viewer → 422 field "role" (schemas.py:16,64-68)']), 422, 'VALIDATION', 'role');
      expectError(await call(admin, 'role_missing_user_id', 'PATCH', path, { role: 'engineer' }, ['userId missing → 422 field "userId" (schemas.py:68)']), 422, 'VALIDATION', 'userId');
      expectError(await call(admin, 'role_path_body_mismatch', 'PATCH', path, { role: 'engineer', userId: NO_USER }, ['body userId ≠ path → 422 PATH_BODY_MISMATCH field "userId" (W21, routing.py:138-151)']), 422, 'PATH_BODY_MISMATCH', 'userId');
      expectError(await call(admin, 'role_unknown_key', 'PATCH', path, { role: 'engineer', userId: m.id, note: 'x' }, ['unknown key → 422 field "note" (extra=forbid)']), 422, 'VALIDATION', 'note');
      expectError(await call(admin, 'role_unknown_user', 'PATCH', `/api/users/${NO_USER}/role`, { role: 'engineer', userId: NO_USER }, ['unknown target → 404 NOT_FOUND resource user (open_scope, service.py:181-185)']), 404, 'NOT_FOUND', null, 'user');

      const changed = await call(admin, 'role_to_engineer', 'PATCH', path, { role: 'engineer', userId: m.id }, [
        '200 AdminUser role engineer (service.py:284-294); token version bumped (bump_token_version) + one user.role_change row',
      ]);
      expectDecodes(changed, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(changed.body).role).toBe('engineer');
      expect(asJson(changed.body).status).toBe('active');
      await expectBearerRevoked(api, 'role_old_token_revoked', 'after the role change (ver bumped)');

      const again = await call(admin, 'role_same_role_noop', 'PATCH', path, { role: 'engineer', userId: m.id }, ['same role → 200, nothing written (no bump, no activity, service.py:290)']);
      expectDecodes(again, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(again.body).role).toBe('engineer');
      const listed = await listedUser(admin, m.id, 'role_listed', 'GET /users shows role engineer');
      expect(listed?.role).toBe('engineer');
      const rows = await adminActivityAbout(admin, adminId, m.id, 'user.role_change', 'role_activity');
      expect(rows, 'exactly ONE user.role_change row: the same-role call wrote nothing').toHaveLength(1);
      expect(rows[0]!.objectLabel).toBe(m.email);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · disable / enable an active user: sessions revoked, body rules + W21, repeat calls are no-ops, enable → active', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('state', cleanup);
      const { admin, adminId } = m;
      const api = await accept('state', m, cleanup);
      expect((await call(api, 'state_probe_before', 'GET', '/api/me', undefined, ['the user\'s Bearer works before disable'])).res.status()).toBe(200);
      const disable = `/api/users/${m.id}/disable`;
      const enable = `/api/users/${m.id}/enable`;

      expectError(await call(admin, 'disable_unknown_key', 'POST', disable, { reason: 'x' }, ['EmptyBody: any key → 422 field "reason" (schemas.py:60-61)']), 422, 'VALIDATION', 'reason');
      expectError(await call(admin, 'disable_path_body_mismatch', 'POST', disable, { userId: NO_USER }, ['userId ≠ path → 422 PATH_BODY_MISMATCH field "userId" before Pydantic (routing.py:138-151)']), 422, 'PATH_BODY_MISMATCH', 'userId');
      expectError(await call(admin, 'disable_unknown_user', 'POST', `/api/users/${NO_USER}/disable`, {}, ['unknown target → 404 NOT_FOUND resource user']), 404, 'NOT_FOUND', null, 'user');

      const off = await call(admin, 'disable', 'POST', disable, {}, ['200 AdminUser status disabled; sessions + pending tokens revoked, ver bumped, one user.disable row (service.py:297-309)']);
      expectDecodes(off, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(off.body).status).toBe('disabled');
      await expectBearerRevoked(api, 'disable_old_token_revoked', 'after disable');
      const offAgain = await call(admin, 'disable_again_noop', 'POST', disable, {}, ['already disabled → 200 disabled, nothing written (service.py:303)']);
      expectDecodes(offAgain, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(offAgain.body).status).toBe('disabled');

      const on = await call(admin, 'enable', 'POST', enable, {}, ['disabled + has a password → 200 status active, one user.enable row (service.py:312-320)']);
      expectDecodes(on, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(on.body).status).toBe('active');
      const onAgain = await call(admin, 'enable_again_noop', 'POST', enable, {}, ['not disabled → 200 unchanged, nothing written (service.py:317)']);
      expect(asJson(onAgain.body).status).toBe('active');
      const stillRevoked = await call(api, 'enable_old_token_still_revoked', 'GET', '/api/me', undefined, ['enable does not revive the revoked session → still 401 SESSION_REVOKED']);
      expectError(stillRevoked, 401, 'SESSION_REVOKED');

      expect(await adminActivityAbout(admin, adminId, m.id, 'user.disable', 'state_activity_disable'), 'one user.disable row (repeat wrote nothing)').toHaveLength(1);
      expect(await adminActivityAbout(admin, adminId, m.id, 'user.enable', 'state_activity_enable'), 'one user.enable row (repeat wrote nothing)').toHaveLength(1);
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · disable / enable a pending invitee: invitation token revoked (accept → 422 INVITATION_TOKEN_INVALID), enable → pending', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('pend', cleanup);
      const { admin } = m;
      const off = await call(admin, 'pend_disable', 'POST', `/api/users/${m.id}/disable`, {}, ['pending → 200 disabled; pending invite token revoked (revoke_tokens, service.py:307)']);
      expectDecodes(off, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(off.body).status).toBe('disabled');
      expect(asJson(off.body), 'invite window only shown for pending (service.py:205)').not.toHaveProperty('invitedAt');

      const anon = await newApiContext();
      try {
        const refused = await call(anon, 'pend_accept_revoked', 'POST', '/api/auth/invitations/accept', { token: m.token, fullName: `${PREFIX}pend`, password: `Qa-${randomUUID()}` }, [
          'the mailed token of a disabled invitee → 422 INVITATION_TOKEN_INVALID, never 401 (auth_recovery/router.py:12-15,348-349)',
          'costs 1 recovery_ip',
        ]);
        expectError(refused, 422, 'INVITATION_TOKEN_INVALID');
      } finally {
        await anon.dispose();
      }

      const on = await call(admin, 'pend_enable', 'POST', `/api/users/${m.id}/enable`, {}, ['disabled WITHOUT a password → 200 status pending (needs a resend), not active (service.py:318)']);
      expectDecodes(on, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(on.body).status).toBe('pending');
      const listed = await listedUser(admin, m.id, 'pend_listed', 'GET /users shows the invitee pending again');
      expect(listed?.status).toBe('pending');
    } finally {
      await cleanup.run();
    }
  });

  test('A08 · delete: body rules, W21, confirm mismatch, case-insensitive confirm deletes (pre-delete view), then 404 everywhere', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('del', cleanup);
      const { admin, adminId } = m;
      const path = `/api/users/${m.id}`;

      const noBody = await call(admin, 'delete_no_body', 'DELETE', path, undefined, ['no body → 422 VALIDATION (DeleteUserBody required, schemas.py:71-81)']);
      expectError(noBody, 422, 'VALIDATION');
      expectError(await call(admin, 'delete_confirm_not_email', 'DELETE', path, { userId: m.id, confirmEmail: 'not-an-email' }, ['confirmEmail not an email → 422 field "confirmEmail" (validate_wire_email, schemas.py:77-81)']), 422, 'VALIDATION', 'confirmEmail');
      expectError(await call(admin, 'delete_path_body_mismatch', 'DELETE', path, { userId: NO_USER, confirmEmail: m.email }, ['userId ≠ path → 422 PATH_BODY_MISMATCH field "userId" (W21)']), 422, 'PATH_BODY_MISMATCH', 'userId');
      expectError(await call(admin, 'delete_confirm_mismatch', 'DELETE', path, { userId: m.id, confirmEmail: testEmail('other') }, ['another address → 422 USER_CONFIRM_EMAIL_MISMATCH field "confirmEmail" (service.py:111-114)']), 422, 'USER_CONFIRM_EMAIL_MISMATCH', 'confirmEmail');
      expect((await listedUser(admin, m.id, 'delete_still_listed', 'after the four refusals the user is still listed'))?.status).toBe('pending');

      const deleted = await call(admin, 'delete', 'DELETE', path, { userId: m.id, confirmEmail: m.email.toUpperCase() }, [
        'confirmEmail compared via normalize_email (casefold) → 200 AdminUser built BEFORE the soft delete (status pending, service.py:441-460)',
      ]);
      expectDecodes(deleted, 200, AdminUserSchema, 'AdminUser');
      expect(asJson(deleted.body).id).toBe(m.id);
      expect(asJson(deleted.body).status).toBe('pending');

      expect(await listedUser(admin, m.id, 'delete_not_listed', 'soft-deleted user is gone from GET /users (service.py:242)')).toBeUndefined();
      expectError(await call(admin, 'delete_memberships_404', 'GET', `${path}/memberships`, undefined, ['soft-deleted → 404 resource user']), 404, 'NOT_FOUND', null, 'user');
      expectError(await call(admin, 'delete_activity_404', 'GET', `${path}/activity`, undefined, ['soft-deleted → 404 resource user']), 404, 'NOT_FOUND', null, 'user');
      expectError(await call(admin, 'delete_again_404', 'DELETE', path, { userId: m.id, confirmEmail: m.email }, ['second delete → 404 resource user (open_scope skips deleted rows, service.py:170-185)']), 404, 'NOT_FOUND', null, 'user');
      const rows = await adminActivityAbout(admin, adminId, m.id, 'user.delete', 'delete_activity');
      expect(rows, 'one user.delete row about the user (service.py:458)').toHaveLength(1);
    } finally {
      await cleanup.run();
    }
  });
});

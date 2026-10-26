/**
 * Phase 5 — 3D viewer BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the phase-5 screens call (FE `src/api/endpoints.ts:157-161` measurements.*, `:251-265` spatial.*; UI spec
 * `phase05_3d_viewer.spec.ts` SCR-23 load / vertex edit, SCR-25 pin / delete / undo):
 *   GET    /api/projects/:p/measurements (#16)        BE measurements/router.py:24-27, service.py:76-84
 *   POST   /api/projects/:p/measurements (#17)        BE measurements/router.py:30-38, schemas.py:58-75, service.py:108-138
 *   DELETE /api/projects/:p/measurements/:m (#18)     BE measurements/router.py:41-44, service.py:141-155
 *   GET    /api/projects/:p/spatial (N15), GET/PUT …/floors/:f/spatial/layer (N16/#35): rules unchanged since phase 4
 *          (`git diff bf83f815 2ee030c5` on spatial_read/, spatial_write/, floors/, projects/ is empty) and fully covered by
 *          `phase04_qc_layers_api.spec.ts` — this file adds NO spatial test (see `qa/coverage/phase05-be.md`).
 * QA-05c: each test is wrapped as `SCR-BE · FL-A5-NN` and its assertions regrouped under `test.step('[<row id>] …')`
 * (B05-G-* rows of flows-C6, 25-G-* rows of flows-C4 SCR-25); the 3D-path flows live in `phase05_3d_api.spec.ts`.
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, HEAD 2ee030c5), paths under `apps/api/` unless noted.
 * Every 200/201 measurement body is also parsed with the FE zod `MeasurementRecordSchema` (contract FE <-> BE).
 *
 * ## Non-serial, own data
 * Every test signs in on its own, creates the projects it needs (`qa-<runId>-…` names) and its measurements (fixed
 * `MS-…` ids are fine: ids are unique per PROJECT, BE:measurements/service.py:115-121), then deletes its projects in
 * `finally` (soft delete; measurement rows go with the project row, FK ON DELETE CASCADE, packages/db/models/
 * measurements.py:31). The one non-admin user is REAL: admin invites a run-unique `@example.test` viewer, the token
 * comes from Mailpit, the invitee accepts; later admin changes its role to engineer (#41) and it signs in once.
 * Cleanup: `DELETE /api/users/{id}` + mails. The admin account is only read.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - No rate limit on #16 / #17 / #18 (grep `rate_limit(` in measurements/: none; nginx has no `limit_req` on /api/).
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37; override LOGIN_IP_LIMIT=120): THIS file 8
 *   (one admin login in each of the 7 signed-in tests + 1 engineer login in "roles"), 0 failed. Phase-5 UI layers:
 *   main `phase05_3d_viewer.spec.ts` 2 (`signInAdmin` desktop + mobile, +1 only for a dead stored session); ui
 *   `phase05_3d_viewer_ui.spec.ts` 1 (`signedInApi`, +1 only for a dead stored session); no edge spec at authoring
 *   time. Layers run sequentially -> <= 13 per run, far below 30 even without the override.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:32-46): THIS file 1. Phases 1-4 spend 26
 *   (phase04 header) -> Phases 1-5 in one hour = 27 <= 30.
 * - `recovery_ip` 10 / 900 s per IP (override 60): 1 invitation accept.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/settings.py:14): admin 1.
 * - Body ceiling: one 1 MiB and one 1 MiB + 1 anonymous POST (#17 default `body_limit`, core/routing.py:46).
 * - Measurement caps (BE:measurements/settings.py:18-20, not overridden on the QA stack): "limits" writes 1 000
 *   measurements (2 points each) in one project and 100 x 200 points in another (~1 110 requests, pool of 8 per project;
 *   the project advisory lock serialises them, service.py:114).
 * - Idempotency records: "idempotency" leaves 3 rows (24 h TTL, core/idempotency.py:49).
 * - Mailpit: 1 invitation mail, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { MeasurementRecordSchema } from '../../src/api/schemas/measurements';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { EVIDENCE_DIR, TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE:auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppFront'; // BE:auth_recovery/messages.py (phase01-04 api specs)
const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)
const DEFAULT_BODY_LIMIT = 1024 * 1024; // BE:core/routing.py:46 (#17 declares no route_options)
const POINTS_MAX = 200; // BE:measurements/settings.py:19
const POINTS_TOTAL_MAX = 20_000; // settings.py:20
const MEASUREMENTS_MAX = 1000; // settings.py:18
const RECORD_KEYS = ['id', 'mode', 'name', 'points', 'rawValueMm'] as const; // schemas.py:78-85

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Mode = 'pointToPoint' | 'perpendicular' | 'height' | 'floorArea';
interface Point {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const projectName = (slug: string): string => `${PREFIX}${slug}-${uniq()}`;
const listPath = (p: string): string => `/api/projects/${p}/measurements`;
const itemPath = (p: string, m: string): string => `/api/projects/${p}/measurements/${m}`;

/** #17 body (schemas.py:58-65): the full client-made record, camelCase. */
function rec(id: string, o: { name?: string; mode?: Mode; points?: Point[]; rawValueMm?: number } = {}): Json {
  return {
    id,
    name: o.name ?? `Đo ${id}`,
    mode: o.mode ?? 'pointToPoint',
    points: o.points ?? [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
    rawValueMm: o.rawValueMm ?? 1000,
  };
}
const pointsOf = (n: number): Point[] => Array.from({ length: n }, (_, i) => ({ x: i * 10.5, y: i % 7 }));

/* ------------------------------------------------------------------ phase-local helpers (pattern of phase04 api) */

function note(description: string): void {
  test.info().annotations.push({ type: 'note', description });
}

function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

const objs = (value: unknown, what: string): Json[] => asArray(value, what).map((v) => asJson(v, what));

/** Every `required` key present and nothing outside `required` ∪ `optional`. */
function expectKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): Json {
  const record = asJson(value);
  const keys = Object.keys(record);
  for (const key of required) expect.soft(keys, `key "${key}"`).toContain(key);
  expect.soft(keys.filter((key) => !required.includes(key) && !optional.includes(key)), 'unexpected keys').toEqual([]);
  return record;
}

/** The FE decodes this body with `schema` (the screen's zod); a failure is an FE<->BE contract break. */
function expectZod(schema: ZodTypeAny, value: unknown, what: string): void {
  const parsed = schema.safeParse(value);
  const issues = parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3));
  expect.soft(parsed.success, `${what} decodes with the FE zod schema ${issues}`).toBe(true);
}

/** A record body: exact keys (no createdBy / updatedAt / bodySha256, K01), FE zod ok. */
function expectRecord(value: unknown, what: string): Json {
  const body = expectKeys(value, RECORD_KEYS);
  expectZod(MeasurementRecordSchema, value, what);
  return body;
}

interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `A05_<ev>.json` (secrets redacted by `captureExchange`).
 * A `Buffer` is sent raw (a string `data` would be JSON-encoded again by Playwright, BUG-107/279). */
async function call(
  api: APIRequestContext,
  ev: string,
  method: Method,
  path: string,
  data: unknown,
  claims: readonly string[],
  headers?: Record<string, string>,
): Promise<Sent> {
  const raw = Buffer.isBuffer(data);
  const res = await api.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    headers: { ...(raw ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
  });
  let shown: unknown = data ?? null;
  if (raw) shown = data.length > 2048 ? `<${String(data.length)} raw bytes>` : data.toString('utf8');
  const body = await captureExchange(`A05_${ev}.json`, { method, path, body: shown }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource`). `field: null` = must be absent. */
function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string | null; readonly resource?: string } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field === null) expect.soft(body, `${code} has no field`).not.toHaveProperty('field');
  else if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  return body;
}

/** Evidence for a bulk case (summary only — one file per request would be 1 000 files). */
async function captureSummary(name: string, req: Json, summary: Json, assertions: readonly string[]): Promise<void> {
  const record = { request: req, response: summary, assertions, capturedAt: new Date().toISOString() };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = join(EVIDENCE_DIR, `A05_${name}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  await test.info().attach(`A05_${name}.json`, { path: file, contentType: 'application/json' });
}

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
        note(`cleanup: ${String(error)}`);
      }
    }
  }
}

async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

/** Setup: admin creates a project and registers its deletion (404 = the test already deleted it). */
async function newProject(api: APIRequestContext, ev: string, cleanup: Cleanup): Promise<string> {
  const sent = await call(api, `${ev}_create`, 'POST', '/api/projects', { name: projectName(ev) }, [
    'setup: 201 ProjectOut (projects/router.py)',
  ]);
  expect(sent.res.status(), 'setup create project').toBe(201);
  const id = String(asJson(sent.body).id);
  cleanup.add(async () => {
    const res = await api.delete(`/api/projects/${id}`);
    if (res.status() !== 200 && res.status() !== 404) note(`DELETE /api/projects/${id} → ${String(res.status())}`);
  });
  return id;
}

/** `ProjectOut.updatedAt` — moved by `touch_project` (BE:projects/summaries.py:177). */
async function updatedAt(api: APIRequestContext, id: string, ev: string): Promise<unknown> {
  const sent = await call(api, ev, 'GET', `/api/projects/${id}`, undefined, ['read-back: 200 ProjectOut.updatedAt (#24)']);
  expect(sent.res.status()).toBe(200);
  return asJson(sent.body).updatedAt;
}

/** #16 read-back: 200, a bare array (router.py:24-27), each item a record the FE decodes. */
async function list(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', listPath(pid), undefined, [claim]);
  expect(sent.res.status(), `#16 ${ev}`).toBe(200);
  return objs(sent.body, '#16').map((r) => expectRecord(r, '#16 item'));
}

async function post(api: APIRequestContext, ev: string, pid: string, data: unknown, claims: readonly string[], headers?: Record<string, string>): Promise<Sent> {
  return call(api, ev, 'POST', listPath(pid), data, claims, headers);
}

/** Many #17 without per-request evidence; returns the status of each, in order. Pool of `width` in flight. */
async function bulkPost(api: APIRequestContext, pid: string, bodies: readonly Json[], width = 8): Promise<number[]> {
  const statuses: number[] = new Array<number>(bodies.length).fill(0);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < bodies.length) {
      const i = next++;
      statuses[i] = (await api.post(listPath(pid), { data: bodies[i] })).status();
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return statuses;
}

const countBy = (xs: readonly number[]): Record<string, number> =>
  xs.reduce<Record<string, number>>((acc, s) => ({ ...acc, [String(s)]: (acc[String(s)] ?? 0) + 1 }), {});

/* ---- the real non-admin user (invitation → Mailpit → accept → refresh) */

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly api: APIRequestContext;
}

function cookieFrom(res: APIResponse, name: string): string | undefined {
  const line = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${name}=`));
  return line?.value.slice(name.length + 1).split(';')[0];
}

/** Admin invites a run-unique `role` user (users/router.py:55-63), the invitee accepts with the mailed token, one
 * refresh gives its Bearer. Registers user + mail cleanup. */
async function realUser(admin: APIRequestContext, role: 'viewer' | 'engineer', ev: string, cleanup: Cleanup): Promise<TestUser> {
  const email = testEmail(ev);
  const password = `Qa-${randomUUID()}`;
  const since = new Date(Date.now() - 5_000);
  const sent = await call(admin, `${ev}_invite`, 'POST', '/api/users/invitations', { emails: [email], role }, [
    `setup: admin invites a run-unique @example.test ${role} → 201, one pending user`,
  ]);
  expect(sent.res.status()).toBe(201);
  const user = objs(sent.body, 'invitations').find((u) => u.email === email);
  const id = String(user?.id);
  cleanup.add(async () => {
    const res = await admin.delete(`/api/users/${id}`, { data: { userId: id, confirmEmail: email } });
    if (res.status() !== 200) note(`DELETE /api/users/${id} → ${String(res.status())}`);
  });
  const mail: Mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation link has no #token');
  const anon = await newApiContext();
  let bearer = '';
  try {
    const accept = await call(anon, `${ev}_accept`, 'POST', '/api/auth/invitations/accept', { token, fullName: `${PREFIX}${ev}`, password }, [
      'setup: invitee accepts with the real mailed token → 204 + refresh cookie',
    ]);
    expect(accept.res.status()).toBe(204);
    const refreshCookie = cookieFrom(accept.res, REFRESH);
    if (!refreshCookie) throw new Error('accept: no refresh cookie');
    const refreshed = await call(anon, `${ev}_refresh`, 'POST', '/api/auth/refresh', undefined, [
      `setup: 200 W16 roles ["${role}"] + access token`,
    ], { Cookie: `${REFRESH}=${refreshCookie}` });
    expect(refreshed.res.status()).toBe(200);
    expect(asJson(refreshed.body).roles).toEqual([role]);
    bearer = String(((await refreshed.res.json()) as Json).accessToken);
  } finally {
    await anon.dispose();
  }
  const base = apiBaseUrl();
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${bearer}` } });
  cleanup.add(() => api.dispose());
  return { id, email, password, api };
}

/* ------------------------------------------------------------------ tests (QA-05c: every assertion group is a `[<row id>]` step;
 * B05-G-* = flows-C6 FL-A5-01..08, 25-G-* = flows-C4 SCR-25 rows added to the same 8 tests) */

test.describe('A05 phase-5 backend (measurements #16 / #17 / #18)', () => {
  test('SCR-BE · FL-A5-01 · wrap A05 · anonymous: #16 / #17 / #18 → 401 UNAUTHENTICATED before the body is read (also truncated JSON); #17 default ceiling 1 MiB → 401, 1 MiB + 1 → 413 PAYLOAD_TOO_LARGE before auth', async () => {
    // core/routing.py:129-136,264 (principal before the body); core/routing.py:46 DEFAULT_BODY_LIMIT; core/middleware.py:217-236.
    const anon = await newApiContext();
    try {
      const routes: Array<[string, Method, string, unknown]> = [
        ['list', 'GET', listPath(MISSING_PROJECT), undefined],
        ['create', 'POST', listPath(MISSING_PROJECT), rec('MS-0001')],
        ['delete', 'DELETE', itemPath(MISSING_PROJECT, 'MS-0001'), undefined],
        ['create_malformed', 'POST', listPath(MISSING_PROJECT), Buffer.from('{"id": "MS-0001",')],
      ];
      const jsonOf = (size: number): Buffer => Buffer.from(`{"x":"${'a'.repeat(size - 8)}"}`);

      await test.step('[B05-G-001] anonymous #16 / #17 / #18 (also truncated JSON) → 401 UNAUTHENTICATED before the body', async () => {
        for (const [slug, method, path, data] of routes) {
          const sent = await call(anon, `anon_${slug}_401`, method, path, data, [
            '401 UNAUTHENTICATED: no Bearer, checked before the body / path ids (core/routing.py:129-136)',
          ]);
          expectError(sent, 401, 'UNAUTHENTICATED');
        }
      });

      await test.step('[B05-G-003] anonymous #17 at 1 MiB → 401, at 1 MiB + 1 → 413 PAYLOAD_TOO_LARGE', async () => {
        const atLimit = await call(anon, 'anon_create_1mib_401', 'POST', listPath(MISSING_PROJECT), jsonOf(DEFAULT_BODY_LIMIT), [
          '1 048 576-byte body passes the #17 ceiling (default body_limit 1 MiB, routing.py:46) → 401',
        ]);
        expect.soft(atLimit.res.status()).toBe(401);
        const over = await call(anon, 'anon_create_1mib_plus1_413', 'POST', listPath(MISSING_PROJECT), jsonOf(DEFAULT_BODY_LIMIT + 1), [
          '1 MiB + 1 → 413 PAYLOAD_TOO_LARGE before auth (core/middleware.py:229-236; nginx allows 8m)',
        ]);
        expectError(over, 413, 'PAYLOAD_TOO_LARGE');
      });

      await test.step('[25-G-018] anonymous on a malformed project id: 401 on all three routes, not 404', async () => {
        // The principal is resolved before the path ids are looked at (core/routing.py:129-136).
        for (const [slug, method, path, data] of [
          ['list', 'GET', listPath('prj_bad'), undefined],
          ['create', 'POST', listPath('prj_bad'), rec('MS-0001')],
          ['delete', 'DELETE', itemPath('prj_bad', 'nope'), undefined],
        ] as const) {
          const sent = await call(anon, `anon_badid_${slug}_401`, method, path, data, ['401 UNAUTHENTICATED before the project / measurement id check']);
          expectError(sent, 401, 'UNAUTHENTICATED');
        }
      });
    } finally {
      await anon.dispose();
    }
  });

  test('SCR-BE · FL-A5-02 · wrap A05 · create + list: fresh project → #16 []; #17 → 201 for each mode, the stored record is the normalised body (name trimmed + NFC, LRM kept, integer number accepted, absent z stays absent, 15-digit id, 120-char name), no server fields; #16 in numeric id order (MS-0002 < MS-9999 < MS-10000); a create touches the project, a list does not', async () => {
    // service.py:43-54 (normalize), 76-84 (order by char_length, C collation), 108-138 (create + touch_project);
    // schemas.py:16-85; text.py:15-24 (nfc(strip), 1..120, Cc / bidi override); packages/core/text.py:6-45.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = await newProject(admin, 'create', cleanup);
      let t0: unknown;
      let t1: unknown;
      let t2: unknown;
      let t3: unknown;
      let firstBody: Json = {};
      const created: Json[] = [];
      let all: Json[] = [];

      await test.step('[B05-G-070] fresh project → #16 200 []', async () => {
        expect.soft(await list(admin, 'create_list_empty', pid, '200 [] (bare array) for a project without measurements')).toEqual([]);
        t0 = await updatedAt(admin, pid, 'create_project_t0');
      });

      await test.step('[B05-G-080] #17 → 201 and the stored record is the normalised body', async () => {
        const nfd = `  ${'Phòng khách'.normalize('NFD')} `;
        const first = await post(admin, 'create_point_to_point_201', pid, rec('MS-10000', {
          name: nfd, points: [{ x: 0, y: 0 }, { x: 4000.5, y: 0, z: 1200 }], rawValueMm: 4000,
        }), ['201: name stored NFC + trimmed (text.py:15-24); point 0 has no z key (W2, schemas.py:50-55); integer 4000 accepted (strict float takes int)']);
        expect.soft(first.res.status()).toBe(201);
        firstBody = expectRecord(first.body, '#17 201');
        expect.soft(firstBody).toEqual({
          id: 'MS-10000', name: 'Phòng khách', mode: 'pointToPoint',
          points: [{ x: 0, y: 0 }, { x: 4000.5, y: 0, z: 1200 }], rawValueMm: 4000,
        });
        expect.soft(String(firstBody.name)).toBe(String(firstBody.name).normalize('NFC'));
        created.push(firstBody);
        t1 = await updatedAt(admin, pid, 'create_project_t1');
      });

      await test.step('[B05-G-081] the other 3 modes → 201 each, echoing the normalised body', async () => {
        const others: Array<[string, Json, string]> = [
          ['perpendicular', rec('MS-9999', { mode: 'perpendicular', name: 'Đo‎ vuông góc', rawValueMm: 2500.25 }), 'LRM (U+200E) is not blocked for measurement names (bidi_marks=False, packages/core/text.py:28)'],
          ['height', rec('MS-0002', { mode: 'height', points: [{ x: 10, y: 10, z: 0 }, { x: 10, y: 10, z: 3000 }], rawValueMm: 3000 }), 'z: 0 is kept as a key (absent ≠ 0)'],
          ['floor_area', rec('MS-123456789012345', {
            mode: 'floorArea', name: 'a'.repeat(120), points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }], rawValueMm: 12_000_000,
          }), 'floorArea with exactly 3 points (schemas.py:21,67-75); 15-digit id (ids.py:37); 120-char name (text.py:12)'],
        ];
        for (const [slug, body, claim] of others) {
          const sent = await post(admin, `create_${slug}_201`, pid, body, [`201 ${String(body.mode)}: ${claim}`]);
          expect.soft(sent.res.status(), slug).toBe(201);
          const stored = expectRecord(sent.body, `#17 ${slug}`);
          expect.soft(stored, `${slug} echoes the normalised body`).toEqual(body);
          created.push(stored);
        }
        t2 = await updatedAt(admin, pid, 'create_project_t2');
        all = await list(admin, 'create_list_numeric_order', pid, '200: ordered by (char_length(id), id COLLATE "C") = numeric order (service.py:76-84)');
      });

      await test.step('[B05-G-071] #16 items have exactly the 5 record keys, absent z stays absent, FE zod decodes', async () => {
        // `list` → `expectRecord` already checks keys + zod per item; the stored bodies must equal the #17 answers.
        for (const r of created) expect.soft(all.find((a) => a.id === r.id), `#16 item ${String(r.id)} = #17 body`).toEqual(r);
        expect.soft(all.every((r) => Object.keys(r).length === RECORD_KEYS.length), 'five keys each').toBe(true);
        expect.soft(asArray(asJson(all.find((r) => r.id === 'MS-10000')).points, 'points').map((q) => 'z' in asJson(q, 'point'))).toEqual([false, true]);
      });

      await test.step('[B05-G-072] #16 numeric id order: MS-0002 < MS-9999 < MS-10000 < 15 digits', async () => {
        expect.soft(all.map((r) => r.id)).toEqual(['MS-0002', 'MS-9999', 'MS-10000', 'MS-123456789012345']);
      });

      await test.step('[B05-G-082] a create advances the project updatedAt', async () => {
        expect.soft(t1, 'a create bumps project updatedAt (service.py:137)').not.toBe(t0);
        expect.soft(t2, 'three more creates bump it again').not.toBe(t1);
      });

      await test.step('[B05-G-074] a list does not touch the project', async () => {
        t3 = await updatedAt(admin, pid, 'create_project_t3');
        expect.soft(t3, '#16 never touches the project').toBe(t2);
      });

      await test.step('[25-G-021] end to end: one more create → numeric order kept, stored = body, project touched', async () => {
        // BMS:normalize, list_records, touch_project.
        const extra = rec('MS-0005', { name: '  Đo thêm  ' });
        const sent = await post(admin, 'create_extra_201', pid, extra, ['201: stored record = normalised body']);
        expect.soft(sent.res.status()).toBe(201);
        expect.soft(expectRecord(sent.body, 'extra')).toEqual({ ...extra, name: 'Đo thêm' });
        const final = await list(admin, 'create_list_final', pid, '200: five records in numeric id order');
        expect.soft(final.map((r) => r.id)).toEqual(['MS-0002', 'MS-0005', 'MS-9999', 'MS-10000', 'MS-123456789012345']);
        expect.soft(await updatedAt(admin, pid, 'create_project_t4'), 'the create touched the project').not.toBe(t3);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-03 · wrap A05 · same id / delete / undo: repeat of the stored body → 200 same record without a touch (also an equal-after-normalising body: spaces, NFD, -0.0, 1000.0); other body → 409 MEASUREMENT_ID_TAKEN field id, nothing overwritten; ids are per project; #18 → 204 empty + touch, gone from #16; again / malformed / other project → 404 measurement; undo re-POST → 201', async () => {
    // service.py:101-105,115-123 (existing id: digest equal → 200, else 409), 141-155 (hard delete, 404 resource measurement);
    // errors.py:5-6; router.py:34-38,41-44.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const p1 = await newProject(admin, 'same-id-1', cleanup);
      const p2 = await newProject(admin, 'same-id-2', cleanup);
      const base = rec('MS-0001', { name: 'Đo cửa' });
      const created = await post(admin, 'dup_create_201', p1, base, ['201 created']);
      expect(created.res.status()).toBe(201);
      const t1 = await updatedAt(admin, p1, 'dup_project_t1');

      await test.step('[B05-G-083] repeat of the stored body (also equal after normalising) → 200 same record, no touch', async () => {
        const again = await post(admin, 'dup_repeat_200', p1, base, ['200: same id + same normalised body → the stored record, nothing written (router.py:36-37)']);
        expect.soft(again.res.status()).toBe(200);
        expect.soft(again.body).toEqual(created.body);
        const raw = Buffer.from(
          `{"id":"MS-0001","name":" ${'Đo cửa'.normalize('NFD')}  ","mode":"pointToPoint",` +
            '"points":[{"x":-0.0,"y":0.0},{"x":1000.0,"y":0}],"rawValueMm":1000.0}',
        );
        const equalAfterNorm = await post(admin, 'dup_repeat_normalised_200', p1, raw, [
          '200: name spaces + NFD, -0.0 and 1000.0 normalise to the stored body → same SHA-256 (service.py:30-60)',
        ]);
        expect.soft(equalAfterNorm.res.status()).toBe(200);
        expect.soft(equalAfterNorm.body).toEqual(created.body);
        expect.soft(await updatedAt(admin, p1, 'dup_project_t2'), 'a 200 repeat does not touch the project (service.py:111)').toBe(t1);
      });

      await test.step('[B05-G-084] other body → 409 MEASUREMENT_ID_TAKEN field id, nothing overwritten', async () => {
        const other = await post(admin, 'dup_other_body_409', p1, { ...base, rawValueMm: 1001 }, [
          '409 MEASUREMENT_ID_TAKEN field id: same id, different body; never an upsert (service.py:101-105)',
        ]);
        expectError(other, 409, 'MEASUREMENT_ID_TAKEN', { field: 'id' });
        const kept = await list(admin, 'dup_list_after_409', p1, '200: the stored record is unchanged (rawValueMm 1000)');
        expect.soft(kept).toEqual([created.body]);
      });

      await test.step('[B05-G-073] ids are per project: project 2 takes its own MS-0001', async () => {
        const inP2 = await post(admin, 'dup_other_project_201', p2, { ...base, rawValueMm: 1001 }, ['201: ids are unique per project (PK project_id + measurement_id)']);
        expect.soft(inP2.res.status()).toBe(201);
        const p2List = await list(admin, 'dup_list_project2', p2, '200: project 2 sees only its own MS-0001 (rawValueMm 1001)');
        expect.soft(p2List.map((r) => [r.id, r.rawValueMm])).toEqual([['MS-0001', 1001]]);
      });

      await test.step('[B05-G-110] #18 → 204 empty body + touch, gone from #16', async () => {
        const only1 = await post(admin, 'dup_create_ms0003_201', p1, rec('MS-0003'), ['setup: 201 MS-0003 in project 1 only']);
        expect(only1.res.status()).toBe(201);
        const t3 = await updatedAt(admin, p1, 'dup_project_t3');
        const del = await call(admin, 'dup_delete_204', 'DELETE', itemPath(p1, 'MS-0001'), undefined, ['204 empty body: hard delete (router.py:41-44)']);
        expect.soft(del.res.status()).toBe(204);
        expect.soft(del.body ?? null, '204 has no body').toBeNull();
        expect.soft(await updatedAt(admin, p1, 'dup_project_t4'), 'a delete bumps updatedAt (service.py:155)').not.toBe(t3);
        expect.soft((await list(admin, 'dup_list_after_delete', p1, '200: MS-0001 gone, MS-0003 kept')).map((r) => r.id)).toEqual(['MS-0003']);
      });

      await test.step('[B05-G-111] #18 again / malformed / other project → 404 resource measurement', async () => {
        const foreign = await call(admin, 'dup_delete_foreign_404', 'DELETE', itemPath(p2, 'MS-0003'), undefined, [
          '404 resource measurement: MS-0003 is not in THIS project (service.py:146-154)',
        ]);
        expectError(foreign, 404, 'NOT_FOUND', { resource: 'measurement' });
        for (const [slug, id] of [['again', 'MS-0001'], ['short', 'MS-12'], ['word', 'nope'], ['sixteen', 'MS-1234567890123456']] as const) {
          const sent = await call(admin, `dup_delete_${slug}_404`, 'DELETE', itemPath(p1, id), undefined, [
            '404 resource measurement: id malformed (no lock, no query) or not in the project (service.py:143-154)',
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'measurement' });
        }
      });

      await test.step('[B05-G-085] undo re-POST of the deleted record → 201', async () => {
        const undo = await post(admin, 'dup_undo_repost_201', p1, base, ['201: the undo toast re-POSTs the deleted record unchanged → created again (router.py:34)']);
        expect.soft(undo.res.status()).toBe(201);
        expect.soft(undo.body).toEqual(created.body);
        expect.soft((await list(admin, 'dup_list_after_undo', p1, '200: MS-0001 back')).map((r) => r.id)).toEqual(['MS-0001', 'MS-0003']);
      });

      await test.step('[25-G-014] same id: same body 200 (no touch), the same id with another mode → 409 MEASUREMENT_ID_TAKEN field id', async () => {
        // BMS:create_record, _resolve_existing (sha256 of the normalised body).
        const t = await updatedAt(admin, p1, 'dup_g14_project_before');
        const same = await post(admin, 'dup_g14_same_200', p1, base, ['200: identical body']);
        expect.soft(same.res.status()).toBe(200);
        const mode = await post(admin, 'dup_g14_mode_409', p1, { ...base, mode: 'perpendicular' }, ['409 MEASUREMENT_ID_TAKEN field id: only the mode differs']);
        expectError(mode, 409, 'MEASUREMENT_ID_TAKEN', { field: 'id' });
        expect.soft(await updatedAt(admin, p1, 'dup_g14_project_after'), 'neither answer touches the project').toBe(t);
      });

      await test.step('[25-G-015] #18 → 204, again → 404 resource measurement, undo re-POST → 201', async () => {
        // BMS:delete_record.
        const del = await call(admin, 'dup_g15_delete_204', 'DELETE', itemPath(p1, 'MS-0003'), undefined, ['204']);
        expect.soft(del.res.status()).toBe(204);
        expectError(await call(admin, 'dup_g15_again_404', 'DELETE', itemPath(p1, 'MS-0003'), undefined, ['404 measurement']), 404, 'NOT_FOUND', { resource: 'measurement' });
        const undo = await post(admin, 'dup_g15_undo_201', p1, rec('MS-0003'), ['201: undo re-POST of the deleted record']);
        expect.soft(undo.res.status()).toBe(201);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-04 · wrap A05 · #17 body rules → 422 VALIDATION with field (id MS-<4..15 digits> string, name 1..120 after trim / no Cc / no bidi override / not null, mode enum, points 2 (3 for floorArea)..200, x / y / z finite strict numbers, z not null, strict keys at every depth, rawValueMm ≥ 0 finite) and nothing written; W21 projectId ≠ path → 422 PATH_BODY_MISMATCH; truncated JSON → 400; project gate before Pydantic', async () => {
    // schemas.py:18-75 (Real strict + allow_inf_nan=False, NullFreeModel, point count), text.py:15-24, core/wire.py:46,115-118
    // (extra="forbid"), core/errors.py:136-183 (field = first error, camelCase path), core/routing.py:138-151 (W21).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = await newProject(admin, 'rules', cleanup);
      const t0 = await updatedAt(admin, pid, 'rules_project_t0');
      const ok = rec('MS-0001');
      const p0 = { x: 0, y: 0 };
      const p1 = { x: 1000, y: 0 };

      await test.step('[B05-G-090] field rules → 422 VALIDATION with field, nothing written', async () => {
        const cases: Array<[string, unknown, string | null]> = [
          ['id_short', { ...ok, id: 'MS-123' }, 'id'],
          ['id_16_digits', { ...ok, id: 'MS-1234567890123456' }, 'id'],
          ['id_lower', { ...ok, id: 'ms-1234' }, 'id'],
          ['id_number', { ...ok, id: 1234 }, 'id'],
          ['id_missing', { name: ok.name, mode: ok.mode, points: ok.points, rawValueMm: ok.rawValueMm }, 'id'],
          ['name_empty', { ...ok, name: '' }, 'name'],
          ['name_spaces', { ...ok, name: '   ' }, 'name'],
          ['name_121', { ...ok, name: 'a'.repeat(121) }, 'name'],
          ['name_bell', { ...ok, name: 'Đo\u0007' }, 'name'],
          ['name_rlo', { ...ok, name: 'Đo‮' }, 'name'],
          ['name_null', { ...ok, name: null }, 'name'],
          ['mode_unknown', { ...ok, mode: 'area' }, 'mode'],
          ['points_one', { ...ok, points: [p0] }, 'points'],
          ['points_empty', { ...ok, points: [] }, 'points'],
          ['floor_area_two', { ...ok, mode: 'floorArea', points: [p0, p1] }, 'points'],
          ['points_201', { ...ok, points: pointsOf(POINTS_MAX + 1) }, 'points'],
          ['x_string', { ...ok, points: [{ x: '1', y: 0 }, p1] }, 'points.0.x'],
          ['x_bool', { ...ok, points: [{ x: true, y: 0 }, p1] }, 'points.0.x'],
          ['y_missing', { ...ok, points: [{ x: 0 }, p1] }, 'points.0.y'],
          ['z_null', { ...ok, points: [{ x: 0, y: 0, z: null }, p1] }, 'points.0'],
          ['point_extra_key', { ...ok, points: [{ x: 0, y: 0, w: 1 }, p1] }, 'points.0.w'],
          ['raw_negative', { ...ok, rawValueMm: -1 }, 'rawValueMm'],
          ['raw_string', { ...ok, rawValueMm: '1000' }, 'rawValueMm'],
          ['raw_missing', { id: ok.id, name: ok.name, mode: ok.mode, points: ok.points }, 'rawValueMm'],
          ['extra_key', { ...ok, createdBy: 'usr_x' }, 'createdBy'],
          ['project_id_equal', { ...ok, projectId: pid }, 'projectId'],
          ['x_nan', Buffer.from('{"id":"MS-0001","name":"Đo","mode":"pointToPoint","points":[{"x":NaN,"y":0},{"x":1,"y":0}],"rawValueMm":1}'), 'points.0.x'],
          ['x_1e400', Buffer.from('{"id":"MS-0001","name":"Đo","mode":"pointToPoint","points":[{"x":1e400,"y":0},{"x":1,"y":0}],"rawValueMm":1}'), 'points.0.x'],
          ['raw_infinity', Buffer.from('{"id":"MS-0001","name":"Đo","mode":"pointToPoint","points":[{"x":0,"y":0},{"x":1,"y":0}],"rawValueMm":Infinity}'), 'rawValueMm'],
          ['array_body', [], null],
        ];
        for (const [slug, data, field] of cases) {
          const sent = await post(admin, `rules_${slug}_422`, pid, data, [
            `422 VALIDATION ${field === null ? 'without field (error at the body root)' : `field ${field}`} (schemas.py:18-75; core/errors.py:170-183)`,
          ]);
          expectError(sent, 422, 'VALIDATION', { field });
        }
        expect.soft(await list(admin, 'rules_list_after', pid, '200 []: no rejected body was written')).toEqual([]);
        expect.soft(await updatedAt(admin, pid, 'rules_project_t1'), 'rejected writes never touch the project').toBe(t0);
      });

      await test.step('[B05-G-091] W21 projectId ≠ path → 422 PATH_BODY_MISMATCH field projectId', async () => {
        const mismatch = await post(admin, 'rules_project_id_mismatch_422', pid, { ...ok, projectId: MISSING_PROJECT }, [
          '422 PATH_BODY_MISMATCH field projectId: W21 guard before Pydantic (core/routing.py:138-151)',
        ]);
        expectError(mismatch, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      });

      await test.step('[B05-G-092] truncated JSON → 400 MALFORMED_JSON without field', async () => {
        const truncated = await post(admin, 'rules_truncated_400', pid, Buffer.from('{"id":"MS-0001",'), ['400 MALFORMED_JSON (core/errors.py:173-174)']);
        expectError(truncated, 400, 'MALFORMED_JSON', { field: null });
      });

      await test.step('[B05-G-093] project gate runs before Pydantic: malformed / missing project + invalid body → 404 project', async () => {
        for (const [slug, project] of [['malformed', 'prj_bad'], ['missing', MISSING_PROJECT]] as const) {
          const sent = await post(admin, `rules_${slug}_project_invalid_body_404`, project, { ...ok, name: '' }, [
            '404 resource project: require_project (param dependency) runs before Pydantic (projects/access.py:28-33,78-86)',
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });

      await test.step('[25-G-017] missing mode / name / points → 422 VALIDATION on that field; nothing written', async () => {
        // BMC:28-75 (every field is required).
        for (const [slug, key] of [['mode', 'mode'], ['name', 'name'], ['points', 'points']] as const) {
          const { [key]: _omitted, ...without } = ok;
          const sent = await post(admin, `rules_g17_${slug}_missing_422`, pid, without, [`422 VALIDATION field ${key}: required`]);
          expectError(sent, 422, 'VALIDATION', { field: key });
        }
        expect.soft(await list(admin, 'rules_g17_list_after', pid, '200 []: nothing written')).toEqual([]);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-05 · wrap A05 · roles: viewer member → #16 200 but #17 / #18 → 403 FORBIDDEN (before Pydantic, W21 and the id check); viewer non-member → 404 project on all three; malformed / missing / deleted project → 404 project; after #41 role → engineer: member #17 → 201, #18 of another user\'s record → 204 (no owner rule), non-member → 404', async () => {
    // router.py:21,24,30-44 (GET any member, POST/DELETE layer.edit); projects/access.py:28-33,45-86;
    // packages/domain/permissions/matrix.py:47 (layer.edit admin/engineer yes, viewer no); service.py:141-155 (no created_by check).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const p1 = await newProject(admin, 'roles-member', cleanup);
      const p2 = await newProject(admin, 'roles-outside', cleanup);
      const p3 = await newProject(admin, 'roles-deleted', cleanup);
      const adminRec = await post(admin, 'roles_admin_create_201', p1, rec('MS-0001'), ['setup: 201 admin record']);
      expect(adminRec.res.status()).toBe(201);
      expect((await post(admin, 'roles_admin_create_p2_201', p2, rec('MS-0001'), ['setup: 201 record in project 2'])).res.status()).toBe(201);

      const user = await realUser(admin, 'viewer', 'roles', cleanup);
      const add = await call(admin, 'roles_add_member', 'POST', `/api/projects/${p1}/members`, { email: user.email }, [
        'setup: N3 adds the viewer to project 1 → 201',
      ]);
      expect(add.res.status()).toBe(201);
      const viewer = user.api;
      const forbidden = async (slug: string, method: Method, path: string, data: unknown): Promise<void> => {
        const sent = await call(viewer, `roles_viewer_${slug}_403`, method, path, data, [
          '403 FORBIDDEN without resource: layer.edit is false for viewer; the gate runs before Pydantic, W21 and the id check',
        ]);
        const body = expectError(sent, 403, 'FORBIDDEN');
        expect.soft(body, '403 carries no resource').not.toHaveProperty('resource');
      };

      await test.step('[B05-G-094] viewer member #17 (valid, invalid, W21 mismatch) → 403 FORBIDDEN before Pydantic / W21', async () => {
        const seen = await list(viewer, 'roles_viewer_list_200', p1, '200: any member reads #16 (router.py:24)');
        expect.soft(seen.map((r) => r.id)).toEqual(['MS-0001']);
        await forbidden('post_valid', 'POST', listPath(p1), rec('MS-0002'));
        await forbidden('post_invalid', 'POST', listPath(p1), { id: 'x' });
        await forbidden('post_path_mismatch', 'POST', listPath(p1), { ...rec('MS-0002'), projectId: MISSING_PROJECT });
      });

      await test.step('[B05-G-112] viewer member #18 (valid and malformed id) → 403 FORBIDDEN', async () => {
        await forbidden('delete', 'DELETE', itemPath(p1, 'MS-0001'), undefined);
        await forbidden('delete_malformed_id', 'DELETE', itemPath(p1, 'nope'), undefined);
        expect.soft((await list(admin, 'roles_list_after_viewer', p1, '200: viewer changed nothing')).map((r) => r.id)).toEqual(['MS-0001']);
      });

      await test.step('[25-G-012] viewer #18 of an id that does not exist is still 403 (not 404); #16 stays 200', async () => {
        // BMR:13-16: the permission gate precedes the lookup.
        await forbidden('delete_unknown_id', 'DELETE', itemPath(p1, 'MS-0099'), undefined);
        const sent = await call(viewer, 'roles_g12_viewer_list_200', 'GET', listPath(p1), undefined, ['200: viewer reads #16']);
        expect.soft(sent.res.status()).toBe(200);
      });

      const gone = await call(admin, 'roles_delete_project3', 'DELETE', `/api/projects/${p3}`, undefined, ['setup: soft-delete project 3 → 200']);
      expect(gone.res.status()).toBe(200);
      const projectVerbs = (project: string): Array<[string, Method, string, unknown]> => [
        ['list', 'GET', listPath(project), undefined],
        ['post', 'POST', listPath(project), rec('MS-0001')],
        ['delete', 'DELETE', itemPath(project, 'MS-0001'), undefined],
      ];

      await test.step('[B05-G-076] #16 on a non-member / malformed / missing / deleted project → 404 resource project', async () => {
        const outside = await call(viewer, 'roles_viewer_outside_list_404', 'GET', listPath(p2), undefined, ['404 NOT_FOUND resource project: not a member — 404 beats 403 (access.py:78-86)']);
        expectError(outside, 404, 'NOT_FOUND', { resource: 'project' });
        for (const [slug, project] of [['malformed', 'prj_bad'], ['missing', MISSING_PROJECT], ['deleted', p3]] as const) {
          const sent = await call(admin, `roles_admin_${slug}_project_list_404`, 'GET', listPath(project), undefined, [
            '404 resource project: malformed prj_ id (no query) / no row / soft-deleted (access.py:28-33,64-86)',
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });

      await test.step('[B05-G-113] #17 / #18 on a non-member / malformed / missing / deleted project → 404 resource project', async () => {
        for (const [verb, method, path, data] of projectVerbs(p2).slice(1)) {
          const sent = await call(viewer, `roles_viewer_outside_${verb}_404`, method, path, data, ['404 NOT_FOUND resource project: not a member — 404 beats 403 (access.py:78-86)']);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
        for (const [slug, project] of [['malformed', 'prj_bad'], ['missing', MISSING_PROJECT], ['deleted', p3]] as const) {
          for (const [verb, method, path, data] of projectVerbs(project).slice(1)) {
            const sent = await call(admin, `roles_admin_${slug}_project_${verb}_404`, method, path, data, ['404 resource project before Pydantic / id check']);
            expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
          }
        }
      });

      await test.step('[25-G-013] viewer non-member: #18 with a malformed measurement id → 404 project (the project gate comes first)', async () => {
        // BMR:13-16 (K08).
        const sent = await call(viewer, 'roles_g13_outside_delete_malformed_404', 'DELETE', itemPath(p2, 'nope'), undefined, ['404 resource project, not measurement']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        const deleted = await call(admin, 'roles_g13_deleted_delete_404', 'DELETE', itemPath(p3, 'nope'), undefined, ['404 resource project for a soft-deleted project']);
        expectError(deleted, 404, 'NOT_FOUND', { resource: 'project' });
      });

      let engineer: APIRequestContext | null = null;
      await test.step('[B05-G-095] after #41 → engineer, member #17 → 201', async () => {
        const role = await call(admin, 'roles_change_to_engineer', 'PATCH', `/api/users/${user.id}/role`, { role: 'engineer', userId: user.id }, [
          'setup: #41 viewer → engineer (users/router.py:85-92); old tokens die (bump_token_version)',
        ]);
        expect(role.res.status()).toBe(200);
        engineer = await signedInApi(user.email, user.password);
        const signedIn = engineer;
        cleanup.add(() => signedIn.dispose());
        const own = await post(signedIn, 'roles_engineer_create_201', p1, rec('MS-0002'), ['201: engineer member has layer.edit (matrix.py:47)']);
        expect.soft(own.res.status()).toBe(201);
        expectRecord(own.body, 'engineer #17');
      });

      await test.step('[B05-G-114] engineer #18 of another user\'s record → 204 (no owner rule); non-member → 404', async () => {
        if (engineer === null) throw new Error('engineer session missing');
        const delOther = await call(engineer, 'roles_engineer_delete_admins_204', 'DELETE', itemPath(p1, 'MS-0001'), undefined, [
          '204: any editor may delete any record of the project — no created_by rule (service.py:141-155)',
        ]);
        expect.soft(delOther.res.status()).toBe(204);
        const outside = await post(engineer, 'roles_engineer_outside_404', p2, rec('MS-0003'), ['404 project: engineer is not a member of project 2']);
        expectError(outside, 404, 'NOT_FOUND', { resource: 'project' });
        expect.soft((await list(admin, 'roles_list_final', p1, '200: only the engineer record is left')).map((r) => r.id)).toEqual(['MS-0002']);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-06 · wrap A05 · concurrency (C14): two parallel #17 with one id and one body → {201, 200}, same record; one id and two bodies → {201, 409 MEASUREMENT_ID_TAKEN}; the winner is what #16 holds', async () => {
    // service.py:114-123 (advisory lock measurements:<project> then SELECT … FOR UPDATE); cases.toml:5-8 (C14).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = await newProject(admin, 'race', cleanup);

      await test.step('[B05-G-096] two parallel #17 with one id: same body → {201, 200}; two bodies → {201, 409}; #16 holds the winner', async () => {
        const same = rec('MS-0001');
        const twins = await Promise.all([
          post(admin, 'race_same_body_a', pid, same, ['one of {201, 200}: same id + same body in parallel']),
          post(admin, 'race_same_body_b', pid, same, ['one of {201, 200}: same id + same body in parallel']),
        ]);
        expect.soft(twins.map((s) => s.res.status()).sort()).toEqual([200, 201]);
        expect.soft(twins[0]?.body).toEqual(twins[1]?.body);

        const bodies = [rec('MS-0002', { rawValueMm: 1 }), rec('MS-0002', { rawValueMm: 2 })];
        const rivals = await Promise.all(bodies.map((b, i) => post(admin, `race_other_body_${String(i)}`, pid, b, ['one of {201, 409}: same id + different body in parallel'])));
        const statuses = rivals.map((s) => s.res.status());
        expect.soft([...statuses].sort()).toEqual([201, 409]);
        const loser = rivals.find((s) => s.res.status() === 409);
        if (loser) expectError(loser, 409, 'MEASUREMENT_ID_TAKEN', { field: 'id' });
        const winner = rivals.find((s) => s.res.status() === 201);
        const stored = await list(admin, 'race_list', pid, '200: exactly MS-0001 + the 201 winner of MS-0002');
        expect.soft(stored.map((r) => r.id)).toEqual(['MS-0001', 'MS-0002']);
        expect.soft(stored[1], 'MS-0002 = the 201 body').toEqual(winner?.body);
      });

      await test.step('[25-G-020] three parallel #17 with one id and one body → exactly one 201 and two 200, one stored record', async () => {
        // BMS:118-123 (advisory lock + FOR UPDATE).
        const same = rec('MS-0003');
        const trio = await Promise.all([0, 1, 2].map((i) => post(admin, `race_g20_${String(i)}`, pid, same, ['one 201 and two 200: same id + same body in parallel'])));
        expect.soft(trio.map((s) => s.res.status()).sort()).toEqual([200, 200, 201]);
        const stored = await list(admin, 'race_g20_list', pid, '200: MS-0003 stored once');
        expect.soft(stored.filter((r) => r.id === 'MS-0003')).toHaveLength(1);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-07 · wrap A05 · Idempotency-Key on #17 / #18 (route idempotency "auto"): malformed key → 422 field idempotencyKey, nothing written; same key + same body → the stored 201 replayed (a keyless repeat is 200); same key + other body or other project → 422 IDEMPOTENCY_KEY_REUSED; #18 with a key → 204, replay → 204 (keyless → 404)', async () => {
    // core/routing.py:164-185,221-226 (guard after the permission dependency); core/idempotency.py:79-96,198-234;
    // packages/db/models/idempotency.py:35 (key ^[A-Za-z0-9_-]{8,128}$).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = await newProject(admin, 'idem', cleanup);
      const other = await newProject(admin, 'idem-other', cleanup);
      const a = rec('MS-0001');

      await test.step('[B05-G-097] #17 keys: malformed → 422 idempotencyKey; replay → 201; other body / other project → 422 IDEMPOTENCY_KEY_REUSED', async () => {
        const bad = await post(admin, 'idem_bad_key_422', pid, a, ['422 VALIDATION field idempotencyKey: key shorter than 8 (idempotency.py:79-83)'], { 'Idempotency-Key': 'abc' });
        expectError(bad, 422, 'VALIDATION', { field: 'idempotencyKey' });
        expect.soft(await list(admin, 'idem_list_after_bad', pid, '200 []: the bad-key request wrote nothing')).toEqual([]);

        const key = `qa-${randomUUID()}`;
        const first = await post(admin, 'idem_first_201', pid, a, ['201 created, response stored under the key'], { 'Idempotency-Key': key });
        expect.soft(first.res.status()).toBe(201);
        const replay = await post(admin, 'idem_replay_201', pid, a, ['201 replayed byte-for-byte: the handler does not run again (idempotency.py:232-233)'], { 'Idempotency-Key': key });
        expect.soft(replay.res.status()).toBe(201);
        expect.soft(replay.body).toEqual(first.body);
        const keyless = await post(admin, 'idem_keyless_repeat_200', pid, a, ['200: without a key the same body is a resubmit (router.py:36-37)']);
        expect.soft(keyless.res.status()).toBe(200);
        const reused = await post(admin, 'idem_key_other_body_422', pid, rec('MS-0002'), ['422 IDEMPOTENCY_KEY_REUSED: same key, different body (idempotency.py:230-231)'], { 'Idempotency-Key': key });
        expectError(reused, 422, 'IDEMPOTENCY_KEY_REUSED');
        const elsewhere = await post(admin, 'idem_key_other_project_422', other, a, ['422 IDEMPOTENCY_KEY_REUSED: the digest uses the real path, so another project is another request (idempotency.py:86-90)'], { 'Idempotency-Key': key });
        expectError(elsewhere, 422, 'IDEMPOTENCY_KEY_REUSED');
        expect.soft((await list(admin, 'idem_list_after_reuse', pid, '200: only MS-0001')).map((r) => r.id)).toEqual(['MS-0001']);
        expect.soft(await list(admin, 'idem_list_other_project', other, '200 []: nothing written in the other project')).toEqual([]);
      });

      await test.step('[B05-G-116] #18 with a key → 204, replay → 204, keyless → 404', async () => {
        const delKey = `qa-${randomUUID()}`;
        const del = await call(admin, 'idem_delete_204', 'DELETE', itemPath(pid, 'MS-0001'), undefined, ['204 deleted with a key'], { 'Idempotency-Key': delKey });
        expect.soft(del.res.status()).toBe(204);
        const delReplay = await call(admin, 'idem_delete_replay_204', 'DELETE', itemPath(pid, 'MS-0001'), undefined, ['204 replayed (stored), not 404'], { 'Idempotency-Key': delKey });
        expect.soft(delReplay.res.status()).toBe(204);
        const delKeyless = await call(admin, 'idem_delete_keyless_404', 'DELETE', itemPath(pid, 'MS-0001'), undefined, ['404 measurement: without the key the delete runs again']);
        expectError(delKeyless, 404, 'NOT_FOUND', { resource: 'measurement' });
      });

      await test.step('[25-G-019] key length bounds on #17: 128 chars → 201, 129 chars → 422 field idempotencyKey', async () => {
        // packages/db/models/idempotency.py:35 (^[A-Za-z0-9_-]{8,128}$).
        const longest = await post(admin, 'idem_g19_128_201', pid, rec('MS-0003'), ['201: a 128-character key is accepted'], { 'Idempotency-Key': `qa-${randomUUID()}`.padEnd(128, 'k') });
        expect.soft(longest.res.status()).toBe(201);
        const tooLong = await post(admin, 'idem_g19_129_422', pid, rec('MS-0004'), ['422 VALIDATION field idempotencyKey: 129 characters'], { 'Idempotency-Key': `qa-${randomUUID()}`.padEnd(129, 'k') });
        expectError(tooLong, 422, 'VALIDATION', { field: 'idempotencyKey' });
        expect.soft((await list(admin, 'idem_g19_list', pid, '200: only MS-0003')).map((r) => r.id)).toEqual(['MS-0003']);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-A5-08 · wrap A05 · limits: 200 points per record (201 → 422 field points); 20 000 points per project → next create 422 MEASUREMENT_LIMIT_REACHED (no field), a repeat of a stored id still 200, a delete frees room; 1 000 records per project → 1 001st 422 MEASUREMENT_LIMIT_REACHED; #16 returns all 1 000 in numeric id order', async () => {
    // settings.py:18-20; schemas.py:67-75 (points 2..200); service.py:87-98 (_check_room after the existing-id lookup, 115-124);
    // service.py:76-84 (list order + limit); errors.py:8-9.
    test.setTimeout(600_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pa = await newProject(admin, 'limit-points', cleanup);
      const pb = await newProject(admin, 'limit-count', cleanup);
      const pointBodies = Array.from({ length: POINTS_TOTAL_MAX / POINTS_MAX }, (_, i) =>
        rec(`MS-${String(1001 + i)}`, { points: pointsOf(POINTS_MAX), rawValueMm: i }));
      const countBodies = Array.from({ length: MEASUREMENTS_MAX }, (_, i) => rec(`MS-${String(9001 + i)}`, { rawValueMm: i }));

      await test.step('[B05-G-098] 201 points in one record → 422 VALIDATION field points', async () => {
        const sent = await post(admin, 'limits_points_201_422', pa, rec('MS-0500', { points: pointsOf(POINTS_MAX + 1) }), ['422 VALIDATION field points: more than 200 (schemas.py:67-75)']);
        expectError(sent, 422, 'VALIDATION', { field: 'points' });
      });

      await test.step('[B05-G-099] 20 000 points per project: 100 x 200 points all 201, the next create → 422 MEASUREMENT_LIMIT_REACHED (no field)', async () => {
        const [pointStatuses, countStatuses] = await Promise.all([bulkPost(admin, pa, pointBodies), bulkPost(admin, pb, countBodies)]);
        expect.soft(countBy(pointStatuses), '100 x 200 points = exactly 20 000 → all 201').toEqual({ 201: pointBodies.length });
        expect.soft(countBy(countStatuses), '1 000 records → all 201').toEqual({ 201: MEASUREMENTS_MAX });
        await captureSummary('limits_bulk', {
          project_points: { method: 'POST', path: listPath(pa), bodies: `${String(pointBodies.length)} records x ${String(POINTS_MAX)} points (MS-1001..MS-1100)` },
          project_count: { method: 'POST', path: listPath(pb), bodies: `${String(MEASUREMENTS_MAX)} records x 2 points (MS-9001..MS-10000)` },
        }, { pointStatuses: countBy(pointStatuses), countStatuses: countBy(countStatuses) }, [
          'every bulk create → 201 (the caps are inclusive: count < 1000 and total + new ≤ 20 000, service.py:97)',
        ]);
        const full = await post(admin, 'limits_points_total_422', pa, rec('MS-2000'), [
          '422 MEASUREMENT_LIMIT_REACHED without field: 20 000 + 2 > MEASUREMENT_POINTS_TOTAL_MAX (service.py:97-98)',
        ]);
        expectError(full, 422, 'MEASUREMENT_LIMIT_REACHED', { field: null });
      });

      await test.step('[B05-G-101] at the points cap: a repeat of a stored id → 200; a delete frees room → 201', async () => {
        const repeat = await post(admin, 'limits_points_repeat_200', pa, pointBodies[0], ['200: an existing id resolves before the room check (service.py:122-124)']);
        expect.soft(repeat.res.status()).toBe(200);
        const free = await call(admin, 'limits_points_delete_204', 'DELETE', itemPath(pa, 'MS-1001'), undefined, ['204: frees 200 points']);
        expect.soft(free.res.status()).toBe(204);
        const fits = await post(admin, 'limits_points_after_delete_201', pa, rec('MS-2000'), ['201: 19 800 + 2 ≤ 20 000']);
        expect.soft(fits.res.status()).toBe(201);
      });

      await test.step('[B05-G-100] 1 000 records per project: the 1 001st → 422 MEASUREMENT_LIMIT_REACHED, a repeat of a stored id still 200', async () => {
        const over = await post(admin, 'limits_count_1001_422', pb, rec('MS-10001'), [
          '422 MEASUREMENT_LIMIT_REACHED without field: count 1000 ≥ MEASUREMENTS_MAX (service.py:97-98)',
        ]);
        expectError(over, 422, 'MEASUREMENT_LIMIT_REACHED', { field: null });
        const repeatB = await post(admin, 'limits_count_repeat_200', pb, countBodies[999], ['200: repeat of MS-10000 is still answered at the cap']);
        expect.soft(repeatB.res.status()).toBe(200);
      });

      await test.step('[B05-G-075] #16 at 1 000 records returns all of them in numeric id order, each decodes with the FE zod', async () => {
        const res = await admin.get(listPath(pb));
        expect.soft(res.status()).toBe(200);
        const all = objs(await res.json(), '#16');
        const ids = all.map((r) => String(r.id));
        expect.soft(ids.length, '#16 returns every record up to MEASUREMENTS_MAX').toBe(MEASUREMENTS_MAX);
        expect.soft(ids, 'numeric id order (MS-9999 before MS-10000)').toEqual(countBodies.map((b) => String(b.id)));
        let undecodable = 0;
        for (const r of all) if (!MeasurementRecordSchema.safeParse(r).success) undecodable += 1;
        expect.soft(undecodable, 'every #16 item decodes with the FE zod').toBe(0);
        await captureSummary('limits_count_list', { method: 'GET', path: listPath(pb) }, {
          status: res.status(), length: ids.length, first: ids.slice(0, 3), aroundLengthChange: ids.slice(997, 1000), undecodable,
        }, ['200: 1 000 records, ordered by (char_length(id), id) = numeric (service.py:76-84)']);
      });

      await test.step('[25-G-016] per-record bound in a fresh project: exactly 200 points → 201 (and its repeat 200); 201 points → 422 field points', async () => {
        // BMT:18-20, BMS:_check_room.
        const pc = await newProject(admin, 'limit-record', cleanup);
        const edge = rec('MS-0001', { points: pointsOf(POINTS_MAX) });
        const ok = await post(admin, 'limits_g16_200_points_201', pc, edge, ['201: 200 points is the inclusive per-record cap']);
        expect.soft(ok.res.status()).toBe(201);
        const again = await post(admin, 'limits_g16_200_points_repeat_200', pc, edge, ['200: repeat of the stored record']);
        expect.soft(again.res.status()).toBe(200);
        const over = await post(admin, 'limits_g16_201_points_422', pc, rec('MS-0002', { points: pointsOf(POINTS_MAX + 1) }), ['422 VALIDATION field points']);
        expectError(over, 422, 'VALIDATION', { field: 'points' });
      });
    } finally {
      await cleanup.run();
    }
  });
});

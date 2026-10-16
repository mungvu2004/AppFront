/**
 * Phase 4 — QC layers BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the phase-4 screens call (FE `src/api/endpoints.ts:251-265` spatial.*, `:109-112` floors.*; UI spec
 * `phase04_pipeline.spec.ts`; SCR-14 "Áp cho mọi tầng" reads #12 + N15 then PUTs each floor):
 *   GET  /api/projects/:p/floors/:f/spatial/layer (N16)   BE spatial_read/router.py:71-87
 *   PUT  /api/projects/:p/floors/:f/spatial/layer (#35)   BE spatial_write/router.py:45-67, writer.py:196-648
 *   GET  /api/projects/:p/floors/:f/spatial (#33)         BE spatial_read/router.py:58-62
 *   GET  /api/projects/:p/spatial (N15 graph)             BE spatial_read/router.py:65-68, graph.py:173-208
 *   GET  /api/projects/:p/floors (#12, scale apply-all)   BE floors/router.py:46-49, service.py:197-199
 * Inventory + mock-pairing table: `qa/coverage/phase04-be.md`.
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, main), paths under `apps/api/` unless noted.
 * Every 200 body is also parsed with the FE zod schema the screens use (contract FE <-> BE).
 *
 * ## Non-serial, own data
 * Every test signs in on its own, creates the projects / floors it needs (`qa-<runId>-…` names) and writes layers
 * by hand (a fresh floor accepts a #35 write at baseVersion 0, writer.py:311-327 — no pipeline needed), then deletes
 * its projects in `finally` (soft delete hides floors and documents). The one non-admin user is REAL: admin invites a
 * run-unique `@example.test` viewer, the token comes from Mailpit, the invitee accepts; later admin changes its role to
 * engineer (#41) and it signs in once. Cleanup: `DELETE /api/users/{id}` + mails. The admin account is only read.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - No rate limit on N16 / #35 / #33 / N15 / #12 (grep `rate_limit(` in spatial_read/, spatial_write/, floors/: none).
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37, auth/router.py:121-129; override
 *   LOGIN_IP_LIMIT=120): THIS file 12 (one admin login in each of the 11 signed-in tests + 1 engineer login in
 *   "roles"; the 3 "gaps" tests add 3), 0 failed. Phase-4 UI layers: main `phase04_pipeline.spec.ts` 1
 *   (`signInAdmin`, +1 for a dead stored session); ui `phase04_qc_layers_ui.spec.ts` 1 (+1); edge
 *   `phase04_qc_layers_edge.spec.ts` 0 (+1 for a dead session). Layers run sequentially and the pipeline test alone
 *   takes > 60 s -> <= 18 per run, below 30 even without the override.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:32-46): THIS file 1. Phases 1-3 spend 25
 *   (phase03 header) -> Phases 1-4 in one hour = 26 <= 30.
 * - `recovery_ip` 10 / 900 s per IP (override 60): 1 invitation accept.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/settings.py:14): admin 1.
 * - Body ceiling: one 8 MiB and one 8 MiB + 1 anonymous PUT (nginx `client_max_body_size 8m` = app `body_limit`);
 *   one ~1.3 MiB signed-in PUT ("large").
 * - Concurrency: "versioning" sends one pair of parallel PUTs on one base; no limit involved.
 * - `drawings_init` 60 / 600 s per user (BE:drawings/router.py:39-46, drawings/settings.py:23-24): THIS file 1 ("gaps"
 *   pipeline test) + edge spec 1 = 2. Pipeline worker: 1 real run here (drawing.png, own project) + 1 in the edge spec.
 * - "gaps" truncation test: 2 PUTs of ~180 KB on its own floor, the 409 answer carries 5 000 rows (~1 MB).
 * - Mailpit: 1 invitation mail, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { VersionConflictBodySchema } from '../../src/api/schemas/errors';
import { FloorSchema } from '../../src/api/schemas/index';
import { SpatialGraphDocumentSchema } from '../../src/api/schemas/spatialGraph';
import { FloorLayerDocumentSchema, FloorLayerWriteResultSchema } from '../../src/api/schemas/spatialLayer';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { EVIDENCE_DIR, TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE:auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase01-03 api specs)
const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)
const MIB = 1024 * 1024;
const LAYER_BODY_LIMIT = 8 * MIB; // BE:spatial_write/router.py:29; nginx app_locations.conf:3
const MS_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u; // W3 (core/errors.py:73 to_wire)

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Source = 'ai' | 'human';

const N16_KEYS = ['axes', 'dimensions', 'layer', 'level', 'revision'] as const; // spatial_read/wire.py:212-220
const LEVEL_KEYS = ['confidence', 'elevationMm', 'heightMm', 'id', 'name', 'order', 'reviewed', 'source'] as const; // wire.py:118-131
const LEVEL_OPTIONAL = ['areaM2', 'scaleMillimetresPerPixel'] as const;
const FLOOR_KEYS = ['drawings', 'elevationMm', 'heightMm', 'id', 'name', 'order'] as const; // projects/wire.py:65-74

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const projectName = (slug: string): string => `${PREFIX}${slug}-${uniq()}`;
/** W4 spatial id `<letter>-<base36 UPPER 10..64>` (packages/core/ids.py:23-31,92-94). */
const sid = (letter: 'L' | 'W' | 'D' | 'R' | 'F'): string =>
  `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
const layerPath = (p: string, f: string): string => `/api/projects/${p}/floors/${f}/spatial/layer`;

/* ------------------------------------------------------------------ layer builders (domain model.py:95-257) */

interface Review {
  readonly source?: Source;
  readonly reviewed?: boolean;
}
/** `confidence` 1 for human items — sent as the JSON integer `1`, exactly what the FE serialises. */
const meta = (r: Review = {}): Json => ({
  confidence: (r.source ?? 'ai') === 'human' ? 1 : 0.8,
  source: r.source ?? 'ai',
  reviewed: r.reviewed ?? false,
});

interface WallOpts extends Review {
  readonly id?: string;
  readonly from?: readonly [number, number];
  readonly to?: readonly [number, number];
  readonly t?: number;
  readonly kind?: string;
  readonly openingIds?: readonly string[];
}
function wallOf(levelId: string, o: WallOpts = {}): Json {
  const [x1, y1] = o.from ?? [0, 0];
  const [x2, y2] = o.to ?? [4000, 0];
  return {
    id: o.id ?? sid('W'),
    levelId,
    centreline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thicknessMm: o.t ?? 110,
    heightMm: 3000,
    kind: o.kind ?? 'partition',
    openingIds: [...(o.openingIds ?? [])],
    ...meta(o),
  };
}

/** `Dimension` wire (BE spatial_write/tests/_helpers.py:236-250); id `M-<base36 UPPER>`. Same id twice = duplicate. */
const DIM_ID = `M-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;
function dimOf(levelId: string, o: Review = {}): Json {
  return {
    id: DIM_ID,
    levelId,
    kind: 'linear',
    referenceIds: [],
    line: { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
    valueMm: 1000,
    ...meta(o),
  };
}

function openingOf(wallId: string, o: Review & { id?: string; offset?: number; width?: number } = {}): Json {
  return {
    id: o.id ?? sid('D'),
    wallId,
    kind: 'door',
    offsetMm: o.offset ?? 500,
    widthMm: o.width ?? 900,
    heightMm: 2100,
    sillHeightMm: 0,
    swing: 'left',
    ...meta(o),
  };
}

function roomOf(levelId: string, o: Review & { id?: string; name?: string; w?: number; h?: number; areaM2?: number; wallIds?: string[] } = {}): Json {
  const w = o.w ?? 4000;
  const h = o.h ?? 5000;
  return {
    id: o.id ?? sid('R'),
    levelId,
    name: o.name ?? 'Bếp',
    usage: 'kitchen',
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    areaM2: o.areaM2 ?? 0,
    wallIds: o.wallIds ?? [],
    ...meta(o),
  };
}

function furnitureOf(levelId: string, o: Review & { id?: string; roomId?: string; rotationDeg?: number } = {}): Json {
  return {
    id: o.id ?? sid('F'),
    levelId,
    ...(o.roomId === undefined ? {} : { roomId: o.roomId }),
    kind: 'table',
    centre: { x: 400, y: 300 },
    boundingBox: { min: { x: 0, y: 0 }, max: { x: 800, y: 600 } },
    rotationDeg: o.rotationDeg ?? 0,
    ...meta(o),
  };
}

const layerOf = (p: { walls?: Json[]; openings?: Json[]; rooms?: Json[]; furniture?: Json[] } = {}): Json => ({
  walls: p.walls ?? [],
  openings: p.openings ?? [],
  rooms: p.rooms ?? [],
  furniture: p.furniture ?? [],
});
const writeBody = (base: unknown, body: Json): Json => ({ baseVersion: base, body });

/* ------------------------------------------------------------------ phase-local helpers (pattern of phase03 api) */

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

/** The FE decodes this body with `schema` (the screens' zod); a failure is an FE<->BE contract break. */
function expectZod(schema: ZodTypeAny, value: unknown, what: string): void {
  const parsed = schema.safeParse(value);
  const issues = parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3));
  expect.soft(parsed.success, `${what} decodes with the FE zod schema ${issues}`).toBe(true);
}

interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `A04_<ev>.json` (secrets redacted by `captureExchange`).
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
  const body = await captureExchange(`A04_${ev}.json`, { method, path, body: shown }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource` / `count`). */
function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string; readonly resource?: string; readonly count?: number } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  if (params.count !== undefined) expect.soft(body.count, `${code} count`).toBe(params.count);
  return body;
}

/** Evidence for a case whose bodies are too big to keep (summary only). */
async function captureSummary(name: string, req: Json, summary: Json, assertions: readonly string[]): Promise<void> {
  const record = { request: req, response: summary, assertions, capturedAt: new Date().toISOString() };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = join(EVIDENCE_DIR, `A04_${name}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  await test.info().attach(`A04_${name}.json`, { path: file, contentType: 'application/json' });
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

/** Setup: admin creates a project (no floors) and registers its deletion (404 = the test already deleted it). */
async function newProject(api: APIRequestContext, ev: string, cleanup: Cleanup): Promise<Json> {
  const sent = await call(api, `${ev}_create`, 'POST', '/api/projects', { name: projectName(ev) }, [
    'setup: 201 ProjectOut (projects/router.py)',
  ]);
  expect(sent.res.status(), 'setup create project').toBe(201);
  const project = asJson(sent.body);
  const id = String(project.id);
  cleanup.add(async () => {
    const res = await api.delete(`/api/projects/${id}`);
    if (res.status() !== 200 && res.status() !== 404) note(`DELETE /api/projects/${id} → ${String(res.status())}`);
  });
  return project;
}

/** Setup: #10 creates one floor with a client level id (BE:floors/schemas.py:77-86); returns the id. */
async function newFloor(api: APIRequestContext, projectId: string, ev: string, order = 0): Promise<string> {
  const id = sid('L');
  const sent = await call(api, ev, 'POST', `/api/projects/${projectId}/floors`, {
    id,
    name: `${PREFIX}floor-${String(order)}`,
    order,
    elevationMm: order * 3000,
    heightMm: 3000,
  }, ['setup: 201 FloorOut (floors/router.py:30-35)']);
  expect(sent.res.status(), 'setup create floor').toBe(201);
  return id;
}

/** The admin = the only member of a fresh project (projects/service.py). */
function creatorOf(project: Json): { id: string; name: string } {
  const members = objs(project.members, 'members');
  expect(members).toHaveLength(1);
  return { id: String(members[0]?.id), name: String(members[0]?.name) };
}

async function readProject(api: APIRequestContext, id: string, ev: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${id}`, undefined, ['read-back: 200 ProjectOut (#24)']);
  expect(sent.res.status()).toBe(200);
  return asJson(sent.body);
}

/** N16 read-back (200 + FE `FloorLayerDocumentSchema`). */
async function readLayer(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', layerPath(pid, fid), undefined, [claim]);
  expect(sent.res.status(), `N16 ${ev}`).toBe(200);
  expectZod(FloorLayerDocumentSchema, sent.body, 'N16');
  return asJson(sent.body);
}

/** N15 read-back (200 + FE `SpatialGraphDocumentSchema`). */
async function readGraph(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${pid}/spatial`, undefined, [claim]);
  expect(sent.res.status(), `N15 ${ev}`).toBe(200);
  expectZod(SpatialGraphDocumentSchema, sent.body, 'N15');
  return asJson(sent.body);
}

/** #12 read-back (200 + FE `FloorSchema` per item). */
async function listFloors(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', `/api/projects/${pid}/floors`, undefined, [claim]);
  expect(sent.res.status(), `#12 ${ev}`).toBe(200);
  return objs(sent.body, '#12').map((f) => {
    expectZod(FloorSchema, f, '#12 item');
    return expectKeys(f, FLOOR_KEYS, ['areaM2']);
  });
}

async function put(
  api: APIRequestContext,
  ev: string,
  pid: string,
  fid: string,
  data: unknown,
  claims: readonly string[],
  headers?: Record<string, string>,
): Promise<Sent> {
  return call(api, ev, 'PUT', layerPath(pid, fid), data, claims, headers);
}

/** A 200 of #35: `{revision, layer}` that the FE decodes with `FloorLayerWriteResultSchema`. */
function expectWritten(sent: Sent, revision: number, what: string): Json {
  expect.soft(sent.res.status(), `${what} status`).toBe(200);
  const body = expectKeys(sent.body, ['layer', 'revision']);
  expect.soft(body.revision, `${what} revision`).toBe(revision);
  expectZod(FloorLayerWriteResultSchema, sent.body, `${what} 200`);
  return body;
}

const layerIn = (doc: Json): Json => asJson(doc.layer, 'layer');
const walls = (doc: Json): Json[] => objs(layerIn(doc).walls, 'walls');
const wallById = (doc: Json, id: string): Json | undefined => walls(doc).find((w) => w.id === id);

/* ---- the real pipeline (gaps test): upload drawing.png, poll #8 until the run ends */

const drawingPng = (): Buffer => {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return readFileSync(path);
};

/** #8 Progress (BE:drawings/router.py:102-106, progress.py:33-68) polled every 2 s until `completed` | `failed`. */
async function pipelineFinal(api: APIRequestContext, projectId: string, uploadId: string): Promise<Json> {
  let last: Json = {};
  // Polled, not slept: the 2 s cadence is the poll interval; a run that never ends fails here with its last status.
  await expect
    .poll(
      async () => {
        const res = await api.get(`/api/projects/${projectId}/drawings/uploads/${uploadId}/progress`);
        last = (await res.json().catch(() => ({}))) as Json;
        return last.status;
      },
      { message: '#8 progress reaches completed | failed', intervals: [2_000], timeout: PIPELINE_TIMEOUT_MS },
    )
    .toMatch(/^(?:completed|failed)$/u);
  return last;
}

/* ---- the real non-admin user (invitation → Mailpit → accept → refresh) */

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
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
  const name = `${PREFIX}${ev}`;
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
    const accept = await call(anon, `${ev}_accept`, 'POST', '/api/auth/invitations/accept', { token, fullName: name, password }, [
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
  return { id, email, name, password, api };
}

/* ------------------------------------------------------------------ tests */

test.describe('A04 phase-4 backend (spatial layer read/write, floor meta, graph, floors list)', () => {
  test('A04 · anonymous: N16 / #35 / #33 / N15 / #12 → 401 UNAUTHENTICATED before the body is read (also truncated JSON); #35 body ceiling 8 MiB → 401, 8 MiB + 1 → 413 PAYLOAD_TOO_LARGE before auth', async () => {
    // core/routing.py:1-10,129-136,264 (principal before the body); spatial_write/router.py:29,46 (body_limit 8 MiB);
    // core/middleware.py:218-241; deploy/nginx/snippets/app_locations.conf:3,6 + error_413_body.conf.
    const anon = await newApiContext();
    try {
      const fid = sid('L');
      const routes: Array<[string, Method, string, unknown]> = [
        ['n16', 'GET', layerPath(MISSING_PROJECT, fid), undefined],
        ['put', 'PUT', layerPath(MISSING_PROJECT, fid), writeBody(0, { scaleMillimetresPerPixel: 2 })],
        ['floor_meta', 'GET', `/api/projects/${MISSING_PROJECT}/floors/${fid}/spatial`, undefined],
        ['graph', 'GET', `/api/projects/${MISSING_PROJECT}/spatial`, undefined],
        ['floors', 'GET', `/api/projects/${MISSING_PROJECT}/floors`, undefined],
        ['put_malformed', 'PUT', layerPath(MISSING_PROJECT, fid), Buffer.from('{"baseVersion": 0,')],
      ];
      const answers = new Map<string, Sent>();
      for (const [slug, method, path, data] of routes) {
        answers.set(slug, await call(anon, `anon_${slug}_401`, method, path, data, [
          '401 UNAUTHENTICATED: no Bearer, checked before the body / path ids (core/routing.py:129-136,264)',
        ]));
      }
      const jsonOf = (size: number): Buffer => Buffer.from(`{"x":"${'a'.repeat(size - 8)}"}`);
      const atLimit = await call(anon, 'anon_put_8mib_401', 'PUT', layerPath(MISSING_PROJECT, fid), jsonOf(LAYER_BODY_LIMIT), [
        '8 388 608-byte body passes the #35 ceiling (body_limit 8 MiB, router.py:29,46) → 401',
      ]);
      const over = await call(anon, 'anon_put_8mib_plus1_413', 'PUT', layerPath(MISSING_PROJECT, fid), jsonOf(LAYER_BODY_LIMIT + 1), [
        '8 MiB + 1 → 413 PAYLOAD_TOO_LARGE before auth (nginx 8m / core/middleware.py:229-236)',
      ]);
      const answer = (slug: string): Sent => answers.get(slug) as Sent;
      await test.step('[16-G-014] N16 / #33 / #35 anonymous → 401', async () => {
        for (const slug of ['n16', 'floor_meta', 'put']) expectError(answer(slug), 401, 'UNAUTHENTICATED');
      });
      await test.step('[BE4-G-001] no Bearer on N16 / #35 / #33 / N15 (also truncated PUT) → 401 UNAUTHENTICATED', async () => {
        for (const slug of ['graph', 'put_malformed']) expectError(answer(slug), 401, 'UNAUTHENTICATED');
      });
      await test.step('[BE4-G-059] body of exactly 8 MiB reaches auth (401); 8 MiB + 1 → 413 before auth', async () => {
        expect.soft(atLimit.res.status()).toBe(401);
        expectError(over, 413, 'PAYLOAD_TOO_LARGE');
      });
      await test.step('[16-G-011] body > 8 MiB → 413 (the FE blocks it)', async () => {
        expect.soft(over.res.status()).toBe(413);
      });
      await test.step('[BE5-G-001] #12 anonymous → 401 UNAUTHENTICATED', async () => {
        expectError(answer('floors'), 401, 'UNAUTHENTICATED');
      });
    } finally {
      await anon.dispose();
    }
  });

  test('A04 · reads: empty project → N15 empty graph + #12 []; fresh floors → #12 by order, #33 = the #12 item, N16 revision 0 empty layer (no scale, no scaleStatus), N15 levels + floorRevisions 0; reads never write (updatedAt kept); unknown / malformed / foreign floor → 404 floor; malformed / missing / deleted project → 404 project; deleted floor → 404 and gone from #12 / N15', async () => {
    // spatial_read/router.py:38-87, graph.py:153-208, assemble.py:235-283, documents.py:294-313,366-374;
    // floors/router.py:46-49, lookup.py:111-118; projects/access.py:28-33,78-86.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'reads', cleanup);
      const pid = String(project.id);

      const empty = await readGraph(admin, 'reads_graph_empty', pid, '200 N15 of a project without floors: levels / walls / … [] and floorRevisions [] (graph.py:173-208)');
      const emptyFloors = await listFloors(admin, 'reads_floors_empty', pid, '200 [] for a project without floors');
      await test.step('[BE4-G-107] project without floors → every list [], floorRevisions [], default building', async () => {
        const emptyGraph = asJson(empty.graph);
        for (const key of ['levels', 'walls', 'openings', 'furniture', 'rooms', 'axes', 'dimensions', 'notes']) {
          expect.soft(emptyGraph[key], `graph.${key}`).toEqual([]);
        }
        expect.soft(empty.floorRevisions).toEqual([]);
        expect.soft(asJson(emptyGraph.building)).toMatchObject({
          name: project.name, datumElevationMm: 0, confidence: 1, source: 'human', reviewed: false, grossFloorAreaM2: 0,
        });
        expect.soft(emptyFloors).toEqual([]);
      });

      const upper = await newFloor(admin, pid, 'reads_floor_upper', 1);
      const ground = await newFloor(admin, pid, 'reads_floor_ground', 0);
      const before = await readProject(admin, pid, 'reads_project_before');

      const floors = await listFloors(admin, 'reads_floors', pid, '200 FloorOut[] sorted by (order, pk): ground (0) before upper (1) (service.py:197-199)');
      expect.soft(floors.map((f) => f.id)).toEqual([ground, upper]);
      for (const f of floors) expect.soft(f.drawings, 'no drawing yet').toEqual([]);

      const meta33 = await call(admin, 'reads_floor_meta_200', 'GET', `/api/projects/${pid}/floors/${upper}/spatial`, undefined, [
        '200 #33 = the very FloorOut #12 returns for that floor (router.py:58-62, same floor_outs path)',
      ]);
      await test.step('[16-G-002] #33 read for the background → 200 FloorOut', async () => {
        expect.soft(meta33.res.status()).toBe(200);
        expectZod(FloorSchema, meta33.body, '#33');
        expect.soft(asJson(meta33.body).drawings, 'drawings[] present for the background (empty before an upload)').toEqual([]);
      });
      await test.step('[BE4-G-104] #33 = the #12 item of that floor, key for key', async () => {
        expect.soft(meta33.body).toEqual(floors.find((f) => f.id === upper));
      });

      const fresh = await readLayer(admin, 'reads_layer_fresh', pid, upper, '200 N16 of a floor never written: revision 0, empty layer, axes [], dimensions [], no scaleStatus (documents.py:294-313, assemble.py:247-249)');
      await test.step('[16-G-001] N16 read on load → 200 {revision, level, layer, dimensions}', async () => {
        for (const key of ['revision', 'level', 'layer', 'dimensions']) expect.soft(fresh, `N16.${key}`).toHaveProperty(key);
      });
      await test.step('[21-G-001] N16 alone carries what SCR-21 needs (level + layer)', async () => {
        expect.soft(asJson(fresh.level).id).toBe(upper);
        expect.soft(fresh.layer).toEqual(layerOf());
      });
      await test.step('[BE4-G-020] never-written floor → revision 0, empty lists, no scaleStatus, no scale', async () => {
        expect.soft(fresh).not.toHaveProperty('scaleStatus');
        expect.soft(fresh.revision).toBe(0);
        expect.soft(fresh.layer).toEqual(layerOf());
        expect.soft(fresh.dimensions).toEqual([]);
        expect.soft(asJson(fresh.level), 'no scale yet (W24)').not.toHaveProperty('scaleMillimetresPerPixel');
      });
      await test.step('[BE4-G-021] N16 key set is exactly {revision, level, layer, axes, dimensions} + optional scaleStatus', async () => {
        expectKeys(fresh, N16_KEYS, ['scaleStatus']);
      });
      await test.step('[BE4-G-022] level = FloorOut of the floor + confidence 1, source human', async () => {
        const level = expectKeys(fresh.level, LEVEL_KEYS, LEVEL_OPTIONAL);
        expect.soft(level).toMatchObject({ id: upper, order: 1, elevationMm: 3000, heightMm: 3000, confidence: 1, source: 'human', reviewed: false });
      });
      await test.step('[BE4-G-029] axes is always []', async () => {
        expect.soft(fresh.axes).toEqual([]);
      });

      let graph: Json = {};
      await test.step('[BE4-G-319] reads through the real stack (Playwright request): N15 200 decodes with the FE zod', async () => {
        graph = await readGraph(admin, 'reads_graph', pid, '200 N15: levels in floor order, floorRevisions a bijection, revision 0 each');
      });
      await test.step('[BE4-G-108] floorRevisions is a bijection with the live floors, in floor order, revision = N16 revision', async () => {
        expect.soft(objs(asJson(graph.graph).levels, 'levels').map((l) => l.id)).toEqual([ground, upper]);
        expect.soft(graph.floorRevisions).toEqual([{ floorId: ground, revision: 0 }, { floorId: upper, revision: 0 }]);
        expect.soft(asJson(asJson(graph.graph).building).reviewed, 'no level reviewed → building not reviewed').toBe(false);
      });

      const after = await readProject(admin, pid, 'reads_project_after');
      const again = await readLayer(admin, 'reads_layer_again', pid, upper, '200 still revision 0: the read created no document');
      await test.step('[BE4-G-111] reads write nothing: updatedAt kept, no document row created', async () => {
        expect.soft(after.updatedAt, 'GETs never write: no ensure_document, no touch_project (graph.py:125-127)').toBe(before.updatedAt);
        expect.soft(again.revision).toBe(0);
        expect.soft(again.axes, 'axes stay [] on every re-read').toEqual([]);
      });

      // 404 branches.
      const other = await newProject(admin, 'reads-other', cleanup);
      const otherPid = String(other.id);
      const foreignFloor = await newFloor(admin, otherPid, 'reads_floor_foreign', 0);
      const floorMisses: Array<[string, string]> = [['unknown', sid('L')], ['malformed', 'nope'], ['foreign', foreignFloor]];
      const floorAnswers = new Map<string, Sent[]>();
      for (const [slug, fid] of floorMisses) {
        const n16 = await call(admin, `reads_layer_${slug}_404`, 'GET', layerPath(pid, fid), undefined, [
          `404 NOT_FOUND resource floor: ${slug} floor id under my project (router.py:38-43)`,
        ]);
        const m33 = await call(admin, `reads_meta_${slug}_404`, 'GET', `/api/projects/${pid}/floors/${fid}/spatial`, undefined, [
          `404 NOT_FOUND resource floor (#33, ${slug})`,
        ]);
        floorAnswers.set(slug, [n16, m33]);
      }
      const projectMisses: Array<[string, string]> = [['malformed', 'not-a-project'], ['missing', MISSING_PROJECT]];
      const projectAnswers = new Map<string, Array<[string, Sent]>>();
      for (const [slug, p] of projectMisses) {
        const paths: Array<[string, string]> = [
          ['layer', layerPath(p, upper)],
          ['meta', `/api/projects/${p}/floors/${upper}/spatial`],
          ['graph', `/api/projects/${p}/spatial`],
          ['floors', `/api/projects/${p}/floors`],
        ];
        const rows: Array<[string, Sent]> = [];
        for (const [route, path] of paths) {
          rows.push([route, await call(admin, `reads_${route}_${slug}_project_404`, 'GET', path, undefined, [
            `404 NOT_FOUND resource project: ${slug} project id (projects/access.py:28-33,82-83)`,
          ])]);
        }
        projectAnswers.set(slug, rows);
      }
      await test.step('[BE4-G-004] malformed project id → 404 resource project (N16 / #33 / N15)', async () => {
        for (const [route, sent] of projectAnswers.get('malformed') ?? []) {
          if (route !== 'floors') expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });
      await test.step('[BE4-G-014] floor id with a wrong shape or unknown → 404 resource floor, not 422', async () => {
        for (const slug of ['malformed', 'unknown']) {
          for (const sent of floorAnswers.get(slug) ?? []) expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
        }
      });
      await test.step('[BE4-G-015] IDOR: floor of project B under project A → 404 resource floor', async () => {
        for (const sent of floorAnswers.get('foreign') ?? []) expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
      });

      const del = await call(admin, 'reads_floor_delete', 'DELETE', `/api/floors/${upper}`, undefined, ['setup: #11 soft delete → 200 snapshot']);
      expect(del.res.status()).toBe(200);
      const gone = await call(admin, 'reads_layer_deleted_floor_404', 'GET', layerPath(pid, upper), undefined, [
        '404 floor: a soft-deleted floor is not found (lookup.py:111-118 deleted_at IS NULL)',
      ]);
      const goneMeta = await call(admin, 'reads_meta_deleted_floor_404', 'GET', `/api/projects/${pid}/floors/${upper}/spatial`, undefined, ['404 floor (#33)']);
      await test.step('[BE4-G-016] soft-deleted floor → 404 resource floor (N16 / #33)', async () => {
        expectError(gone, 404, 'NOT_FOUND', { resource: 'floor' });
        expectError(goneMeta, 404, 'NOT_FOUND', { resource: 'floor' });
      });
      const liveFloors = await listFloors(admin, 'reads_floors_after_delete', pid, '200 only the live floor');
      const graphAfter = await readGraph(admin, 'reads_graph_after_delete', pid, '200 N15 without the deleted floor');
      await test.step('[BE4-G-109] deleted floor leaves levels, floorRevisions and #12', async () => {
        expect.soft(liveFloors.map((f) => f.id)).toEqual([ground]);
        expect.soft(objs(asJson(graphAfter.graph).levels, 'levels').map((l) => l.id)).toEqual([ground]);
        expect.soft(graphAfter.floorRevisions).toEqual([{ floorId: ground, revision: 0 }]);
        expect.soft(asJson(asJson(graphAfter.graph).building).grossFloorAreaM2).toBe(0);
      });

      const delProject = await call(admin, 'reads_project_delete', 'DELETE', `/api/projects/${otherPid}`, undefined, ['setup: soft-delete the other project → 200']);
      expect(delProject.res.status()).toBe(200);
      const deletedAnswers: Array<[string, Sent]> = [];
      for (const [route, path] of [
        ['layer', layerPath(otherPid, foreignFloor)],
        ['graph', `/api/projects/${otherPid}/spatial`],
        ['floors', `/api/projects/${otherPid}/floors`],
      ] as const) {
        deletedAnswers.push([route, await call(admin, `reads_${route}_deleted_project_404`, 'GET', path, undefined, [
          '404 project: a soft-deleted project fails the membership query (access.py:62-72 deleted_at IS NULL)',
        ])]);
      }
      await test.step('[BE4-G-005] missing or soft-deleted project → 404 resource project (N16 / #33 / N15)', async () => {
        for (const [route, sent] of projectAnswers.get('missing') ?? []) {
          if (route !== 'floors') expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
        for (const [route, sent] of deletedAnswers) {
          if (route !== 'floors') expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });
      await test.step('[BE5-G-003] #12 on a malformed / missing / soft-deleted project → 404 resource project', async () => {
        for (const slug of ['malformed', 'missing']) {
          for (const [route, sent] of projectAnswers.get(slug) ?? []) {
            if (route === 'floors') expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
          }
        }
        for (const [route, sent] of deletedAnswers) {
          if (route === 'floors') expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · write happy path: base 0 → 200 revision 1 (room areaM2 recomputed from the outline, NFD name → NFC, furniture without roomId keeps the key absent, integer confidence 1 accepted); N16 = response; #12 areaM2 + N15 grossFloorAreaM2 + project updatedAt follow; same layer again → 200 same revision, nothing touched; approve all → level + building reviewed; empty layer → counts reset', async () => {
    // spatial_write/router.py:45-67; writer.py:196-241,420-441,492-530; spatial_read/assemble.py:252-261; graph.py:160-170;
    // projects/summaries.py:133-179; domain/spatial/area.py:57-59.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'write', cleanup);
      const pid = String(project.id);
      const fid = await newFloor(admin, pid, 'write_floor', 0);

      const wa = sid('W');
      const door = openingOf(wa);
      const wallA = wallOf(fid, { id: wa, openingIds: [String(door.id)] });
      const wallB = wallOf(fid, { from: [0, 5000], to: [4000, 5000], t: 220, source: 'human', reviewed: true });
      const nfdName = 'Bếp Nhỏ'.normalize('NFD');
      const room = roomOf(fid, { name: nfdName, areaM2: 999, wallIds: [wa] });
      const loose = furnitureOf(fid);
      const placed = furnitureOf(fid, { roomId: String(room.id), rotationDeg: 90 });
      const layer = layerOf({ walls: [wallA, wallB], openings: [door], rooms: [room], furniture: [loose, placed] });

      const before = await readProject(admin, pid, 'write_project_before');
      const first = await put(admin, 'write_base0_200', pid, fid, writeBody(0, { layer }), [
        '200 revision 1; room areaM2 999 → 20 (4000 × 5000 mm, W18 writer.py:420-427); NFD name stored NFC; roomId absent stays absent (W2)',
      ]);
      const expected = layerOf({
        walls: [wallA, wallB],
        openings: [door],
        rooms: [{ ...room, name: 'Bếp Nhỏ', areaM2: 20 }],
        furniture: [loose, placed],
      });
      let written: Json = {};
      await test.step('[16-G-004] autosave PUT #35 {baseVersion, body:{layer}} → 200 revision + 1', async () => {
        written = expectWritten(first, 1, 'first write');
      });
      await test.step('[BE4-G-035] base 0 on a new floor ("Duyệt đoạn này") → 200 {revision 1, layer}, document created', async () => {
        expect.soft(written.layer).toEqual(expected);
      });
      await test.step('[BE4-G-036] client areaM2 is recomputed from the outline (999 → 20)', async () => {
        expect.soft(objs(layerIn(written).rooms, 'rooms')[0]?.areaM2).toBe(20);
      });
      await test.step('[BE4-G-037] NFD room name comes back NFC', async () => {
        expect.soft(objs(layerIn(written).rooms, 'rooms')[0]?.name).toBe('Bếp Nhỏ');
      });
      await test.step('[BE4-G-038] furniture without roomId keeps the key absent (W2)', async () => {
        expect.soft(objs(layerIn(written).furniture, 'furniture')[0], 'W2: no roomId key, not null').not.toHaveProperty('roomId');
      });
      await test.step('[BE4-G-039] integer confidence 1 (as the FE serialises it) is accepted', async () => {
        expect.soft(wallById(written, String(wallB.id))?.confidence).toBe(1);
      });

      const read1 = await readLayer(admin, 'write_read1', pid, fid, '200 N16 revision 1 = the 200 layer');
      const floors = await listFloors(admin, 'write_floors1', pid, '200 #12: floor areaM2 20 from set_layer_counts (writer.py:520-528)');
      const graph1 = await readGraph(admin, 'write_graph1', pid, '200 N15: grossFloorAreaM2 20, floorRevisions revision 1, the 2 walls');
      const after1 = await readProject(admin, pid, 'write_project_after1');
      await test.step('[BE4-G-031] N16 after the write = the layer in the 200, new revision', async () => {
        expect.soft(read1.revision).toBe(1);
        expect.soft(read1.layer).toEqual(expected);
      });
      await test.step('[BE5-G-005] room areaM2 from the #35 outline: 4000 × 5000 mm → 20', async () => {
        expect.soft(asJson(read1.level).areaM2, 'floor area = the room').toBe(20);
      });
      await test.step('[BE4-G-041] side effects: #12 areaM2, N15 grossFloorAreaM2 + floorRevisions, project updatedAt', async () => {
        expect.soft(floors[0]?.areaM2).toBe(20);
        expect.soft(asJson(asJson(graph1.graph).building).grossFloorAreaM2).toBe(20);
        expect.soft(graph1.floorRevisions).toEqual([{ floorId: fid, revision: 1 }]);
        expect.soft(objs(asJson(graph1.graph).walls, 'graph walls').map((w) => w.id)).toEqual([wa, wallB.id]);
        expect.soft(Date.parse(String(after1.updatedAt)), 'touch_project on a real write (writer.py:529)').toBeGreaterThan(Date.parse(String(before.updatedAt)));
      });

      const same = await put(admin, 'write_same_layer_200', pid, fid, writeBody(1, { layer }), [
        '200 revision 1: base = current and the stored document would not change (step 10, writer.py:340-341,492-499) → no UPDATE, no touch',
      ]);
      const after2 = await readProject(admin, pid, 'write_project_after_same');
      await test.step('[BE4-G-040] same layer at the current base (repeated Ctrl+S) → 200 same revision, no touch_project', async () => {
        expectWritten(same, 1, 'unchanged write');
        expect.soft(after2.updatedAt, 'no touch_project for an unchanged write').toBe(after1.updatedAt);
      });

      const human: Review = { source: 'human', reviewed: true };
      const approved = layerOf({
        walls: [{ ...wallA, ...meta(human) }, wallB],
        openings: [{ ...door, ...meta(human) }],
        rooms: [{ ...room, ...meta(human) }],
        furniture: [{ ...loose, ...meta(human) }, { ...placed, ...meta(human) }],
      });
      const approve = await put(admin, 'write_approve_all_200', pid, fid, writeBody(1, { layer: approved }), [
        '200 revision 2: every item human + reviewed (A5 allows it), no scale (source none) → level.reviewed true (assemble.py:252-261)',
      ]);
      const read2 = await readLayer(admin, 'write_read_approved', pid, fid, '200 N16: level.reviewed true');
      const graph2 = await readGraph(admin, 'write_graph_approved', pid, '200 N15: building.reviewed true (≥ 1 level, all reviewed, graph.py:160-170)');
      await test.step('[BE4-G-044] everything reviewed by a human, no scale → level.reviewed and building.reviewed true', async () => {
        expectWritten(approve, 2, 'approve all');
        expect.soft(asJson(read2.level).reviewed).toBe(true);
        expect.soft(asJson(asJson(graph2.graph).building).reviewed).toBe(true);
      });
      await test.step('[BE4-G-110] building.reviewed only when ≥ 1 level and every level is reviewed', async () => {
        expect.soft(asJson(asJson(graph1.graph).building).reviewed, 'one unreviewed AI wall → building not reviewed').toBe(false);
        expect.soft(asJson(asJson(graph2.graph).building).reviewed).toBe(true);
      });

      const cleared = await put(admin, 'write_empty_layer_200', pid, fid, writeBody(2, { layer: layerOf() }), [
        '200 revision 3: every item removed; counts reset (0 walls → level not reviewed, no area)',
      ]);
      const read3 = await readLayer(admin, 'write_read_empty', pid, fid, '200 N16 revision 3, empty layer, level.reviewed false (0 walls)');
      const floors3 = await listFloors(admin, 'write_floors_empty', pid, '200 #12: floor area back to 0 / absent');
      await test.step('[BE4-G-043] empty layer → counts back to 0, level.reviewed false, #12 areaM2 absent / 0', async () => {
        expectWritten(cleared, 3, 'empty layer');
        expect.soft(read3.layer).toEqual(layerOf());
        expect.soft(asJson(read3.level).reviewed).toBe(false);
        expect.soft(floors3[0]?.areaM2 ?? 0).toBe(0);
      });
      await test.step('[BE4-G-023] level.reviewed: false with an AI wall, true with all items human + reviewed and no provisional scale, false with 0 walls', async () => {
        expect.soft([asJson(read1.level).reviewed, asJson(read2.level).reviewed, asJson(read3.level).reviewed]).toEqual([false, true, false]);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · versioning: stale base → 409 VERSION_CONFLICT currentVersion + remoteChanges (snake field names, changedBy/Name of the writer, ms instants, __deleted__ without value); own repeat → 200 same body; base ahead → 422 field baseVersion (not 409); Idempotency-Key ignored; stale base with no logged change since → 200; two parallel PUTs on one base → one 200 + one 409; review-only change logs one touch mark', async () => {
    // writer.py:174-193,347-373,575-614; spatial_write/changes.py:241-281; core/errors.py:67-87; domain/spatial/diff.py:20-83;
    // spatial_write/router.py:8-10,46 (idempotency off).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'versions', cleanup);
      const pid = String(project.id);
      const me = creatorOf(project);
      const fid = await newFloor(admin, pid, 'ver_floor', 0);
      const wid = sid('W');
      const wall = (over: WallOpts = {}): Json => wallOf(fid, { id: wid, ...over });
      const table = furnitureOf(fid);

      expectWritten(await put(admin, 'ver_base0_200', pid, fid, writeBody(0, { layer: layerOf({ walls: [wall()], furniture: [table] }) }), [
        '200 revision 1',
      ]), 1, 'base 0');
      const body2 = writeBody(1, { layer: layerOf({ walls: [wall({ t: 220 })] }) });
      const second = await put(admin, 'ver_base1_200', pid, fid, body2, ['200 revision 2: thickness 220, table removed']);
      expectWritten(second, 2, 'base 1');

      const repeat = await put(admin, 'ver_base1_repeat_200', pid, fid, body2, [
        '200 revision 2 = the first answer: same writer + same body digest + same base (C09b, writer.py:359-364), nothing written',
      ]);
      await test.step('[BE4-G-050] own body repeated on a stale base (FE retry after a transient error) → 200 current revision, nothing written', async () => {
        expectWritten(repeat, 2, 'own repeat');
        expect.soft(repeat.body).toEqual(second.body);
      });

      const stale = await put(admin, 'ver_stale_409', pid, fid, writeBody(1, { layer: layerOf({ walls: [wall({ kind: 'loadBearing' })], furniture: [table] }) }), [
        '409 VERSION_CONFLICT currentVersion 2; remoteChanges = the revision-2 log: wall thickness_mm 220 + furniture __deleted__ (no value key)',
      ]);
      const conflict = asJson(stale.body);
      const changes = Array.isArray(conflict.remoteChanges) ? objs(conflict.remoteChanges, 'remoteChanges') : [];
      await test.step('[16-G-005] stale base → 409 VERSION_CONFLICT (the FE shows the reload banner)', async () => {
        expectError(stale, 409, 'VERSION_CONFLICT');
        expectZod(VersionConflictBodySchema, stale.body, '409');
      });
      await test.step('[BE4-G-049] stale base with logged changes → 409 currentVersion + remoteChanges (snake field names, changedBy / changedByName, ms instants)', async () => {
        expect.soft(conflict.currentVersion).toBe(2);
        const thickness = changes.find((c) => c.entityType === 'wall' && c.field === 'thickness_mm');
        expect.soft(thickness, 'wall thickness_mm row').toMatchObject({ entityId: wid, value: 220, changedBy: me.id, changedByName: me.name });
        expect.soft(String(thickness?.changedAt)).toMatch(MS_INSTANT);
        for (const c of changes) expectKeys(c, ['changedAt', 'changedBy', 'changedByName', 'entityId', 'entityType', 'field'], ['value']);
      });
      await test.step('[BE4-G-099] removing an item logs a removed row without a value (__deleted__ in the 409)', async () => {
        const removed = changes.find((c) => c.entityType === 'furniture' && c.field === '__deleted__');
        expect.soft(removed, 'furniture __deleted__ row').toMatchObject({ entityId: table.id });
        expect.soft(removed, 'a removal has no value key (core/errors.py:77-78)').not.toHaveProperty('value');
      });

      const ahead = await put(admin, 'ver_ahead_422', pid, fid, writeBody(9, { layer: layerOf({ walls: [wall()] }) }), [
        '422 VALIDATION field baseVersion: a base ahead of the document is invalid input, not a conflict (writer.py:355-356)',
      ]);
      const read2 = await readLayer(admin, 'ver_read2', pid, fid, '200 still revision 2 after the 409 / 422');
      await test.step('[BE4-G-048] baseVersion above the current revision → 422 VALIDATION field baseVersion (not 409)', async () => {
        expectError(ahead, 422, 'VALIDATION', { field: 'baseVersion' });
        expect.soft(read2.revision).toBe(2);
      });

      const key = `qa-layer-${uniq()}`;
      const keyFirst = await put(admin, 'ver_key_first_200', pid, fid, writeBody(2, { layer: layerOf({ walls: [wall({ t: 330 })] }) }), [
        '200 revision 3 with an Idempotency-Key',
      ], { 'Idempotency-Key': key });
      const keyReused = await put(admin, 'ver_key_reused_200', pid, fid, writeBody(3, { layer: layerOf({ walls: [wall({ t: 440 })] }) }), [
        '200 revision 4: the same key is NOT replayed (idempotency="off", router.py:8-10,46)',
      ], { 'Idempotency-Key': key });
      await test.step('[BE4-G-057] an Idempotency-Key reused is not replayed: two requests, two revisions', async () => {
        expectWritten(keyFirst, 3, 'key first');
        expectWritten(keyReused, 4, 'key reused');
      });

      expectWritten(await put(admin, 'ver_scale_only_200', pid, fid, writeBody(4, { scaleMillimetresPerPixel: 10 }), [
        '200 revision 5: scale only, first scale → no rescale, layer unchanged → no change-log row (writer.py:593-614)',
      ]), 5, 'scale only');
      const clean = await put(admin, 'ver_stale_but_clean_200', pid, fid, writeBody(4, { layer: layerOf({ walls: [wall({ t: 550 })] }) }), [
        '200 revision 6: base 4 < 5 but no logged field changed since 4 → no conflict, written on top (writer.py:365-373)',
      ]);
      await test.step('[BE4-G-052] stale base but no logged row since it (scale-only change) → 200, written on top', async () => {
        expectWritten(clean, 6, 'stale but clean');
      });

      const [a, b] = await Promise.all([
        put(admin, 'ver_race_a', pid, fid, writeBody(6, { layer: layerOf({ walls: [wall({ t: 660 })] }) }), ['race A at base 6']),
        put(admin, 'ver_race_b', pid, fid, writeBody(6, { layer: layerOf({ walls: [wall({ t: 770 })] }) }), ['race B at base 6']),
      ]);
      const winner = a.res.status() === 200 ? a : b;
      const loser = a.res.status() === 200 ? b : a;
      const winnerT = Number(wallById(asJson(winner.body), wid)?.thicknessMm);
      const read7 = await readLayer(admin, 'ver_read_race', pid, fid, '200 N16 revision 7 = the winner');
      await test.step('[BE4-G-053] two parallel PUTs on one base (two tabs) → exactly one 200 and one 409', async () => {
        const statuses = [a.res.status(), b.res.status()].sort();
        expect.soft(statuses, 'UPDATE … WHERE revision = 6 lets one win; the loser retries and meets the winner log (writer.py:330-344,533-557)').toEqual([200, 409]);
        expect.soft(asJson(winner.body).revision).toBe(7);
        expect.soft(asJson(loser.body).currentVersion).toBe(7);
        expect.soft(read7.revision).toBe(7);
        expect.soft(wallById(read7, wid)?.thicknessMm).toBe(winnerT);
      });

      const reviewOnly = await put(admin, 'ver_review_only_200', pid, fid, writeBody(7, { layer: layerOf({ walls: [wall({ t: winnerT, source: 'human', reviewed: true })] }) }), [
        '200 revision 8: only reviewed / source / confidence changed (untracked fields)',
      ]);
      const touch = await put(admin, 'ver_touch_mark_409', pid, fid, writeBody(7, { layer: layerOf({ walls: [wall({ t: winnerT, kind: 'envelope' })] }) }), [
        '409 currentVersion 8 with exactly ONE row: the touch mark wall thickness_mm = current value (writer.py:575-590,609-610)',
      ]);
      await test.step('[BE4-G-054] review-only change (reviewed / source / confidence) → the stale writer gets a 409 with exactly one touch row', async () => {
        expectWritten(reviewOnly, 8, 'review only');
        const touchBody = expectError(touch, 409, 'VERSION_CONFLICT');
        expect.soft(touchBody.currentVersion).toBe(8);
        expect.soft(objs(touchBody.remoteChanges, 'remoteChanges').map((c) => [c.entityType, c.entityId, c.field, c.value])).toEqual([
          ['wall', wid, 'thickness_mm', winnerT],
        ]);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · #35 body rules → 422 VALIDATION with field (baseVersion strict ≥ 0, body required and non-empty, strict keys, every wall / opening / room / furniture field rule) and nothing written; guards: missing baseVersion → 428 before Pydantic; floorId / projectId ≠ path → 422 PATH_BODY_MISMATCH; truncated JSON → 400; Pydantic before the floor lookup; unknown floor → 404 floor', async () => {
    // spatial_write/schemas.py:128-153; domain/spatial/model.py:34-257; core/errors.py:136-182; core/routing.py:138-161,236-252.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'rules', cleanup)).id);
      const fid = await newFloor(admin, pid, 'rules_floor', 0);
      const w = wallOf(fid);
      const okLayer = layerOf({ walls: [w] });
      const withWall = (over: Json): Json => writeBody(0, { layer: layerOf({ walls: [{ ...w, ...over }] }) });
      const wid = String(w.id);
      const door = openingOf(wid);
      const withDoor = (over: Json): Json =>
        writeBody(0, { layer: layerOf({ walls: [{ ...w, openingIds: [door.id] }], openings: [{ ...door, ...over }] }) });
      const room = roomOf(fid);
      const withRoom = (over: Json): Json => writeBody(0, { layer: layerOf({ walls: [w], rooms: [{ ...room, ...over }] }) });
      const item = furnitureOf(fid);
      const withItem = (over: Json): Json => writeBody(0, { layer: layerOf({ walls: [w], furniture: [{ ...item, ...over }] }) });
      const { furniture: _dropped, ...noFurniture } = okLayer;

      const cases: Array<[string, unknown, string]> = [
        ['base_negative', writeBody(-1, { layer: okLayer }), 'baseVersion'],
        ['base_string', writeBody('0', { layer: okLayer }), 'baseVersion'],
        ['base_float', writeBody(1.5, { layer: okLayer }), 'baseVersion'],
        ['body_missing', { baseVersion: 0 }, 'body'],
        ['body_empty', writeBody(0, {}), 'body'],
        ['body_layer_null', writeBody(0, { layer: null }), 'body'],
        ['body_extra', writeBody(0, { layer: okLayer, foo: 1 }), 'body.foo'],
        ['top_extra', { ...writeBody(0, { layer: okLayer }), foo: 1 }, 'foo'],
        ['layer_list_missing', writeBody(0, { layer: noFurniture }), 'body.layer.furniture'],
        ['wall_id_short', withWall({ id: 'W-ABC' }), 'body.layer.walls.0.id'],
        ['wall_id_prefix', withWall({ id: sid('R') }), 'body.layer.walls.0.id'],
        ['wall_level_malformed', withWall({ levelId: 'level-1' }), 'body.layer.walls.0.levelId'],
        ['wall_zero_length', withWall({ centreline: { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } } }), 'body.layer.walls.0.centreline'],
        ['wall_thickness_0', withWall({ thicknessMm: 0 }), 'body.layer.walls.0.thicknessMm'],
        ['wall_thickness_float', withWall({ thicknessMm: 12.5 }), 'body.layer.walls.0.thicknessMm'],
        ['wall_thickness_string', withWall({ thicknessMm: '110' }), 'body.layer.walls.0.thicknessMm'],
        ['wall_thickness_unsafe', withWall({ thicknessMm: 2 ** 53 }), 'body.layer.walls.0.thicknessMm'],
        ['wall_height_negative', withWall({ heightMm: -1 }), 'body.layer.walls.0.heightMm'],
        ['wall_kind', withWall({ kind: 'brick' }), 'body.layer.walls.0.kind'],
        ['wall_confidence', withWall({ confidence: 1.5 }), 'body.layer.walls.0.confidence'],
        ['wall_source', withWall({ source: 'robot' }), 'body.layer.walls.0.source'],
        ['wall_reviewed_string', withWall({ reviewed: 'true' }), 'body.layer.walls.0.reviewed'],
        ['wall_extra', withWall({ foo: 1 }), 'body.layer.walls.0.foo'],
        ['wall_opening_id', withWall({ openingIds: ['X-1'] }), 'body.layer.walls.0.openingIds.0'],
        ['opening_offset', withDoor({ offsetMm: -1 }), 'body.layer.openings.0.offsetMm'],
        ['opening_width_0', withDoor({ widthMm: 0 }), 'body.layer.openings.0.widthMm'],
        ['opening_swing', withDoor({ swing: 'up' }), 'body.layer.openings.0.swing'],
        ['room_outline_2', withRoom({ outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }), 'body.layer.rooms.0.outline'],
        ['room_name_empty', withRoom({ name: '' }), 'body.layer.rooms.0.name'],
        ['room_name_bidi', withRoom({ name: 'B\u202Ep' }), 'body.layer.rooms.0.name'],
        ['room_name_bell', withRoom({ name: 'B\u0007p' }), 'body.layer.rooms.0.name'],
        ['room_usage', withRoom({ usage: 'garage' }), 'body.layer.rooms.0.usage'],
        ['room_area_negative', withRoom({ areaM2: -1 }), 'body.layer.rooms.0.areaM2'],
        ['furniture_rotation_360', withItem({ rotationDeg: 360 }), 'body.layer.furniture.0.rotationDeg'],
        ['furniture_box_inverted', withItem({ boundingBox: { min: { x: 10, y: 0 }, max: { x: 0, y: 10 } } }), 'body.layer.furniture.0.boundingBox'],
        ['furniture_room_id', withItem({ roomId: 'R-x' }), 'body.layer.furniture.0.roomId'],
        ['furniture_kind', withItem({ kind: 'sofa' }), 'body.layer.furniture.0.kind'],
      ];
      cases.push(
        ['base_ahead', writeBody(5, { layer: okLayer }), 'baseVersion'],
        // QD-001 (decisions.md:5-14) + HOP-DONG-MOI Bản 11 §4 #35 (line 384): `dimensions?` is accepted now; its own rules are tested here.
        ['dim_duplicate_id', writeBody(0, { dimensions: [dimOf(fid), dimOf(fid)] }), 'body.dimensions.1.id'],
        ['dim_ai_reviewed', writeBody(0, { dimensions: [dimOf(fid, { source: 'ai', reviewed: true })] }), 'body.dimensions.0.reviewed'],
        ['body_axes', writeBody(0, { layer: okLayer, axes: [] }), 'body.axes'],
      );
      const answered = new Map<string, { sent: Sent; field: string }>();
      for (const [slug, data, field] of cases) {
        const sent = await put(admin, `rules_${slug}_422`, pid, fid, data, [`422 VALIDATION field "${field}" (schemas.py / domain model.py)`]);
        answered.set(slug, { sent, field });
      }
      const expect422 = (slugs: readonly string[]): void => {
        for (const slug of slugs) {
          const got = answered.get(slug);
          if (got === undefined) throw new Error(`no answer recorded for ${slug}`);
          expectError(got.sent, 422, 'VALIDATION', { field: got.field });
        }
      };
      const unchanged = await readLayer(admin, 'rules_read_unchanged', pid, fid, '200 revision 0: no 422 wrote anything');

      const noBase = await put(admin, 'rules_no_base_428', pid, fid, { body: { layer: okLayer } }, [
        '428 PRECONDITION_REQUIRED: no baseVersion key (core/routing.py:154-161)',
      ]);
      const arrayBody = await put(admin, 'rules_array_428', pid, fid, [1], ['428: a non-object body has no baseVersion']);
      const junk = await put(admin, 'rules_no_base_junk_428', pid, fid, { body: 'junk' }, ['428 before Pydantic: the invalid body does not matter (routing.py:9-12)']);

      const otherFloor = sid('L');
      const mismatchFloor = await put(admin, 'rules_floorid_mismatch_422', pid, fid, { ...writeBody(0, { layer: okLayer }), floorId: otherFloor }, [
        '422 PATH_BODY_MISMATCH field floorId: camelCase path key with another value (core/routing.py:138-151)',
      ]);
      const mismatchProject = await put(admin, 'rules_projectid_mismatch_422', pid, fid, { ...writeBody(0, { layer: okLayer }), projectId: MISSING_PROJECT }, [
        '422 PATH_BODY_MISMATCH field projectId',
      ]);
      const sameFloor = await put(admin, 'rules_floorid_same_422', pid, fid, { ...writeBody(0, { layer: okLayer }), floorId: fid }, [
        '422 VALIDATION field floorId: equal to the path passes W21 but is an extra key (WireRequest extra=forbid)',
      ]);
      const malformed = await put(admin, 'rules_malformed_400', pid, fid, Buffer.from('{"baseVersion": 0, "body": {'), [
        '400 MALFORMED_JSON: truncated JSON, parsed before every dependency (core/errors.py:170-174; core/routing.py:111)',
      ]);

      const ghost = sid('L');
      const ghostInvalid = await put(admin, 'rules_unknown_floor_invalid_body_422', pid, ghost, writeBody(0, {}), [
        '422 VALIDATION field body: Pydantic runs before the handler looks the floor up (router.py:55-57)',
      ]);
      const ghostValid = await put(admin, 'rules_unknown_floor_404', pid, ghost, writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 NOT_FOUND resource floor (router.py:55-57)',
      ]);
      const malformedFloor = await put(admin, 'rules_malformed_floor_404', pid, 'nope', writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 floor: the floor id has no format check, the lookup misses (floors/lookup.py:111-118)',
      ]);
      const badProject = await put(admin, 'rules_bad_project_404', 'not-a-project', fid, writeBody(0, { layer: okLayer }), [
        '404 project: malformed prj id, no DB query (projects/access.py:28-33)',
      ]);

      await test.step('[16-G-006] base above the current revision → 422 field baseVersion (the FE reloads)', async () => {
        expect422(['base_ahead']);
      });
      await test.step('[16-G-007] any other 422 VALIDATION (the FE shows "Không lưu được…") carries a field', async () => {
        const got = answered.get('body_empty');
        expect.soft(got?.sent.res.status()).toBe(422);
        expect.soft(asJson(got?.sent.body).field).toBe('body');
      });
      await test.step('[BE4-G-046] missing baseVersion key (also an array or junk body) → 428 PRECONDITION_REQUIRED before Pydantic', async () => {
        for (const sent of [noBase, arrayBody, junk]) expectError(sent, 428, 'PRECONDITION_REQUIRED');
      });
      await test.step('[BE4-G-047] baseVersion "0" / -1 / 1.5 → 422 field baseVersion (strict int ≥ 0)', async () => {
        expect422(['base_negative', 'base_string', 'base_float']);
      });
      await test.step('[BE4-G-061] body missing / {} / layer null → 422 field body', async () => {
        expect422(['body_missing', 'body_empty', 'body_layer_null']);
      });
      await test.step('[BE4-G-062] unknown key in the envelope / body / entity → 422 at that key (extra=forbid)', async () => {
        expect422(['top_extra', 'body_extra', 'wall_extra']);
      });
      await test.step('[BE4-G-063] body.axes is still refused (SCR-19 cannot save); body.dimensions is accepted (QD-001) but a duplicate id → 422 VALIDATION body.dimensions.1.id and source ai + reviewed true → 422 REVIEW_BY_AI_FORBIDDEN body.dimensions.0.reviewed', async () => {
        expect422(['body_axes', 'dim_duplicate_id']);
        const ai = answered.get('dim_ai_reviewed');
        if (ai === undefined) throw new Error('no answer recorded for dim_ai_reviewed');
        expectError(ai.sent, 422, 'REVIEW_BY_AI_FORBIDDEN', { field: ai.field });
      });
      await test.step('[BE4-G-064] layer missing a list (furniture) → 422 field body.layer.furniture', async () => {
        expect422(['layer_list_missing']);
      });
      await test.step('[BE4-G-065] wall rules: id, levelId, zero-length centreline, thickness 0 / 12.5 / "110" / 2^53, height, kind, … → 422 body.layer.walls.0.<key>', async () => {
        expect422([...answered.keys()].filter((slug) => slug.startsWith('wall_') && slug !== 'wall_extra'));
      });
      await test.step('[BE4-G-066] opening rules: offsetMm -1, widthMm 0, swing unknown → 422 body.layer.openings.0.<key>', async () => {
        expect422([...answered.keys()].filter((slug) => slug.startsWith('opening_')));
      });
      await test.step('[BE4-G-067] room rules: outline < 3 points, name "" / U+202E / U+0007, usage, areaM2 -1 → 422 body.layer.rooms.0.<key>', async () => {
        expect422([...answered.keys()].filter((slug) => slug.startsWith('room_')));
      });
      await test.step('[BE4-G-069] furniture rules: rotationDeg 360, inverted box, roomId, kind → 422 body.layer.furniture.0.<key>', async () => {
        expect422([...answered.keys()].filter((slug) => slug.startsWith('furniture_')));
      });
      await test.step('[BE4-G-070] after every 422 nothing is written: N16 revision stays 0', async () => {
        expect.soft(unchanged.revision).toBe(0);
      });
      await test.step('[BE4-G-071] truncated JSON → 400 MALFORMED_JSON', async () => {
        expectError(malformed, 400, 'MALFORMED_JSON');
      });
      await test.step('[BE4-G-072] floorId / projectId in the body different from the path → 422 PATH_BODY_MISMATCH; equal → 422 VALIDATION (extra key)', async () => {
        expectError(mismatchFloor, 422, 'PATH_BODY_MISMATCH', { field: 'floorId' });
        expectError(mismatchProject, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
        expectError(sameFloor, 422, 'VALIDATION', { field: 'floorId' });
      });
      await test.step('[BE4-G-073] invalid body on an unknown floor → 422 body (Pydantic first); valid body → 404 floor', async () => {
        expectError(ghostInvalid, 422, 'VALIDATION', { field: 'body' });
        expectError(ghostValid, 404, 'NOT_FOUND', { resource: 'floor' });
        expectError(malformedFloor, 404, 'NOT_FOUND', { resource: 'floor' });
        expectError(badProject, 404, 'NOT_FOUND', { resource: 'project' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · domain rules: A5 (AI item marked reviewed) → 422 REVIEW_BY_AI_FORBIDDEN field of the first item, checked before levelId and before the base; LAYER_LEVEL_MISMATCH field; critical integrity → 422 LAYER_INTEGRITY_BROKEN count, warnings accepted; entity ids unique per project: another floor\'s id → 422 count 1 (also a deleted floor inside the restore window), free once released, same id in another project → 200; deleted / foreign floor → 404 floor', async () => {
    // writer.py:216-219,290-308,560-572; domain/spatial/integrity.py:303-383, kinds.py:454-463;
    // spatial_read/entity_ids.py (claim_entity_ids); floors/settings.py:19 (restore window 600 s).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'domain', cleanup)).id);
      const fa = await newFloor(admin, pid, 'dom_floor_a', 0);
      const fb = await newFloor(admin, pid, 'dom_floor_b', 1);
      const fc = await newFloor(admin, pid, 'dom_floor_c', 2);
      const aiReviewed: Review = { source: 'ai', reviewed: true };

      const a5Cases: Array<[string, Json, string]> = [
        ['a5_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fa, aiReviewed)] }) }), 'body.layer.walls.0.reviewed'],
        ['a5_second_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fa), wallOf(fa, aiReviewed)] }) }), 'body.layer.walls.1.reviewed'],
      ];
      const host = wallOf(fa);
      const aiDoor = openingOf(String(host.id), aiReviewed);
      a5Cases.push(['a5_opening', writeBody(0, { layer: layerOf({ walls: [{ ...host, openingIds: [aiDoor.id] }], openings: [aiDoor] }) }), 'body.layer.openings.0.reviewed']);
      a5Cases.push(['a5_with_base_ahead', writeBody(9, { layer: layerOf({ walls: [wallOf(fa, aiReviewed)] }) }), 'body.layer.walls.0.reviewed']);
      a5Cases.push([
        'a5_before_level',
        writeBody(0, { layer: layerOf({ walls: [{ ...host, levelId: fb, openingIds: [aiDoor.id] }], openings: [aiDoor] }) }),
        'body.layer.openings.0.reviewed',
      ]);
      const a5Sent: Array<[Sent, string]> = [];
      for (const [slug, data, field] of a5Cases) {
        a5Sent.push([await put(admin, `dom_${slug}_422`, pid, fa, data, [
          `422 REVIEW_BY_AI_FORBIDDEN field ${field}: A5 first, before levelId / integrity (writer.py:290-298) and before the base check (writer.py:217-219 vs 355)`,
        ]), field]);
      }
      await test.step('[BE4-G-074] an AI item marked reviewed → 422 REVIEW_BY_AI_FORBIDDEN at the first such item, before levelId and before the base', async () => {
        for (const [sent, field] of a5Sent) expectError(sent, 422, 'REVIEW_BY_AI_FORBIDDEN', { field });
      });

      const levelCases: Array<[string, Json, string]> = [
        ['level_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fb)] }) }), 'body.layer.walls.0.levelId'],
        ['level_room', writeBody(0, { layer: layerOf({ walls: [wallOf(fa)], rooms: [roomOf(fb)] }) }), 'body.layer.rooms.0.levelId'],
      ];
      const dup = wallOf(fb);
      levelCases.push(['level_before_integrity', writeBody(0, { layer: layerOf({ walls: [dup, dup] }) }), 'body.layer.walls.0.levelId']);
      const levelSent: Array<[Sent, string]> = [];
      for (const [slug, data, field] of levelCases) {
        levelSent.push([await put(admin, `dom_${slug}_422`, pid, fa, data, [
          `422 LAYER_LEVEL_MISMATCH field ${field}: item of another (well-formed) floor, checked before integrity (writer.py:299-305)`,
        ]), field]);
      }
      await test.step('[BE4-G-075] item with a levelId other than the written floor → 422 LAYER_LEVEL_MISMATCH at that field', async () => {
        for (const [sent, field] of levelSent) expectError(sent, 422, 'LAYER_LEVEL_MISMATCH', { field });
      });

      const twin = wallOf(fa);
      const ghostDoor = openingOf(sid('W'));
      const integrityCases: Array<[string, Json]> = [
        ['dup_id', writeBody(0, { layer: layerOf({ walls: [twin, twin] }) })],
        ['opening_ghost_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fa)], openings: [ghostDoor] }) })],
        ['wall_ghost_opening', writeBody(0, { layer: layerOf({ walls: [wallOf(fa, { openingIds: [sid('D')] })] }) })],
      ];
      const integritySent: Sent[] = [];
      for (const [slug, data] of integrityCases) {
        integritySent.push(await put(admin, `dom_${slug}_422`, pid, fa, data, [
          '422 LAYER_INTEGRITY_BROKEN count 1: one critical issue (integrity.py:303-339; writer.py:306-308)',
        ]));
      }
      const readA0 = await readLayer(admin, 'dom_read_a0', pid, fa, '200 floor A still revision 0 after every 422');

      const wa = wallOf(fa);
      const closed = roomOf(fa, { wallIds: [sid('W')] });
      const closedRoom = { ...closed, outline: [...(closed.outline as Json[]), { x: 0, y: 0 }] };
      const strayItem = furnitureOf(fa, { roomId: sid('R') });
      const warn = await put(admin, 'dom_warnings_200', pid, fa, writeBody(0, { layer: layerOf({ walls: [wa], rooms: [closedRoom], furniture: [strayItem] }) }), [
        '200 revision 1: room → missing wall, furniture → missing room, closed outline are WARNINGS (integrity.py:327-358), stored as sent',
      ]);
      await test.step('[BE4-G-076] critical integrity issues → 422 LAYER_INTEGRITY_BROKEN with count; warnings (room → missing wall, furniture → missing room) are stored as sent', async () => {
        for (const sent of integritySent) expectError(sent, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
        expect.soft(readA0.revision).toBe(0);
        const warned = expectWritten(warn, 1, 'warnings');
        expect.soft(objs(layerIn(warned).furniture, 'furniture')[0]?.roomId).toBe(strayItem.roomId);
      });

      const waOnB = { ...wa, levelId: fb };
      const taken = await put(admin, 'dom_id_of_floor_a_on_b_422', pid, fb, writeBody(0, { layer: layerOf({ walls: [waOnB] }) }), [
        '422 LAYER_INTEGRITY_BROKEN count 1: the wall id belongs to floor A of this project (writer.py:560-572, entity_ids.py)',
      ]);
      const readB0 = await readLayer(admin, 'dom_read_b0', pid, fb, '200 floor B still revision 0: the savepoint rolled the bump back');
      await test.step('[BE4-G-077] an id that belongs to another live floor of the project → 422 LAYER_INTEGRITY_BROKEN count 1; the revision bump rolls back', async () => {
        expectError(taken, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
        expect.soft(readB0.revision).toBe(0);
      });

      const otherPid = String((await newProject(admin, 'domain-other', cleanup)).id);
      const fq = await newFloor(admin, otherPid, 'dom_floor_other_project', 0);
      const otherProject = await put(admin, 'dom_same_id_other_project_200', otherPid, fq, writeBody(0, { layer: layerOf({ walls: [{ ...wa, levelId: fq }] }) }), [
        '200: ids are unique per PROJECT (PK project_id, entity_id), another project may reuse it',
      ]);

      const release = await put(admin, 'dom_release_on_a_200', pid, fa, writeBody(1, { layer: layerOf() }), [
        '200 revision 2: floor A drops the wall → its id is released (entity_ids.py _release)',
      ]);
      const claim = await put(admin, 'dom_claim_on_b_200', pid, fb, writeBody(0, { layer: layerOf({ walls: [waOnB] }) }), [
        '200 revision 1: floor B now owns the released id',
      ]);
      await test.step('[BE4-G-078] an id dropped from floor A is released and floor B can take it', async () => {
        expectWritten(release, 2, 'release');
        expectWritten(claim, 1, 'claim');
      });

      // Delete then undo on the SAME floor (SCR-16 Backspace + "Hoàn tác"): the id is released, then inserted again.
      const undoWall = wallOf(fa);
      const undoAdd = await put(admin, 'dom_undo_add_200', pid, fa, writeBody(2, { layer: layerOf({ walls: [undoWall] }) }), ['200 revision 3: a new wall on floor A']);
      const undoDelete = await put(admin, 'dom_undo_delete_200', pid, fa, writeBody(3, { layer: layerOf() }), ['200 revision 4: the wall is deleted (id released)']);
      const undoRestore = await put(admin, 'dom_undo_restore_200', pid, fa, writeBody(4, { layer: layerOf({ walls: [undoWall] }) }), [
        '200 revision 5: "Hoàn tác" puts back the very same id on the same floor (entity_ids.py _release, _insert_new)',
      ]);
      await test.step('[BE4-G-079] delete then undo on the same floor: PUT without the id → 200, PUT with the same id again → 200', async () => {
        expectWritten(undoAdd, 3, 'add');
        expectWritten(undoDelete, 4, 'delete');
        expectWritten(undoRestore, 5, 'undo');
      });

      const wc = wallOf(fc);
      expectWritten(await put(admin, 'dom_floor_c_200', pid, fc, writeBody(0, { layer: layerOf({ walls: [wc] }) }), ['200 revision 1 on floor C']), 1, 'floor C');
      const del = await call(admin, 'dom_floor_c_delete', 'DELETE', `/api/floors/${fc}`, undefined, ['setup: #11 soft delete floor C → 200']);
      expect(del.res.status()).toBe(200);
      const held = await put(admin, 'dom_id_of_deleted_floor_422', pid, fb, writeBody(1, { layer: layerOf({ walls: [waOnB, { ...wc, levelId: fb }] }) }), [
        '422 LAYER_INTEGRITY_BROKEN count 1: a soft-deleted floor keeps its ids inside FLOOR_RESTORE_WINDOW_S (600 s, entity_ids.py claim_entity_ids)',
      ]);
      const onDeleted = await put(admin, 'dom_write_deleted_floor_404', pid, fc, writeBody(1, { layer: layerOf() }), [
        '404 floor: writing a soft-deleted floor (router.py:55-57)',
      ]);
      const foreign = await put(admin, 'dom_write_foreign_floor_404', pid, fq, writeBody(1, { layer: layerOf() }), [
        '404 floor: a floor of another project under my project path',
      ]);
      await test.step('[BE4-G-080] a soft-deleted floor inside the 600 s restore window keeps its ids → 422 count 1; writing the deleted / a foreign floor → 404 floor', async () => {
        expectError(held, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
        expectError(onDeleted, 404, 'NOT_FOUND', { resource: 'floor' });
        expectError(foreign, 404, 'NOT_FOUND', { resource: 'floor' });
      });
      await test.step('[BE4-G-082] the same entity id in another project → 200', async () => {
        expectWritten(otherProject, 1, 'other project');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · scale: scale-only write → 200 + N16 level.scaleMillimetresPerPixel (HALF_UP 6 places), human scale → no scaleStatus; same scale → no bump; range (0, 999999] and JSON-number-only → 422 field body.scaleMillimetresPerPixel; a new scale rescales only UNREVIEWED items (k = new / old; heights, angles kept; room area recomputed); layer + scale → layer read in the old scale; a rescale that collapses an item → 422; SCR-14 apply-all (#12 + N15 revisions → PUT each floor) → every level carries the scale', async () => {
    // spatial_write/schemas.py:92-139; writer.py:376-417,430-441; domain/scale/rescale.py:1-110; spatial_read/assemble.py:235-283.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'scale', cleanup)).id);
      const s1 = await newFloor(admin, pid, 'scale_floor_1', 0);
      const s2 = await newFloor(admin, pid, 'scale_floor_2', 1);
      const s3 = await newFloor(admin, pid, 'scale_floor_3', 2);
      const s4 = await newFloor(admin, pid, 'scale_floor_4', 3);
      const field = 'body.scaleMillimetresPerPixel';

      const rules: Array<[string, unknown, string]> = [
        ['zero', writeBody(0, { scaleMillimetresPerPixel: 0 }), field],
        ['negative', writeBody(0, { scaleMillimetresPerPixel: -1 }), field],
        ['rounds_to_zero', writeBody(0, { scaleMillimetresPerPixel: 0.0000004 }), field],
        ['above_max', writeBody(0, { scaleMillimetresPerPixel: 1_000_000 }), field],
        ['string', writeBody(0, { scaleMillimetresPerPixel: '2' }), field],
        ['bool', writeBody(0, { scaleMillimetresPerPixel: true }), field],
        ['nan_raw', Buffer.from('{"baseVersion":0,"body":{"scaleMillimetresPerPixel":NaN}}'), field],
        ['overflow_raw', Buffer.from('{"baseVersion":0,"body":{"scaleMillimetresPerPixel":1e400}}'), field],
        ['null_only', writeBody(0, { scaleMillimetresPerPixel: null }), 'body'],
      ];
      const ruleSent: Array<[Sent, string]> = [];
      for (const [slug, data, f] of rules) {
        ruleSent.push([await put(admin, `scale_rule_${slug}_422`, pid, s1, data, [`422 VALIDATION field ${f} (schemas.py:101-139)`]), f]);
      }
      const readS10 = await readLayer(admin, 'scale_read_s1_0', pid, s1, '200 revision 0 after the 422s');
      await test.step('[BE4-G-085] scale 0 / -1 / 1 000 000 / "2" / true / NaN / 0.0000004 → 422 VALIDATION field body.scaleMillimetresPerPixel; nothing written', async () => {
        for (const [sent, f] of ruleSent) expectError(sent, 422, 'VALIDATION', { field: f });
        expect.soft(readS10.revision).toBe(0);
      });

      const firstScale = await put(admin, 'scale_first_200', pid, s1, writeBody(0, { scaleMillimetresPerPixel: 2.0000005 }), [
        '200 revision 1, empty layer (scale-only write creates the document, writer.py:311-327)',
      ]);
      const r1 = await readLayer(admin, 'scale_read_s1_1', pid, s1, '200 N16: scale 2.000001 (HALF_UP), source human → no scaleStatus (assemble.py:247-249)');
      await test.step('[BE4-G-083] scale-only write ("Áp dụng tỷ lệ") → 200 revision + 1, empty document created, N16 has the scale and no scaleStatus', async () => {
        const out = expectWritten(firstScale, 1, 'first scale');
        expect.soft(out.layer).toEqual(layerOf());
        expect.soft(asJson(r1.level).scaleMillimetresPerPixel).toBeGreaterThan(0);
        expect.soft(r1).not.toHaveProperty('scaleStatus');
      });
      await test.step('[BE4-G-026] after a human scale via #35: no scaleStatus, level.scaleMillimetresPerPixel = the stored value', async () => {
        expect.soft(r1).not.toHaveProperty('scaleStatus');
        expect.soft(asJson(r1.level).scaleMillimetresPerPixel).toBe(2.000001);
      });
      const sameScale = await put(admin, 'scale_same_200', pid, s1, writeBody(1, { scaleMillimetresPerPixel: 2.000001 }), [
        '200 revision 1: same value, source and page → unchanged, no bump (writer.py:492-499)',
      ]);
      await test.step('[BE4-G-086] same scale again → 200, revision not bumped', async () => {
        expectWritten(sameScale, 1, 'same scale');
      });

      const lowBound = await put(admin, 'scale_low_bound_200', pid, s2, writeBody(0, { scaleMillimetresPerPixel: 0.0000005 }), [
        '200: 0.0000005 rounds HALF_UP to 0.000001 > 0',
      ]);
      const readLow = await readLayer(admin, 'scale_read_s2_low', pid, s2, '200 scale 0.000001');
      const highBound = await put(admin, 'scale_high_bound_200', pid, s2, writeBody(1, { scaleMillimetresPerPixel: 999_999 }), [
        '200: 999999 = SCALE_MAX accepted (schemas.py:95)',
      ]);
      await test.step('[BE4-G-084] scale rounds HALF_UP to 6 places (2.0000005 → 2.000001, 0.0000005 → 0.000001) and 999 999 is accepted', async () => {
        expectWritten(lowBound, 1, 'low bound');
        expect.soft(asJson(readLow.level).scaleMillimetresPerPixel).toBe(0.000001);
        expectWritten(highBound, 2, 'high bound');
      });

      // Rescale (s3): first write sets layer + scale 2 together (no previous scale → no factor).
      const wu = sid('W');
      const door = openingOf(wu, { offset: 500, width: 900 });
      const unreviewed = wallOf(s3, { id: wu, t: 110, openingIds: [String(door.id)] });
      const reviewed = wallOf(s3, { from: [0, 1000], to: [4000, 1000], t: 220, source: 'human', reviewed: true });
      const room = roomOf(s3, { w: 4000, h: 5000 });
      const item = furnitureOf(s3, { rotationDeg: 90 });
      expectWritten(await put(admin, 'scale_s3_base_200', pid, s3, writeBody(0, {
        layer: layerOf({ walls: [unreviewed, reviewed], openings: [door], rooms: [room], furniture: [item] }),
        scaleMillimetresPerPixel: 2,
      }), ['200 revision 1: layer as sent, scale 2']), 1, 's3 base');
      const doubled = await put(admin, 'scale_s3_double_200', pid, s3, writeBody(1, { scaleMillimetresPerPixel: 4 }), [
        '200 revision 2: k = 4 / 2 → unreviewed wall end 8000 + thickness 220, door offset 1000 / width 1800 (height kept), room outline ×2 and area 80, table centre / box ×2 (rotation kept); reviewed wall untouched (rescale.py:1-92)',
      ]);
      const r3 = await readLayer(admin, 'scale_read_s3_2', pid, s3, '200 N16 = the 200 layer, level scale 4');
      await test.step('[BE4-G-087] a new scale rescales only UNREVIEWED items by k = new / old (heights, angles kept, area recomputed); reviewed items untouched', async () => {
        const dl = expectWritten(doubled, 2, 'rescale');
        const layer2 = layerIn(dl);
        expect.soft(wallById(dl, wu)).toMatchObject({ centreline: { start: { x: 0, y: 0 }, end: { x: 8000, y: 0 } }, thicknessMm: 220, heightMm: 3000 });
        expect.soft(wallById(dl, String(reviewed.id))).toEqual(reviewed);
        expect.soft(objs(layer2.openings, 'openings')[0]).toMatchObject({ offsetMm: 1000, widthMm: 1800, heightMm: 2100, sillHeightMm: 0 });
        expect.soft(objs(layer2.rooms, 'rooms')[0]).toMatchObject({
          outline: [{ x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 10000 }, { x: 0, y: 10000 }],
          areaM2: 80,
        });
        expect.soft(objs(layer2.furniture, 'furniture')[0]).toMatchObject({
          centre: { x: 800, y: 600 },
          boundingBox: { min: { x: 0, y: 0 }, max: { x: 1600, y: 1200 } },
          rotationDeg: 90,
        });
        expect.soft(r3.layer).toEqual(layer2);
        expect.soft(asJson(r3.level).scaleMillimetresPerPixel).toBe(4);
      });

      const sentOld = await put(admin, 'scale_s3_layer_and_scale_200', pid, s3, writeBody(2, {
        layer: layerOf({ walls: [wallOf(s3, { id: wu, to: [1000, 0], t: 100 }), reviewed] }),
        scaleMillimetresPerPixel: 8,
      }), ['200 revision 3: the sent layer is read in the OLD scale (4) and rescaled ×2 → wall end 2000, thickness 200; reviewed wall kept (writer.py:437-439)']);
      await test.step('[BE4-G-088] layer + scale in one body (saveScale with pending edits): the layer is read in the OLD scale, then multiplied by k', async () => {
        const so = expectWritten(sentOld, 3, 'layer + scale');
        expect.soft(wallById(so, wu)).toMatchObject({ centreline: { start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } }, thicknessMm: 200 });
        expect.soft(wallById(so, String(reviewed.id))).toEqual(reviewed);
      });

      // SCR-14 "Áp cho mọi tầng": read #12 + N15, then one scale-only PUT per floor at its floorRevisions revision.
      const listed = await listFloors(admin, 'scale_all_floors', pid, '200 #12: the 4 floors (useScaleCalibration onApply reads it)');
      const graph = await readGraph(admin, 'scale_all_graph', pid, '200 N15 floorRevisions: the base of each per-floor PUT');
      const revisions = new Map(objs(graph.floorRevisions, 'floorRevisions').map((r) => [String(r.floorId), Number(r.revision)]));
      const applyAll: Array<[Sent, number, string]> = [];
      for (const f of listed) {
        const id = String(f.id);
        const base = revisions.get(id) ?? 0;
        applyAll.push([await put(admin, `scale_all_put_${String(f.order)}`, pid, id, writeBody(base, { scaleMillimetresPerPixel: 5 }), [
          `200 revision ${String(base + 1)}: scale 5 applied at the N15 revision of this floor`,
        ]), base + 1, `apply-all floor ${String(f.order)}`]);
      }
      const graphAll = await readGraph(admin, 'scale_all_graph_after', pid, '200 N15: every level scaleMillimetresPerPixel 5');
      await test.step('[BE4-G-093] "Áp cho mọi tầng": #12 + N15 floorRevisions → one scale-only PUT per floor at that revision, each 200; every level carries the scale', async () => {
        expect.soft([...revisions.keys()].sort()).toEqual(listed.map((f) => String(f.id)).sort());
        for (const [sent, revision, what] of applyAll) expectWritten(sent, revision, what);
        for (const l of objs(asJson(graphAll.graph).levels, 'levels')) expect.soft(l.scaleMillimetresPerPixel, `level ${String(l.id)}`).toBe(5);
      });

      // RescaleError (s4 is at revision 1, scale 5, empty): a 1 mm wall, then a scale that rounds it to 0 mm.
      expectWritten(await put(admin, 'scale_s4_thin_wall_200', pid, s4, writeBody(1, { layer: layerOf({ walls: [wallOf(s4, { t: 1 })] }) }), [
        '200 revision 2: a 1 mm unreviewed wall',
      ]), 2, 'thin wall');
      const collapse = await put(admin, 'scale_s4_collapse_422', pid, s4, writeBody(2, { scaleMillimetresPerPixel: 0.001 }), [
        '422 VALIDATION field body.scaleMillimetresPerPixel: k = 0.0002 rounds the 1 mm thickness to 0 → RescaleError (writer.py:404-409)',
      ]);
      const r4 = await readLayer(admin, 'scale_read_s4', pid, s4, '200 still revision 2, scale 5');
      await test.step('[BE4-G-089] a scale that collapses an item (thickness 1 mm → 0) → 422 field body.scaleMillimetresPerPixel, nothing written', async () => {
        expectError(collapse, 422, 'VALIDATION', { field });
        expect.soft(r4.revision).toBe(2);
        expect.soft(asJson(r4.level).scaleMillimetresPerPixel).toBe(5);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · roles: viewer member → reads N16 / #33 / N15 / #12 (200) but #35 → 403 FORBIDDEN (also before 428 and Pydantic); viewer non-member → 404 project on reads and #35; after #41 role → engineer: member #35 → 200, non-member → 404 project; admin\'s stale write then names the engineer in remoteChanges', async () => {
    // projects/access.py:45-86; packages/domain/permissions/matrix.py:47 (layer.edit admin/engineer); spatial_read/router.py:58-72
    // (any member); spatial_write/router.py:36-42,50 (changed_by_name read in the write transaction).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const p1 = String((await newProject(admin, 'roles-member', cleanup)).id);
      const p2 = String((await newProject(admin, 'roles-outside', cleanup)).id);
      const f1 = await newFloor(admin, p1, 'roles_floor_member', 0);
      const f2 = await newFloor(admin, p2, 'roles_floor_outside', 0);
      const user = await realUser(admin, 'viewer', 'roles', cleanup);
      const add = await call(admin, 'roles_add_member', 'POST', `/api/projects/${p1}/members`, { email: user.email }, [
        'setup: N3 adds the viewer to project 1 → 201',
      ]);
      expect(add.res.status()).toBe(201);
      const viewer = user.api;

      const viewerN16 = await call(viewer, 'roles_viewer_n16_200', 'GET', layerPath(p1, f1), undefined, ['200: any member reads N16 (router.py:71)']);
      const meta = await call(viewer, 'roles_viewer_meta_200', 'GET', `/api/projects/${p1}/floors/${f1}/spatial`, undefined, ['200 #33 for a viewer member']);
      const viewerGraph = await call(viewer, 'roles_viewer_graph_200', 'GET', `/api/projects/${p1}/spatial`, undefined, ['200 N15 for a viewer member']);
      const viewerFloors = await call(viewer, 'roles_viewer_floors_200', 'GET', `/api/projects/${p1}/floors`, undefined, ['200 #12 for a viewer member']);
      const viewerGhost = await call(viewer, 'roles_viewer_unknown_floor_404', 'GET', layerPath(p1, sid('L')), undefined, [
        '404 resource floor: the project exists, the floor does not (the FE picks its copy from `resource`)',
      ]);
      await test.step('[BE4-G-019] viewer member reads N16 and #33 → 200', async () => {
        expect.soft(viewerN16.res.status()).toBe(200);
        expectZod(FloorLayerDocumentSchema, viewerN16.body, 'N16');
        expect.soft(meta.res.status()).toBe(200);
      });
      await test.step('[BE4-G-106] viewer member reads N15 → 200', async () => {
        expect.soft(viewerGraph.res.status()).toBe(200);
        expectZod(SpatialGraphDocumentSchema, viewerGraph.body, 'N15');
      });
      await test.step('[BE5-G-002] viewer member reads #12 → 200', async () => {
        expect.soft(viewerFloors.res.status()).toBe(200);
      });
      const viewerPuts: Array<[string, unknown]> = [
        ['valid', writeBody(0, { scaleMillimetresPerPixel: 2 })],
        ['no_base', { body: { scaleMillimetresPerPixel: 2 } }],
        ['empty_body', writeBody(0, {})],
      ];
      const viewerPutSent = new Map<string, Sent>();
      for (const [slug, data] of viewerPuts) {
        viewerPutSent.set(slug, await put(viewer, `roles_viewer_put_${slug}_403`, p1, f1, data, [
          '403 FORBIDDEN: layer.edit is false for viewer; require_project runs before the 428 guard and Pydantic (router.py:3-6)',
        ]));
      }
      await test.step('[16-G-008] viewer PUT → 403 FORBIDDEN', async () => {
        expectError(viewerPutSent.get('valid') as Sent, 403, 'FORBIDDEN');
      });
      await test.step('[BE4-G-095] viewer member PUT (valid body, missing base, empty body) → 403 FORBIDDEN without resource, before 428 and Pydantic', async () => {
        for (const sent of viewerPutSent.values()) {
          const body = expectError(sent, 403, 'FORBIDDEN');
          expect.soft(body, '403 carries no resource').not.toHaveProperty('resource');
        }
      });
      const outsideSent: Sent[] = [];
      for (const [slug, method, path, data] of [
        ['n16', 'GET', layerPath(p2, f2), undefined],
        ['graph', 'GET', `/api/projects/${p2}/spatial`, undefined],
        ['floors', 'GET', `/api/projects/${p2}/floors`, undefined],
        ['put', 'PUT', layerPath(p2, f2), writeBody(0, { scaleMillimetresPerPixel: 2 })],
      ] as const) {
        outsideSent.push(await call(viewer, `roles_viewer_outside_${slug}_404`, method, path, data, [
          '404 NOT_FOUND resource project: not a member — 404 beats 403 (access.py:78-86)',
        ]));
      }
      await test.step('[BE4-G-006] non-member viewer: N16 / N15 / #12 / #35 on another project → 404 resource project (404 beats 403)', async () => {
        for (const sent of outsideSent) expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      });
      await test.step('[16-G-015] N16 distinguishes 404 resource project from 404 resource floor', async () => {
        expectError(outsideSent[0] as Sent, 404, 'NOT_FOUND', { resource: 'project' });
        expectError(viewerGhost, 404, 'NOT_FOUND', { resource: 'floor' });
      });

      const role = await call(admin, 'roles_change_to_engineer', 'PATCH', `/api/users/${user.id}/role`, { role: 'engineer', userId: user.id }, [
        'setup: #41 viewer → engineer (users/router.py:85-92); old tokens die (bump_token_version)',
      ]);
      expect(role.res.status()).toBe(200);
      const engineer = await signedInApi(user.email, user.password);
      cleanup.add(() => engineer.dispose());
      const wid = sid('W');
      const engineerPut = await put(engineer, 'roles_engineer_put_200', p1, f1, writeBody(0, { layer: layerOf({ walls: [wallOf(f1, { id: wid, t: 220 })] }) }), [
        '200 revision 1: engineer member has layer.edit (matrix.py:47)',
      ]);
      await test.step('[BE4-G-008] permission follows the SYSTEM role: after #41 viewer → engineer the same member gets 200 on #35 (was 403)', async () => {
        expect.soft(role.res.status()).toBe(200);
        expectWritten(engineerPut, 1, 'engineer write');
      });
      const outside = await put(engineer, 'roles_engineer_outside_404', p2, f2, writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 project: engineer is not a member of project 2',
      ]);
      await test.step('[BE4-G-096] engineer member → 200; engineer outside the project → 404 resource project', async () => {
        expect.soft(engineerPut.res.status()).toBe(200);
        expectError(outside, 404, 'NOT_FOUND', { resource: 'project' });
      });

      const stale = await put(admin, 'roles_admin_stale_409', p1, f1, writeBody(0, { layer: layerOf({ walls: [wallOf(f1, { id: wid, t: 110 })] }) }), [
        '409: remoteChanges name the engineer (changedBy = its usr id, changedByName = its name at write time, router.py:36-42)',
      ]);
      await test.step('[BE4-G-097] admin writes on a stale base after the engineer → 409 remoteChanges names the engineer (changedByName = name at write time)', async () => {
        const body = expectError(stale, 409, 'VERSION_CONFLICT');
        const row = objs(body.remoteChanges, 'remoteChanges').find((c) => c.entityType === 'wall' && c.field === 'thickness_mm');
        expect.soft(row).toMatchObject({ entityId: wid, value: 220, changedBy: user.id, changedByName: user.name });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · large layer: a > 1 MiB #35 body (5 000 walls) is accepted under the route\'s 8 MiB ceiling (the 1 MiB default does not apply) → 200 revision 1; N16 and N15 return every wall', async () => {
    // spatial_write/router.py:29-30,46 (BODY_LIMIT 8 MiB, "tầng 3.000 tường vượt 1 MiB mặc định"); core/routing.py:46.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'large', cleanup)).id);
      const fid = await newFloor(admin, pid, 'large_floor', 0);
      const count = 5000;
      const many = Array.from({ length: count }, (_, i) => wallOf(fid, { from: [0, i * 10], to: [4000, i * 10] }));
      const data = writeBody(0, { layer: layerOf({ walls: many }) });
      const bytes = Buffer.byteLength(JSON.stringify(data));
      expect(bytes, 'precondition: body above the 1 MiB default ceiling').toBeGreaterThan(MIB);
      expect(bytes, 'precondition: body below the 8 MiB route ceiling').toBeLessThan(LAYER_BODY_LIMIT);

      const res = await admin.put(layerPath(pid, fid), { data, timeout: 120_000 });
      const status = res.status();
      const out = (await res.json().catch(() => ({}))) as Json;
      const read = await admin.get(layerPath(pid, fid), { timeout: 120_000 });
      const readBody = (await read.json().catch(() => ({}))) as Json;
      const graph = await admin.get(`/api/projects/${pid}/spatial`, { timeout: 120_000 });
      const graphBody = (await graph.json().catch(() => ({}))) as Json;
      const putWalls = Array.isArray(asJson(out.layer ?? {}).walls) ? (asJson(out.layer).walls as unknown[]).length : -1;
      const readWalls = Array.isArray(asJson(readBody.layer ?? {}).walls) ? (asJson(readBody.layer).walls as unknown[]).length : -1;
      const graphWalls = Array.isArray(asJson(graphBody.graph ?? {}).walls) ? (asJson(graphBody.graph).walls as unknown[]).length : -1;
      await captureSummary('large_layer_200', { method: 'PUT', path: layerPath(pid, fid), bodyBytes: bytes, walls: count }, {
        put: { status, revision: out.revision ?? null, code: out.code ?? null, walls: putWalls },
        n16: { status: read.status(), revision: readBody.revision ?? null, walls: readWalls },
        n15: { status: graph.status(), walls: graphWalls },
      }, [
        `200 revision 1 for a ${String(bytes)}-byte body (> 1 MiB default, < 8 MiB route limit)`,
        `N16 and N15 return all ${String(count)} walls`,
      ]);
      await test.step('[BE4-G-060] signed-in body above 1 MiB (5 000 walls) → 200 revision 1; N16 and N15 return every wall', async () => {
        expect.soft(status).toBe(200);
        expect.soft(out.revision).toBe(1);
        expect.soft(putWalls).toBe(count);
        expect.soft(read.status()).toBe(200);
        expect.soft(readWalls).toBe(count);
        expect.soft(graph.status()).toBe(200);
        expect.soft(graphWalls).toBe(count);
      });
    } finally {
      await cleanup.run();
    }
  });

  /* ---------------------------------------------------------------- gaps (BE inventory be=2ee030c5, coverage/phase04-be.md) */

  test('A04 · gaps: deleting a floor hides its summary row → N15 grossFloorAreaM2, levels and #12 drop it; #10 with the same id inside the restore window brings back the same document (revision, layer, area) and its entity ids; a whitespace-only room name is accepted and stored as sent', async () => {
    // floors/service.py:174-194 (#11 → unregister_floor), 53-73,118-131,134-156 (#10 restore keeps the pk, so the
    // floor_documents row is the same); projects/summaries.py:74-98 (register_floor restored keeps counts / unregister_floor
    // hidden), 200-229 (project_rollups skips hidden rows); spatial_read/graph.py:56-91; floors/lookup.py:52-86,111-118
    // (deleted_at IS NULL); spatial_read/entity_ids.py:68-127 (ids stay with the floor pk); domain/spatial/model.py:57-64
    // (_human_text = NFC + non-empty + no control / bidi char, no strip).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'restore', cleanup)).id);
      const fa = await newFloor(admin, pid, 'restore_floor_a', 0);
      const fb = await newFloor(admin, pid, 'restore_floor_b', 1);
      expectWritten(await put(admin, 'restore_write_a_200', pid, fa, writeBody(0, { layer: layerOf({ walls: [wallOf(fa)], rooms: [roomOf(fa)] }) }), [
        '200 revision 1: floor A, one 4000 × 5000 mm room → 20 m² (writer.py:420-427)',
      ]), 1, 'floor A');
      const wb = wallOf(fb, { to: [2000, 0] });
      const blankName = '   ';
      const b1Sent = await put(admin, 'restore_write_b_blank_name_200', pid, fb, writeBody(0, {
        layer: layerOf({ walls: [wb], rooms: [roomOf(fb, { name: blankName, w: 2000, h: 5000 })] }),
      }), [
        '200 revision 1: floor B, 2000 × 5000 mm room → 10 m²; room name "   " (3 spaces) accepted and stored unchanged: _human_text does not strip (model.py:57-64)',
      ]);
      await test.step('[BE4-G-068] whitespace-only room name "   " → 200, stored as sent (not stripped)', async () => {
        const b1 = expectWritten(b1Sent, 1, 'floor B');
        expect.soft(objs(layerIn(b1).rooms, 'rooms')[0]?.name, 'whitespace-only name kept as sent').toBe(blankName);
      });
      const g1 = await readGraph(admin, 'restore_graph_before', pid, '200 N15: 2 levels, grossFloorAreaM2 20 + 10 = 30');
      expect.soft(asJson(asJson(g1.graph).building).grossFloorAreaM2).toBe(30);
      expect.soft(objs(asJson(g1.graph).levels, 'levels').map((l) => l.id)).toEqual([fa, fb]);

      const del = await call(admin, 'restore_delete_b_200', 'DELETE', `/api/floors/${fb}`, undefined, [
        '200 #11: snapshot taken just before the soft delete, areaM2 10 (service.py:174-194)',
      ]);
      expect.soft(del.res.status()).toBe(200);
      expect.soft(asJson(del.body).areaM2).toBe(10);
      const g2 = await readGraph(admin, 'restore_graph_deleted', pid, '200 N15: 1 level, floorRevisions 1 row, grossFloorAreaM2 20 (hidden summary row skipped, summaries.py:229)');
      const graph2 = asJson(g2.graph);
      expect.soft(asJson(graph2.building).grossFloorAreaM2, 'deleted floor area leaves the rollup').toBe(20);
      expect.soft(objs(graph2.levels, 'levels').map((l) => l.id)).toEqual([fa]);
      expect.soft(objs(g2.floorRevisions, 'floorRevisions').map((r) => r.floorId)).toEqual([fa]);
      expect.soft(objs(graph2.walls, 'walls').some((w) => w.id === wb.id), 'deleted floor walls are gone from N15').toBe(false);
      expect.soft((await listFloors(admin, 'restore_floors_deleted', pid, '200 #12: only floor A')).map((f) => f.id)).toEqual([fa]);
      expectError(await call(admin, 'restore_n16_deleted_404', 'GET', layerPath(pid, fb), undefined, [
        '404 NOT_FOUND resource floor while deleted (spatial_read/router.py:38-43)',
      ]), 404, 'NOT_FOUND', { resource: 'floor' });

      const restored = await call(admin, 'restore_create_same_id_201', 'POST', `/api/projects/${pid}/floors`, {
        id: fb, name: `${PREFIX}floor-restored`, order: 1, elevationMm: 3000, heightMm: 3000,
      }, ['201 #10: the soft-deleted id inside FLOOR_RESTORE_WINDOW_S (600 s) is restored in place, same pk, counts kept (service.py:53-73,127-131; summaries.py:83-85)']);
      expect.soft(restored.res.status()).toBe(201);
      expect.soft(asJson(restored.body)).toMatchObject({ id: fb, name: `${PREFIX}floor-restored`, areaM2: 10 });
      const b2 = await readLayer(admin, 'restore_n16_back', pid, fb, '200 N16: the same document is back: revision 1, the wall and the "   " room');
      await test.step('[BE4-G-034] #11 delete then #10 with the same id inside the 600 s window → N16 returns the same document (revision, layer, area)', async () => {
        expect.soft(b2.revision).toBe(1);
        expect.soft(walls(b2).map((w) => w.id)).toEqual([wb.id]);
        expect.soft(objs(layerIn(b2).rooms, 'rooms').map((r) => r.areaM2)).toEqual([10]);
      });
      await test.step('[BE4-G-320] whitespace-only room name is still stored as sent after the restore (FE 20-C-006 seed)', async () => {
        expect.soft(objs(layerIn(b2).rooms, 'rooms').map((r) => r.name)).toEqual([blankName]);
      });
      const g3 = await readGraph(admin, 'restore_graph_back', pid, '200 N15: 2 levels again, grossFloorAreaM2 30, floorRevisions B revision 1');
      expect.soft(asJson(asJson(g3.graph).building).grossFloorAreaM2).toBe(30);
      expect.soft(objs(g3.floorRevisions, 'floorRevisions').map((r) => [r.floorId, r.revision])).toEqual([[fa, 1], [fb, 1]]);
      const floors3 = await listFloors(admin, 'restore_floors_back', pid, '200 #12: A then B, B areaM2 10');
      expect.soft(floors3.map((f) => [f.id, f.areaM2])).toEqual([[fa, 20], [fb, 10]]);

      const claimsB = await put(admin, 'restore_a_claims_b_id_422', pid, fa, writeBody(1, { layer: layerOf({ walls: [wallOf(fa), wallOf(fa, { id: String(wb.id) })] }) }), [
        '422 LAYER_INTEGRITY_BROKEN count 1: the restored floor B still owns its wall id (entity_ids.py:92-127; writer.py:560-572)',
      ]);
      const restoredWrite = await put(admin, 'restore_b_write_base1_200', pid, fb, writeBody(1, { layer: layerOf({ walls: [wb, wallOf(fb, { from: [0, 1000], to: [2000, 1000] })] }) }), [
        '200 revision 2: base 1 = the restored document revision; its own ids claim without conflict',
      ]);
      await test.step('[BE4-G-103] restored floor: a write at the restored revision → 200; its old ids still belong to it (another floor claiming one → 422)', async () => {
        expectWritten(restoredWrite, 2, 'restored floor write');
        expectError(claimsB, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · gaps: remoteChanges keeps only the newest SPATIAL_CONFLICT_CHANGES_MAX (5 000) rows: 720 new walls log 5 040 fields (3 wall fields + x / y of both vertices) → a stale write gets 409 currentVersion 1 with exactly 5 000 rows in log order, the 40 oldest dropped', async () => {
    // spatial_write/settings.py:19 (5000); changes.py:39-65 (DISTINCT ON (entity, field), ORDER BY revision DESC, id DESC
    // LIMIT, then reversed); writer.py:365-372,593-614 (log rows inserted in diff order); domain/spatial/diff.py:20-25,40-78
    // (wall thickness_mm / height_mm / kind, then V-<id>-start x / y, V-<id>-end x / y); kinds.py:59-61 (vertex id).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'truncate', cleanup)).id);
      const fid = await newFloor(admin, pid, 'truncate_floor', 0);
      const count = 720;
      const many = Array.from({ length: count }, (_, i) => wallOf(fid, { from: [0, i * 10], to: [4000, i * 10] }));
      const res1 = await admin.put(layerPath(pid, fid), { data: writeBody(0, { layer: layerOf({ walls: many }) }), timeout: 120_000 });
      const out1 = (await res1.json().catch(() => ({}))) as Json;
      const stale = await admin.put(layerPath(pid, fid), { data: writeBody(0, { layer: layerOf() }), timeout: 120_000 });
      const conflict = (await stale.json().catch(() => ({}))) as Json;
      const rows = Array.isArray(conflict.remoteChanges) ? objs(conflict.remoteChanges, 'remoteChanges') : [];
      const logged = many.flatMap((w) => {
        const id = String(w.id);
        return [
          ['wall', id, 'thickness_mm'], ['wall', id, 'height_mm'], ['wall', id, 'kind'],
          ['vertex', `V-${id}-start`, 'x'], ['vertex', `V-${id}-start`, 'y'],
          ['vertex', `V-${id}-end`, 'x'], ['vertex', `V-${id}-end`, 'y'],
        ];
      });
      const expected = logged.slice(logged.length - 5000);
      const got = rows.map((c) => [c.entityType, c.entityId, c.field]);
      await captureSummary('gaps_conflict_truncated_409', {
        method: 'PUT', path: layerPath(pid, fid), first: `baseVersion 0, ${String(count)} walls`, second: 'baseVersion 0, empty layer',
      }, {
        first: { status: res1.status(), revision: out1.revision ?? null },
        stale: {
          status: stale.status(), code: conflict.code ?? null, currentVersion: conflict.currentVersion ?? null, rows: rows.length,
          firstRows: rows.slice(0, 3), lastRows: rows.slice(-3),
        },
        loggedFields: logged.length,
      }, [
        `first write 200 revision 1 logs ${String(logged.length)} fields (7 per new wall)`,
        '409 VERSION_CONFLICT currentVersion 1 with exactly 5 000 remoteChanges (SPATIAL_CONFLICT_CHANGES_MAX)',
        'the newest 5 000 kept in ascending log order: walls 1-5 and the start vertex of wall 6 are dropped',
      ]);
      const readAfter = await readLayer(admin, 'truncate_read_after', pid, fid, '200 N16 still revision 1 with 720 walls after the 409');
      await test.step('[BE4-G-055] remoteChanges is capped at the newest 5 000 rows (SPATIAL_CONFLICT_CHANGES_MAX), in log order', async () => {
        expect.soft(res1.status()).toBe(200);
        expect.soft(out1.revision).toBe(1);
        expect.soft(stale.status()).toBe(409);
        expect.soft(conflict.code).toBe('VERSION_CONFLICT');
        expect.soft(conflict.currentVersion).toBe(1);
        expectZod(VersionConflictBodySchema, conflict, '409 truncated');
        expect.soft(rows.length, 'remoteChanges capped at 5 000').toBe(5000);
        expect.soft(got[0], 'oldest kept row = end vertex x of wall 6').toEqual(expected[0]);
        expect.soft(got[got.length - 1], 'newest row = end vertex y of the last wall').toEqual(expected[expected.length - 1]);
        expect.soft(JSON.stringify(got) === JSON.stringify(expected), 'kept rows = the newest 5 000 in log order').toBe(true);
        const dropped = new Set(many.slice(0, 5).map((w) => String(w.id)));
        expect.soft(rows.some((c) => dropped.has(String(c.entityId)) || [...dropped].some((id) => String(c.entityId).startsWith(`V-${id}-`))), 'walls 1-5 dropped').toBe(false);
        expect.soft(readAfter.revision).toBe(1);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · gaps: a real pipeline run (drawing.png) leaves N16 scaleStatus "unresolved" + a scale + level.reviewed false and logs its rows as system:pipeline; a human ×2 scale rescales every unreviewed AI item and dimension line (heights, valueMm kept) and drops scaleStatus; an empty layer prunes every dimension referenceId and logs dimension reference_ids', async () => {
    // Upload #5/#6/#7, progress #8: drawings/router.py:50-106. Pipeline: worker pipeline_build/build.py:75,201-220
    // (scaleSource pipeline | project_default), pipeline_persist/service.py:108-130 (write_layer merge, actor
    // system:pipeline, name "hệ thống AI" constants.py:5). N16: spatial_read/assemble.py:27-41,44-53 (scaleStatus, reviewed),
    // router.py:71-87. Human scale: spatial_write/writer.py:376-401 (rank human 3 ≥ pipeline 2, page = the stored page),
    // 430-455 (rescale layer + dimensions); domain/scale/rescale.py:40-110 (js_round(v × k); heights, valueMm kept).
    // Pruning: writer.py:443-489 (_drop_missing_refs), 608-611 (dimension reference_ids log row).
    test.setTimeout(PIPELINE_TIMEOUT_MS + 180_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'pipeline-scale', cleanup)).id);
      const fid = await newFloor(admin, pid, 'pipe_floor', 0);
      const png = drawingPng();
      const init = await call(admin, 'pipe_upload_init', 'POST', `/api/projects/${pid}/floors/${fid}/drawings/uploads`, {
        fileName: `${PREFIX}drawing.png`, floorId: fid, mimeType: 'image/png', projectId: pid, sizeBytes: png.length,
      }, ['setup: 200 Progress pending (drawings/router.py:50-67)']);
      expect(init.res.status(), 'setup upload init').toBe(200);
      const uid = String(asJson(init.body).id);
      const chunk = await call(admin, 'pipe_upload_chunk', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/chunks`, {
        chunk: png.toString('base64'), chunkIndex: 0,
      }, ['setup: 200 chunk 0 (router.py:70-77)']);
      expect(chunk.res.status(), 'setup upload chunk').toBe(200);
      const done = await call(admin, 'pipe_upload_complete', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/complete`, { uploadId: uid }, [
        'setup: 200 complete → one pipeline run (router.py:80-99)',
      ]);
      expect(done.res.status(), 'setup upload complete').toBe(200);
      const final = await pipelineFinal(admin, pid, uid);
      await captureSummary('gaps_pipeline_progress', { method: 'GET', path: `/api/projects/${pid}/drawings/uploads/${uid}/progress` }, final, [
        '#8 Progress polled every 2 s until completed | failed',
      ]);
      expect(final.status, `pipeline final status (error ${String(final.error)})`).toBe('completed');

      const p = await readLayer(admin, 'pipe_n16_unresolved', pid, fid, '200 N16 after the run: scaleStatus "unresolved" (source pipeline / project_default, assemble.py:39-41), level scale present, level.reviewed false (assemble.py:44-53)');
      const level = asJson(p.level);
      const scale = Number(level.scaleMillimetresPerPixel);
      const rev = Number(p.revision);
      await test.step('[BE4-G-025] after a pipeline run: scaleStatus "unresolved", a level scale, level.reviewed false', async () => {
        expect.soft(p.scaleStatus, 'pipeline scale is provisional').toBe('unresolved');
        expect.soft(scale, 'pipeline sets a scale').toBeGreaterThan(0);
        expect.soft(level.reviewed, 'a provisional scale keeps the level unreviewed').toBe(false);
        expect.soft(rev, 'the run wrote the document').toBeGreaterThanOrEqual(1);
      });
      const before = layerIn(p);
      const entities = (['walls', 'openings', 'rooms', 'furniture'] as const).flatMap((k) => objs(before[k], k));
      const dims = objs(p.dimensions, 'dimensions');
      note(`pipeline layer: ${String(objs(before.walls, 'walls').length)} walls, ${String(objs(before.openings, 'openings').length)} openings, ${String(objs(before.rooms, 'rooms').length)} rooms, ${String(objs(before.furniture, 'furniture').length)} furniture, ${String(dims.length)} dimensions, scale ${String(scale)}`);
      for (const e of entities) expect.soft([e.source, e.reviewed], `AI item ${String(e.id)} unreviewed`).toEqual(['ai', false]);
      await test.step('[BE4-G-030] pipeline dimensions carry referenceIds that point at entities of the layer', async () => {
        const entityIds = new Set(entities.map((e) => String(e.id)));
        for (const d of dims) {
          expect.soft(Array.isArray(d.referenceIds), `dimension ${String(d.id)} has referenceIds`).toBe(true);
          for (const ref of asArray(d.referenceIds)) expect.soft(entityIds.has(String(ref)), `reference ${String(ref)} exists in the layer`).toBe(true);
        }
      });

      const repeat = await put(admin, 'pipe_stale_base0', pid, fid, writeBody(0, { layer: before }), [
        'base 0 < run revision with the current layer: 409 whose rows are all changedBy system:pipeline / "hệ thống AI" when the run logged entities; 200 unchanged (no write) when it logged none (writer.py:340-341,365-373)',
      ]);
      if (entities.length > 0) {
        const body = expectError(repeat, 409, 'VERSION_CONFLICT');
        expectZod(VersionConflictBodySchema, repeat.body, '409 pipeline rows');
        const rows = objs(body.remoteChanges, 'remoteChanges');
        expect.soft(rows.length).toBeGreaterThan(0);
        expect.soft([...new Set(rows.map((c) => `${String(c.changedBy)}|${String(c.changedByName)}`))]).toEqual(['system:pipeline|hệ thống AI']);
      } else {
        expectWritten(repeat, rev, 'nothing to conflict with, nothing changed');
      }

      const scale2 = Number((scale * 2).toFixed(6));
      const human = await put(admin, 'pipe_human_scale_x2_200', pid, fid, writeBody(rev, { scaleMillimetresPerPixel: scale2 }), [
        `200 revision ${String(rev + 1)}: human scale ${String(scale2)} = 2 × pipeline scale; every unreviewed item and dimension line ×2 (rescale.py:55-79)`,
      ]);
      await test.step('[BE4-G-090] human scale on a pipeline floor: every unreviewed AI item and dimension line ×k (heights, valueMm kept), scaleStatus gone', async () => {
        expectWritten(human, rev + 1, 'human scale');
        const h = await readLayer(admin, 'pipe_n16_human', pid, fid, '200 N16: human scale → no scaleStatus (assemble.py:27-41: same page as stored), level scale = 2 × pipeline scale');
        expect.soft(h, 'human scale is not provisional').not.toHaveProperty('scaleStatus');
        expect.soft(Number(asJson(h.level).scaleMillimetresPerPixel)).toBeCloseTo(scale2, 6);
        const after = layerIn(h);
        const x2 = (pt: unknown): Json => ({ x: Number(asJson(pt).x) * 2, y: Number(asJson(pt).y) * 2 });
        const byId = (k: string): Map<unknown, Json> => new Map(objs(after[k], k).map((e) => [e.id, e]));
        const wallsAfter = byId('walls');
        for (const w of objs(before.walls, 'walls')) {
          const c = asJson(w.centreline);
          expect.soft(wallsAfter.get(w.id), `wall ${String(w.id)} ×2`).toMatchObject({
            centreline: { start: x2(c.start), end: x2(c.end) }, thicknessMm: Number(w.thicknessMm) * 2, heightMm: w.heightMm,
          });
        }
        const openingsAfter = byId('openings');
        for (const o of objs(before.openings, 'openings')) {
          expect.soft(openingsAfter.get(o.id), `opening ${String(o.id)} ×2`).toMatchObject({
            offsetMm: Number(o.offsetMm) * 2, widthMm: Number(o.widthMm) * 2, heightMm: o.heightMm, sillHeightMm: o.sillHeightMm,
          });
        }
        const roomsAfter = byId('rooms');
        for (const r of objs(before.rooms, 'rooms')) {
          expect.soft(roomsAfter.get(r.id)?.outline, `room ${String(r.id)} outline ×2`).toEqual(asArray(r.outline).map(x2));
        }
        const furnitureAfter = byId('furniture');
        for (const f of objs(before.furniture, 'furniture')) {
          const box = asJson(f.boundingBox);
          expect.soft(furnitureAfter.get(f.id), `furniture ${String(f.id)} ×2`).toMatchObject({
            centre: x2(f.centre), boundingBox: { min: x2(box.min), max: x2(box.max) }, rotationDeg: f.rotationDeg,
          });
        }
        const dimsAfter = new Map(objs(h.dimensions, 'dimensions').map((d) => [d.id, d]));
        for (const d of dims) {
          const line = asJson(d.line);
          expect.soft(dimsAfter.get(d.id), `dimension ${String(d.id)} line ×2, valueMm kept`).toMatchObject({
            line: { start: x2(line.start), end: x2(line.end) }, valueMm: d.valueMm, referenceIds: d.referenceIds,
          });
        }
      });

      const withRefs = dims.filter((d) => asArray(d.referenceIds).length > 0);
      await test.step('[BE4-G-100] empty layer with referenced dimensions: every referenceId is dropped and a dimension reference_ids row is logged', async () => {
        const changes = entities.length > 0 || withRefs.length > 0; // nothing to drop → unchanged write (writer.py:492-499)
        expectWritten(await put(admin, 'pipe_empty_layer_200', pid, fid, writeBody(rev + 1, { layer: layerOf() }), [
          `200: empty layer → revision ${String(rev + 2)} when the layer had entities or referenced dimensions, else unchanged ${String(rev + 1)}; dimensions stay but lose every referenceId (writer.py:475-489)`,
        ]), changes ? rev + 2 : rev + 1, 'empty layer');
        const e = await readLayer(admin, 'pipe_n16_pruned', pid, fid, '200 N16: same dimensions, every referenceIds []');
        expect.soft(objs(e.dimensions, 'dimensions').map((d) => [d.id, d.referenceIds])).toEqual(dims.map((d) => [d.id, []]));
        if (changes) {
          const log = await put(admin, 'pipe_stale_after_prune_409', pid, fid, writeBody(rev + 1, { layer: layerOf({ walls: [wallOf(fid)] }) }), [
            `409 currentVersion ${String(rev + 2)}: the pruning write logged one dimension reference_ids row (value []) per dimension that had references (writer.py:608-611), plus __deleted__ rows`,
          ]);
          const body = expectError(log, 409, 'VERSION_CONFLICT');
          expect.soft(body.currentVersion).toBe(rev + 2);
          const rows = objs(body.remoteChanges, 'remoteChanges');
          expect.soft(rows.filter((c) => c.entityType === 'dimension').map((c) => [c.entityId, c.field, c.value]).sort())
            .toEqual(withRefs.map((d) => [d.id, 'reference_ids', []]).sort());
        }
      });
      if (withRefs.length === 0) note('the run produced no dimension with referenceIds: the pruning branch was reached with nothing to prune');
    } finally {
      await cleanup.run();
    }
  });
});

/**
 * Phase 4 — QC layers BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the phase-4 screens call (FE `src/api/endpoints.ts:251-265` spatial.*, `:109-112` floors.*; UI spec
 * `phase04_qc_layers.spec.ts`; SCR-14 "Áp cho mọi tầng" reads #12 + N15 then PUTs each floor):
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
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37; override LOGIN_IP_LIMIT=120): THIS file 9
 *   (one admin login in each of the 8 signed-in tests + 1 engineer login in "roles"), 0 failed. Phase-4 UI layers:
 *   main `phase04_qc_layers.spec.ts` 1 (`signInAdmin`, +1 only for a dead stored session); ui
 *   `phase04_qc_layers_ui.spec.ts` 1 (`signedInApi`, +1 only for a dead stored session); no edge spec at authoring
 *   time. Layers run sequentially -> <= 13 per run, far below 30 even without the override.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:32-46): THIS file 1. Phases 1-3 spend 25
 *   (phase03 header) -> Phases 1-4 in one hour = 26 <= 30.
 * - `recovery_ip` 10 / 900 s per IP (override 60): 1 invitation accept.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/settings.py:14): admin 1.
 * - Body ceiling: one 8 MiB and one 8 MiB + 1 anonymous PUT (nginx `client_max_body_size 8m` = app `body_limit`);
 *   one ~1.3 MiB signed-in PUT ("large").
 * - Concurrency: "versioning" sends one pair of parallel PUTs on one base; no limit involved.
 * - Mailpit: 1 invitation mail, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { VersionConflictBodySchema } from '../../src/api/schemas/errors';
import { FloorSchema } from '../../src/api/schemas/index';
import { SpatialGraphDocumentSchema } from '../../src/api/schemas/spatialGraph';
import { FloorLayerDocumentSchema, FloorLayerWriteResultSchema } from '../../src/api/schemas/spatialLayer';
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
      for (const [slug, method, path, data] of routes) {
        const sent = await call(anon, `anon_${slug}_401`, method, path, data, [
          '401 UNAUTHENTICATED: no Bearer, checked before the body / path ids (core/routing.py:129-136,264)',
        ]);
        expectError(sent, 401, 'UNAUTHENTICATED');
      }
      const jsonOf = (size: number): Buffer => Buffer.from(`{"x":"${'a'.repeat(size - 8)}"}`);
      const atLimit = await call(anon, 'anon_put_8mib_401', 'PUT', layerPath(MISSING_PROJECT, fid), jsonOf(LAYER_BODY_LIMIT), [
        '8 388 608-byte body passes the #35 ceiling (body_limit 8 MiB, router.py:29,46) → 401',
      ]);
      expect.soft(atLimit.res.status()).toBe(401);
      const over = await call(anon, 'anon_put_8mib_plus1_413', 'PUT', layerPath(MISSING_PROJECT, fid), jsonOf(LAYER_BODY_LIMIT + 1), [
        '8 MiB + 1 → 413 PAYLOAD_TOO_LARGE before auth (nginx 8m / core/middleware.py:229-236)',
      ]);
      expectError(over, 413, 'PAYLOAD_TOO_LARGE');
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
      const emptyGraph = asJson(empty.graph);
      for (const key of ['levels', 'walls', 'openings', 'furniture', 'rooms', 'axes', 'dimensions', 'notes']) {
        expect.soft(emptyGraph[key], `graph.${key}`).toEqual([]);
      }
      expect.soft(empty.floorRevisions).toEqual([]);
      expect.soft(asJson(emptyGraph.building)).toMatchObject({
        name: project.name, datumElevationMm: 0, confidence: 1, source: 'human', reviewed: false, grossFloorAreaM2: 0,
      });
      expect.soft(await listFloors(admin, 'reads_floors_empty', pid, '200 [] for a project without floors')).toEqual([]);

      const upper = await newFloor(admin, pid, 'reads_floor_upper', 1);
      const ground = await newFloor(admin, pid, 'reads_floor_ground', 0);
      const before = await readProject(admin, pid, 'reads_project_before');

      const floors = await listFloors(admin, 'reads_floors', pid, '200 FloorOut[] sorted by (order, pk): ground (0) before upper (1) (service.py:197-199)');
      expect.soft(floors.map((f) => f.id)).toEqual([ground, upper]);
      for (const f of floors) expect.soft(f.drawings, 'no drawing yet').toEqual([]);

      const meta33 = await call(admin, 'reads_floor_meta_200', 'GET', `/api/projects/${pid}/floors/${upper}/spatial`, undefined, [
        '200 #33 = the very FloorOut #12 returns for that floor (router.py:58-62, same floor_outs path)',
      ]);
      expect.soft(meta33.res.status()).toBe(200);
      expectZod(FloorSchema, meta33.body, '#33');
      expect.soft(meta33.body).toEqual(floors.find((f) => f.id === upper));

      const fresh = await readLayer(admin, 'reads_layer_fresh', pid, upper, '200 N16 of a floor never written: revision 0, empty layer, axes [], dimensions [], no scaleStatus (documents.py:294-313, assemble.py:247-249)');
      expectKeys(fresh, N16_KEYS, ['scaleStatus']);
      expect.soft(fresh).not.toHaveProperty('scaleStatus');
      expect.soft(fresh.revision).toBe(0);
      expect.soft(fresh.layer).toEqual(layerOf());
      expect.soft(fresh.axes).toEqual([]);
      expect.soft(fresh.dimensions).toEqual([]);
      const level = expectKeys(fresh.level, LEVEL_KEYS, LEVEL_OPTIONAL);
      expect.soft(level).toMatchObject({ id: upper, order: 1, elevationMm: 3000, heightMm: 3000, confidence: 1, source: 'human', reviewed: false });
      expect.soft(level, 'no scale yet (W24)').not.toHaveProperty('scaleMillimetresPerPixel');

      const graph = await readGraph(admin, 'reads_graph', pid, '200 N15: levels in floor order, floorRevisions a bijection, revision 0 each');
      expect.soft(objs(asJson(graph.graph).levels, 'levels').map((l) => l.id)).toEqual([ground, upper]);
      expect.soft(graph.floorRevisions).toEqual([{ floorId: ground, revision: 0 }, { floorId: upper, revision: 0 }]);
      expect.soft(asJson(asJson(graph.graph).building).reviewed, 'no level reviewed → building not reviewed').toBe(false);

      const after = await readProject(admin, pid, 'reads_project_after');
      expect.soft(after.updatedAt, 'GETs never write: no ensure_document, no touch_project (graph.py:125-127)').toBe(before.updatedAt);
      const again = await readLayer(admin, 'reads_layer_again', pid, upper, '200 still revision 0: the read created no document');
      expect.soft(again.revision).toBe(0);

      // 404 branches.
      const other = await newProject(admin, 'reads-other', cleanup);
      const otherPid = String(other.id);
      const foreignFloor = await newFloor(admin, otherPid, 'reads_floor_foreign', 0);
      const floorMisses: Array<[string, string]> = [['unknown', sid('L')], ['malformed', 'nope'], ['foreign', foreignFloor]];
      for (const [slug, fid] of floorMisses) {
        const n16 = await call(admin, `reads_layer_${slug}_404`, 'GET', layerPath(pid, fid), undefined, [
          `404 NOT_FOUND resource floor: ${slug} floor id under my project (router.py:38-43)`,
        ]);
        expectError(n16, 404, 'NOT_FOUND', { resource: 'floor' });
        const m33 = await call(admin, `reads_meta_${slug}_404`, 'GET', `/api/projects/${pid}/floors/${fid}/spatial`, undefined, [
          `404 NOT_FOUND resource floor (#33, ${slug})`,
        ]);
        expectError(m33, 404, 'NOT_FOUND', { resource: 'floor' });
      }
      const projectMisses: Array<[string, string]> = [['malformed', 'not-a-project'], ['missing', MISSING_PROJECT]];
      for (const [slug, p] of projectMisses) {
        const paths: Array<[string, string]> = [
          ['layer', layerPath(p, upper)],
          ['meta', `/api/projects/${p}/floors/${upper}/spatial`],
          ['graph', `/api/projects/${p}/spatial`],
          ['floors', `/api/projects/${p}/floors`],
        ];
        for (const [route, path] of paths) {
          const sent = await call(admin, `reads_${route}_${slug}_project_404`, 'GET', path, undefined, [
            `404 NOT_FOUND resource project: ${slug} project id (projects/access.py:28-33,82-83)`,
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      }

      const del = await call(admin, 'reads_floor_delete', 'DELETE', `/api/floors/${upper}`, undefined, ['setup: #11 soft delete → 200 snapshot']);
      expect(del.res.status()).toBe(200);
      const gone = await call(admin, 'reads_layer_deleted_floor_404', 'GET', layerPath(pid, upper), undefined, [
        '404 floor: a soft-deleted floor is not found (lookup.py:111-118 deleted_at IS NULL)',
      ]);
      expectError(gone, 404, 'NOT_FOUND', { resource: 'floor' });
      const goneMeta = await call(admin, 'reads_meta_deleted_floor_404', 'GET', `/api/projects/${pid}/floors/${upper}/spatial`, undefined, ['404 floor (#33)']);
      expectError(goneMeta, 404, 'NOT_FOUND', { resource: 'floor' });
      expect.soft((await listFloors(admin, 'reads_floors_after_delete', pid, '200 only the live floor')).map((f) => f.id)).toEqual([ground]);
      const graphAfter = await readGraph(admin, 'reads_graph_after_delete', pid, '200 N15 without the deleted floor');
      expect.soft(graphAfter.floorRevisions).toEqual([{ floorId: ground, revision: 0 }]);

      const delProject = await call(admin, 'reads_project_delete', 'DELETE', `/api/projects/${otherPid}`, undefined, ['setup: soft-delete the other project → 200']);
      expect(delProject.res.status()).toBe(200);
      for (const [route, path] of [
        ['layer', layerPath(otherPid, foreignFloor)],
        ['graph', `/api/projects/${otherPid}/spatial`],
        ['floors', `/api/projects/${otherPid}/floors`],
      ] as const) {
        const sent = await call(admin, `reads_${route}_deleted_project_404`, 'GET', path, undefined, [
          '404 project: a soft-deleted project fails the membership query (access.py:62-72 deleted_at IS NULL)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      }
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
      const written = expectWritten(first, 1, 'first write');
      const expected = layerOf({
        walls: [wallA, wallB],
        openings: [door],
        rooms: [{ ...room, name: 'Bếp Nhỏ', areaM2: 20 }],
        furniture: [loose, placed],
      });
      expect.soft(written.layer).toEqual(expected);
      expect.soft(objs(layerIn(written).furniture, 'furniture')[0], 'W2: no roomId key, not null').not.toHaveProperty('roomId');

      const read1 = await readLayer(admin, 'write_read1', pid, fid, '200 N16 revision 1 = the 200 layer');
      expect.soft(read1.revision).toBe(1);
      expect.soft(read1.layer).toEqual(expected);
      expect.soft(asJson(read1.level).reviewed, 'one unreviewed AI wall → level not reviewed').toBe(false);
      expect.soft(asJson(read1.level).areaM2, 'floor area = the room').toBe(20);
      const floors = await listFloors(admin, 'write_floors1', pid, '200 #12: floor areaM2 20 from set_layer_counts (writer.py:520-528)');
      expect.soft(floors[0]?.areaM2).toBe(20);
      const graph1 = await readGraph(admin, 'write_graph1', pid, '200 N15: grossFloorAreaM2 20, floorRevisions revision 1, the 2 walls');
      expect.soft(asJson(asJson(graph1.graph).building).grossFloorAreaM2).toBe(20);
      expect.soft(graph1.floorRevisions).toEqual([{ floorId: fid, revision: 1 }]);
      expect.soft(objs(asJson(graph1.graph).walls, 'graph walls').map((w) => w.id)).toEqual([wa, wallB.id]);
      const after1 = await readProject(admin, pid, 'write_project_after1');
      expect.soft(Date.parse(String(after1.updatedAt)), 'touch_project on a real write (writer.py:529)').toBeGreaterThan(Date.parse(String(before.updatedAt)));

      const same = await put(admin, 'write_same_layer_200', pid, fid, writeBody(1, { layer }), [
        '200 revision 1: base = current and the stored document would not change (step 10, writer.py:340-341,492-499) → no UPDATE, no touch',
      ]);
      expectWritten(same, 1, 'unchanged write');
      const after2 = await readProject(admin, pid, 'write_project_after_same');
      expect.soft(after2.updatedAt, 'no touch_project for an unchanged write').toBe(after1.updatedAt);

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
      expectWritten(approve, 2, 'approve all');
      const read2 = await readLayer(admin, 'write_read_approved', pid, fid, '200 N16: level.reviewed true');
      expect.soft(asJson(read2.level).reviewed).toBe(true);
      const graph2 = await readGraph(admin, 'write_graph_approved', pid, '200 N15: building.reviewed true (≥ 1 level, all reviewed, graph.py:160-170)');
      expect.soft(asJson(asJson(graph2.graph).building).reviewed).toBe(true);

      const cleared = await put(admin, 'write_empty_layer_200', pid, fid, writeBody(2, { layer: layerOf() }), [
        '200 revision 3: every item removed; counts reset (0 walls → level not reviewed, no area)',
      ]);
      expectWritten(cleared, 3, 'empty layer');
      const read3 = await readLayer(admin, 'write_read_empty', pid, fid, '200 N16 revision 3, empty layer, level.reviewed false (0 walls)');
      expect.soft(read3.layer).toEqual(layerOf());
      expect.soft(asJson(read3.level).reviewed).toBe(false);
      const floors3 = await listFloors(admin, 'write_floors_empty', pid, '200 #12: floor area back to 0 / absent');
      expect.soft(floors3[0]?.areaM2 ?? 0).toBe(0);
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
      expectWritten(repeat, 2, 'own repeat');
      expect.soft(repeat.body).toEqual(second.body);

      const stale = await put(admin, 'ver_stale_409', pid, fid, writeBody(1, { layer: layerOf({ walls: [wall({ kind: 'loadBearing' })], furniture: [table] }) }), [
        '409 VERSION_CONFLICT currentVersion 2; remoteChanges = the revision-2 log: wall thickness_mm 220 + furniture __deleted__ (no value key)',
      ]);
      const conflict = expectError(stale, 409, 'VERSION_CONFLICT');
      expectZod(VersionConflictBodySchema, stale.body, '409');
      expect.soft(conflict.currentVersion).toBe(2);
      const changes = objs(conflict.remoteChanges, 'remoteChanges');
      const thickness = changes.find((c) => c.entityType === 'wall' && c.field === 'thickness_mm');
      expect.soft(thickness, 'wall thickness_mm row').toMatchObject({ entityId: wid, value: 220, changedBy: me.id, changedByName: me.name });
      expect.soft(String(thickness?.changedAt)).toMatch(MS_INSTANT);
      const removed = changes.find((c) => c.entityType === 'furniture' && c.field === '__deleted__');
      expect.soft(removed, 'furniture __deleted__ row').toMatchObject({ entityId: table.id });
      expect.soft(removed, 'a removal has no value key (core/errors.py:77-78)').not.toHaveProperty('value');
      for (const c of changes) expectKeys(c, ['changedAt', 'changedBy', 'changedByName', 'entityId', 'entityType', 'field'], ['value']);

      const ahead = await put(admin, 'ver_ahead_422', pid, fid, writeBody(9, { layer: layerOf({ walls: [wall()] }) }), [
        '422 VALIDATION field baseVersion: a base ahead of the document is invalid input, not a conflict (writer.py:355-356)',
      ]);
      expectError(ahead, 422, 'VALIDATION', { field: 'baseVersion' });
      expect.soft((await readLayer(admin, 'ver_read2', pid, fid, '200 still revision 2 after the 409 / 422')).revision).toBe(2);

      const key = `qa-layer-${uniq()}`;
      expectWritten(await put(admin, 'ver_key_first_200', pid, fid, writeBody(2, { layer: layerOf({ walls: [wall({ t: 330 })] }) }), [
        '200 revision 3 with an Idempotency-Key',
      ], { 'Idempotency-Key': key }), 3, 'key first');
      expectWritten(await put(admin, 'ver_key_reused_200', pid, fid, writeBody(3, { layer: layerOf({ walls: [wall({ t: 440 })] }) }), [
        '200 revision 4: the same key is NOT replayed (idempotency="off", router.py:8-10,46)',
      ], { 'Idempotency-Key': key }), 4, 'key reused');

      expectWritten(await put(admin, 'ver_scale_only_200', pid, fid, writeBody(4, { scaleMillimetresPerPixel: 10 }), [
        '200 revision 5: scale only, first scale → no rescale, layer unchanged → no change-log row (writer.py:593-614)',
      ]), 5, 'scale only');
      const clean = await put(admin, 'ver_stale_but_clean_200', pid, fid, writeBody(4, { layer: layerOf({ walls: [wall({ t: 550 })] }) }), [
        '200 revision 6: base 4 < 5 but no logged field changed since 4 → no conflict, written on top (writer.py:365-373)',
      ]);
      expectWritten(clean, 6, 'stale but clean');

      const [a, b] = await Promise.all([
        put(admin, 'ver_race_a', pid, fid, writeBody(6, { layer: layerOf({ walls: [wall({ t: 660 })] }) }), ['race A at base 6']),
        put(admin, 'ver_race_b', pid, fid, writeBody(6, { layer: layerOf({ walls: [wall({ t: 770 })] }) }), ['race B at base 6']),
      ]);
      const statuses = [a.res.status(), b.res.status()].sort();
      expect.soft(statuses, 'UPDATE … WHERE revision = 6 lets one win; the loser retries and meets the winner log (writer.py:330-344,533-557)').toEqual([200, 409]);
      const winner = a.res.status() === 200 ? a : b;
      const loser = a.res.status() === 200 ? b : a;
      expect.soft(asJson(winner.body).revision).toBe(7);
      expect.soft(asJson(loser.body).currentVersion).toBe(7);
      const winnerT = Number(wallById(asJson(winner.body), wid)?.thicknessMm);
      const read7 = await readLayer(admin, 'ver_read_race', pid, fid, '200 N16 revision 7 = the winner');
      expect.soft(read7.revision).toBe(7);
      expect.soft(wallById(read7, wid)?.thicknessMm).toBe(winnerT);

      expectWritten(await put(admin, 'ver_review_only_200', pid, fid, writeBody(7, { layer: layerOf({ walls: [wall({ t: winnerT, source: 'human', reviewed: true })] }) }), [
        '200 revision 8: only reviewed / source / confidence changed (untracked fields)',
      ]), 8, 'review only');
      const touch = await put(admin, 'ver_touch_mark_409', pid, fid, writeBody(7, { layer: layerOf({ walls: [wall({ t: winnerT, kind: 'envelope' })] }) }), [
        '409 currentVersion 8 with exactly ONE row: the touch mark wall thickness_mm = current value (writer.py:575-590,609-610)',
      ]);
      const touchBody = expectError(touch, 409, 'VERSION_CONFLICT');
      expect.soft(touchBody.currentVersion).toBe(8);
      expect.soft(objs(touchBody.remoteChanges, 'remoteChanges').map((c) => [c.entityType, c.entityId, c.field, c.value])).toEqual([
        ['wall', wid, 'thickness_mm', winnerT],
      ]);
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
      for (const [slug, data, field] of cases) {
        const sent = await put(admin, `rules_${slug}_422`, pid, fid, data, [`422 VALIDATION field "${field}" (schemas.py / domain model.py)`]);
        expectError(sent, 422, 'VALIDATION', { field });
      }
      expect.soft((await readLayer(admin, 'rules_read_unchanged', pid, fid, '200 revision 0: no 422 wrote anything')).revision).toBe(0);

      const noBase = await put(admin, 'rules_no_base_428', pid, fid, { body: { layer: okLayer } }, [
        '428 PRECONDITION_REQUIRED: no baseVersion key (core/routing.py:154-161)',
      ]);
      expectError(noBase, 428, 'PRECONDITION_REQUIRED');
      const arrayBody = await put(admin, 'rules_array_428', pid, fid, [1], ['428: a non-object body has no baseVersion']);
      expectError(arrayBody, 428, 'PRECONDITION_REQUIRED');
      const junk = await put(admin, 'rules_no_base_junk_428', pid, fid, { body: 'junk' }, ['428 before Pydantic: the invalid body does not matter (routing.py:9-12)']);
      expectError(junk, 428, 'PRECONDITION_REQUIRED');

      const otherFloor = sid('L');
      const mismatchFloor = await put(admin, 'rules_floorid_mismatch_422', pid, fid, { ...writeBody(0, { layer: okLayer }), floorId: otherFloor }, [
        '422 PATH_BODY_MISMATCH field floorId: camelCase path key with another value (core/routing.py:138-151)',
      ]);
      expectError(mismatchFloor, 422, 'PATH_BODY_MISMATCH', { field: 'floorId' });
      const mismatchProject = await put(admin, 'rules_projectid_mismatch_422', pid, fid, { ...writeBody(0, { layer: okLayer }), projectId: MISSING_PROJECT }, [
        '422 PATH_BODY_MISMATCH field projectId',
      ]);
      expectError(mismatchProject, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      const sameFloor = await put(admin, 'rules_floorid_same_422', pid, fid, { ...writeBody(0, { layer: okLayer }), floorId: fid }, [
        '422 VALIDATION field floorId: equal to the path passes W21 but is an extra key (WireRequest extra=forbid)',
      ]);
      expectError(sameFloor, 422, 'VALIDATION', { field: 'floorId' });
      const malformed = await put(admin, 'rules_malformed_400', pid, fid, Buffer.from('{"baseVersion": 0, "body": {'), [
        '400 MALFORMED_JSON: truncated JSON, parsed before every dependency (core/errors.py:170-174; core/routing.py:111)',
      ]);
      expectError(malformed, 400, 'MALFORMED_JSON');

      const ghost = sid('L');
      const ghostInvalid = await put(admin, 'rules_unknown_floor_invalid_body_422', pid, ghost, writeBody(0, {}), [
        '422 VALIDATION field body: Pydantic runs before the handler looks the floor up (router.py:55-57)',
      ]);
      expectError(ghostInvalid, 422, 'VALIDATION', { field: 'body' });
      const ghostValid = await put(admin, 'rules_unknown_floor_404', pid, ghost, writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 NOT_FOUND resource floor (router.py:55-57)',
      ]);
      expectError(ghostValid, 404, 'NOT_FOUND', { resource: 'floor' });
      const malformedFloor = await put(admin, 'rules_malformed_floor_404', pid, 'nope', writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 floor: the floor id has no format check, the lookup misses (floors/lookup.py:111-118)',
      ]);
      expectError(malformedFloor, 404, 'NOT_FOUND', { resource: 'floor' });
      const badProject = await put(admin, 'rules_bad_project_404', 'not-a-project', fid, writeBody(0, { layer: okLayer }), [
        '404 project: malformed prj id, no DB query (projects/access.py:28-33)',
      ]);
      expectError(badProject, 404, 'NOT_FOUND', { resource: 'project' });
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
      for (const [slug, data, field] of a5Cases) {
        const sent = await put(admin, `dom_${slug}_422`, pid, fa, data, [
          `422 REVIEW_BY_AI_FORBIDDEN field ${field}: A5 first, before levelId / integrity (writer.py:290-298) and before the base check (writer.py:217-219 vs 355)`,
        ]);
        expectError(sent, 422, 'REVIEW_BY_AI_FORBIDDEN', { field });
      }

      const levelCases: Array<[string, Json, string]> = [
        ['level_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fb)] }) }), 'body.layer.walls.0.levelId'],
        ['level_room', writeBody(0, { layer: layerOf({ walls: [wallOf(fa)], rooms: [roomOf(fb)] }) }), 'body.layer.rooms.0.levelId'],
      ];
      const dup = wallOf(fb);
      levelCases.push(['level_before_integrity', writeBody(0, { layer: layerOf({ walls: [dup, dup] }) }), 'body.layer.walls.0.levelId']);
      for (const [slug, data, field] of levelCases) {
        const sent = await put(admin, `dom_${slug}_422`, pid, fa, data, [
          `422 LAYER_LEVEL_MISMATCH field ${field}: item of another (well-formed) floor, checked before integrity (writer.py:299-305)`,
        ]);
        expectError(sent, 422, 'LAYER_LEVEL_MISMATCH', { field });
      }

      const twin = wallOf(fa);
      const ghostDoor = openingOf(sid('W'));
      const integrityCases: Array<[string, Json]> = [
        ['dup_id', writeBody(0, { layer: layerOf({ walls: [twin, twin] }) })],
        ['opening_ghost_wall', writeBody(0, { layer: layerOf({ walls: [wallOf(fa)], openings: [ghostDoor] }) })],
        ['wall_ghost_opening', writeBody(0, { layer: layerOf({ walls: [wallOf(fa, { openingIds: [sid('D')] })] }) })],
      ];
      for (const [slug, data] of integrityCases) {
        const sent = await put(admin, `dom_${slug}_422`, pid, fa, data, [
          '422 LAYER_INTEGRITY_BROKEN count 1: one critical issue (integrity.py:303-339; writer.py:306-308)',
        ]);
        expectError(sent, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
      }
      expect.soft((await readLayer(admin, 'dom_read_a0', pid, fa, '200 floor A still revision 0 after every 422')).revision).toBe(0);

      const wa = wallOf(fa);
      const closed = roomOf(fa, { wallIds: [sid('W')] });
      const closedRoom = { ...closed, outline: [...(closed.outline as Json[]), { x: 0, y: 0 }] };
      const strayItem = furnitureOf(fa, { roomId: sid('R') });
      const warn = await put(admin, 'dom_warnings_200', pid, fa, writeBody(0, { layer: layerOf({ walls: [wa], rooms: [closedRoom], furniture: [strayItem] }) }), [
        '200 revision 1: room → missing wall, furniture → missing room, closed outline are WARNINGS (integrity.py:327-358), stored as sent',
      ]);
      const warned = expectWritten(warn, 1, 'warnings');
      expect.soft(objs(layerIn(warned).furniture, 'furniture')[0]?.roomId).toBe(strayItem.roomId);

      const waOnB = { ...wa, levelId: fb };
      const taken = await put(admin, 'dom_id_of_floor_a_on_b_422', pid, fb, writeBody(0, { layer: layerOf({ walls: [waOnB] }) }), [
        '422 LAYER_INTEGRITY_BROKEN count 1: the wall id belongs to floor A of this project (writer.py:560-572, entity_ids.py)',
      ]);
      expectError(taken, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });
      expect.soft((await readLayer(admin, 'dom_read_b0', pid, fb, '200 floor B still revision 0: the savepoint rolled the bump back')).revision).toBe(0);

      const otherPid = String((await newProject(admin, 'domain-other', cleanup)).id);
      const fq = await newFloor(admin, otherPid, 'dom_floor_other_project', 0);
      expectWritten(await put(admin, 'dom_same_id_other_project_200', otherPid, fq, writeBody(0, { layer: layerOf({ walls: [{ ...wa, levelId: fq }] }) }), [
        '200: ids are unique per PROJECT (PK project_id, entity_id), another project may reuse it',
      ]), 1, 'other project');

      expectWritten(await put(admin, 'dom_release_on_a_200', pid, fa, writeBody(1, { layer: layerOf() }), [
        '200 revision 2: floor A drops the wall → its id is released (entity_ids.py _release)',
      ]), 2, 'release');
      expectWritten(await put(admin, 'dom_claim_on_b_200', pid, fb, writeBody(0, { layer: layerOf({ walls: [waOnB] }) }), [
        '200 revision 1: floor B now owns the released id',
      ]), 1, 'claim');

      const wc = wallOf(fc);
      expectWritten(await put(admin, 'dom_floor_c_200', pid, fc, writeBody(0, { layer: layerOf({ walls: [wc] }) }), ['200 revision 1 on floor C']), 1, 'floor C');
      const del = await call(admin, 'dom_floor_c_delete', 'DELETE', `/api/floors/${fc}`, undefined, ['setup: #11 soft delete floor C → 200']);
      expect(del.res.status()).toBe(200);
      const held = await put(admin, 'dom_id_of_deleted_floor_422', pid, fb, writeBody(1, { layer: layerOf({ walls: [waOnB, { ...wc, levelId: fb }] }) }), [
        '422 LAYER_INTEGRITY_BROKEN count 1: a soft-deleted floor keeps its ids inside FLOOR_RESTORE_WINDOW_S (600 s, entity_ids.py claim_entity_ids)',
      ]);
      expectError(held, 422, 'LAYER_INTEGRITY_BROKEN', { count: 1 });

      const onDeleted = await put(admin, 'dom_write_deleted_floor_404', pid, fc, writeBody(1, { layer: layerOf() }), [
        '404 floor: writing a soft-deleted floor (router.py:55-57)',
      ]);
      expectError(onDeleted, 404, 'NOT_FOUND', { resource: 'floor' });
      const foreign = await put(admin, 'dom_write_foreign_floor_404', pid, fq, writeBody(1, { layer: layerOf() }), [
        '404 floor: a floor of another project under my project path',
      ]);
      expectError(foreign, 404, 'NOT_FOUND', { resource: 'floor' });
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
      for (const [slug, data, f] of rules) {
        const sent = await put(admin, `scale_rule_${slug}_422`, pid, s1, data, [`422 VALIDATION field ${f} (schemas.py:101-139)`]);
        expectError(sent, 422, 'VALIDATION', { field: f });
      }
      expect.soft((await readLayer(admin, 'scale_read_s1_0', pid, s1, '200 revision 0 after the 422s')).revision).toBe(0);

      expectWritten(await put(admin, 'scale_first_200', pid, s1, writeBody(0, { scaleMillimetresPerPixel: 2.0000005 }), [
        '200 revision 1, empty layer (scale-only write creates the document, writer.py:311-327)',
      ]), 1, 'first scale');
      const r1 = await readLayer(admin, 'scale_read_s1_1', pid, s1, '200 N16: scale 2.000001 (HALF_UP), source human → no scaleStatus (assemble.py:247-249)');
      expect.soft(asJson(r1.level).scaleMillimetresPerPixel).toBe(2.000001);
      expect.soft(r1).not.toHaveProperty('scaleStatus');
      expectWritten(await put(admin, 'scale_same_200', pid, s1, writeBody(1, { scaleMillimetresPerPixel: 2.000001 }), [
        '200 revision 1: same value, source and page → unchanged, no bump (writer.py:492-499)',
      ]), 1, 'same scale');

      expectWritten(await put(admin, 'scale_low_bound_200', pid, s2, writeBody(0, { scaleMillimetresPerPixel: 0.0000005 }), [
        '200: 0.0000005 rounds HALF_UP to 0.000001 > 0',
      ]), 1, 'low bound');
      expect.soft(asJson((await readLayer(admin, 'scale_read_s2_low', pid, s2, '200 scale 0.000001')).level).scaleMillimetresPerPixel).toBe(0.000001);
      expectWritten(await put(admin, 'scale_high_bound_200', pid, s2, writeBody(1, { scaleMillimetresPerPixel: 999_999 }), [
        '200: 999999 = SCALE_MAX accepted (schemas.py:95)',
      ]), 2, 'high bound');

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
      const r3 = await readLayer(admin, 'scale_read_s3_2', pid, s3, '200 N16 = the 200 layer, level scale 4');
      expect.soft(r3.layer).toEqual(layer2);
      expect.soft(asJson(r3.level).scaleMillimetresPerPixel).toBe(4);

      const sentOld = await put(admin, 'scale_s3_layer_and_scale_200', pid, s3, writeBody(2, {
        layer: layerOf({ walls: [wallOf(s3, { id: wu, to: [1000, 0], t: 100 }), reviewed] }),
        scaleMillimetresPerPixel: 8,
      }), ['200 revision 3: the sent layer is read in the OLD scale (4) and rescaled ×2 → wall end 2000, thickness 200; reviewed wall kept (writer.py:437-439)']);
      const so = expectWritten(sentOld, 3, 'layer + scale');
      expect.soft(wallById(so, wu)).toMatchObject({ centreline: { start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } }, thicknessMm: 200 });
      expect.soft(wallById(so, String(reviewed.id))).toEqual(reviewed);

      // SCR-14 "Áp cho mọi tầng": read #12 + N15, then one scale-only PUT per floor at its floorRevisions revision.
      const listed = await listFloors(admin, 'scale_all_floors', pid, '200 #12: the 4 floors (useScaleCalibration onApply reads it)');
      const graph = await readGraph(admin, 'scale_all_graph', pid, '200 N15 floorRevisions: the base of each per-floor PUT');
      const revisions = new Map(objs(graph.floorRevisions, 'floorRevisions').map((r) => [String(r.floorId), Number(r.revision)]));
      expect.soft([...revisions.keys()].sort()).toEqual(listed.map((f) => String(f.id)).sort());
      for (const f of listed) {
        const id = String(f.id);
        const base = revisions.get(id) ?? 0;
        expectWritten(await put(admin, `scale_all_put_${String(f.order)}`, pid, id, writeBody(base, { scaleMillimetresPerPixel: 5 }), [
          `200 revision ${String(base + 1)}: scale 5 applied at the N15 revision of this floor`,
        ]), base + 1, `apply-all floor ${String(f.order)}`);
      }
      const graphAll = await readGraph(admin, 'scale_all_graph_after', pid, '200 N15: every level scaleMillimetresPerPixel 5');
      for (const l of objs(asJson(graphAll.graph).levels, 'levels')) expect.soft(l.scaleMillimetresPerPixel, `level ${String(l.id)}`).toBe(5);

      // RescaleError (s4 is at revision 1, scale 5, empty): a 1 mm wall, then a scale that rounds it to 0 mm.
      expectWritten(await put(admin, 'scale_s4_thin_wall_200', pid, s4, writeBody(1, { layer: layerOf({ walls: [wallOf(s4, { t: 1 })] }) }), [
        '200 revision 2: a 1 mm unreviewed wall',
      ]), 2, 'thin wall');
      const collapse = await put(admin, 'scale_s4_collapse_422', pid, s4, writeBody(2, { scaleMillimetresPerPixel: 0.001 }), [
        '422 VALIDATION field body.scaleMillimetresPerPixel: k = 0.0002 rounds the 1 mm thickness to 0 → RescaleError (writer.py:404-409)',
      ]);
      expectError(collapse, 422, 'VALIDATION', { field });
      const r4 = await readLayer(admin, 'scale_read_s4', pid, s4, '200 still revision 2, scale 5');
      expect.soft(r4.revision).toBe(2);
      expect.soft(asJson(r4.level).scaleMillimetresPerPixel).toBe(5);
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

      await readLayer(viewer, 'roles_viewer_n16_200', p1, f1, '200: any member reads N16 (router.py:71)');
      const meta = await call(viewer, 'roles_viewer_meta_200', 'GET', `/api/projects/${p1}/floors/${f1}/spatial`, undefined, ['200 #33 for a viewer member']);
      expect.soft(meta.res.status()).toBe(200);
      await readGraph(viewer, 'roles_viewer_graph_200', p1, '200 N15 for a viewer member');
      await listFloors(viewer, 'roles_viewer_floors_200', p1, '200 #12 for a viewer member');
      const viewerPuts: Array<[string, unknown]> = [
        ['valid', writeBody(0, { scaleMillimetresPerPixel: 2 })],
        ['no_base', { body: { scaleMillimetresPerPixel: 2 } }],
        ['empty_body', writeBody(0, {})],
      ];
      for (const [slug, data] of viewerPuts) {
        const sent = await put(viewer, `roles_viewer_put_${slug}_403`, p1, f1, data, [
          '403 FORBIDDEN: layer.edit is false for viewer; require_project runs before the 428 guard and Pydantic (router.py:3-6)',
        ]);
        const body = expectError(sent, 403, 'FORBIDDEN');
        expect.soft(body, '403 carries no resource').not.toHaveProperty('resource');
      }
      for (const [slug, method, path, data] of [
        ['n16', 'GET', layerPath(p2, f2), undefined],
        ['graph', 'GET', `/api/projects/${p2}/spatial`, undefined],
        ['floors', 'GET', `/api/projects/${p2}/floors`, undefined],
        ['put', 'PUT', layerPath(p2, f2), writeBody(0, { scaleMillimetresPerPixel: 2 })],
      ] as const) {
        const sent = await call(viewer, `roles_viewer_outside_${slug}_404`, method, path, data, [
          '404 NOT_FOUND resource project: not a member — 404 beats 403 (access.py:78-86)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      }

      const role = await call(admin, 'roles_change_to_engineer', 'PATCH', `/api/users/${user.id}/role`, { role: 'engineer', userId: user.id }, [
        'setup: #41 viewer → engineer (users/router.py:85-92); old tokens die (bump_token_version)',
      ]);
      expect(role.res.status()).toBe(200);
      const engineer = await signedInApi(user.email, user.password);
      cleanup.add(() => engineer.dispose());
      const wid = sid('W');
      expectWritten(await put(engineer, 'roles_engineer_put_200', p1, f1, writeBody(0, { layer: layerOf({ walls: [wallOf(f1, { id: wid, t: 220 })] }) }), [
        '200 revision 1: engineer member has layer.edit (matrix.py:47)',
      ]), 1, 'engineer write');
      const outside = await put(engineer, 'roles_engineer_outside_404', p2, f2, writeBody(0, { scaleMillimetresPerPixel: 2 }), [
        '404 project: engineer is not a member of project 2',
      ]);
      expectError(outside, 404, 'NOT_FOUND', { resource: 'project' });

      const stale = await put(admin, 'roles_admin_stale_409', p1, f1, writeBody(0, { layer: layerOf({ walls: [wallOf(f1, { id: wid, t: 110 })] }) }), [
        '409: remoteChanges name the engineer (changedBy = its usr id, changedByName = its name at write time, router.py:36-42)',
      ]);
      const body = expectError(stale, 409, 'VERSION_CONFLICT');
      const row = objs(body.remoteChanges, 'remoteChanges').find((c) => c.entityType === 'wall' && c.field === 'thickness_mm');
      expect.soft(row).toMatchObject({ entityId: wid, value: 220, changedBy: user.id, changedByName: user.name });
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
      expect.soft(status).toBe(200);
      expect.soft(out.revision).toBe(1);
      expect.soft(putWalls).toBe(count);
      expect.soft(read.status()).toBe(200);
      expect.soft(readWalls).toBe(count);
      expect.soft(graph.status()).toBe(200);
      expect.soft(graphWalls).toBe(count);
    } finally {
      await cleanup.run();
    }
  });
});

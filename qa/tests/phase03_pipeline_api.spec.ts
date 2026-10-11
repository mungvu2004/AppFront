/**
 * Phase 3 — project setup, upload and pipeline BACKEND through the real API (skill `qa-api-test`), no browser,
 * NO mocks. Endpoints (FE `src/api/endpoints.ts`, `lib/upload/uploadTask.ts`; UI spec `phase03_pipeline.spec.ts`):
 *   PUT  /api/projects/:id/settings (N6, read-back GET N5)        BE project_settings/router.py:22-39
 *   PATCH /api/projects/:id (#26 — rules owned by phase02_dashboard_api, only referenced here)
 *   POST /api/projects/:id/floors (#10)                            BE floors/router.py:30-35
 *   PATCH /api/projects/:id/floors/:fid/spatial (#34)              BE floors/router.py:67-78
 *   PATCH /api/floors/reorder (#13)                                BE floors/router.py:52-64
 *   POST /api/projects/:id/floors/:fid/drawings/uploads (#5)       BE drawings/router.py:50-67
 *   POST /api/projects/:id/drawings/uploads/:uid/chunks (#6)       BE drawings/router.py:70-77 (NOT under /floors/:fid)
 *   POST /api/projects/:id/drawings/uploads/:uid/complete (#7)     BE drawings/router.py:80-99
 *   GET  /api/projects/:id/drawings/uploads/:uid/progress (#8, read-back)  BE drawings/router.py:102-106
 *   GET  /api/streams/projects/:id/uploads/:uid/progress (S1, SSE) BE streams/router.py:118-140
 *   GET  /api/projects/:id/floors/:fid/quality (#30, SCR-11), POST …/quality/straighten (#32, 404 branch only),
 *   GET  /api/files/{token} (signed drawing URL) — BE quality/router.py:30-56, files/router.py:30-48.
 * Inventory + mock-pairing table: `qa/coverage/phase03-be.md`.
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, main), paths under `apps/api/` unless noted.
 *
 * ## Non-serial, own data
 * Every test signs in on its own, creates the projects/floors/uploads it needs (`qa-<runId>-…` names) and deletes
 * its projects in `finally` (soft delete hides floors, uploads and runs with them). Non-admin roles are REAL users:
 * admin invites a run-unique `@example.test` address, the one-time token comes from Mailpit, the invitee accepts and
 * one refresh gives its Bearer + stream cookie. Cleanup: `DELETE /api/users/{id}` + mails. The admin account is only
 * read: no password change, no failed login.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py; override LOGIN_IP_LIMIT=120): THIS file 12 (one
 *   admin login per test except "anon"; 15 since the three "gaps" tests), 0 failed. Phase-3 UI layers: main
 *   `phase03_pipeline.spec.ts` 1, ui `phase03_pipeline_ui.spec.ts` 1, edge `phase03_pipeline_edge.spec.ts` 0 (each +1
 *   only for a dead stored session). Layers run sequentially → ≤ 20 per run.
 * - `drawings_init` 60 / 600 s PER USER (BE:drawings/settings.py:135-136, router.py:39-46; counted for every #5
 *   request that passes the `floor.upload` gate, even a 422 body — core/ratelimit.py:116-118): ADMIN 29 in this file
 *   (init-rules 13, dedupe 3, chunks 2, reject 3, pipeline 1, sse-gates 1, roles 1, gaps-pdf 4, gaps-gone-floor 1) + main ≤ 2
 *   + edge 3 (by its header) + ui 0 = 34 ≤ 60 per run. A second full run inside the same 600 s would reach 68 > 60 (429)
 *   → wait 10 min between full phase-3 runs; a --grep re-run of only the "gaps" tests spends 5.
 *   The 61 inits of "roles" are spent by its own fresh engineer (own bucket, deleted afterwards).
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py): THIS file 2 ("roles"). Phase 1 spends 8,
 *   Phase 2 ≤ 15 → Phases 1-3 in one hour = 25 ≤ 30.
 * - `recovery_ip` 10 / 900 s per IP (override 60): 2 invitation accepts.
 * - `members_add` 60 / 3600 s per actor: admin 2.
 * - SSE: ≤ 6 concurrent streams per user (BE:streams/settings.py:34, connections.py:30-50) — "roles" opens 7 for its
 *   own engineer on purpose (7th → 429); the admin never holds more than 1. nginx `limit_conn` 30 per IP
 *   (deploy/nginx/snippets/app_locations.conf:25) — max 7 concurrent here.
 * - Pipeline worker: 1 real run ("pipeline", drawing.png); every other upload is rejected or left `receiving` (the four
 *   "gaps" PDFs are all rejected at #7, so none starts a run).
 * - Concurrency: "gaps: concurrent writers" sends 3 pairs of parallel requests (settings ×2, floor create ×1); no limit.
 * - Mailpit: 2 invitation mails, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { EVIDENCE_DIR, TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE:auth/cookies.py:13
const STREAM = 'appback_stream'; // BE:auth/cookies.py:15 (Path /api/streams)
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase01/02 api specs)
const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)
const MISSING_UPLOAD = `upl_${'0'.repeat(26)}`;
const UPLOAD_ID = /^upl_[0-9A-HJKMNP-TV-Z]{26}$/u;
const FOREIGN_ORIGIN = 'http://evil.example.test';
/** `UPLOAD_CHUNK_BYTES` (BE:drawings/settings.py:131) = FE `UPLOAD_CHUNK_SIZE_BYTES` (lib/upload/chunk.ts:46). */
const CHUNK_BYTES = 5 * 1024 * 1024;
/** `UPLOAD_MAX_BYTES` (BE:drawings/settings.py:130). */
const UPLOAD_MAX_BYTES = 104_857_600;
const INIT_LIMIT = 60; // BE:drawings/settings.py:135
const STREAM_MAX_PER_USER = 6; // BE:streams/settings.py:34
const SSE_RETRY_AFTER = '5'; // BE:streams/sse.py:65
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // packages/vision/preprocess/sniff.py

/* Wire shapes (W2: optional keys are ABSENT, never null). */
const FLOOR_KEYS = ['drawings', 'elevationMm', 'heightMm', 'id', 'name', 'order'] as const; // projects/wire.py:63-72
const FLOOR_OPTIONAL = ['areaM2'] as const;
const PROGRESS_KEYS = ['id', 'progressPercent', 'status', 'step'] as const; // drawings/schemas.py:82-95
const PROGRESS_OPTIONAL = ['endedAt', 'error', 'startedAt'] as const;
const SETTINGS_KEYS = [
  'buildingType', 'confidenceThreshold', 'defaultScaleMmPerPx', 'lengthUnit', 'revision', 'snapToleranceMm',
] as const; // project_settings/schemas.py:124-133
const SETTINGS_OPTIONAL = ['notes'] as const;
const ACTIVITY_KEYS = ['at', 'id', 'kind', 'objectCode', 'objectLabel'] as const; // users/schemas.py

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Role = 'viewer' | 'engineer';

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const projectName = (slug: string): string => `${PREFIX}${slug}-${uniq()}`;
/** Client-made level id `L-<base36 UPPER 10..64>` (BE:packages/core/ids.py:92-94; FE makes its own the same way). */
const newLevelId = (): string => `L-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 24)}`;
const floorBody = (id: string, order: number, name = `${PREFIX}floor-${String(order)}`): Json => ({
  id,
  name,
  order,
  elevationMm: order * 3000,
  heightMm: 3000,
});
/** A valid N6 body (BE:project_settings/schemas.py:103-111). */
const settingsBody = (over: Json = {}): Json => ({
  buildingType: 'residential',
  lengthUnit: 'mm',
  snapToleranceMm: 50,
  confidenceThreshold: 0.75,
  defaultScaleMmPerPx: 1,
  ...over,
});

/* ------------------------------------------------------------------ phase-local helpers */

function note(description: string): void {
  test.info().annotations.push({ type: 'note', description });
}

function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

/** Non-throwing view of an error body (a missing / non-JSON body just fails the soft checks). */
const errBody = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

/** Every `required` key present and nothing outside `required` ∪ `optional`. */
function expectKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): Json {
  const record = asJson(value);
  const keys = Object.keys(record);
  for (const key of required) expect.soft(keys, `key "${key}"`).toContain(key);
  expect.soft(keys.filter((key) => !required.includes(key) && !optional.includes(key)), 'unexpected keys').toEqual([]);
  return record;
}

interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `A03_<ev>.json` (secrets redacted by `captureExchange`). */
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
  const shown = typeof data === 'string' && data.length > 2048 ? `<${String(data.length)} chars>` : data;
  const body = await captureExchange(`A03_${ev}.json`, { method, path, body: shown ?? null }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource` / `count`). */
function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string; readonly resource?: string } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  return body;
}

function expectFloorOut(value: unknown): Json {
  return expectKeys(value, FLOOR_KEYS, FLOOR_OPTIONAL);
}

/** `Progress` (BE:drawings/progress.py:33-68): keys, enum, percent 0..100, endedAt only when completed. */
function expectProgress(value: unknown, uploadId?: string): Json {
  const p = expectKeys(value, PROGRESS_KEYS, PROGRESS_OPTIONAL);
  if (uploadId !== undefined) expect.soft(p.id).toBe(uploadId);
  expect.soft(String(p.id)).toMatch(UPLOAD_ID);
  expect.soft(['pending', 'running', 'completed', 'failed']).toContain(p.status);
  expect.soft(typeof p.progressPercent === 'number' && p.progressPercent >= 0 && p.progressPercent <= 100).toBe(true);
  if (p.status !== 'completed') expect.soft(p, 'endedAt only when completed (K33)').not.toHaveProperty('endedAt');
  if (p.status === 'failed') expect.soft(String(p.error)).toMatch(/^[A-Z][A-Z0-9_]*$/u);
  else expect.soft(p).not.toHaveProperty('error');
  return p;
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

/** Setup: admin creates a project (`extra.floors` = hook floors, BE:floors/view_parts.py) and registers its deletion. */
async function newProject(api: APIRequestContext, ev: string, cleanup: Cleanup, extra: Json = {}): Promise<Json> {
  const sent = await call(api, `${ev}_create`, 'POST', '/api/projects', { name: projectName(ev), ...extra }, [
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

/** Setup: #10 creates one floor with a client id; returns the id. */
async function newFloor(api: APIRequestContext, projectId: string, ev: string, order = 0): Promise<string> {
  const id = newLevelId();
  const sent = await call(api, ev, 'POST', `/api/projects/${projectId}/floors`, floorBody(id, order), [
    'setup: 201 FloorOut (floors/router.py:30-35)',
  ]);
  expect(sent.res.status(), 'setup create floor').toBe(201);
  return id;
}

async function readProject(api: APIRequestContext, id: string, ev: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${id}`, undefined, ['read-back: 200 ProjectOut (#24)']);
  expect(sent.res.status()).toBe(200);
  return asJson(sent.body);
}

async function listFloors(api: APIRequestContext, projectId: string, ev: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', `/api/projects/${projectId}/floors`, undefined, [
    'read-back: 200 FloorOut[] of live floors, (order, pk) (floors/router.py:46-49, service.py:197-199)',
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body).map((f) => expectFloorOut(f));
}

/** The admin's id = the only member of a fresh project (projects/service.py). */
function creatorId(project: Json): string {
  const members = asArray(project.members, 'members').map((m) => asJson(m));
  expect(members).toHaveLength(1);
  return String(members[0]?.id);
}

/** `activity_log` rows of `userId` whose `objectCode` is `code` (GET /api/users/{id}/activity, newest first). */
async function activityOf(admin: APIRequestContext, userId: string, code: string, ev: string): Promise<Json[]> {
  const sent = await call(admin, ev, 'GET', `/api/users/${userId}/activity`, undefined, [
    'read-back: 200 activity rows of the admin, newest first; filtered here by objectCode',
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body)
    .map((row) => expectKeys(row, ACTIVITY_KEYS))
    .filter((row) => row.objectCode === code);
}

/** #5 init (FE body: uploadTask.ts:424-433). */
async function initUpload(
  api: APIRequestContext,
  ev: string,
  projectId: string,
  floorId: string,
  over: Json,
  claims: readonly string[],
): Promise<Sent> {
  const body = { fileName: `${PREFIX}${ev}.png`, floorId, mimeType: 'image/png', projectId, sizeBytes: 1, ...over };
  return call(api, ev, 'POST', `/api/projects/${projectId}/floors/${floorId}/drawings/uploads`, body, claims);
}

async function sendChunk(
  api: APIRequestContext,
  ev: string,
  projectId: string,
  uploadId: string,
  bytes: Buffer,
  index: number,
  claims: readonly string[],
): Promise<Sent> {
  return call(api, ev, 'POST', `/api/projects/${projectId}/drawings/uploads/${uploadId}/chunks`, {
    chunk: bytes.toString('base64'),
    chunkIndex: index,
  }, claims);
}

async function complete(api: APIRequestContext, ev: string, projectId: string, uploadId: string, claims: readonly string[]): Promise<Sent> {
  return call(api, ev, 'POST', `/api/projects/${projectId}/drawings/uploads/${uploadId}/complete`, { uploadId }, claims);
}

async function progressOf(api: APIRequestContext, ev: string, projectId: string, uploadId: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${projectId}/drawings/uploads/${uploadId}/progress`, undefined, [claim]);
  expect(sent.res.status(), '#8 progress').toBe(200);
  return expectProgress(sent.body, uploadId);
}

/** Single-chunk upload of `bytes` named `fileName`: init → chunk 0 → returns the upload id (status receiving). */
async function receivingUpload(
  api: APIRequestContext,
  ev: string,
  projectId: string,
  floorId: string,
  bytes: Buffer,
  fileName: string,
): Promise<string> {
  const init = await initUpload(api, `${ev}_init`, projectId, floorId, { fileName, sizeBytes: bytes.length }, [
    'setup: 200 Progress pending (drawings/uploads.py:174-227)',
  ]);
  expect(init.res.status(), 'setup init').toBe(200);
  const uploadId = String(asJson(init.body).id);
  const chunk = await sendChunk(api, `${ev}_chunk`, projectId, uploadId, bytes, 0, ['setup: 200 Progress pending (uploads.py:273-296)']);
  expect(chunk.res.status(), 'setup chunk').toBe(200);
  return uploadId;
}

/* ---- the stream cookie (S1 is cookie-authenticated, BE:streams/sse.py:161-169) */

async function streamCookieOf(api: APIRequestContext): Promise<string> {
  const cookie = (await api.storageState()).cookies.find((c) => c.name === STREAM);
  if (!cookie) throw new Error('no appback_stream cookie in the signed-in context');
  return cookie.value;
}

interface SseFrame {
  readonly id: string;
  readonly data: Json;
}

interface SseResult {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly frames: SseFrame[];
  readonly errorBody?: unknown;
  readonly closed: 'until' | 'timeout' | 'error-response' | 'server-ended';
}

/** Open S1 with Node fetch (APIRequestContext buffers the whole body, an SSE never ends), read W15 frames
 * (`id:` + one `data:` line, never `event:` — BE:streams/sse.py:79-86; `: ping` comments ignored) until
 * `until(frame)` or `timeoutMs`, then abort. A non-2xx answer is read as JSON. */
async function readSse(
  path: string,
  opts: { cookie?: string; origin?: string; until: (f: SseFrame) => boolean; timeoutMs: number },
): Promise<SseResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (opts.cookie !== undefined) headers.Cookie = `${STREAM}=${opts.cookie}`;
  if (opts.origin !== undefined) headers.Origin = opts.origin;
  const frames: SseFrame[] = [];
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, { headers, signal: controller.signal });
    const outHeaders = Object.fromEntries([...res.headers.entries()].filter(([k]) => !/^(date|set-cookie)$/iu.test(k)));
    if (!res.ok || res.body === null) {
      const text = await res.text();
      let errorBody: unknown = text;
      try {
        errorBody = JSON.parse(text);
      } catch {
        /* keep text */
      }
      return { status: res.status, headers: outHeaders, frames, errorBody, closed: 'error-response' };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return { status: res.status, headers: outHeaders, frames, closed: 'server-ended' };
        buffer += decoder.decode(value, { stream: true });
        let cut = buffer.indexOf('\n\n');
        while (cut >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          cut = buffer.indexOf('\n\n');
          const lines = block.split('\n');
          const id = lines.find((l) => l.startsWith('id: '))?.slice(4);
          const data = lines.find((l) => l.startsWith('data: '))?.slice(6);
          expect.soft(lines.some((l) => l.startsWith('event:')), 'no `event:` line (K03)').toBe(false);
          if (id === undefined || data === undefined) continue; // `: ping`
          const frame = { id, data: asJson(JSON.parse(data), 'SSE data') };
          frames.push(frame);
          if (opts.until(frame)) {
            controller.abort();
            return { status: res.status, headers: outHeaders, frames, closed: 'until' };
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return { status: res.status, headers: outHeaders, frames, closed: 'timeout' };
      throw error;
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

/** Evidence for a stream case (no cookie value is ever written). */
async function captureStream(name: string, path: string, sent: Json, result: SseResult, assertions: readonly string[]): Promise<void> {
  const record = { request: { method: 'GET', path, sent }, response: result, assertions, capturedAt: new Date().toISOString() };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = join(EVIDENCE_DIR, `A03_${name}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  await test.info().attach(`A03_${name}.json`, { path: file, contentType: 'application/json' });
}

/* ---- real non-admin users (invitation → Mailpit → accept → refresh) */

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly api: APIRequestContext;
  readonly streamCookie: string;
}

function cookieFrom(res: APIResponse, name: string): string | undefined {
  const line = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${name}=`));
  return line?.value.slice(name.length + 1).split(';')[0];
}

/** Admin invites a run-unique user with `role` (users/router.py), the invitee accepts with the mailed token and
 * one refresh gives its Bearer and stream cookie. Registers user + mail cleanup. */
async function realUser(admin: APIRequestContext, role: Role, ev: string, cleanup: Cleanup): Promise<TestUser> {
  const email = testEmail(ev);
  const since = new Date(Date.now() - 5_000);
  const sent = await call(admin, `${ev}_invite`, 'POST', '/api/users/invitations', { emails: [email], role }, [
    `setup: admin invites a run-unique @example.test ${role} → 201, one pending user`,
  ]);
  expect(sent.res.status()).toBe(201);
  const user = asArray(sent.body).map((u) => asJson(u)).find((u) => u.email === email);
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
  let streamCookie = '';
  try {
    const accept = await call(anon, `${ev}_accept`, 'POST', '/api/auth/invitations/accept', {
      token,
      fullName: `${PREFIX}${ev}`,
      password: `Qa-${randomUUID()}`,
    }, ['setup: invitee accepts with the real mailed token → 204 + refresh cookie']);
    expect(accept.res.status()).toBe(204);
    const refreshCookie = cookieFrom(accept.res, REFRESH);
    if (!refreshCookie) throw new Error('accept: no refresh cookie');
    const refreshed = await call(anon, `${ev}_refresh`, 'POST', '/api/auth/refresh', undefined, [
      `setup: 200 W16 roles ["${role}"] + a new stream cookie (auth/cookies.py:29-31)`,
    ], { Cookie: `${REFRESH}=${refreshCookie}` });
    expect(refreshed.res.status()).toBe(200);
    expect(asJson(refreshed.body).roles).toEqual([role]);
    bearer = String(((await refreshed.res.json()) as Json).accessToken);
    streamCookie = cookieFrom(refreshed.res, STREAM) ?? cookieFrom(accept.res, STREAM) ?? '';
    if (!streamCookie) throw new Error('no stream cookie after accept/refresh');
  } finally {
    await anon.dispose();
  }
  const base = apiBaseUrl();
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${bearer}` } });
  cleanup.add(() => api.dispose());
  return { id, email, api, streamCookie };
}

async function addMember(admin: APIRequestContext, projectId: string, email: string, ev: string): Promise<void> {
  const sent = await call(admin, ev, 'POST', `/api/projects/${projectId}/members`, { email }, [
    'setup: N3 adds the user → 201 (project_members/router.py)',
  ]);
  expect(sent.res.status()).toBe(201);
}

/** Minimal PDF with `pages` empty A4 pages and a correct xref table — a port of the BE's own fixture
 * `packages/vision/preprocess/tests/synthetic.py:96-150` (`make_pdf`, no encryption). `pages = 0` gives `/Count 0`. */
function makePdf(pages: number): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${String(3 + i)} 0 R`).join(' ');
  const objects = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${kids}]/Count ${String(pages)}>>`];
  for (let i = 0; i < pages; i += 1) {
    objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents ${String(3 + pages + i)} 0 R/Resources<<>>>>`);
  }
  for (let i = 0; i < pages; i += 1) objects.push('<</Length 0>>\nstream\n\nendstream');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<</Size ${String(objects.length + 1)}/Root 1 0 R>>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(out, 'latin1'); // ASCII only: string offsets = byte offsets
}

const drawingPng = (): Buffer => {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return readFileSync(path);
};

/* ------------------------------------------------------------------ tests */

test.describe('A03 phase-3 backend (settings, floors, uploads, pipeline stream)', () => {
  test('A03 · anonymous: every phase-3 route → 401 UNAUTHENTICATED before the body is read; S1 without a stream cookie / with a forged one → 401; foreign Origin on S1 → 403 first; forged file token → 404; body ceilings 1 MiB / 8 MiB (chunks) → 413', async () => {
    // core/routing.py:125-131 (_principal_of before the body), 1-10; streams/router.py:127-128 (Origin, then cookie);
    // files/router.py:2-10,37-40; core/routing.py:46, drawings/router.py:33,71; nginx 8m (app_locations.conf).
    const anon = await newApiContext();
    try {
      const fid = newLevelId();
      const routes: Array<[string, Method, string, unknown]> = [
        ['settings', 'PUT', `/api/projects/${MISSING_PROJECT}/settings`, { baseVersion: 0, body: settingsBody() }],
        ['floor_create', 'POST', `/api/projects/${MISSING_PROJECT}/floors`, floorBody(fid, 0)],
        ['floor_patch', 'PATCH', `/api/projects/${MISSING_PROJECT}/floors/${fid}/spatial`, { name: 'x' }],
        ['reorder', 'PATCH', '/api/floors/reorder', { floorIds: [fid] }],
        ['init', 'POST', `/api/projects/${MISSING_PROJECT}/floors/${fid}/drawings/uploads`, { fileName: 'a.png' }],
        ['chunk', 'POST', `/api/projects/${MISSING_PROJECT}/drawings/uploads/${MISSING_UPLOAD}/chunks`, { chunk: 'AA==', chunkIndex: 0 }],
        ['complete', 'POST', `/api/projects/${MISSING_PROJECT}/drawings/uploads/${MISSING_UPLOAD}/complete`, { uploadId: MISSING_UPLOAD }],
        ['progress', 'GET', `/api/projects/${MISSING_PROJECT}/drawings/uploads/${MISSING_UPLOAD}/progress`, undefined],
        ['quality', 'GET', `/api/projects/${MISSING_PROJECT}/floors/${fid}/quality`, undefined],
        ['settings_malformed', 'PUT', `/api/projects/${MISSING_PROJECT}/settings`, '{"baseVersion": 0,'],
      ];
      for (const [slug, method, path, data] of routes) {
        const headers = typeof data === 'string' ? { 'Content-Type': 'application/json' } : undefined;
        const sent = await call(anon, `anon_${slug}_401`, method, path, data, [
          '401 UNAUTHENTICATED: no Bearer, checked before the body / path ids (core/routing.py:125-131)',
        ], headers);
        expectError(sent, 401, 'UNAUTHENTICATED');
      }

      const streamPath = `/api/streams/projects/${MISSING_PROJECT}/uploads/${MISSING_UPLOAD}/progress`;
      const noCookie = await readSse(streamPath, { until: () => true, timeoutMs: 15_000 });
      await captureStream('anon_sse_no_cookie_401', streamPath, { cookie: 'none' }, noCookie, ['401 UNAUTHENTICATED: no appback_stream cookie (sse.py:164-166)']);
      expect.soft(noCookie.status).toBe(401);
      expect.soft(errBody(noCookie.errorBody).code).toBe('UNAUTHENTICATED');
      const forged = await readSse(streamPath, { cookie: 'forged.token.value', until: () => true, timeoutMs: 15_000 });
      await captureStream('anon_sse_forged_cookie_401', streamPath, { cookie: '<forged>' }, forged, ['401 UNAUTHENTICATED: stream JWT does not verify (sse.py:167)']);
      expect.soft(forged.status).toBe(401);
      expect.soft(errBody(forged.errorBody).code).toBe('UNAUTHENTICATED');
      const foreign = await readSse(streamPath, { origin: FOREIGN_ORIGIN, until: () => true, timeoutMs: 15_000 });
      await captureStream('anon_sse_foreign_origin_403', streamPath, { origin: FOREIGN_ORIGIN, cookie: 'none' }, foreign, [
        '403 ORIGIN_MISMATCH: a present foreign Origin is checked before the cookie (streams/router.py:127-128, core/origin.py:59-62)',
      ]);
      expect.soft(foreign.status).toBe(403);
      expect.soft(errBody(foreign.errorBody).code).toBe('ORIGIN_MISMATCH');

      const file = await call(anon, 'anon_file_forged_404', 'GET', '/api/files/forged-token', undefined, [
        '404 NOT_FOUND: a forged / unknown file token is one indistinguishable 404 (files/router.py:7-8,33-40)',
      ]);
      expectError(file, 404, 'NOT_FOUND');

      // Body ceilings: exactly at the limit reaches the route (401), one byte more → 413 before authentication.
      const oneMiB = 1024 * 1024;
      const jsonOf = (size: number): string => `{"x":"${'a'.repeat(size - 8)}"}`;
      const atLimit = await call(anon, 'anon_settings_1mib_401', 'PUT', `/api/projects/${MISSING_PROJECT}/settings`, jsonOf(oneMiB), [
        '1 048 576-byte body passes the 1 MiB ceiling → 401 (core/routing.py:46)',
      ], { 'Content-Type': 'application/json' });
      expect.soft(atLimit.res.status()).toBe(401);
      const over = await call(anon, 'anon_settings_1mib_plus1_413', 'PUT', `/api/projects/${MISSING_PROJECT}/settings`, jsonOf(oneMiB + 1), [
        '1 048 577 bytes → 413 PAYLOAD_TOO_LARGE before auth (core/middleware.py body limit)',
      ], { 'Content-Type': 'application/json' });
      expectError(over, 413, 'PAYLOAD_TOO_LARGE');
      const chunkPath = `/api/projects/${MISSING_PROJECT}/drawings/uploads/${MISSING_UPLOAD}/chunks`;
      const chunkAt = await call(anon, 'anon_chunk_8mib_401', 'POST', chunkPath, jsonOf(8 * oneMiB), [
        '8 MiB body passes the #6 ceiling (drawings/router.py:33,71) → 401',
      ], { 'Content-Type': 'application/json' });
      expect.soft(chunkAt.res.status()).toBe(401);
      const chunkOver = await call(anon, 'anon_chunk_8mib_plus1_413', 'POST', chunkPath, jsonOf(8 * oneMiB + 1), [
        '8 MiB + 1 → 413 PAYLOAD_TOO_LARGE (app ceiling = nginx client_max_body_size 8m)',
      ], { 'Content-Type': 'application/json' });
      expectError(chunkOver, 413, 'PAYLOAD_TOO_LARGE');
    } finally {
      await anon.dispose();
    }
  });

  test('A03 · settings N5/N6 versioning: fresh project → revision 0 defaults; PUT base 0 → 200 revision 1 (notes trimmed + NFC, decimals rounded HALF_UP); own repeat → 200 same revision, no 2nd write; stale / ahead base → 409 VERSION_CONFLICT currentVersion + remoteChanges []; missing baseVersion → 428 before Pydantic; Idempotency-Key ignored; activity + updatedAt only on real writes', async () => {
    // project_settings/router.py:22-39, service.py:88-119, read.py:29-37,65-68, schemas.py:63-133; core/routing.py:154-161.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'set-ver', cleanup);
      const pid = String(project.id);
      const path = `/api/projects/${pid}/settings`;

      const fresh = await call(admin, 'set_read_default', 'GET', path, undefined, [
        '200 defaults revision 0 residential/mm/50/0.75/1, notes absent (read.py:29-37)',
      ]);
      expect(fresh.res.status()).toBe(200);
      expect(expectKeys(fresh.body, SETTINGS_KEYS, SETTINGS_OPTIONAL)).toEqual({
        revision: 0, buildingType: 'residential', lengthUnit: 'mm', snapToleranceMm: 50, confidenceThreshold: 0.75, defaultScaleMmPerPx: 1,
      });

      const missing = await call(admin, 'set_put_no_base_428', 'PUT', path, { body: { junk: true } }, [
        '428 PRECONDITION_REQUIRED: no baseVersion key, checked before Pydantic (an invalid body does not matter, routing.py:154-161)',
      ]);
      expectError(missing, 428, 'PRECONDITION_REQUIRED');
      const arrayBody = await call(admin, 'set_put_array_428', 'PUT', path, [1], ['428: a non-object body has no baseVersion (routing.py:160)']);
      expectError(arrayBody, 428, 'PRECONDITION_REQUIRED');

      const before = await readProject(admin, pid, 'set_project_before');
      const body1 = settingsBody({ notes: '  Cafe\u0301 ghi chú\n\tdòng 2  ', confidenceThreshold: 0.1235, defaultScaleMmPerPx: 1.0000005, lengthUnit: 'm' });
      const first = await call(admin, 'set_put_base0_200', 'PUT', path, { baseVersion: 0, body: body1 }, [
        '200 revision 1; notes trimmed + NFC (é), \\n and \\t kept; 0.1235 → 0.124, 1.0000005 → 1.000001 HALF_UP (schemas.py:63-100)',
      ], { 'Idempotency-Key': `qa-set-${uniq()}` });
      expect(first.res.status()).toBe(200);
      expect.soft(expectKeys(first.body, SETTINGS_KEYS, SETTINGS_OPTIONAL)).toEqual({
        revision: 1, buildingType: 'residential', notes: 'Café ghi chú\n\tdòng 2', lengthUnit: 'm', snapToleranceMm: 50,
        confidenceThreshold: 0.124, defaultScaleMmPerPx: 1.000001,
      });
      const after1 = await readProject(admin, pid, 'set_project_after1');
      expect.soft(Date.parse(String(after1.updatedAt)), 'touch_project on a real write (service.py:114)').toBeGreaterThan(Date.parse(String(before.updatedAt)));

      const repeat = await call(admin, 'set_put_base0_repeat_200', 'PUT', path, { baseVersion: 0, body: body1 }, [
        '200 revision 1: same writer + same normalised body digest at revision base+1 = own repeat (C09b, service.py:79-85,116-118)',
      ]);
      expect.soft(repeat.res.status()).toBe(200);
      expect.soft(asJson(repeat.body).revision).toBe(1);
      // NFD vs NFC notes digest the same (service.py:47-54): the NFC spelling is still a repeat.
      const nfc = await call(admin, 'set_put_base0_repeat_nfc_200', 'PUT', path, { baseVersion: 0, body: { ...body1, notes: 'Café ghi chú\n\tdòng 2' } }, [
        '200 revision 1: the NFC spelling of the same notes hashes the same (C16)',
      ]);
      expect.soft(nfc.res.status()).toBe(200);
      expect.soft(asJson(nfc.body).revision).toBe(1);

      const stale = await call(admin, 'set_put_stale_409', 'PUT', path, { baseVersion: 0, body: settingsBody({ lengthUnit: 'mm' }) }, [
        '409 VERSION_CONFLICT currentVersion 1, remoteChanges [] (service.py:119; core/errors.py:82-87)',
      ]);
      const staleBody = expectError(stale, 409, 'VERSION_CONFLICT');
      expect.soft(staleBody.currentVersion).toBe(1);
      expect.soft(staleBody.remoteChanges).toEqual([]);

      // Idempotency-Key is not used by versioned routes (router.py:4-5, routing.py:227-232): same key, new base/body → a 2nd write.
      const key = `qa-set-key-${uniq()}`;
      const second = await call(admin, 'set_put_base1_200', 'PUT', path, { baseVersion: 1, body: settingsBody() }, ['200 revision 2, notes absent = cleared (PUT replaces)'], { 'Idempotency-Key': key });
      expect.soft(second.res.status()).toBe(200);
      const secondBody = asJson(second.body);
      expect.soft(secondBody.revision).toBe(2);
      expect.soft(secondBody, 'notes cleared by an absent key (schemas.py:104)').not.toHaveProperty('notes');
      const third = await call(admin, 'set_put_base2_same_key_200', 'PUT', path, { baseVersion: 2, body: settingsBody({ buildingType: 'mixed' }) }, [
        '200 revision 3: the same Idempotency-Key is NOT replayed on a versioned route',
      ], { 'Idempotency-Key': key });
      expect.soft(third.res.status()).toBe(200);
      expect.soft(asJson(third.body).revision).toBe(3);

      const ahead = await call(admin, 'set_put_ahead_409', 'PUT', path, { baseVersion: 9, body: settingsBody() }, ['409 VERSION_CONFLICT currentVersion 3 for a base ahead of the row']);
      expect.soft(expectError(ahead, 409, 'VERSION_CONFLICT').currentVersion).toBe(3);
      const old = await call(admin, 'set_put_old_repeat_409', 'PUT', path, { baseVersion: 0, body: body1 }, [
        '409: the revision-1 body sent again at base 0 is no longer a repeat (row is at 3, service.py:82)',
      ]);
      expect.soft(expectError(old, 409, 'VERSION_CONFLICT').currentVersion).toBe(3);

      const reread = await call(admin, 'set_read_after', 'GET', path, undefined, ['200 N5 = the last write, revision 3']);
      expect.soft(asJson(reread.body).revision).toBe(3);
      expect.soft(asJson(reread.body).buildingType).toBe('mixed');
      const rows = await activityOf(admin, creatorId(project), pid, 'set_activity');
      expect.soft(rows.filter((r) => r.kind === 'project.settings_update').length, 'one row per real write, none for repeats / 409').toBe(3);
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · settings body rules → 422 VALIDATION with field (enum, strict int 1..120, decimals ranges and type, notes 500 / blank / bidi, missing and extra keys, baseVersion strict ≥ 0); bounds accepted', async () => {
    // project_settings/schemas.py:56-121; core/errors.py (field = camelCase loc of the first error).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'set-rules', cleanup)).id);
      const path = `/api/projects/${pid}/settings`;
      const cases: Array<[string, unknown, string]> = [
        ['building_enum', { baseVersion: 0, body: settingsBody({ buildingType: 'castle' }) }, 'body.buildingType'],
        ['unit_enum', { baseVersion: 0, body: settingsBody({ lengthUnit: 'cm' }) }, 'body.lengthUnit'],
        ['snap_0', { baseVersion: 0, body: settingsBody({ snapToleranceMm: 0 }) }, 'body.snapToleranceMm'],
        ['snap_121', { baseVersion: 0, body: settingsBody({ snapToleranceMm: 121 }) }, 'body.snapToleranceMm'],
        ['snap_float', { baseVersion: 0, body: settingsBody({ snapToleranceMm: 1.5 }) }, 'body.snapToleranceMm'],
        ['snap_string', { baseVersion: 0, body: settingsBody({ snapToleranceMm: '50' }) }, 'body.snapToleranceMm'],
        ['conf_above_1', { baseVersion: 0, body: settingsBody({ confidenceThreshold: 1.0001 }) }, 'body.confidenceThreshold'],
        ['conf_negative', { baseVersion: 0, body: settingsBody({ confidenceThreshold: -0.0004 }) }, 'body.confidenceThreshold'],
        ['conf_bool', { baseVersion: 0, body: settingsBody({ confidenceThreshold: true }) }, 'body.confidenceThreshold'],
        ['conf_string', { baseVersion: 0, body: settingsBody({ confidenceThreshold: '0.5' }) }, 'body.confidenceThreshold'],
        ['scale_low', { baseVersion: 0, body: settingsBody({ defaultScaleMmPerPx: 0.0099 }) }, 'body.defaultScaleMmPerPx'],
        ['scale_high', { baseVersion: 0, body: settingsBody({ defaultScaleMmPerPx: 1000.5 }) }, 'body.defaultScaleMmPerPx'],
        ['notes_501', { baseVersion: 0, body: settingsBody({ notes: 'n'.repeat(501) }) }, 'body.notes'],
        ['notes_blank', { baseVersion: 0, body: settingsBody({ notes: '   ' }) }, 'body.notes'],
        ['notes_bidi', { baseVersion: 0, body: settingsBody({ notes: 'a\u202Eb' }) }, 'body.notes'],
        ['notes_bell', { baseVersion: 0, body: settingsBody({ notes: 'a\u0007b' }) }, 'body.notes'],
        ['unit_missing', { baseVersion: 0, body: { ...settingsBody(), lengthUnit: undefined } }, 'body.lengthUnit'],
        ['body_extra', { baseVersion: 0, body: settingsBody({ foo: 1 }) }, 'body.foo'],
        ['top_extra', { baseVersion: 0, body: settingsBody(), foo: 1 }, 'foo'],
        ['body_missing', { baseVersion: 0 }, 'body'],
        ['base_negative', { baseVersion: -1, body: settingsBody() }, 'baseVersion'],
        ['base_string', { baseVersion: '0', body: settingsBody() }, 'baseVersion'],
      ];
      for (const [slug, data, field] of cases) {
        const sent = await call(admin, `set_rules_${slug}_422`, 'PUT', path, data, [`422 VALIDATION field "${field}" (schemas.py)`]);
        expectError(sent, 422, 'VALIDATION', { field });
      }
      const unchanged = await call(admin, 'set_rules_read_unchanged', 'GET', path, undefined, ['200 still revision 0: no 422 wrote anything']);
      expect.soft(asJson(unchanged.body).revision).toBe(0);
      const bounds = settingsBody({
        buildingType: 'other', snapToleranceMm: 120, confidenceThreshold: 1, defaultScaleMmPerPx: 0.01, notes: 'n'.repeat(500),
      });
      const ok = await call(admin, 'set_rules_bounds_200', 'PUT', path, { baseVersion: 0, body: bounds }, [
        '200: 120 / 1 / 0.01 / 500-char notes are inside the ranges (schemas.py:59,99-100,109)',
      ]);
      expect.soft(ok.res.status()).toBe(200);
      expect.soft(asJson(ok.body)).toMatchObject({ revision: 1, snapToleranceMm: 120, confidenceThreshold: 1, defaultScaleMmPerPx: 0.01 });
      const low = await call(admin, 'set_rules_low_bounds_200', 'PUT', path, {
        baseVersion: 1, body: settingsBody({ snapToleranceMm: 1, confidenceThreshold: 0, defaultScaleMmPerPx: 1000 }),
      }, ['200: 1 / 0 / 1000 accepted']);
      expect.soft(low.res.status()).toBe(200);
      expect.soft(asJson(low.body)).toMatchObject({ revision: 2, snapToleranceMm: 1, confidenceThreshold: 0, defaultScaleMmPerPx: 1000 });
      const malformed = await call(admin, 'set_rules_malformed_400', 'PUT', path, '{"baseVersion": 2, "body": {', [
        '400 MALFORMED_JSON (core/errors.py json_invalid)',
      ], { 'Content-Type': 'application/json' });
      expectError(malformed, 400, 'MALFORMED_JSON');
      const badId = await call(admin, 'set_rules_bad_project_404', 'PUT', '/api/projects/not-a-project/settings', { baseVersion: 0, body: settingsBody() }, [
        '404 NOT_FOUND resource project: malformed prj id, no DB query (projects/access.py:28-33)',
      ]);
      expectError(badId, 404, 'NOT_FOUND', { resource: 'project' });
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · floors #10 create: 201 FloorOut (drawings [], echoed drawings/areaM2 ignored); same id again → 409 FLOOR_ID_TAKEN field id; body rules → 422 field; 50-floor cap → 422 FLOOR_LIMIT_REACHED; deleted id re-created inside the restore window → 201; activity "floor.create"', async () => {
    // floors/router.py:30-35, schemas.py:16-86, service.py:76-156, errors.py:7-14, settings.py:156-157.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'floor-create', cleanup);
      const pid = String(project.id);
      const path = `/api/projects/${pid}/floors`;
      const id = newLevelId();
      const name = `  ${PREFIX}Tầng ma\u0301i  `;
      const created = await call(admin, 'floor_create_201', 'POST', path, { ...floorBody(id, 3, name), drawings: [{ junk: 1 }], areaM2: 99, heightMm: 2999.995 }, [
        '201 FloorOut: name trimmed + NFC, heightMm 2999.995 → 3000 (≤ 0.01 off, schemas.py:36-47), drawings/areaM2 ignored (W18), drawings []',
      ]);
      expect(created.res.status()).toBe(201);
      const out = expectFloorOut(created.body);
      expect.soft(out).toMatchObject({ id, name: `${PREFIX}Tầng mái`, order: 3, elevationMm: 9000, heightMm: 3000, drawings: [] });
      expect.soft(out, 'areaM2 from the body is not stored').not.toHaveProperty('areaM2');

      const taken = await call(admin, 'floor_create_taken_409', 'POST', path, floorBody(id, 4), ['409 FLOOR_ID_TAKEN field id (service.py:76-83)']);
      expectError(taken, 409, 'FLOOR_ID_TAKEN', { field: 'id' });

      const fresh = (): string => newLevelId();
      const cases: Array<[string, Json, string]> = [
        ['id_bad', floorBody('W-ABCDEFGHIJ', 0), 'id'],
        ['id_short', floorBody('L-ABC', 0), 'id'],
        ['id_lower', floorBody('L-abcdefghijkl', 0), 'id'],
        ['name_blank', floorBody(fresh(), 0, '   '), 'name'],
        ['name_121', floorBody(fresh(), 0, 'n'.repeat(121)), 'name'],
        ['name_rlo', floorBody(fresh(), 0, 'a\u202Eb'), 'name'],
        ['order_neg', floorBody(fresh(), -1), 'order'],
        ['order_1000', { ...floorBody(fresh(), 0), order: 1000 }, 'order'],
        ['elev_low', { ...floorBody(fresh(), 0), elevationMm: -30001 }, 'elevationMm'],
        ['elev_high', { ...floorBody(fresh(), 0), elevationMm: 300001 }, 'elevationMm'],
        ['height_low', { ...floorBody(fresh(), 0), heightMm: 1999 }, 'heightMm'],
        ['height_high', { ...floorBody(fresh(), 0), heightMm: 10001 }, 'heightMm'],
        ['height_frac', { ...floorBody(fresh(), 0), heightMm: 3000.5 }, 'heightMm'],
        ['height_string', { ...floorBody(fresh(), 0), heightMm: '3000' }, 'heightMm'],
        ['height_bool', { ...floorBody(fresh(), 0), heightMm: true }, 'heightMm'],
        ['height_missing', { id: fresh(), name: 'x', order: 0, elevationMm: 0 }, 'heightMm'],
        ['extra', { ...floorBody(fresh(), 0), foo: 1 }, 'foo'],
      ];
      for (const [slug, data, field] of cases) {
        const sent = await call(admin, `floor_create_${slug}_422`, 'POST', path, data, [`422 VALIDATION field "${field}" (floors/schemas.py)`]);
        expectError(sent, 422, 'VALIDATION', { field });
      }
      const pathMismatch = await call(admin, 'floor_create_projectid_422', 'POST', path, { ...floorBody(fresh(), 0), projectId: MISSING_PROJECT }, [
        '422 PATH_BODY_MISMATCH field projectId (W21, core/routing.py:138-151)',
      ]);
      expectError(pathMismatch, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      const longId = `L-${`${randomUUID()}${randomUUID()}${randomUUID()}`.replace(/-/gu, '').toUpperCase().slice(0, 64)}`;
      const edges = await call(admin, 'floor_create_bounds_201', 'POST', path, {
        id: longId, name: 'n'.repeat(120), order: 999, elevationMm: -30000, heightMm: 10000,
      }, ['201: 64-char id body, 120-char name, order 999, elevation −30000, height 10000 are inside the ranges']);
      expect.soft(edges.res.status()).toBe(201);
      const floors = await listFloors(admin, pid, 'floor_create_list');
      expect.soft(floors.map((f) => f.id).sort(), 'only the two 201 floors exist (no 422 wrote)').toEqual([id, longId].sort());

      // Restore: delete (#11) then POST the same id inside FLOOR_RESTORE_WINDOW_S 600 → 201 with the new body (service.py:53-73,127-131).
      const del = await call(admin, 'floor_create_delete_200', 'DELETE', `/api/floors/${id}`, undefined, ['setup: #11 soft delete → 200 snapshot']);
      expect(del.res.status()).toBe(200);
      const restored = await call(admin, 'floor_create_restore_201', 'POST', path, floorBody(id, 7, `${PREFIX}restored`), [
        '201: a soft-deleted id inside the restore window is restored with the new body, not 409 (service.py:53-73)',
      ]);
      expect.soft(restored.res.status()).toBe(201);
      expect.soft(asJson(restored.body)).toMatchObject({ id, name: `${PREFIX}restored`, order: 7 });
      expect.soft((await listFloors(admin, pid, 'floor_create_list_after')).filter((f) => f.id === id)).toHaveLength(1);
      const rows = await activityOf(admin, creatorId(project), id, 'floor_create_activity');
      expect.soft(rows.map((r) => r.kind)).toEqual(['floor.create', 'floor.delete', 'floor.create']);

      // Cap: a project created with 50 floors (hook, view_parts.py) → #10 → 422 FLOOR_LIMIT_REACHED (service.py:86-89).
      const full = await newProject(admin, 'floor-cap', cleanup, {
        floors: Array.from({ length: 50 }, (_, order) => ({ name: `F${String(order)}`, order, elevationMm: order * 3000, heightMm: 3000 })),
      });
      const cap = await call(admin, 'floor_create_cap_422', 'POST', `/api/projects/${String(full.id)}/floors`, floorBody(newLevelId(), 50), [
        '422 FLOOR_LIMIT_REACHED, no field: 50 live floors = FLOORS_MAX (settings.py:156)',
      ]);
      expect.soft(expectError(cap, 422, 'FLOOR_LIMIT_REACHED')).not.toHaveProperty('field');
      const missing = await call(admin, 'floor_create_missing_project_404', 'POST', `/api/projects/${MISSING_PROJECT}/floors`, floorBody(newLevelId(), 0), [
        '404 NOT_FOUND resource project (projects/access.py:82-83)',
      ]);
      expectError(missing, 404, 'NOT_FOUND', { resource: 'project' });
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · floors #34 PATCH spatial: one field at a time → 200 FloorOut + activity "floor.edit"; {} / same value / W18 echo → 200 without a write (updatedAt kept); explicit null / ranges / extra → 422 field; body id ≠ path → 422 PATH_BODY_MISMATCH id, floorId ≠ path → field floorId; unknown floor → 404 floor', async () => {
    // floors/router.py:67-78, schemas.py:59-104, service.py:263-322.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'floor-patch', cleanup);
      const pid = String(project.id);
      const fid = await newFloor(admin, pid, 'floor_patch_setup', 0);
      const path = `/api/projects/${pid}/floors/${fid}/spatial`;
      const patch = async (ev: string, data: unknown, claim: string, headers?: Record<string, string>): Promise<Sent> =>
        call(admin, ev, 'PATCH', path, data, [claim], headers);

      const before = await readProject(admin, pid, 'floor_patch_project_before');
      const renamed = await patch('floor_patch_name_200', { name: `  ${PREFIX}đổi tên  ` }, '200 FloorOut: name trimmed, other fields kept (service.py:269-289)');
      expect(renamed.res.status()).toBe(200);
      expect.soft(expectFloorOut(renamed.body)).toMatchObject({ id: fid, name: `${PREFIX}đổi tên`, order: 0, elevationMm: 0, heightMm: 3000 });
      const height = await patch('floor_patch_height_200', { heightMm: 3300 }, '200: heightMm alone');
      expect.soft(asJson(height.body)).toMatchObject({ name: `${PREFIX}đổi tên`, heightMm: 3300 });
      const elev = await patch('floor_patch_elevation_200', { elevationMm: -1500, id: fid }, '200: elevationMm alone; body id = path is accepted');
      expect.soft(asJson(elev.body)).toMatchObject({ elevationMm: -1500, heightMm: 3300 });
      const order = await patch('floor_patch_order_200', { order: 5 }, '200: order alone (set_floor_orders, service.py:310-311)');
      expect.soft(asJson(order.body).order).toBe(5);
      const afterWrites = await readProject(admin, pid, 'floor_patch_project_after');
      expect.soft(Date.parse(String(afterWrites.updatedAt))).toBeGreaterThan(Date.parse(String(before.updatedAt)));

      for (const [slug, data] of [['empty', {}], ['same', { name: `${PREFIX}đổi tên`, heightMm: 3300 }], ['echo', { drawings: [{ x: 1 }], areaM2: 12.5 }]] as const) {
        const sent = await patch(`floor_patch_noop_${slug}_200`, data, '200 FloorOut unchanged; no write, no activity, no touch (service.py:302-308)');
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body)).toMatchObject({ name: `${PREFIX}đổi tên`, order: 5, elevationMm: -1500, heightMm: 3300 });
      }
      const afterNoop = await readProject(admin, pid, 'floor_patch_project_noop');
      expect.soft(afterNoop.updatedAt, 'no-op PATCH does not touch the project').toBe(afterWrites.updatedAt);
      const rows = await activityOf(admin, creatorId(project), fid, 'floor_patch_activity');
      expect.soft(rows.map((r) => r.kind), 'one floor.edit per real change, newest first').toEqual(['floor.edit', 'floor.edit', 'floor.edit', 'floor.edit', 'floor.create']);
      expect.soft(rows[0]?.objectLabel).toBe(`${PREFIX}đổi tên`);

      const cases: Array<[string, Json, string]> = [
        ['name_null', { name: null }, 'name'],
        ['height_null', { heightMm: null }, 'heightMm'],
        ['id_null', { id: null }, 'id'],
        ['name_blank', { name: ' ' }, 'name'],
        ['name_121', { name: 'n'.repeat(121) }, 'name'],
        ['height_1999', { heightMm: 1999 }, 'heightMm'],
        ['height_frac', { heightMm: 2500.5 }, 'heightMm'],
        ['order_1000', { order: 1000 }, 'order'],
        ['elev_low', { elevationMm: -30001 }, 'elevationMm'],
        ['id_bad', { id: 'bad' }, 'id'],
        ['extra', { foo: 1 }, 'foo'],
        ['floorid_same', { floorId: fid }, 'floorId'],
      ];
      for (const [slug, data, field] of cases) {
        const sent = await patch(`floor_patch_${slug}_422`, data, `422 VALIDATION field "${field}" (floors/schemas.py:89-104; extra="forbid")`);
        expectError(sent, 422, 'VALIDATION', { field });
      }
      const other = newLevelId();
      const idMismatch = await patch('floor_patch_id_mismatch_422', { id: other, name: 'x' }, '422 PATH_BODY_MISMATCH field id (service.py:263-266)');
      expectError(idMismatch, 422, 'PATH_BODY_MISMATCH', { field: 'id' });
      const floorIdMismatch = await patch('floor_patch_floorid_mismatch_422', { floorId: other }, '422 PATH_BODY_MISMATCH field floorId (W21 guard, core/routing.py:138-151)');
      expectError(floorIdMismatch, 422, 'PATH_BODY_MISMATCH', { field: 'floorId' });
      const unknown = await call(admin, 'floor_patch_unknown_404', 'PATCH', `/api/projects/${pid}/floors/${newLevelId()}/spatial`, { name: 'x' }, [
        '404 NOT_FOUND resource floor (service.py:159-166)',
      ]);
      expectError(unknown, 404, 'NOT_FOUND', { resource: 'floor' });
      const final = (await listFloors(admin, pid, 'floor_patch_list')).find((f) => f.id === fid);
      expect.soft(final, 'the 422s changed nothing').toMatchObject({ name: `${PREFIX}đổi tên`, order: 5, elevationMm: -1500, heightMm: 3300 });
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · floors #13 reorder: permutation → 200 FloorOut[] in the new order + "floor.reorder"; same order → 200 without a write; subset / ids from two projects → 422 FLOOR_REORDER_MISMATCH floorIds; [] / duplicate / extra key / not an array → 422 VALIDATION floorIds; unknown id → 404 floor; one id live in two of my projects → 409 FLOOR_ID_AMBIGUOUS; truncated JSON → 400', async () => {
    // floors/router.py:52-64, resolvers.py:41-138, service.py:202-260, errors.py:10-17.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'reorder', cleanup);
      const pid = String(project.id);
      const [a, b, c] = [await newFloor(admin, pid, 'reorder_a', 0), await newFloor(admin, pid, 'reorder_b', 1), await newFloor(admin, pid, 'reorder_c', 2)];
      const reorder = async (ev: string, data: unknown, claim: string, headers?: Record<string, string>): Promise<Sent> =>
        call(admin, ev, 'PATCH', '/api/floors/reorder', data, [claim], headers);

      const before = await readProject(admin, pid, 'reorder_project_before');
      const moved = await reorder('reorder_cab_200', { floorIds: [c, a, b] }, '200 FloorOut[] sorted by the new order; order = index (service.py:213-260)');
      expect(moved.res.status()).toBe(200);
      const list = asArray(moved.body).map((f) => expectFloorOut(f));
      expect.soft(list.map((f) => [f.id, f.order])).toEqual([[c, 0], [a, 1], [b, 2]]);
      const after = await readProject(admin, pid, 'reorder_project_after');
      expect.soft(Date.parse(String(after.updatedAt))).toBeGreaterThan(Date.parse(String(before.updatedAt)));
      const same = await reorder('reorder_same_200', { floorIds: [c, a, b] }, '200: nothing changed → no write, no activity, no touch (service.py:246-260)');
      expect.soft(asArray(same.body).map((f) => asJson(f).id)).toEqual([c, a, b]);
      expect.soft((await readProject(admin, pid, 'reorder_project_same')).updatedAt).toBe(after.updatedAt);
      const rows = await activityOf(admin, creatorId(project), pid, 'reorder_activity');
      expect.soft(rows.filter((r) => r.kind === 'floor.reorder').length, 'exactly one floor.reorder row').toBe(1);

      const subset = await reorder('reorder_subset_422', { floorIds: [a, b] }, '422 FLOOR_REORDER_MISMATCH field floorIds: not the full live set (service.py:219-222)');
      expectError(subset, 422, 'FLOOR_REORDER_MISMATCH', { field: 'floorIds' });
      for (const [slug, data] of [
        ['empty', { floorIds: [] }],
        ['dup', { floorIds: [a, a, b] }],
        ['extra', { floorIds: [a, b, c], foo: 1 }],
        ['string', { floorIds: a }],
        ['number_item', { floorIds: [a, 1] }],
        ['missing', {}],
      ] as const) {
        const sent = await reorder(`reorder_${slug}_422`, data, '422 VALIDATION field floorIds: raw-body shape rule in the resolver (resolvers.py:80-107)');
        expectError(sent, 422, 'VALIDATION', { field: 'floorIds' });
      }
      const unknown = await reorder('reorder_unknown_404', { floorIds: [newLevelId()] }, '404 NOT_FOUND resource floor: no live floor of mine (resolvers.py:119-125)');
      expectError(unknown, 404, 'NOT_FOUND', { resource: 'floor' });
      const malformed = await reorder('reorder_malformed_400', '{"floorIds": [', '400 MALFORMED_JSON: FastAPI parses JSON before the resolver (schemas.py:111-113)', { 'Content-Type': 'application/json' });
      expectError(malformed, 400, 'MALFORMED_JSON');

      // A second project of mine: mixing its floor in → no project holds all ids → 422; the same level id in both → 409.
      const other = String((await newProject(admin, 'reorder-q', cleanup)).id);
      const q = await newFloor(admin, other, 'reorder_q', 0);
      const mixed = await reorder('reorder_two_projects_422', { floorIds: [a, b, c, q] }, '422 FLOOR_REORDER_MISMATCH: ids from two projects (resolvers.py:126-131)');
      expectError(mixed, 422, 'FLOOR_REORDER_MISMATCH', { field: 'floorIds' });
      const twin = await call(admin, 'reorder_twin_create_201', 'POST', `/api/projects/${other}/floors`, floorBody(a, 1), [
        '201: a level id is unique per project only (uq_floors_level), so project Q can hold P\'s id',
      ]);
      expect(twin.res.status()).toBe(201);
      const ambiguous = await reorder('reorder_ambiguous_409', { floorIds: [a] }, '409 FLOOR_ID_AMBIGUOUS: [a] is a full set of both projects (resolvers.py:126-128)');
      expectError(ambiguous, 409, 'FLOOR_ID_AMBIGUOUS');
      const final = await listFloors(admin, pid, 'reorder_list');
      expect.soft(final.map((f) => [f.id, f.order]), 'failed requests changed nothing').toEqual([[c, 0], [a, 1], [b, 2]]);
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · upload init #5 rules: empty MIME accepted (magic bytes decide later); unknown floor → 404 floor; .dwg or a dwg MIME → 422 CAD_NOT_SUPPORTED; other extension / MIME ≠ extension → 422 FILE_TYPE_MISMATCH; > 100 MiB → 413; pageIndex 1 on an image → 422 pageIndex; Pydantic fileName / sizeBytes / pageIndex / floorId rules; projectId ≠ path → 422 PATH_BODY_MISMATCH', async () => {
    // drawings/schemas.py:27-66, uploads.py:98-115,174-227, router.py:50-67. 13 inits on the admin's drawings_init bucket.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'init-rules', cleanup)).id);
      const fid = await newFloor(admin, pid, 'init_rules_floor', 0);
      const init = async (ev: string, over: Json, claim: string, floorId = fid): Promise<Sent> => initUpload(admin, ev, pid, floorId, over, [claim]);

      const blank = await init('init_blank_mime_200', { mimeType: '', sizeBytes: 10 }, '200 Progress pending: empty MIME is accepted (uploads.py:57-58,113)');
      expect(blank.res.status()).toBe(200);
      expect.soft(expectProgress(blank.body)).toMatchObject({ status: 'pending', step: 'preprocess', progressPercent: 0 });
      const unknownFloor = await init('init_unknown_floor_404', { fileName: 'x.dwg' }, '404 NOT_FOUND resource floor: floor checked before the file type (uploads.py:190-193)', newLevelId());
      expectError(unknownFloor, 404, 'NOT_FOUND', { resource: 'floor' });
      const dwg = await init('init_dwg_422', { fileName: `${PREFIX}plan.DWG`, mimeType: '' }, '422 CAD_NOT_SUPPORTED: .dwg extension, case-insensitive (uploads.py:106-109)');
      expectError(dwg, 422, 'CAD_NOT_SUPPORTED');
      const dwgMime = await init('init_dwg_mime_422', { mimeType: 'image/vnd.dwg' }, '422 CAD_NOT_SUPPORTED: MIME mentions dwg even on .png');
      expectError(dwgMime, 422, 'CAD_NOT_SUPPORTED');
      const txt = await init('init_txt_422', { fileName: `${PREFIX}notes.txt`, mimeType: 'text/plain' }, '422 FILE_TYPE_MISMATCH: extension outside png/jpg/jpeg/pdf (uploads.py:110-112)');
      expectError(txt, 422, 'FILE_TYPE_MISMATCH');
      const lie = await init('init_mime_mismatch_422', { mimeType: 'image/jpeg' }, '422 FILE_TYPE_MISMATCH: declared MIME ≠ the extension\'s (uploads.py:113-114)');
      expectError(lie, 422, 'FILE_TYPE_MISMATCH');
      const big = await init('init_too_big_413', { sizeBytes: UPLOAD_MAX_BYTES + 1 }, '413 PAYLOAD_TOO_LARGE: sizeBytes > UPLOAD_MAX_BYTES (uploads.py:195-196)');
      expectError(big, 413, 'PAYLOAD_TOO_LARGE');
      const page = await init('init_page_on_image_422', { pageIndex: 1 }, '422 VALIDATION field pageIndex: pages only for PDF (uploads.py:197-198)');
      expectError(page, 422, 'VALIDATION', { field: 'pageIndex' });
      const pydantic: Array<[string, Json, string]> = [
        ['name_slash', { fileName: 'a/b.png' }, 'fileName'],
        ['size_0', { sizeBytes: 0 }, 'sizeBytes'],
        ['page_20', { fileName: 'a.pdf', mimeType: 'application/pdf', pageIndex: 20 }, 'pageIndex'],
      ];
      for (const [slug, over, field] of pydantic) {
        const sent = await init(`init_${slug}_422`, over, `422 VALIDATION field "${field}" (schemas.py:34-66)`);
        expectError(sent, 422, 'VALIDATION', { field });
      }
      const noFloorId = await call(admin, 'init_no_floorid_422', 'POST', `/api/projects/${pid}/floors/${fid}/drawings/uploads`, {
        fileName: 'a.png', mimeType: 'image/png', projectId: pid, sizeBytes: 1,
      }, ['422 VALIDATION field floorId: required in the body even though it is in the path (schemas.py:62)']);
      expectError(noFloorId, 422, 'VALIDATION', { field: 'floorId' });
      const projMismatch = await init('init_projectid_mismatch_422', { projectId: MISSING_PROJECT }, '422 PATH_BODY_MISMATCH field projectId (W21, routing.py:138-151)');
      expectError(projMismatch, 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      note('init budget: 13 counted requests on the admin bucket here (the unknown-floor 404 passes the gate and counts too)');
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · upload init dedupe: two identical inits within UPLOAD_INIT_DEDUPE_S → the same upload id; once that upload has a chunk, the same init opens a new upload; activity "floor.upload" once per new upload', async () => {
    // drawings/uploads.py:145-171,200-202, settings.py:132. 3 inits on the admin bucket.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'dedupe', cleanup);
      const pid = String(project.id);
      const fid = await newFloor(admin, pid, 'dedupe_floor', 0);
      const over = { fileName: `${PREFIX}dedupe.png`, sizeBytes: 64 };
      const first = await initUpload(admin, 'dedupe_first_200', pid, fid, over, ['200 Progress pending, new upl_ id']);
      const second = await initUpload(admin, 'dedupe_second_same_200', pid, fid, over, ['200: same floor/user/name/size/MIME/page, receiving, no chunk → the same id (uploads.py:145-171)']);
      expect(first.res.status()).toBe(200);
      const id1 = String(asJson(first.body).id);
      expect.soft(asJson(second.body).id).toBe(id1);
      const chunk = await sendChunk(admin, 'dedupe_chunk_200', pid, id1, Buffer.alloc(10, 1), 0, ['200: one chunk received (last chunk may be short)']);
      expect.soft(chunk.res.status()).toBe(200);
      const third = await initUpload(admin, 'dedupe_third_new_200', pid, fid, over, ['200 with a NEW id: the twin already has a chunk (uploads.py:149-150,154)']);
      expect.soft(third.res.status()).toBe(200);
      expect.soft(asJson(third.body).id).not.toBe(id1);
      const rows = await activityOf(admin, creatorId(project), fid, 'dedupe_activity');
      expect.soft(rows.filter((r) => r.kind === 'floor.upload').length, 'one floor.upload per NEW upload (uploads.py:218-226)').toBe(2);
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · chunks #6 + complete #7 bookkeeping: chunkIndex ≥ chunk_count / −1 → 422 chunkIndex; empty / non-base64 / short non-final chunk → 422 chunk; resend of an index overwrites; complete with a missing index → 422 UPLOAD_INCOMPLETE count; total ≠ sizeBytes → 422 UPLOAD_SIZE_MISMATCH (upload stays receiving); uploadId ≠ path → 422 PATH_BODY_MISMATCH; unknown / malformed upload → 404 upload', async () => {
    // drawings/uploads.py:118-142,230-296, complete.py:113-131,286-305, schemas.py:69-79. 2 inits on the admin bucket.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'chunks', cleanup)).id);
      const fid = await newFloor(admin, pid, 'chunks_floor', 0);
      const size = CHUNK_BYTES + 3; // chunk_count 2 (uploads.py:212)
      const init = await initUpload(admin, 'chunks_init_200', pid, fid, { fileName: `${PREFIX}two-chunks.png`, sizeBytes: size }, [
        '200 Progress pending; chunk_count = ceil(size / 5 MiB) = 2',
      ]);
      expect(init.res.status()).toBe(200);
      const uid = String(asJson(init.body).id);
      const chunkPath = `/api/projects/${pid}/drawings/uploads/${uid}/chunks`;
      const raw = async (ev: string, data: unknown, claim: string): Promise<Sent> => call(admin, ev, 'POST', chunkPath, data, [claim]);

      expectError(await raw('chunks_index_2_422', { chunk: 'AAAA', chunkIndex: 2 }, '422 field chunkIndex: index ≥ chunk_count (uploads.py:285-286)'), 422, 'VALIDATION', { field: 'chunkIndex' });
      expectError(await raw('chunks_index_neg_422', { chunk: 'AAAA', chunkIndex: -1 }, '422 field chunkIndex: ge=0 (schemas.py:73)'), 422, 'VALIDATION', { field: 'chunkIndex' });
      expectError(await raw('chunks_empty_422', { chunk: '', chunkIndex: 1 }, '422 field chunk: min_length 1 (schemas.py:72)'), 422, 'VALIDATION', { field: 'chunk' });
      expectError(await raw('chunks_not_b64_422', { chunk: '!!!not base64', chunkIndex: 1 }, '422 field chunk: b64decode(validate=True) fails (uploads.py:237-240)'), 422, 'VALIDATION', { field: 'chunk' });
      expectError(await raw('chunks_short_middle_422', { chunk: Buffer.alloc(10).toString('base64'), chunkIndex: 0 }, '422 field chunk: a non-final chunk must be exactly 5 MiB (uploads.py:243-244)'), 422, 'VALIDATION', { field: 'chunk' });
      expectError(await raw('chunks_extra_422', { chunk: 'AAAA', chunkIndex: 1, foo: 1 }, '422 field foo: extra="forbid"'), 422, 'VALIDATION', { field: 'foo' });
      const last = await sendChunk(admin, 'chunks_last_200', pid, uid, Buffer.from([1, 2, 3]), 1, ['200 Progress pending: the last chunk may be short']);
      expect.soft(expectProgress(last.body, uid).status).toBe('pending');
      const again = await sendChunk(admin, 'chunks_last_resend_200', pid, uid, Buffer.from([4, 5, 6]), 1, ['200: resending an index overwrites it (upsert, U10, uploads.py:248-270)']);
      expect.soft(again.res.status()).toBe(200);

      const incomplete = await complete(admin, 'chunks_complete_incomplete_422', pid, uid, ['422 UPLOAD_INCOMPLETE count 1: index 0 missing (complete.py:126-128)']);
      const incBody = expectError(incomplete, 422, 'UPLOAD_INCOMPLETE');
      expect.soft(incBody.count).toBe(1);
      expect.soft((await progressOf(admin, 'chunks_progress_still_pending', pid, uid, '200: still pending (receiving) after UPLOAD_INCOMPLETE')).status).toBe('pending');
      const mismatch = await call(admin, 'chunks_complete_path_mismatch_422', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/complete`, { uploadId: MISSING_UPLOAD }, [
        '422 PATH_BODY_MISMATCH field uploadId (W21)',
      ]);
      expectError(mismatch, 422, 'PATH_BODY_MISMATCH', { field: 'uploadId' });
      const emptyComplete = await call(admin, 'chunks_complete_no_uploadid_422', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/complete`, {}, [
        '422 VALIDATION field uploadId: required (schemas.py:76-79)',
      ]);
      expectError(emptyComplete, 422, 'VALIDATION', { field: 'uploadId' });

      // Size mismatch: 1 chunk declared 10 bytes, 20 sent (≤ 5 MiB, last chunk) → complete 422 UPLOAD_SIZE_MISMATCH.
      const small = await initUpload(admin, 'chunks_size_init_200', pid, fid, { fileName: `${PREFIX}size.png`, sizeBytes: 10 }, ['200 Progress pending, 1 chunk']);
      const sid = String(asJson(small.body).id);
      const twenty = await sendChunk(admin, 'chunks_size_chunk_200', pid, sid, Buffer.concat([PNG_SIGNATURE, Buffer.alloc(12)]), 0, ['200: 20 bytes ≤ chunk size are accepted']);
      expect.soft(twenty.res.status()).toBe(200);
      const sizeErr = await complete(admin, 'chunks_complete_size_mismatch_422', pid, sid, ['422 UPLOAD_SIZE_MISMATCH: 20 ≠ 10 declared (complete.py:129-130)']);
      expectError(sizeErr, 422, 'UPLOAD_SIZE_MISMATCH');
      expect.soft((await progressOf(admin, 'chunks_size_progress', pid, sid, '200 pending: UPLOAD_SIZE_MISMATCH keeps receiving')).status).toBe('pending');

      for (const [slug, upl] of [['unknown', MISSING_UPLOAD], ['malformed', 'not-an-upload']] as const) {
        const c = await sendChunk(admin, `chunks_${slug}_chunk_404`, pid, upl, Buffer.from([1]), 0, ['404 NOT_FOUND resource upload (uploads.py:118-142)']);
        expectError(c, 404, 'NOT_FOUND', { resource: 'upload' });
        const d = await complete(admin, `chunks_${slug}_complete_404`, pid, upl, ['404 NOT_FOUND resource upload']);
        expectError(d, 404, 'NOT_FOUND', { resource: 'upload' });
        const p = await call(admin, `chunks_${slug}_progress_404`, 'GET', `/api/projects/${pid}/drawings/uploads/${upl}/progress`, undefined, ['404 NOT_FOUND resource upload (#8)']);
        expectError(p, 404, 'NOT_FOUND', { resource: 'upload' });
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · complete #7 judges magic bytes, not the name: text as .png → 422 FILE_TYPE_MISMATCH, PNG without IEND → 422 FILE_CORRUPT, DWG bytes renamed .png → 422 CAD_NOT_SUPPORTED; each upload is kept "rejected" → #8 failed + error code; a chunk after → 422 UPLOAD_NOT_RECEIVING; complete again → 200 the failed Progress', async () => {
    // drawings/complete.py:144-153,197-218,227-239,286-312, progress.py:53-54, uploads.py:255-261,283-284. 3 inits.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'reject', cleanup)).id);
      const fid = await newFloor(admin, pid, 'reject_floor', 0);
      const cases: Array<[string, Buffer, string]> = [
        ['type', Buffer.from('hello, this is not a picture'), 'FILE_TYPE_MISMATCH'],
        ['corrupt', Buffer.concat([PNG_SIGNATURE, Buffer.alloc(40, 7)]), 'FILE_CORRUPT'],
        ['cad', Buffer.concat([Buffer.from('AC1027'), Buffer.alloc(40)]), 'CAD_NOT_SUPPORTED'],
      ];
      for (const [slug, bytes, code] of cases) {
        const uid = await receivingUpload(admin, `reject_${slug}`, pid, fid, bytes, `${PREFIX}reject-${slug}.png`);
        const done = await complete(admin, `reject_${slug}_complete_422`, pid, uid, [`422 ${code}: sniff_kind / end marker (complete.py:144-153,214-215), returned not raised so the row stays rejected`]);
        expect.soft(expectError(done, 422, code)).not.toHaveProperty('field');
        const p = await progressOf(admin, `reject_${slug}_progress_failed`, pid, uid, `200 Progress failed, error ${code}, step preprocess, 0 % (progress.py:53-54)`);
        expect.soft(p).toEqual({ id: uid, status: 'failed', step: 'preprocess', progressPercent: 0, error: code });
        if (slug === 'type') {
          const late = await sendChunk(admin, 'reject_type_late_chunk_422', pid, uid, bytes, 0, ['422 UPLOAD_NOT_RECEIVING: the upload is rejected (uploads.py:283-284)']);
          expectError(late, 422, 'UPLOAD_NOT_RECEIVING');
          const replay = await complete(admin, 'reject_type_complete_again_200', pid, uid, ['200 the current (failed) Progress, no effect (complete.py:303-304)']);
          expect.soft(replay.res.status()).toBe(200);
          expect.soft(asJson(replay.body)).toMatchObject({ status: 'failed', error: code });
        }
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · happy path with drawing.png: init → chunk → complete 200 pending → S1 SSE snapshot then frames until a final status (completed or failed, W15 frames) = #8; complete again → 200 without a 2nd run; activity floor.upload + floor.upload_complete once; quality #30 + signed file URL when completed; another project\'s path with this upload → 404 upload on #6/#7/#8/S1', async () => {
    // drawings/complete.py:242-312, runs.py:218-256, progress.py:33-68; streams/router.py:118-140, sse.py:234-262,
    // 279-312,408-427; drawings/stream_providers.py:37-72; quality/router.py:30-37, assessments.py:248-279; files/router.py.
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'pipeline', cleanup);
      const pid = String(project.id);
      const fid = await newFloor(admin, pid, 'pipeline_floor', 0);
      const png = drawingPng();
      expect(png.length, 'drawing.png fits one chunk').toBeLessThanOrEqual(CHUNK_BYTES);
      const uid = await receivingUpload(admin, 'pipeline', pid, fid, png, `${PREFIX}drawing.png`);
      const done = await complete(admin, 'pipeline_complete_200', pid, uid, ['200 Progress pending (start_run inserts a pending run, runs.py:234-241; progress.py:51-52)']);
      expect(done.res.status()).toBe(200);
      expect.soft(expectProgress(done.body, uid)).toEqual({ id: uid, status: 'pending', step: 'preprocess', progressPercent: 0 });

      const cookie = await streamCookieOf(admin);
      const streamPath = `/api/streams/projects/${pid}/uploads/${uid}/progress`;
      const isFinal = (f: SseFrame): boolean => f.data.status === 'completed' || f.data.status === 'failed';
      const stream = await readSse(streamPath, { cookie, until: isFinal, timeoutMs: PIPELINE_TIMEOUT_MS });
      await captureStream('pipeline_sse_frames', streamPath, { cookie: '<admin stream cookie>' }, stream, [
        '200 text/event-stream, Cache-Control no-store; first frame = snapshot Progress (S08), then events until completed|failed',
      ]);
      expect(stream.status).toBe(200);
      expect.soft(stream.headers['content-type'] ?? '').toContain('text/event-stream');
      expect.soft(stream.headers['cache-control'] ?? '').toContain('no-store');
      expect(stream.closed, `final status within ${String(PIPELINE_TIMEOUT_MS)} ms`).toBe('until');
      for (const frame of stream.frames) {
        expect.soft(frame.id.length, 'every frame has an id').toBeGreaterThan(0);
        expectProgress(frame.data, uid);
      }
      const finalFrame = stream.frames[stream.frames.length - 1];
      const finalData = asJson(finalFrame?.data);
      note(`pipeline final status: ${String(finalData.status)}${finalData.error === undefined ? '' : ` (${String(finalData.error)})`}`);
      if (finalData.status === 'completed') {
        expect.soft(finalData).toMatchObject({ step: 'qualityCheck', progressPercent: 100 });
        expect.soft(typeof finalData.endedAt).toBe('string');
      }
      const read = await progressOf(admin, 'pipeline_progress_final', pid, uid, '200 #8 = the last SSE frame (one source, progress.py:71-115)');
      expect.soft(read).toEqual(finalData);

      const replay = await complete(admin, 'pipeline_complete_again_200', pid, uid, ['200 the current Progress; status ≠ receiving → no 2nd run (complete.py:302-304)']);
      expect.soft(replay.res.status()).toBe(200);
      expect.soft(asJson(replay.body)).toEqual(finalData);
      const rows = await activityOf(admin, creatorId(project), fid, 'pipeline_activity');
      expect.soft(rows.filter((r) => r.kind === 'floor.upload').length).toBe(1);
      expect.soft(rows.filter((r) => r.kind === 'floor.upload_complete').length, 'one upload_complete for two completes').toBe(1);

      const quality = await call(admin, 'pipeline_quality', 'GET', `/api/projects/${pid}/floors/${fid}/quality`, undefined, [
        'completed → 200 {projectId, floorId, floors[≥1]} with this floor and a sourceUrl (assessments.py:248-279); failed before a drawing → 404 upload',
      ]);
      if (finalData.status === 'completed') {
        expect.soft(quality.res.status()).toBe(200);
        const q = expectKeys(quality.body, ['floorId', 'floors', 'projectId']);
        expect.soft(q).toMatchObject({ projectId: pid, floorId: fid });
        const floor = asArray(q.floors).map((f) => asJson(f)).find((f) => f.floorId === fid);
        const url = String(floor?.sourceUrl ?? '');
        expect.soft(url.length).toBeGreaterThan(0);
        // The QA stack signs MinIO URLs (S3 backend, files/router.py:34-36); a local-disk backend signs /api/files/{token}.
        // Only the host is written down — the query string is the signature.
        note(`sourceUrl host: ${url.startsWith('/') ? 'same origin' : new URL(url).host}`);
        const files = url.startsWith('/') ? admin : await request.newContext();
        const file = await files.get(url);
        expect.soft(file.status(), 'the signed page URL serves the drawing').toBe(200);
        expect.soft(file.headers()['content-type'] ?? '').toMatch(/^image\//u);
        await file.dispose();
        if (files !== admin) await files.dispose();
      } else {
        note('pipeline ended failed: quality #30 / file URL checks skipped');
      }

      // IDOR across my own projects: the upload belongs to P; Q's path must not reach it (uploads.py:118-142, stream_providers.py:48-62).
      const q2 = String((await newProject(admin, 'pipeline-q', cleanup)).id);
      expectError(await sendChunk(admin, 'pipeline_other_project_chunk_404', q2, uid, png, 0, ['404 upload: upload of another project']), 404, 'NOT_FOUND', { resource: 'upload' });
      expectError(await complete(admin, 'pipeline_other_project_complete_404', q2, uid, ['404 upload']), 404, 'NOT_FOUND', { resource: 'upload' });
      const crossProgress = await call(admin, 'pipeline_other_project_progress_404', 'GET', `/api/projects/${q2}/drawings/uploads/${uid}/progress`, undefined, ['404 upload (#8)']);
      expectError(crossProgress, 404, 'NOT_FOUND', { resource: 'upload' });
      const crossPath = `/api/streams/projects/${q2}/uploads/${uid}/progress`;
      const cross = await readSse(crossPath, { cookie, until: () => true, timeoutMs: 15_000 });
      await captureStream('pipeline_other_project_sse_404', crossPath, { cookie: '<admin stream cookie>' }, cross, ['404 NOT_FOUND resource upload (stream_providers.py:48-62)']);
      expect.soft(cross.status).toBe(404);
      expect.soft(errBody(cross.errorBody)).toMatchObject({ code: 'NOT_FOUND', resource: 'upload' });
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · S1 SSE gates on a receiving upload: no Origin and same Origin → 200 with the snapshot frame = #8 (pending); foreign Origin → 403 ORIGIN_MISMATCH; malformed project / upload id → 404 upload; unknown upload → 404 upload; quality #30 without a drawing → 404 upload, unknown floor → 404 floor; straighten #32 without a drawing → 404 upload, extra key → 422', async () => {
    // streams/router.py:118-140, sse.py:161-169,234-262,299-311, stream_providers.py:37-72; quality/router.py:30-56, service.py:125-140.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'sse-gates', cleanup)).id);
      const fid = await newFloor(admin, pid, 'sse_gates_floor', 0);
      const init = await initUpload(admin, 'sse_gates_init_200', pid, fid, { sizeBytes: 50 }, ['setup: 200 Progress pending (receiving)']);
      expect(init.res.status()).toBe(200);
      const uid = String(asJson(init.body).id);
      const cookie = await streamCookieOf(admin);
      const pathOf = (p: string, u: string): string => `/api/streams/projects/${p}/uploads/${u}/progress`;
      const first = (): boolean => true;
      const expected = await progressOf(admin, 'sse_gates_progress', pid, uid, '200 #8 pending');

      for (const [slug, origin] of [['no_origin', undefined], ['same_origin', apiBaseUrl()]] as const) {
        const r = await readSse(pathOf(pid, uid), { cookie, ...(origin === undefined ? {} : { origin }), until: first, timeoutMs: 20_000 });
        await captureStream(`sse_gates_${slug}_200`, pathOf(pid, uid), { origin: origin ?? 'absent', cookie: '<admin stream cookie>' }, r, [
          '200 text/event-stream; a missing Origin is allowed for EventSource (K31); first frame = snapshot (S08) equal to #8',
        ]);
        expect.soft(r.status).toBe(200);
        expect.soft(r.headers['content-type'] ?? '').toContain('text/event-stream');
        expect.soft(r.frames[0]?.data).toEqual(expected);
      }
      const foreign = await readSse(pathOf(pid, uid), { cookie, origin: FOREIGN_ORIGIN, until: first, timeoutMs: 15_000 });
      await captureStream('sse_gates_foreign_origin_403', pathOf(pid, uid), { origin: FOREIGN_ORIGIN, cookie: '<admin stream cookie>' }, foreign, ['403 ORIGIN_MISMATCH (core/origin.py:59-62)']);
      expect.soft(foreign.status).toBe(403);
      expect.soft(errBody(foreign.errorBody).code).toBe('ORIGIN_MISMATCH');
      for (const [slug, p, u] of [['bad_project', 'nope', uid], ['bad_upload', pid, 'nope'], ['unknown_upload', pid, MISSING_UPLOAD], ['unknown_project', MISSING_PROJECT, uid]] as const) {
        const r = await readSse(pathOf(p, u), { cookie, until: first, timeoutMs: 15_000 });
        await captureStream(`sse_gates_${slug}_404`, pathOf(p, u), { cookie: '<admin stream cookie>' }, r, [
          '404 NOT_FOUND resource upload: id pattern (router.py:129-130) or membership/upload lookup (stream_providers.py:48-62)',
        ]);
        expect.soft(r.status, slug).toBe(404);
        expect.soft(errBody(r.errorBody), slug).toMatchObject({ code: 'NOT_FOUND', resource: 'upload' });
      }

      const noDrawing = await call(admin, 'sse_gates_quality_no_drawing_404', 'GET', `/api/projects/${pid}/floors/${fid}/quality`, undefined, [
        '404 NOT_FOUND resource upload: no floor of the project has a drawing yet (assessments.py:273-275)',
      ]);
      expectError(noDrawing, 404, 'NOT_FOUND', { resource: 'upload' });
      const noFloor = await call(admin, 'sse_gates_quality_unknown_floor_404', 'GET', `/api/projects/${pid}/floors/${newLevelId()}/quality`, undefined, [
        '404 NOT_FOUND resource floor (quality/router.py:35-36)',
      ]);
      expectError(noFloor, 404, 'NOT_FOUND', { resource: 'floor' });
      const straighten = await call(admin, 'sse_gates_straighten_no_drawing_404', 'POST', `/api/projects/${pid}/floors/${fid}/quality/straighten`, {}, [
        '404 NOT_FOUND resource upload: no current drawing (quality/service.py:137-140)',
      ]);
      expectError(straighten, 404, 'NOT_FOUND', { resource: 'upload' });
      const straightenExtra = await call(admin, 'sse_gates_straighten_extra_422', 'POST', `/api/projects/${pid}/floors/${fid}/quality/straighten`, { foo: 1 }, [
        '422 VALIDATION field foo: body must be {} (quality/schemas.py:95-96)',
      ]);
      expectError(straightenExtra, 422, 'VALIDATION', { field: 'foo' });
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · gaps: complete #7 PDF branches (pdfium) — 21 pages → 422 VALIDATION without field; 1 page with pageIndex 1 → 422 VALIDATION field pageIndex; /Count 0 → 422 PDF_UNREADABLE; %PDF- header + garbage + %%EOF → 422 FILE_CORRUPT; each upload kept "rejected" → #8 failed + that code', async () => {
    // drawings/complete.py:52-53,172-194 (_check_pages / _page_count), 197-218, 227-239 (_reject returns, row kept);
    // packages/vision/preprocess/pdf.py:30-50 (SUCCESS/PASSWORD/SECURITY → PDF_UNREADABLE, else FILE_CORRUPT), 53-60;
    // sniff.py:37-38 ("%PDF-" in the first 1 KiB); uploads.py:197-198 (pageIndex ≠ 0 refused only for images);
    // progress.py:53-54. BE unit twins: packages/vision/preprocess/tests/test_pdf.py:25-50. 4 inits.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'pdf', cleanup)).id);
      const fid = await newFloor(admin, pid, 'pdf_floor', 0);
      const garbage = Buffer.from(`%PDF-1.4\n${'\u0001\u0002\u0003garbage'.repeat(40)}\n%%EOF\n`, 'latin1');
      const cases: ReadonlyArray<{ slug: string; bytes: Buffer; pageIndex: number; code: string; field?: string; claim: string }> = [
        { slug: 'pages21', bytes: makePdf(21), pageIndex: 0, code: 'VALIDATION', claim: '21 pages > PDF_PAGE_MAX 20 → 422 VALIDATION, no field (complete.py:52-53,181-182)' },
        { slug: 'page_index', bytes: makePdf(1), pageIndex: 1, code: 'VALIDATION', field: 'pageIndex', claim: 'pageIndex 1 ≥ 1 page → 422 VALIDATION field pageIndex (complete.py:183-184)' },
        { slug: 'zero_pages', bytes: makePdf(0), pageIndex: 0, code: 'PDF_UNREADABLE', claim: '/Count 0 opens with err SUCCESS → 422 PDF_UNREADABLE (pdf.py:30-50)' },
        { slug: 'garbage', bytes: garbage, pageIndex: 0, code: 'FILE_CORRUPT', claim: '%PDF- + garbage, %%EOF present (end marker passes) → pdfium FORMAT → 422 FILE_CORRUPT (pdf.py:44-50)' },
      ];
      for (const c of cases) {
        const init = await initUpload(admin, `pdf_${c.slug}_init`, pid, fid, {
          fileName: `${PREFIX}${c.slug}.pdf`, mimeType: 'application/pdf', sizeBytes: c.bytes.length, pageIndex: c.pageIndex,
        }, [`setup: 200 Progress pending; a .pdf may carry pageIndex ${String(c.pageIndex)} (uploads.py:197-198)`]);
        expect(init.res.status(), `${c.slug} init`).toBe(200);
        const uid = String(asJson(init.body).id);
        const chunk = await sendChunk(admin, `pdf_${c.slug}_chunk`, pid, uid, c.bytes, 0, ['setup: 200 Progress pending']);
        expect(chunk.res.status(), `${c.slug} chunk`).toBe(200);
        const done = await complete(admin, `pdf_${c.slug}_complete_422`, pid, uid, [c.claim, 'returned (not raised) → the upload row stays rejected (complete.py:227-239)']);
        const body = expectError(done, 422, c.code, c.field === undefined ? {} : { field: c.field });
        if (c.field === undefined) expect.soft(body, `${c.slug}: no field`).not.toHaveProperty('field');
        const p = await progressOf(admin, `pdf_${c.slug}_progress_failed`, pid, uid, `200 Progress failed, error ${c.code} = rejected_code (progress.py:53-54)`);
        expect.soft(p, c.slug).toEqual({ id: uid, status: 'failed', step: 'preprocess', progressPercent: 0, error: c.code });
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · gaps: concurrent writers — two N6 PUTs on one base (0 = INSERT … ON CONFLICT DO NOTHING, 1 = UPDATE … WHERE revision) → exactly one 200, the other 409 VERSION_CONFLICT with the winner revision; two #10 creates of one floor id → one 201, one 409 FLOOR_ID_TAKEN field id; one activity row per win', async () => {
    // project_settings/service.py:57-76 (_try_write), 79-85 (repeat = same writer AND same digest), 101-119;
    // floors/service.py:76-96 (_check_not_taken / unique-violation → FLOOR_ID_TAKEN), 134-156 (lock_project_floors).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'race', cleanup);
      const pid = String(project.id);
      const path = `/api/projects/${pid}/settings`;

      for (const [base, typeA, typeB] of [[0, 'commercial', 'industrial'], [1, 'mixed', 'other']] as const) {
        const claim = `one of the pair: 200 revision ${String(base + 1)} or 409 VERSION_CONFLICT currentVersion ${String(base + 1)} (different bodies → never a repeat)`;
        const [a, b] = await Promise.all([
          call(admin, `race_set_base${String(base)}_a`, 'PUT', path, { baseVersion: base, body: settingsBody({ buildingType: typeA }) }, [claim]),
          call(admin, `race_set_base${String(base)}_b`, 'PUT', path, { baseVersion: base, body: settingsBody({ buildingType: typeB }) }, [claim]),
        ]);
        expect.soft([a.res.status(), b.res.status()].sort(), `base ${String(base)}: one winner`).toEqual([200, 409]);
        const [winner, loser, winType] = a.res.status() === 200 ? [a, b, typeA] : [b, a, typeB];
        expect.soft(asJson(winner.body)).toMatchObject({ revision: base + 1, buildingType: winType });
        const conflict = expectError(loser, 409, 'VERSION_CONFLICT');
        expect.soft(conflict.currentVersion, `base ${String(base)}: loser sees the winner`).toBe(base + 1);
        expect.soft(conflict.remoteChanges).toEqual([]);
        const read = await call(admin, `race_set_read_base${String(base)}`, 'GET', path, undefined, [`200 N5 = the winner's body, revision ${String(base + 1)}`]);
        expect.soft(asJson(read.body)).toMatchObject({ revision: base + 1, buildingType: winType });
      }
      const setRows = await activityOf(admin, creatorId(project), pid, 'race_set_activity');
      expect.soft(setRows.filter((r) => r.kind === 'project.settings_update').length, 'one row per win, none for a 409').toBe(2);

      const fid = newLevelId();
      const floorsPath = `/api/projects/${pid}/floors`;
      const floorClaim = 'one of the pair: 201 FloorOut or 409 FLOOR_ID_TAKEN field id (advisory lock serialises, service.py:139-141)';
      const [fa, fb] = await Promise.all([
        call(admin, 'race_floor_a', 'POST', floorsPath, floorBody(fid, 0, `${PREFIX}race-a`), [floorClaim]),
        call(admin, 'race_floor_b', 'POST', floorsPath, floorBody(fid, 1, `${PREFIX}race-b`), [floorClaim]),
      ]);
      expect.soft([fa.res.status(), fb.res.status()].sort(), 'one floor created').toEqual([201, 409]);
      const [created, refused] = fa.res.status() === 201 ? [fa, fb] : [fb, fa];
      const winner = expectFloorOut(created.body);
      expectError(refused, 409, 'FLOOR_ID_TAKEN', { field: 'id' });
      const live = (await listFloors(admin, pid, 'race_floor_list')).filter((f) => f.id === fid);
      expect.soft(live, 'exactly one live floor with that id').toHaveLength(1);
      expect.soft(live[0]?.name).toBe(winner.name);
      const floorRows = await activityOf(admin, creatorId(project), fid, 'race_floor_activity');
      expect.soft(floorRows.map((r) => r.kind), 'one floor.create').toEqual(['floor.create']);
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · gaps: S1 lastEventId never silences a fresh open (malformed, "0-0" on an empty stream, beyond the tail → the snapshot frame with id = tail); a soft-deleted floor hides its upload → #6 / #7 / #8 / S1 404 upload; re-creating that floor id inside the restore window brings the same upload back (#8 200)', async () => {
    // streams/router.py:37 (query lastEventId), 118-140; sse.py:279-311 (resolve_start, snapshot id = tail);
    // packages/messaging/streams.py:23-24,45-47,168-179 (empty stream → tail "0-0", is_trimmed True);
    // drawings/uploads.py:118-142 (load_upload joins a LIVE floor), stream_providers.py:43-62; floors/router.py:38-43,
    // service.py:53-73,118-131 (restore keeps the floor pk), 174-194. 1 init.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'gone-floor', cleanup)).id);
      const fid = await newFloor(admin, pid, 'gone_floor_floor', 0);
      const init = await initUpload(admin, 'gone_floor_init_200', pid, fid, { sizeBytes: 50 }, ['setup: 200 Progress pending (receiving)']);
      expect(init.res.status()).toBe(200);
      const uid = String(asJson(init.body).id);
      const cookie = await streamCookieOf(admin);
      const streamPath = `/api/streams/projects/${pid}/uploads/${uid}/progress`;
      const first = (): boolean => true;
      const expected = await progressOf(admin, 'gone_floor_progress', pid, uid, '200 #8 pending');

      const plain = await readSse(streamPath, { cookie, until: first, timeoutMs: 20_000 });
      await captureStream('gone_floor_sse_plain_200', streamPath, { cookie: '<admin stream cookie>' }, plain, ['200; first frame = snapshot with id = stream tail (S08)']);
      expect(plain.status).toBe(200);
      const tail = plain.frames[0]?.id ?? '';
      expect.soft(plain.frames[0]?.data).toEqual(expected);
      for (const [slug, value] of [['malformed', 'not-an-id'], ['first_id', '0-0'], ['beyond_tail', '99999999999999-0']] as const) {
        const path = `${streamPath}?lastEventId=${encodeURIComponent(value)}`;
        const r = await readSse(path, { cookie, until: first, timeoutMs: 20_000 });
        await captureStream(`gone_floor_sse_last_${slug}_200`, path, { lastEventId: value, cookie: '<admin stream cookie>' }, r, [
          'lastEventId used only if well-formed, ≤ tail AND not trimmed (sse.py:286-292); else snapshot frame, id = tail',
        ]);
        expect.soft(r.status, slug).toBe(200);
        expect.soft(r.closed, `${slug}: a frame arrived`).toBe('until');
        expect.soft(r.frames[0]?.id, `${slug}: id = tail`).toBe(tail);
        expect.soft(r.frames[0]?.data, `${slug}: snapshot = #8`).toEqual(expected);
      }

      const del = await call(admin, 'gone_floor_delete_200', 'DELETE', `/api/floors/${fid}`, undefined, ['setup: #11 soft delete → 200 snapshot']);
      expect(del.res.status()).toBe(200);
      const gone = '404 NOT_FOUND resource upload: the upload\'s floor is soft-deleted (uploads.py:118-142)';
      expectError(await sendChunk(admin, 'gone_floor_chunk_404', pid, uid, Buffer.alloc(50, 1), 0, [gone]), 404, 'NOT_FOUND', { resource: 'upload' });
      expectError(await complete(admin, 'gone_floor_complete_404', pid, uid, [gone]), 404, 'NOT_FOUND', { resource: 'upload' });
      const progress = await call(admin, 'gone_floor_progress_404', 'GET', `/api/projects/${pid}/drawings/uploads/${uid}/progress`, undefined, [gone]);
      expectError(progress, 404, 'NOT_FOUND', { resource: 'upload' });
      const sse = await readSse(streamPath, { cookie, until: first, timeoutMs: 15_000 });
      await captureStream('gone_floor_sse_404', streamPath, { cookie: '<admin stream cookie>' }, sse, ['404 NOT_FOUND resource upload: FloorRow.deleted_at must be null (stream_providers.py:52-62)']);
      expect.soft(sse.status).toBe(404);
      expect.soft(errBody(sse.errorBody)).toMatchObject({ code: 'NOT_FOUND', resource: 'upload' });

      const restored = await call(admin, 'gone_floor_restore_201', 'POST', `/api/projects/${pid}/floors`, floorBody(fid, 0), [
        '201: the soft-deleted id inside FLOOR_RESTORE_WINDOW_S is restored in place, same pk (service.py:53-73,127-131)',
      ]);
      expect.soft(restored.res.status()).toBe(201);
      const back = await call(admin, 'gone_floor_progress_back_200', 'GET', `/api/projects/${pid}/drawings/uploads/${uid}/progress`, undefined, [
        '200: the upload joins the restored floor row again (uploads.py:133-139)',
      ]);
      expect.soft(back.res.status()).toBe(200);
      expect.soft(back.body).toEqual(expected);
    } finally {
      await cleanup.run();
    }
  });

  test('A03 · roles: viewer member → 403 FORBIDDEN on settings PUT, floor create / patch / reorder, init / chunk / complete, but reads settings, #8 and S1; engineer non-member → 404 on all of them (S1 404 upload); engineer member → 201/200, its identical settings body after admin\'s write → 409 (another writer is no repeat); its init is capped at 60 / 600 s per user → 61st 429 RATE_LIMITED + Retry-After ≤ 10; its 7th concurrent S1 stream → 429 RATE_LIMITED Retry-After 5', async () => {
    // permissions/matrix.py:46-51 (floor.upload, layer.edit, project.settings.edit: admin, engineer); projects/access.py:45-86
    // (404 beats 403, K08); floors/resolvers.py:41-77,134-138; drawings/router.py:36-46; core/ratelimit.py:100-140;
    // streams/sse.py:208-221, connections.py:30-50, settings.py:34.
    test.setTimeout(240_000);
    const cleanup = new Cleanup();
    const opened: AbortController[] = [];
    try {
      const admin = await adminApi(cleanup);
      const pid = String((await newProject(admin, 'roles', cleanup)).id);
      const [f1, f2] = [await newFloor(admin, pid, 'roles_f1', 0), await newFloor(admin, pid, 'roles_f2', 1)];
      const init = await initUpload(admin, 'roles_admin_init_200', pid, f1, { sizeBytes: 20 }, ['setup: admin upload (receiving)']);
      expect(init.res.status()).toBe(200);
      const uid = String(asJson(init.body).id);
      const viewer = await realUser(admin, 'viewer', 'roles-viewer', cleanup);
      const engineer = await realUser(admin, 'engineer', 'roles-engineer', cleanup);
      await addMember(admin, pid, viewer.email, 'roles_add_viewer');

      const writes = (who: string): Array<[string, Method, string, unknown]> => [
        ['settings', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body: settingsBody() }],
        ['floor_create', 'POST', `/api/projects/${pid}/floors`, floorBody(newLevelId(), 5)],
        ['floor_patch', 'PATCH', `/api/projects/${pid}/floors/${f1}/spatial`, { name: `${PREFIX}${who}` }],
        ['reorder', 'PATCH', '/api/floors/reorder', { floorIds: [f2, f1] }],
        ['init', 'POST', `/api/projects/${pid}/floors/${f1}/drawings/uploads`, { fileName: 'a.png', floorId: f1, mimeType: 'image/png', projectId: pid, sizeBytes: 5 }],
        ['chunk', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/chunks`, { chunk: 'AAAA', chunkIndex: 0 }],
        ['complete', 'POST', `/api/projects/${pid}/drawings/uploads/${uid}/complete`, { uploadId: uid }],
      ];
      for (const [slug, method, path, data] of writes('viewer')) {
        const sent = await call(viewer.api, `roles_viewer_${slug}_403`, method, path, data, [
          '403 FORBIDDEN, no resource: member, but viewer lacks floor.upload / layer.edit / project.settings.edit (access.py:84-85)',
        ]);
        expect.soft(expectError(sent, 403, 'FORBIDDEN'), slug).not.toHaveProperty('resource');
      }
      const vSettings = await call(viewer.api, 'roles_viewer_settings_read_200', 'GET', `/api/projects/${pid}/settings`, undefined, ['200: any member reads N5 (router.py:22-27)']);
      expect.soft(vSettings.res.status()).toBe(200);
      expect.soft((await progressOf(viewer.api, 'roles_viewer_progress_200', pid, uid, '200: any member reads #8')).status).toBe('pending');
      const vStream = await readSse(`/api/streams/projects/${pid}/uploads/${uid}/progress`, { cookie: viewer.streamCookie, until: () => true, timeoutMs: 20_000 });
      await captureStream('roles_viewer_sse_200', `/api/streams/projects/${pid}/uploads/${uid}/progress`, { cookie: '<viewer stream cookie>' }, vStream, ['200 + snapshot: S1 only needs membership (stream_providers.py:43-51)']);
      expect.soft(vStream.status).toBe(200);
      expect.soft(vStream.frames[0]?.data.id).toBe(uid);

      for (const [slug, method, path, data] of writes('engineer')) {
        const sent = await call(engineer.api, `roles_engineer_nonmember_${slug}_404`, method, path, data, [
          '404 NOT_FOUND: not a member (resource project; reorder → floor via the resolver, resolvers.py:41-77)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: slug === 'reorder' ? 'floor' : 'project' });
      }
      const eProgress = await call(engineer.api, 'roles_engineer_nonmember_progress_404', 'GET', `/api/projects/${pid}/drawings/uploads/${uid}/progress`, undefined, ['404 project']);
      expectError(eProgress, 404, 'NOT_FOUND', { resource: 'project' });
      const eStream = await readSse(`/api/streams/projects/${pid}/uploads/${uid}/progress`, { cookie: engineer.streamCookie, until: () => true, timeoutMs: 15_000 });
      await captureStream('roles_engineer_nonmember_sse_404', `/api/streams/projects/${pid}/uploads/${uid}/progress`, { cookie: '<engineer stream cookie>' }, eStream, ['404 NOT_FOUND resource upload, not 403 (stream_providers.py:43-51)']);
      expect.soft(eStream.status).toBe(404);
      expect.soft(errBody(eStream.errorBody)).toMatchObject({ code: 'NOT_FOUND', resource: 'upload' });

      // Admin writes settings rev 1; then the engineer joins.
      const body = settingsBody({ buildingType: 'commercial' });
      const adminPut = await call(admin, 'roles_admin_settings_200', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body }, ['200 revision 1 by the admin']);
      expect(adminPut.res.status()).toBe(200);
      await addMember(admin, pid, engineer.email, 'roles_add_engineer');
      const notRepeat = await call(engineer.api, 'roles_engineer_settings_same_body_409', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body }, [
        '409 VERSION_CONFLICT currentVersion 1: same body + base but another writer is not a repeat (service.py:79-85)',
      ]);
      expect.soft(expectError(notRepeat, 409, 'VERSION_CONFLICT').currentVersion).toBe(1);
      const ePut = await call(engineer.api, 'roles_engineer_settings_200', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 1, body: settingsBody() }, ['200 revision 2: engineer has project.settings.edit']);
      expect.soft(asJson(ePut.body).revision).toBe(2);
      const eFloor = newLevelId();
      const eCreate = await call(engineer.api, 'roles_engineer_floor_create_201', 'POST', `/api/projects/${pid}/floors`, floorBody(eFloor, 2), ['201: engineer has layer.edit']);
      expect.soft(eCreate.res.status()).toBe(201);
      const ePatch = await call(engineer.api, 'roles_engineer_floor_patch_200', 'PATCH', `/api/projects/${pid}/floors/${eFloor}/spatial`, { heightMm: 2800 }, ['200']);
      expect.soft(ePatch.res.status()).toBe(200);
      const eReorder = await call(engineer.api, 'roles_engineer_reorder_200', 'PATCH', '/api/floors/reorder', { floorIds: [eFloor, f2, f1] }, ['200']);
      expect.soft(eReorder.res.status()).toBe(200);

      // drawings_init 60 / 600 s per user: 60 identical inits → 200 with ONE id (dedupe), the 61st → 429.
      const initBody = { fileName: `${PREFIX}limit.png`, floorId: f2, mimeType: 'image/png', projectId: pid, sizeBytes: 30 };
      const initPath = `/api/projects/${pid}/floors/${f2}/drawings/uploads`;
      const ids = new Set<unknown>();
      for (let i = 1; i <= INIT_LIMIT; i += 1) {
        const res = await engineer.api.post(initPath, { data: initBody });
        if (i === 1 || i === INIT_LIMIT) {
          await captureExchange(`A03_roles_engineer_init_${String(i)}_200.json`, { method: 'POST', path: initPath, body: initBody }, res, [
            `init #${String(i)} of ${String(INIT_LIMIT)} → 200; identical inits share one upload id (uploads.py:145-171)`,
          ]);
        }
        expect(res.status(), `engineer init #${String(i)}`).toBe(200);
        ids.add(((await res.json()) as Json).id);
        await res.dispose();
      }
      expect.soft(ids.size, 'dedupe: 60 identical inits → one upload').toBe(1);
      const limited = await call(engineer.api, 'roles_engineer_init_61_429', 'POST', initPath, initBody, [
        '429 RATE_LIMITED + Retry-After 1..10: drawings_init 60 / 600 s per user (settings.py:135-136, ratelimit.py:30-31,133-134)',
      ]);
      expectError(limited, 429, 'RATE_LIMITED');
      const retry = Number(limited.res.headers()['retry-after']);
      expect.soft(retry >= 1 && retry <= 10, `Retry-After ${String(retry)}`).toBe(true);
      const engineerUpload = String([...ids][0]);

      // S1 per-user cap: 6 open streams OK, the 7th → 429 RATE_LIMITED Retry-After 5.
      const sse = `/api/streams/projects/${pid}/uploads/${engineerUpload}/progress`;
      for (let i = 0; i < STREAM_MAX_PER_USER; i += 1) {
        const controller = new AbortController();
        opened.push(controller);
        const res = await fetch(`${apiBaseUrl()}${sse}`, { headers: { Cookie: `${STREAM}=${engineer.streamCookie}` }, signal: controller.signal });
        expect(res.status, `stream ${String(i + 1)} opens`).toBe(200);
        const reader = res.body?.getReader();
        await reader?.read(); // the snapshot frame: the slot is held
      }
      const seventh = await readSse(sse, { cookie: engineer.streamCookie, until: () => true, timeoutMs: 15_000 });
      await captureStream('roles_engineer_sse_7th_429', sse, { cookie: '<engineer stream cookie>', alreadyOpen: STREAM_MAX_PER_USER }, seventh, [
        '429 RATE_LIMITED + Retry-After 5: STREAM_MAX_PER_USER 6 (sse.py:65,208-221; connections.py:30-50)',
      ]);
      expect.soft(seventh.status).toBe(429);
      expect.soft(errBody(seventh.errorBody).code).toBe('RATE_LIMITED');
      expect.soft(seventh.headers['retry-after']).toBe(SSE_RETRY_AFTER);
    } finally {
      for (const controller of opened) controller.abort();
      await cleanup.run();
    }
  });
});

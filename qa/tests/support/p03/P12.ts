/**
 * QA-03d P12 helpers for the phase-3 API lifecycle flows (`phase03_projects_api.spec.ts`, `phase03_upload_api.spec.ts`).
 * Real backend only (skill `qa-api-test`). The request / SSE helpers mirror the private ones of
 * `phase03_pipeline_api.spec.ts` (not exported there, and that file is not P12's to edit); the crafted files are new.
 * `BE:` = `F:/App/AppBack` main 2ee030c5, paths under `apps/api/` unless noted.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { PIPELINE_TIMEOUT_MS } from '../../../../e2e/fullstack/env';
import { apiBaseUrl, captureExchange, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { deleteSeededProject } from '../drawingSeed';
import { EVIDENCE_DIR, TEST_DATA_PREFIX } from '../evidence';
import { poolUser, type PoolRole, type PoolUser } from '../phase03Seed';

export type Json = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const PREFIX = TEST_DATA_PREFIX;
export const JSON_CT = { 'Content-Type': 'application/json' } as const;
export const STREAM_COOKIE = 'appback_stream'; // BE:auth/cookies.py:15
/** `UPLOAD_CHUNK_BYTES` (BE:drawings/settings.py:19). */
export const CHUNK_BYTES = 5 * 1024 * 1024;
/** `UPLOAD_MAX_BYTES` (BE:drawings/settings.py:18). */
export const UPLOAD_MAX_BYTES = 104_857_600;
/** drawings_init per user per 600 s: BE default 60, the QA stack sets 300 (qa-limits.override.yml → qa.config env). */
export const INIT_LIMIT = Number(process.env.E2E_DRAWINGS_INIT_RATE_LIMIT ?? '60');
export const STREAM_MAX_PER_USER = 6; // BE:streams/settings.py:34
export const STREAM_HEARTBEAT_S = 15; // BE:streams/settings.py:32
/** Server closes a revoked stream within MAX_CLOSE_S (BE:streams/settings.py:23); + 0.5 s for nginx / client. */
export const STREAM_CLOSE_MS = 5_500;
export const PIPELINE_STEPS = [
  'preprocess', 'wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading', 'spatialDataBuild', 'qualityCheck',
] as const; // BE:packages/core/pipeline.py:18-25
/** Clockwise TL → TR → BR → BL frames well inside the page (BE:quality/geometry.py:54-78). */
export const CORNERS_C1 = [
  { xRatio: 0.05, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.95 }, { xRatio: 0.05, yRatio: 0.95 },
];
/** The whole displayed page: after a #31 write it maps back to the applied corners (BE quality tests FULL_PAGE). */
export const FULL_PAGE = [
  { xRatio: 0, yRatio: 0 }, { xRatio: 1, yRatio: 0 }, { xRatio: 1, yRatio: 1 }, { xRatio: 0, yRatio: 1 },
];

export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** Client-made level id `L-<base36 UPPER>` (BE:packages/core/ids.py:92-94). */
export const newLevelId = (): string => `L-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 24)}`;
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function note(description: string): void {
  test.info().annotations.push({ type: 'note', description });
}

export function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

/** Non-throwing view of a body (a missing / non-JSON body just fails the soft checks). */
export const errBody = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

export function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

/** Cleanup steps run in reverse order; a failing step is annotated, never thrown. */
export class Cleanup {
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

export interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** Evidence copy of a request body: strings over 2 KiB (base64 chunks, 1 MiB bodies) → `<N chars>`. */
function elide(value: unknown): unknown {
  if (typeof value === 'string') return value.length > 2048 ? `<${String(value.length)} chars>` : value;
  if (Array.isArray(value)) return value.map(elide);
  if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, elide(v)]));
  }
  return value;
}

/**
 * One request + its exchange evidence `A03_<ev>.json`. A string body goes out as raw bytes (Playwright would
 * JSON-encode a string that is not valid JSON, BUG-279/280) — pass `JSON_CT` with it.
 */
export async function call(
  api: APIRequestContext,
  ev: string,
  method: Method,
  path: string,
  data: unknown,
  claims: readonly string[],
  headers?: Record<string, string>,
): Promise<Sent> {
  const sent = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const res = await api.fetch(path, {
    method,
    ...(sent === undefined ? {} : { data: sent }),
    ...(headers === undefined ? {} : { headers }),
  });
  const body = await captureExchange(`A03_${ev}.json`, { method, path, body: elide(data) ?? null }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource`). Soft checks. */
export function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string; readonly resource?: string } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = errBody(sent.body);
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  return body;
}

/** A valid N6 body (BE:project_settings/schemas.py:103-111). */
export const settingsBody = (over: Json = {}): Json => ({
  buildingType: 'residential',
  lengthUnit: 'mm',
  snapToleranceMm: 50,
  confidenceThreshold: 0.75,
  defaultScaleMmPerPx: 1,
  ...over,
});

export async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

/**
 * Pool user of `role` in P12's own `slot` (phase03Seed `poolUser`: invites only when the slot is empty) and
 * re-enabled first: P12 flows disable their own pool users on purpose, `poolUser` only checks existence, and
 * #43 enable is a no-op on an active account (BE:users/service.py:312-320).
 */
export async function p12User(admin: APIRequestContext, role: PoolRole, slot: string): Promise<PoolUser> {
  const user = await poolUser(admin, role, slot);
  const enabled = await admin.post(`/api/users/${user.id}/enable`, { data: {} });
  expect(enabled.status(), `setup: POST /api/users/${user.id}/enable (pool ${slot})`).toBe(200);
  return user;
}

/** Signed-in Bearer context of a pool user (1 login), disposed by `cleanup`. */
export async function userApi(user: PoolUser, cleanup: Cleanup): Promise<APIRequestContext> {
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return api;
}

/** Admin #42 disable (`{}` body, BE:users/router.py:95-100) + a cleanup that enables the user again (#43). */
export async function disableUser(admin: APIRequestContext, user: PoolUser, ev: string, cleanup: Cleanup): Promise<Sent> {
  cleanup.add(async () => {
    const res = await admin.post(`/api/users/${user.id}/enable`, { data: {} });
    if (res.status() !== 200) note(`POST /api/users/${user.id}/enable → ${String(res.status())}`);
  });
  const sent = await call(admin, ev, 'POST', `/api/users/${user.id}/disable`, {}, [
    '200 AdminUserOut status "disabled": sessions revoked (users/service.py:297-309)',
  ]);
  expect(sent.res.status(), 'admin disables the pool user').toBe(200);
  return sent;
}

/** Project of `api`'s user with hook floors `names` (orders 0..n-1, 3 m apart); deleted by `cleanup` via {@link deleteSeededProject} (admin fallback, BUG-513). */
export async function ownProject(
  api: APIRequestContext,
  ev: string,
  cleanup: Cleanup,
  names: readonly string[],
): Promise<{ readonly id: string; readonly floors: string[]; readonly project: Json }> {
  const sent = await call(api, `${ev}_setup_project`, 'POST', '/api/projects', {
    name: `${PREFIX}${ev}-${uniq()}`,
    ...(names.length ? { floors: names.map((name, order) => ({ name, order, elevationMm: order * 3000, heightMm: 3000 })) } : {}),
  }, ['setup: 201 ProjectOut (projects/router.py:54-63)']);
  expect(sent.res.status(), 'setup: create project').toBe(201);
  const project = asJson(sent.body);
  const id = String(project.id);
  cleanup.add(async () => {
    const failed = await deleteSeededProject(api, id);
    if (failed !== null) note(failed);
  });
  const floors = asArray(project.floors ?? [], 'floors')
    .map((f) => asJson(f))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((f) => String(f.id));
  if (floors.length !== names.length) {
    const read = await api.get(`/api/projects/${id}/floors`);
    const rows = asArray(await read.json()).map((f) => asJson(f)).sort((a, b) => Number(a.order) - Number(b.order));
    return { id, floors: rows.map((f) => String(f.id)), project };
  }
  return { id, floors, project };
}

/** #10 create one floor (client id) → its id. */
export async function addFloor(api: APIRequestContext, ev: string, pid: string, order: number, name = `${PREFIX}floor-${String(order)}`): Promise<string> {
  const id = newLevelId();
  const sent = await call(api, ev, 'POST', `/api/projects/${pid}/floors`, { id, name, order, elevationMm: order * 3000, heightMm: 3000 }, [
    'setup: 201 FloorOut (floors/router.py:30-35)',
  ]);
  expect(sent.res.status(), 'setup: create floor').toBe(201);
  return id;
}

/** N3 add (`api` must be allowed to manage members). */
export async function addMember(api: APIRequestContext, ev: string, pid: string, email: string): Promise<void> {
  const sent = await call(api, ev, 'POST', `/api/projects/${pid}/members`, { email }, ['setup: N3 → 201 (project_members/router.py:42-70)']);
  expect(sent.res.status(), 'setup: add member').toBe(201);
}

/* ---- upload #5 / #6 / #7 / #8 */

export const initPath = (pid: string, fid: string): string => `/api/projects/${pid}/floors/${fid}/drawings/uploads`;
export const chunkPath = (pid: string, uid: string): string => `/api/projects/${pid}/drawings/uploads/${uid}/chunks`;
export const completePath = (pid: string, uid: string): string => `/api/projects/${pid}/drawings/uploads/${uid}/complete`;
export const progressPath = (pid: string, uid: string): string => `/api/projects/${pid}/drawings/uploads/${uid}/progress`;
export const streamPath = (pid: string, uid: string): string => `/api/streams/projects/${pid}/uploads/${uid}/progress`;
export const latestPath = (pid: string): string => `/api/projects/${pid}/drawings/uploads/latest`;
export const qualityPath = (pid: string, fid: string, tail = ''): string => `/api/projects/${pid}/floors/${fid}/quality${tail}`;
export const layerPath = (pid: string, fid: string): string => `/api/projects/${pid}/floors/${fid}/spatial/layer`;

/** #5 init body as the FE sends it (uploadTask.ts:424-433). */
export const initBody = (pid: string, fid: string, over: Json): Json => ({
  fileName: `${PREFIX}p12.png`, floorId: fid, mimeType: 'image/png', projectId: pid, sizeBytes: 1, ...over,
});

export async function initUpload(api: APIRequestContext, ev: string, pid: string, fid: string, over: Json, claims: readonly string[]): Promise<Sent> {
  return call(api, ev, 'POST', initPath(pid, fid), initBody(pid, fid, over), claims);
}

export async function sendChunk(
  api: APIRequestContext, ev: string, pid: string, uid: string, bytes: Buffer, index: number, claims: readonly string[],
): Promise<Sent> {
  return call(api, ev, 'POST', chunkPath(pid, uid), { chunk: bytes.toString('base64'), chunkIndex: index }, claims);
}

export async function completeUpload(
  api: APIRequestContext, ev: string, pid: string, uid: string, claims: readonly string[], headers?: Record<string, string>,
): Promise<Sent> {
  return call(api, ev, 'POST', completePath(pid, uid), { uploadId: uid }, claims, headers);
}

/** File split into `CHUNK_BYTES` chunks. */
export const chunksOf = (bytes: Buffer): Buffer[] =>
  Array.from({ length: Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES)) }, (_, i) => bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));

/** init → every chunk in order → the upload id (status receiving). */
export async function receivingUpload(
  api: APIRequestContext, ev: string, pid: string, fid: string, bytes: Buffer, fileName: string, mimeType = 'image/png',
): Promise<string> {
  const init = await initUpload(api, `${ev}_init`, pid, fid, { fileName, mimeType, sizeBytes: bytes.length }, [
    'setup: 200 Progress pending (drawings/uploads.py:174-227)',
  ]);
  expect(init.res.status(), `setup init ${fileName}`).toBe(200);
  const uid = String(asJson(init.body).id);
  const parts = chunksOf(bytes);
  for (const [i, part] of parts.entries()) {
    const chunk = await sendChunk(api, `${ev}_chunk${String(i)}`, pid, uid, part, i, ['setup: 200 (uploads.py:273-296)']);
    expect(chunk.res.status(), `setup chunk ${String(i)}`).toBe(200);
  }
  return uid;
}

/** Polls #8 (no evidence per poll) until completed / failed, then captures the final read as `A03_<ev>.json`. */
export async function waitFinal(api: APIRequestContext, ev: string, pid: string, uid: string): Promise<Json> {
  const deadline = Date.now() + PIPELINE_TIMEOUT_MS;
  for (;;) {
    const res = await api.get(progressPath(pid, uid));
    const status = res.status();
    const body = status === 200 ? asJson(await res.json()) : {};
    await res.dispose();
    if (status !== 200) throw new Error(`#8 polling → ${String(status)}`);
    if (body.status === 'completed' || body.status === 'failed') break;
    if (Date.now() > deadline) throw new Error(`pipeline of ${uid} not final within ${String(PIPELINE_TIMEOUT_MS)} ms`);
    await sleep(500);
  }
  const sent = await call(api, ev, 'GET', progressPath(pid, uid), undefined, ['200 #8 final Progress (progress.py:30-67)']);
  return asJson(sent.body);
}

export async function progressOf(api: APIRequestContext, ev: string, pid: string, uid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', progressPath(pid, uid), undefined, [claim]);
  expect(sent.res.status(), '#8 progress').toBe(200);
  return asJson(sent.body);
}

/** Setup: `bytes` uploaded + completed and its run final → `{uid, final}` (1 init on the caller's bucket). */
export async function finishedUpload(
  api: APIRequestContext, ev: string, pid: string, fid: string, bytes: Buffer, fileName: string,
): Promise<{ readonly uid: string; readonly final: Json }> {
  const uid = await receivingUpload(api, ev, pid, fid, bytes, fileName);
  const done = await completeUpload(api, `${ev}_complete`, pid, uid, ['setup: 200 Progress pending, run queued (complete.py:269-283)']);
  expect(done.res.status(), 'setup complete').toBe(200);
  return { uid, final: await waitFinal(api, `${ev}_final`, pid, uid) };
}

/** N7 items (`GET …/drawings/uploads/latest`, one item per live floor with an upload). */
export async function latestItems(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', latestPath(pid), undefined, [claim]);
  expect(sent.res.status(), 'N7').toBe(200);
  return asArray(asJson(sent.body).items).map((i) => asJson(i));
}

/** The env drawing `E2E_DRAWING_PNG` (straight 1600x1200 plan; the fake-ML run completes). */
export function drawingPng(): Buffer {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return readFileSync(path);
}

/* ---- S1 SSE (cookie-authenticated, BE:streams/sse.py) */

export async function streamCookieOf(api: APIRequestContext): Promise<string> {
  const cookie = (await api.storageState()).cookies.find((c) => c.name === STREAM_COOKIE);
  if (!cookie) throw new Error('no appback_stream cookie in the signed-in context');
  return cookie.value;
}

export interface SseFrame {
  readonly id: string;
  readonly data: Json;
  /** ms since the stream opened */
  readonly at: number;
}

/**
 * A live S1 connection read with Node fetch (an SSE never ends, APIRequestContext would buffer it). Frames are W15
 * `id:` + `data:` blocks; `: ping` comments are counted with their time (BE:streams/sse.py:62,79-86).
 */
export class SseConn {
  readonly frames: SseFrame[] = [];
  readonly pings: number[] = [];
  status = 0;
  headers: Record<string, string> = {};
  errorBody: unknown;
  /** ms since open when the server ended the stream / the client aborted / the answer was not 2xx */
  endedAt: number | undefined;
  end: 'server-ended' | 'aborted' | 'error-response' | 'read-error' | undefined;
  private readonly controller = new AbortController();
  private readonly openedAt = Date.now();
  private done: Promise<void> = Promise.resolve();

  static async open(path: string, opts: { cookie?: string; headers?: Record<string, string> } = {}): Promise<SseConn> {
    const conn = new SseConn();
    const headers: Record<string, string> = { Accept: 'text/event-stream', ...(opts.headers ?? {}) };
    if (opts.cookie !== undefined) headers.Cookie = `${STREAM_COOKIE}=${opts.cookie}`;
    const res = await fetch(`${apiBaseUrl()}${path}`, { headers, signal: conn.controller.signal });
    conn.status = res.status;
    conn.headers = Object.fromEntries([...res.headers.entries()].filter(([k]) => !/^(date|set-cookie)$/iu.test(k)));
    if (!res.ok || res.body === null) {
      const text = await res.text();
      try {
        conn.errorBody = JSON.parse(text);
      } catch {
        conn.errorBody = text;
      }
      conn.finish('error-response');
      return conn;
    }
    const reader = res.body.getReader();
    conn.done = conn.pump(reader);
    return conn;
  }

  get elapsed(): number {
    return Date.now() - this.openedAt;
  }

  private finish(how: NonNullable<SseConn['end']>): void {
    if (this.end !== undefined) return;
    this.end = how;
    this.endedAt = this.elapsed;
  }

  private async pump(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          this.finish('server-ended');
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let cut = buffer.indexOf('\n\n');
        while (cut >= 0) {
          const lines = buffer.slice(0, cut).split('\n');
          buffer = buffer.slice(cut + 2);
          cut = buffer.indexOf('\n\n');
          if (lines.some((l) => l.startsWith(': ping'))) this.pings.push(this.elapsed);
          const id = lines.find((l) => l.startsWith('id: '))?.slice(4);
          const data = lines.find((l) => l.startsWith('data: '))?.slice(6);
          if (id !== undefined && data !== undefined) this.frames.push({ id, data: asJson(JSON.parse(data), 'SSE data'), at: this.elapsed });
        }
      }
    } catch {
      this.finish(this.controller.signal.aborted ? 'aborted' : 'read-error');
    }
  }

  /** Waits until `pred` holds (checked every 50 ms) or `timeoutMs`; returns whether it held. */
  async until(pred: (conn: SseConn) => boolean, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!pred(this)) {
      if (Date.now() > deadline) return false;
      await sleep(50);
    }
    return true;
  }

  async close(): Promise<void> {
    this.controller.abort();
    await this.done;
    this.finish('aborted');
  }

  record(): Json {
    return { status: this.status, headers: this.headers, errorBody: this.errorBody ?? null, frames: this.frames, pings: this.pings, end: this.end ?? 'open', endedAt: this.endedAt ?? null };
  }
}

/** Evidence of a stream case `A03_<name>.json` (never a cookie value). */
export async function captureStream(name: string, path: string, sent: Json, conn: SseConn | Json, assertions: readonly string[]): Promise<void> {
  const response = conn instanceof SseConn ? conn.record() : conn;
  const record = { request: { method: 'GET', path, sent }, response, assertions, capturedAt: new Date().toISOString() };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const file = join(EVIDENCE_DIR, `A03_${name}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  await test.info().attach(`A03_${name}.json`, { path: file, contentType: 'application/json' });
}

/* ---- N1 summary of one project */

/** The N1 item of `pid` (GET /api/project-summaries, `id ASC`, followed by cursor; BE:projects/router.py:87-91). */
export async function summaryOf(api: APIRequestContext, ev: string, pid: string): Promise<Json | undefined> {
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const query = `?limit=500${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const res = await api.get(`/api/project-summaries${query}`);
    expect(res.status(), 'N1 page').toBe(200);
    const body = asJson(await res.json());
    const item = asArray(body.items).map((i) => asJson(i)).find((i) => i.id === pid);
    if (item !== undefined) {
      const file = join(EVIDENCE_DIR, `A03_${ev}.json`);
      mkdirSync(EVIDENCE_DIR, { recursive: true });
      writeFileSync(file, `${JSON.stringify({ request: { method: 'GET', path: `/api/project-summaries${query}` }, item, capturedAt: new Date().toISOString() }, null, 2)}\n`);
      await test.info().attach(`A03_${ev}.json`, { path: file, contentType: 'application/json' });
      return item;
    }
    if (typeof body.nextCursor !== 'string') return undefined;
    cursor = body.nextCursor;
  }
  return undefined;
}

/* ---- crafted files (in memory) */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf: Buffer): number => {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
};

/**
 * A real PNG: `colorType` 0 gray / 2 RGB / 6 RGBA, 8 bit, rows from `row(y)` (without the filter byte).
 * `level` 0 stores (a noise image stays larger than its pixels).
 */
export function craftPng(width: number, height: number, colorType: 0 | 2 | 6, row: (y: number) => Buffer, level = 6): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, colorType, 0, 0, 0], 8);
  const raw = Buffer.concat(Array.from({ length: height }, (_, y) => Buffer.concat([Buffer.from([0]), row(y)])));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 2400x2400 gray noise, stored (no compression): ~5.8 MB > one 5 MiB chunk → 2 chunks. */
export const noisePng = (): Buffer => craftPng(2400, 2400, 0, () => randomBytes(2400), 0);
/** 64x64 RGBA, white at half alpha (color type 6). */
export const rgbaPng = (): Buffer => craftPng(64, 64, 6, () => Buffer.from(Array.from({ length: 64 * 4 }, (_, i) => (i % 4 === 3 ? 0x80 : 0xff))));
/** 64x64 white gray PNG (valid, tiny). */
export const smallPng = (): Buffer => craftPng(64, 64, 0, () => Buffer.alloc(64, 0xff));

/**
 * Minimal baseline JPEG of 8x8 px with `components` (3 = YCbCr, 4 = CMYK + Adobe APP14 transform 0), one quant
 * table of 1s and one-symbol Huffman tables (DC category 0, AC EOB), so every block is two `0` bits. Optional EXIF
 * APP1 Orientation. `eoi: false` drops the final FF D9 (no other FF D9 in the file).
 */
export function tinyJpeg(opts: { components: 3 | 4; exifOrientation?: number; eoi?: boolean }): Buffer {
  const nc = opts.components;
  const seg = (marker: number, body: Buffer): Buffer => {
    const head = Buffer.alloc(4);
    head.writeUInt16BE(marker, 0);
    head.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([head, body]);
  };
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  if (opts.exifOrientation !== undefined) {
    // "Exif\0\0" + TIFF big-endian header, IFD0 with one entry 0x0112 SHORT 1 = orientation, next IFD 0.
    const tiff = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, opts.exifOrientation, 0, 0, 0, 0, 0, 0]);
    parts.push(seg(0xffe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])));
  }
  if (nc === 4) parts.push(seg(0xffee, Buffer.from([0x41, 0x64, 0x6f, 0x62, 0x65, 0x00, 0x64, 0, 0, 0, 0, 0])));
  parts.push(seg(0xffdb, Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 1)])));
  const sof = [8, 0, 8, 0, 8, nc];
  for (let c = 1; c <= nc; c += 1) sof.push(c, 0x11, 0);
  parts.push(seg(0xffc0, Buffer.from(sof)));
  const oneCode = (tableClass: number): Buffer => Buffer.from([tableClass, 1, ...Array<number>(15).fill(0), 0x00]);
  parts.push(seg(0xffc4, oneCode(0x00)), seg(0xffc4, oneCode(0x10)));
  const sos: number[] = [nc];
  for (let c = 1; c <= nc; c += 1) sos.push(c, 0x00);
  sos.push(0, 63, 0);
  parts.push(seg(0xffda, Buffer.from(sos)));
  parts.push(Buffer.from([nc === 4 ? 0x00 : 0x03])); // 2 bits per block, padded with 1s
  if (opts.eoi !== false) parts.push(Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

/** PDF from object bodies (1-based in order) with a correct xref; `trailerExtra` goes into the trailer dict. */
function pdfOf(objects: readonly string[], trailerExtra = ''): Buffer {
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<</Size ${String(objects.length + 1)}/Root 1 0 R${trailerExtra}>>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(out, 'latin1'); // ASCII only: string offsets = byte offsets
}

/** `pages` empty A4 pages (port of BE packages/vision/preprocess/tests/synthetic.py make_pdf); `pageType` of every page. */
export function makePdf(pages: number, pageType = 'Page'): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${String(3 + i)} 0 R`).join(' ');
  const objects = ['<</Type/Catalog/Pages 2 0 R>>', `<</Type/Pages/Kids[${kids}]/Count ${String(pages)}>>`];
  for (let i = 0; i < pages; i += 1) {
    objects.push(`<</Type/${pageType}/Parent 2 0 R/MediaBox[0 0 595 842]/Contents ${String(3 + pages + i)} 0 R/Resources<<>>>>`);
  }
  for (let i = 0; i < pages; i += 1) objects.push('<</Length 0>>\nstream\n\nendstream');
  return pdfOf(objects);
}

/** A valid 1-page PDF followed by a 2 KiB comment: `%%EOF` is not in the last 1 KiB (BE:drawings/complete.py:55-56). */
export const pdfEofFarFromEnd = (): Buffer => Buffer.concat([makePdf(1), Buffer.from(`%${'x'.repeat(2048)}\n`, 'latin1')]);

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + (s[i] ?? 0) + (key[i % key.length] ?? 0)) & 0xff;
    [s[i], s[j]] = [s[j] ?? 0, s[i] ?? 0];
  }
  const out = Buffer.alloc(data.length);
  let a = 0;
  let b = 0;
  for (let n = 0; n < data.length; n += 1) {
    a = (a + 1) & 0xff;
    b = (b + (s[a] ?? 0)) & 0xff;
    [s[a], s[b]] = [s[b] ?? 0, s[a] ?? 0];
    out[n] = (data[n] ?? 0) ^ (s[((s[a] ?? 0) + (s[b] ?? 0)) & 0xff] ?? 0);
  }
  return out;
}

const PDF_PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex');
const padPw = (pw: string): Buffer => Buffer.concat([Buffer.from(pw, 'latin1'), PDF_PAD]).subarray(0, 32);
const md5 = (...parts: Buffer[]): Buffer => createHash('md5').update(Buffer.concat(parts)).digest();

/**
 * 1-page PDF under the Standard security handler V1 / R2 (40-bit RC4) with a USER password: PDFium cannot open it
 * with the empty password → FPDF_ERR_PASSWORD → 422 PDF_UNREADABLE (BE:packages/vision/preprocess/pdf.py:31,48-51).
 * PDF 1.7 §7.6.3.3 algorithms 2, 3 and 4. The only stream is empty, so nothing else needs encrypting.
 */
export function rc4UserPasswordPdf(userPw = 'qa-user', ownerPw = 'qa-owner'): Buffer {
  const id = randomBytes(16);
  const o = rc4(md5(padPw(ownerPw)).subarray(0, 5), padPw(userPw));
  const p = Buffer.alloc(4);
  p.writeInt32LE(-4, 0);
  const key = md5(padPw(userPw), o, p, id).subarray(0, 5);
  const u = rc4(key, PDF_PAD);
  return pdfOf(
    [
      '<</Type/Catalog/Pages 2 0 R>>',
      '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<<>>>>',
      '<</Length 0>>\nstream\n\nendstream',
      `<</Filter/Standard/V 1/R 2/O<${o.toString('hex')}>/U<${u.toString('hex')}>/P -4>>`,
    ],
    `/Encrypt 5 0 R/ID[<${id.toString('hex')}><${id.toString('hex')}>]`,
  );
}

/**
 * Synthetic page `render_plan(100)` at 1600x1200 (BE packages/ml_contracts/synthetic.py, made once with
 * `docker exec f14-worker-1 python -c "…render_plan(100).image_png"`), and its answer from the same call.
 */
export const syntheticPage = (): Buffer => readFileSync(new URL('./P12-synthetic-seed100.png', import.meta.url));
export const SYNTHETIC_ANSWER = {
  seed: 100, mmPerPx: 8.0, walls: 6, doors: 3, windows: 3, furniture: { wardrobe: 2, bed: 2, stair: 2 }, texts: 20,
} as const;

/**
 * 1600x1200 gray PNG: white page, a 10 px black rectangle (x 160..1440, y 120..1080) and a few interior walls, so
 * #30 finds a frame (`frame.isFound` + 4 corners, BE packages/vision/preprocess/geometry.py:301 find_frame).
 */
export function framedPng(): Buffer {
  const [w, h, x0, x1, y0, y1, t] = [1600, 1200, 160, 1440, 120, 1080, 10];
  const ink = (x: number, y: number): boolean => {
    const inX = x >= x0 && x < x1;
    const inY = y >= y0 && y < y1;
    const border = inX && inY && (x < x0 + t || x >= x1 - t || y < y0 + t || y >= y1 - t);
    const wallV = (x >= 700 && x < 706 && y >= y0 && y < 800) || (x >= 1100 && x < 1106 && y >= 400 && y < y1);
    const wallH = y >= 600 && y < 606 && x >= x0 && x < 1100;
    return border || wallV || wallH;
  };
  return craftPng(w, h, 0, (y) => Buffer.from(Array.from({ length: w }, (_, x) => (ink(x, y) ? 0 : 255))));
}

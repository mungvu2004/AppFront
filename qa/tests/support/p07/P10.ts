/**
 * QA-07b pack P10 helpers — `phase07_me-b_api.spec.ts` (FL-A07-05..09: avatar, soft-deleted owner, password N13).
 * Own copy of the disposable-user machinery (invitation batch + claim) and the PNG builder; the coordinator merges the
 * duplicates in S4. Nothing here touches the shared pool users: avatars cannot be unset and the `me_avatar` /
 * `me_password` windows (900 s) live in Redis per user id, so every flow here owns a user invited just for it.
 */
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { MeSchema } from '../../../../src/api/schemas/me';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX, testEmail } from '../evidence';
import { deleteMails, linkFrom, waitForMail } from '../mailpit';

export const PREFIX = TEST_DATA_PREFIX;
export const REFRESH = 'appback_refresh'; // BE auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE auth_recovery/messages.py:31
export const MAX_BASE64_LEN = 699_052; // BE me/avatar.py:53
export const MAX_DECODED_BYTES = 512 * 1024; // BE me/avatar.py:56
export const BODY_LIMIT = 1_048_576; // BE core/routing.py:46 DEFAULT_BODY_LIMIT (1 MiB)

export type Json = Record<string, unknown>;

export const asJson = (value: unknown): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`expected a JSON object, got ${JSON.stringify(value)}`);
  return value as Json;
};

/** Hard `expect` for H steps, `expect.soft` for the rest (same call signature). */
const chk = (hard: boolean): typeof expect => (hard ? expect : (expect.soft as unknown as typeof expect));

/* ------------------------------------------------------------------ cleanup / evidence */

// dup-of: meUsers.ts Cleanup
/** Runs registered cleanups in reverse order; a failing cleanup is annotated, never thrown over the test's error. */
export class Cleanup {
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

export const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/** The signed avatar URL query (MinIO presigned signature) is cut before anything is written to evidence. */
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
  /** Raw bytes sent as `application/json`. */
  readonly raw?: string;
  /** What the evidence shows as the request body (large payloads are summarized). */
  readonly shown?: unknown;
}

/** One exchange + its `A07_<row id>_<slug>.json` evidence (`id` = catalog row id or `setup`). */
export async function call(
  api: APIRequestContext,
  id: string,
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
  const shown = options.raw ?? options.shown ?? body;
  const parsed = await captureExchange(`A07_${id}_${slug}.json`, { method, path, body: shown }, redactedView(res, text), assertions);
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`); `field: null` = the key must be absent. */
export function expectError(sent: Sent, status: number, code: string, field?: string | null, hard = false): Json {
  const e = chk(hard);
  e(sent.res.status(), `${code} status (body ${sent.text.slice(0, 160)})`).toBe(status);
  let body: Json = {};
  try {
    body = asJson(JSON.parse(sent.text));
  } catch {
    e(false, `${code}: body is a JSON object`).toBe(true);
  }
  e(body.code, `${status} code`).toBe(code);
  e(typeof body.requestId).toBe('string');
  if (field === null) e(body, `${code}: no field`).not.toHaveProperty('field');
  else if (field !== undefined) e(body.field, `${code}: field`).toBe(field);
  return body;
}

/** MeSchema (BE me/schemas.py:21-29) — 200, exact keys, FE `MeSchema.strict()` decodes it; `avatarUrl` by presence only. */
export function expectMe(sent: Sent, expected: Json, hard = false): Json {
  const e = chk(hard);
  e(sent.res.status(), `MeSchema status (body ${sent.text.slice(0, 160)})`).toBe(200);
  let body: Json = {};
  try {
    body = asJson(JSON.parse(sent.text));
  } catch {
    e(false, 'MeSchema: body is a JSON object').toBe(true);
  }
  const fe = MeSchema.safeParse(body);
  e(fe.success, `FE MeSchema decodes the body: ${fe.success ? '' : JSON.stringify(fe.error.issues)}`).toBe(true);
  e(Object.keys(body).sort()).toEqual(Object.keys(expected).sort());
  const { avatarUrl, ...rest } = body;
  const { avatarUrl: wantAvatar, ...wantRest } = expected;
  e(rest).toEqual(wantRest);
  if (wantAvatar !== undefined) e(typeof avatarUrl).toBe('string');
  return body;
}

/** 429 answer shape: keys exactly code + requestId, `Retry-After` integer in 1..10 (core/ratelimit.py:92-94). */
export function expectRateLimited(sent: Sent): void {
  const body = expectError(sent, 429, 'RATE_LIMITED');
  expect.soft(Object.keys(body).sort(), '429 body keys').toEqual(['code', 'requestId']);
  const retryAfter = sent.res.headers()['retry-after'];
  expect.soft(retryAfter, 'Retry-After is an integer').toMatch(/^\d+$/u);
  expect.soft(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  expect.soft(Number(retryAfter)).toBeLessThanOrEqual(10);
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

/** Refresh through the cookie header; returns the response and the rotated cookie value when present. */
export async function refreshWith(slug: string, id: string, cookie: string, assertions: readonly string[]): Promise<Sent> {
  const anon = await newApiContext();
  try {
    return await call(anon, id, slug, 'POST', '/api/auth/refresh', undefined, assertions, { headers: { Cookie: `${REFRESH}=${cookie}` } });
  } finally {
    await anon.dispose();
  }
}

/** Rotated refresh cookie of a 200 refresh answer. */
export const rotatedCookie = (sent: Sent): string => setCookieValue(sent.res, REFRESH);

/** Body whose JSON serialisation is exactly BODY_LIMIT + 1 bytes: `{...fixed, [key]: 'A' x n}` (413 PAYLOAD_TOO_LARGE). */
export function oversizedBody(fixed: Json, key: string): { body: Json; shown: Json } {
  const envelope = JSON.stringify({ ...fixed, [key]: '' }).length;
  const body = { ...fixed, [key]: 'A'.repeat(BODY_LIMIT + 1 - envelope) };
  expect(JSON.stringify(body).length, 'oversized body is exactly 1 MiB + 1').toBe(BODY_LIMIT + 1);
  return { body, shown: { ...fixed, [key]: `<${BODY_LIMIT + 1 - envelope} chars>` } };
}

/* ------------------------------------------------------------------ PNG builder (no dependency) */

// dup-of: png.ts crc32/pngChunk/png/pngHeader/avatarBody
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A real PNG: colorType 0 (gray) / 2 (RGB) / 6 (RGBA), every sample 0x80; gray may be 1-bit for huge sizes. */
export function png(width: number, height: number, colorType: 0 | 2 | 6, bitDepth: 1 | 8 = 8): Buffer {
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : 4;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const row = Buffer.alloc(1 + Math.ceil((width * channels * bitDepth) / 8), 0x80);
  row[0] = 0; // filter: none
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length);
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Assert the IHDR of a served PNG (PNG spec: IHDR right after the 8-byte signature). */
export function expectPng(bytes: Buffer, want: { width: number; height: number; colorType: number }, hard = false): void {
  const e = chk(hard);
  e(bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'PNG signature').toBe(true);
  e({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] }).toEqual(want);
}

export const avatarBody = (bytes: Buffer, mimeType = 'image/png'): Json => ({ mimeType, contentBase64: bytes.toString('base64') });
export const shownAvatar = (body: Json, what: string): Json => ({ mimeType: body.mimeType, contentBase64: `<${String(body.contentBase64).length} base64 chars: ${what}>` });

/** Path of a signed avatar URL (the object key; the query = signature is dropped). */
export function avatarPath(url: unknown): string {
  expect.soft(typeof url, 'avatarUrl is a string').toBe('string');
  return new URL(String(url)).pathname;
}

/** GET the signed URL with a bare context (no Bearer, like an `<img>`); evidence = a summary (no signature, no bytes). */
export async function fetchAvatar(url: string, id: string, slug: string, assertions: readonly string[], hard = false): Promise<{ contentType: string; bytes: Buffer }> {
  const bare = await request.newContext();
  try {
    const res = await bare.get(url);
    const bytes = await res.body();
    const contentType = res.headers()['content-type'] ?? '';
    const isPng = bytes.subarray(0, 8).equals(PNG_SIGNATURE) && bytes.length >= 26;
    const summary = JSON.stringify({ contentType, byteLength: bytes.length, ...(isPng ? { pngWidth: bytes.readUInt32BE(16), pngHeight: bytes.readUInt32BE(20), pngColorType: bytes[25] } : {}) });
    const parsed = new URL(url);
    await captureExchange(`A07_${id}_${slug}.json`, { method: 'GET', path: `${parsed.origin}${parsed.pathname}?<signature redacted>` }, redactedView(res, summary), [
      ...assertions,
      'response body summarized (binary image): content type, byte length, PNG IHDR',
    ]);
    chk(hard)(res.status(), 'signed avatar URL serves the object').toBe(200);
    return { contentType, bytes };
  } finally {
    await bare.dispose();
  }
}

/* ------------------------------------------------------------------ users: one invitation batch per worker */

// dup-of: meUsers.ts inviteBatch / claim (port of the old spec batch() / claim())
export const SLOTS = ['avatar', 'avatarrl', 'avatarb', 'deleted', 'pwrules', 'pwchange'] as const;
export type Slot = (typeof SLOTS)[number];

interface Batch {
  readonly admin: APIRequestContext;
  readonly since: Date;
  readonly users: ReadonlyMap<Slot, { readonly id: string; readonly email: string }>;
  readonly claimed: Set<Slot>;
}

let batchPromise: Promise<Batch> | undefined;

/** Admin signs in once and invites all six slots in ONE request (BE users/router.py:55-62, 201 AdminUserOut[]). */
export function batch(): Promise<Batch> {
  batchPromise ??= (async () => {
    const { email, password } = readAdminCredentials();
    const admin = await signedInApi(email, password);
    const emails = SLOTS.map((slot) => testEmail(slot));
    const since = new Date(Date.now() - 5_000);
    const sent = await call(admin, 'setup', 'p10_invite_batch', 'POST', '/api/users/invitations', { emails, role: 'viewer' }, [
      'setup: admin invites the six run-unique @example.test viewers in one request -> 201, one pending row each',
    ]);
    expect(sent.res.status()).toBe(201);
    const rows = (Array.isArray(sent.body) ? sent.body : []).map(asJson);
    const users = new Map(
      SLOTS.map((slot, i) => {
        const row = rows.find((r) => r.email === emails[i]);
        if (!row) throw new Error(`invitation batch: no row for slot ${slot}`);
        expect(row.status).toBe('pending');
        return [slot, { id: String(row.id), email: emails[i]! }] as const;
      }),
    );
    return { admin, since, users, claimed: new Set<Slot>() };
  })();
  return batchPromise;
}

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly api: APIRequestContext;
  /** Latest refresh cookie value (secret: never written). */
  cookie: string;
  /** The password set at accept time (secret: only sent in bodies `captureExchange` redacts). */
  password: string;
}

/** The flow's own user: real mailed token -> accept (204 + refresh cookie) -> refresh (W16 access token). */
export async function claim(slot: Slot, cleanup: Cleanup): Promise<Member> {
  const b = await batch();
  const user = b.users.get(slot)!;
  b.claimed.add(slot);
  cleanup.add(async () => {
    const res = await b.admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
    if (res.status() !== 200 && slot !== 'deleted') note(`cleanup DELETE /api/users/${user.id} -> ${res.status()}`);
  });
  const mail = await waitForMail(user.email, b.since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation link has no #token');

  const fullName = `${PREFIX}${slot}`;
  const password = `Qa-${randomUUID()}`;
  const anon = await newApiContext();
  try {
    const accept = await call(anon, 'setup', `${slot}_accept`, 'POST', '/api/auth/invitations/accept', { token, fullName, password }, [
      'setup: invitee accepts with the real mailed token -> 204 + refresh cookie (auth_recovery/router.py)',
    ]);
    expect(accept.res.status()).toBe(204);
    const accepted = setCookieValue(accept.res, REFRESH);
    const refreshed = await call(anon, 'setup', `${slot}_refresh`, 'POST', '/api/auth/refresh', undefined, ['setup: 200 W16 roles ["viewer"] + access token'], {
      headers: { Cookie: `${REFRESH}=${accepted}` },
    });
    expect(refreshed.res.status()).toBe(200);
    const api = await bearerContext(String(asJson(refreshed.body).accessToken));
    cleanup.add(() => api.dispose());
    return { id: user.id, email: user.email, fullName, api, cookie: setCookieValue(refreshed.res, REFRESH), password };
  } finally {
    await anon.dispose();
  }
}

/** A context that sends `Authorization: Bearer <token>` and the same-origin `Origin`. */
export async function bearerContext(token: string): Promise<APIRequestContext> {
  const base = apiBaseUrl();
  return request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${token}` } });
}

/** Admin context of the batch (only invites and deletes). */
export async function adminApi(): Promise<APIRequestContext> {
  return (await batch()).admin;
}

/** For the spec's `test.afterAll`: delete the slots no test claimed (a `--grep` subset), their mails, and the admin context. */
export async function cleanupUnclaimed(): Promise<void> {
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
      console.error(`[phase07 me-b api] cleanup of unclaimed slot ${slot} failed: ${String(error)}`);
    }
  }
  await b.admin.dispose();
  batchPromise = undefined;
}

/**
 * Phase 7 — Account BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the SCR-33 `/tai-khoan` screen calls (FE `src/api/endpoints.ts:10` ME_ROOT, client `src/api/client.ts:1090-1102`,
 * decoded with FE `src/api/schemas/me.ts` `MeSchema` strict; session upkeep = `POST /api/auth/refresh`):
 *   GET   /api/me          (N11)  BE me/router.py:109-112
 *   PATCH /api/me          (N12)  BE me/router.py:115-143, schemas.py:32-91
 *   PUT   /api/me/avatar   (N14)  BE me/router.py:247-273, avatar.py:137-237, schemas.py:101-105
 *   POST  /api/auth/refresh (W16) BE auth/router.py:236-282 — here only what phase 7 adds: `user.name` follows N12
 *         (auth/sessions.py:314,339) and the refresh of a soft-deleted owner (phase01-be.md: "not covered").
 *   POST  /api/me/password (N13) BE me/router.py:146-244, schemas.py:94-98 — sent by the edge spec's password tests
 *         (`phase07_account_edge.spec.ts`); here: body rules, 422 CURRENT_PASSWORD_INCORRECT, the me_password 429, and
 *         the success side effects (other sessions revoked, this one kept, old password refused, new one signs in).
 *   POST  /api/auth/login  (W1)  BE auth/router.py:160-192 — only as the N13 probe (old 401 INVALID_CREDENTIALS / new 204).
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, HEAD 2ee030c5 = origin/main), paths under `apps/api/`.
 * Every 200 body is also parsed with the FE zod `MeSchema` (strict) — FE <-> BE contract.
 * Inventory + mock-pairing table: `qa/coverage/phase07-be.md`.
 *
 * ## Non-serial, own data
 * Every test uses its OWN user. The users are REAL viewers: ONE `POST /api/users/invitations` per worker invites the
 * seven run-unique `qa-<runId>-<slot>-…@example.test` addresses (lazy `batch()`, so the invitation budget stays 1); each
 * test then reads ITS invitation token from Mailpit, accepts it (fullName `qa-<runId>-<slot>`) and refreshes once for
 * a Bearer token. Each test soft-deletes its own user (`DELETE /api/users/{id}`) and its mail in `finally`; `afterAll`
 * deletes the slots no test claimed (a `--grep` subset). The admin account is only used to invite and delete test
 * users: never patched, no avatar, no failed login.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE users/router.py:32-43): THIS file 1 (+1 per worker restart
 *   after a failed test) + ui `phase07_account_ui.spec.ts` 1 (its header, "long data" viewer) + main 0 = phase 7: 2.
 *   Phases 1-6 spend 28 (phase06 header) → Phases 1-7 in one hour = 30 ≤ 30: AT the cap — a worker restart or a re-run
 *   inside the same hour gets 429 on the invitation; then wait for the 3600 s window.
 * - `recovery_ip` 10 / 900 s per IP (BE auth_recovery/settings.py:24; override 60 in `qa-limits.override.yml`): THIS
 *   file 7 invitation accepts (one per test that claims a user) + ui 1 + edge ≤ 6 (1 per worker) = ≤ 14 ≤ 60. Without
 *   the override the phase total would pass the BE default 10 — the edge spec already depends on the override.
 * - `POST /api/auth/login` per IP 30 / 60 s (BE auth/settings.py:36; override 120): THIS file 1 (admin `signedInApi`
 *   in `batch()`, +1 per worker restart) + "password rules" 1 + "password change" 3 = 5, of which 1 failed (the old
 *   password, on the test user's own (email, IP) bucket: 5 attempts / 900 s since the last success, login_guard.py:36-48
 *   — attempts there: success, fail, success). Phase-7 UI: main 1, ui 1, edge ≤ 28 spread over minutes. Layers run
 *   sequentially; the busiest 60 s stays far below 120 (and below 30).
 * - `POST /api/auth/refresh`: 7 setup refreshes (one per claimed user) + "profile" 1 + "deleted" 1 + "password change"
 *   3 (second session 1, kept session 1, revoked session 1) — each 401 adds 1 to that session's own fail bucket,
 *   20 / 60 s per (sid, token), auth/settings.py:43; total 300 / 60 s per sid.
 * - `me_avatar` 10 / 900 s per USER (BE me/router.py:47-48,247-249, `key_user`, counted before body validation —
 *   core/ratelimit.py:105-140): "avatar" 5 on its own user; "avatar body rules" 11 on its own user — the 11th is the
 *   designed 429; "deleted" 1. Users are fresh each run, so no window is shared with any other test or phase.
 * - `me_password` 5 / 900 s per USER (me/router.py:45-46,146-153,225, counted before body validation like me_avatar):
 *   "password rules" 5 rejected + the designed 6th → 429 on its own user; "password change" 2 on its own user.
 *   Edge spec 2 on ITS user. Users are fresh each run: no window shared.
 * - No rate limit on N11 / N12 (me/router.py:109,137: no `dependencies`).
 * - Idempotency rows: "avatar" leaves 2 (24 h TTL, core/idempotency.py:49). Avatar objects: 2 in MinIO, removed by the
 *   `purge_avatars` beat once the owner is soft-deleted (me/jobs.py:7-11).
 * - Mailpit: 7 invitation mails, deleted in `finally` / `afterAll`.
 */
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { MeSchema } from '../../src/api/schemas/me';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { deleteMails, linkFrom, waitForMail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE auth_recovery/messages.py:31
const FULL_NAME_MAX = 120; // BE me/schemas.py:16 (jobTitle shares it, :62-64)
const PHONE_MAX = 32; // BE me/schemas.py:17
const MAX_BASE64_LEN = 699_052; // BE me/avatar.py:53
const MAX_DECODED_BYTES = 512 * 1024; // BE me/avatar.py:56
const AVATAR_LIMIT = 10; // BE me/router.py:47

type Json = Record<string, unknown>;

/* ------------------------------------------------------------------ phase-local helpers */

const asJson = (value: unknown): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`expected a JSON object, got ${JSON.stringify(value)}`);
  return value as Json;
};

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
 * The signed avatar URL (`avatarUrl`, MinIO presigned — packages/storage/s3.py:244-255) is a bearer link to the object:
 * its query string (the signature) is cut before anything is written to evidence. Only status/headers/text are read
 * by `captureExchange`, so a thin view with the redacted text is enough.
 */
function redactedView(res: APIResponse, text: string): APIResponse {
  const clean = text.replace(/("avatarUrl"\s*:\s*"[^"?]*)\?[^"]*"/gu, '$1?<signature redacted>"');
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
  /** What the evidence shows as the request body (large base64 payloads are summarized). */
  readonly shown?: unknown;
}

/** One exchange + its `A07_<slug>.json` evidence. */
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
  const shown = options.raw ?? options.shown ?? body;
  const parsed = await captureExchange(`A07_${slug}.json`, { method, path, body: shown }, redactedView(res, text), assertions);
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`); `field: null` = the key must be absent. */
function expectError(sent: Sent, status: number, code: string, field?: string | null): Json {
  expect(sent.res.status(), `${code} status`).toBe(status);
  const body = asJson(JSON.parse(sent.text));
  expect(body.code).toBe(code);
  expect(typeof body.requestId).toBe('string');
  if (field === null) expect(body, `${code}: no field`).not.toHaveProperty('field');
  else if (field !== undefined) expect(body.field).toBe(field);
  return body;
}

/**
 * MeSchema (BE me/schemas.py:21-29, W2: None keys absent) — 200, exact keys, FE `MeSchema.strict()` decodes it.
 * `avatarUrl` is compared by presence only (signed per call); returns the wire body.
 */
function expectMe(sent: Sent, expected: Json): Json {
  expect(sent.res.status(), 'MeSchema status').toBe(200);
  const body = asJson(JSON.parse(sent.text));
  const fe = MeSchema.safeParse(body);
  expect(fe.success, `FE MeSchema decodes the body: ${fe.success ? '' : JSON.stringify(fe.error.issues)}`).toBe(true);
  expect(Object.keys(body).sort()).toEqual(Object.keys(expected).sort());
  const { avatarUrl, ...rest } = body;
  const { avatarUrl: wantAvatar, ...wantRest } = expected;
  expect(rest).toEqual(wantRest);
  if (wantAvatar !== undefined) expect(typeof avatarUrl).toBe('string');
  return body;
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

/* ------------------------------------------------------------------ PNG builder (no dependency) */

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
function png(width: number, height: number, colorType: 0 | 2 | 6, bitDepth: 1 | 8 = 8): Buffer {
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

/** IHDR of a PNG: width, height, colorType (PNG spec: IHDR right after the 8-byte signature). */
function pngHeader(bytes: Buffer): { width: number; height: number; colorType: number } {
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), 'PNG signature').toBe(true);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25]! };
}

const avatarBody = (bytes: Buffer, mimeType = 'image/png'): Json => ({ mimeType, contentBase64: bytes.toString('base64') });
const shownAvatar = (body: Json, what: string): Json => ({ mimeType: body.mimeType, contentBase64: `<${String(body.contentBase64).length} base64 chars: ${what}>` });

/** Path of a signed avatar URL (the object key; the query = signature is dropped). Must be absolute (FE `z.string().url()`). */
function avatarPath(url: unknown): string {
  expect(typeof url).toBe('string');
  return new URL(String(url)).pathname;
}

/** GET the signed URL with a bare context (no Bearer, like an `<img>`), evidence = a summary (no signature, no bytes). */
async function fetchAvatar(url: string, slug: string, assertions: readonly string[]): Promise<{ contentType: string; bytes: Buffer }> {
  const bare = await request.newContext();
  try {
    const res = await bare.get(url);
    const bytes = await res.body();
    const contentType = res.headers()['content-type'] ?? '';
    const summary = JSON.stringify({ contentType, byteLength: bytes.length, ...(bytes.subarray(0, 8).equals(PNG_SIGNATURE) ? pngHeaderSafe(bytes) : {}) });
    const parsed = new URL(url);
    await captureExchange(`A07_${slug}.json`, { method: 'GET', path: `${parsed.origin}${parsed.pathname}?<signature redacted>` }, redactedView(res, summary), [
      ...assertions,
      'response body summarized (binary image): content type, byte length, PNG IHDR',
    ]);
    expect(res.status(), 'signed avatar URL serves the object').toBe(200);
    return { contentType, bytes };
  } finally {
    await bare.dispose();
  }
}

function pngHeaderSafe(bytes: Buffer): Json {
  return bytes.length >= 26 ? { pngWidth: bytes.readUInt32BE(16), pngHeight: bytes.readUInt32BE(20), pngColorType: bytes[25] } : {};
}

/* ------------------------------------------------------------------ users: one invitation batch per worker */

const SLOTS = ['profile', 'rules', 'avatar', 'avatarrules', 'deleted', 'pwrules', 'pwchange'] as const;
type Slot = (typeof SLOTS)[number];

interface Batch {
  readonly admin: APIRequestContext;
  readonly since: Date;
  readonly users: ReadonlyMap<Slot, { readonly id: string; readonly email: string }>;
  readonly claimed: Set<Slot>;
}

let batchPromise: Promise<Batch> | undefined;

/** Admin signs in once and invites all seven slots in ONE request (BE users/router.py:55-62, 201 AdminUserOut[]). */
function batch(): Promise<Batch> {
  batchPromise ??= (async () => {
    const { email, password } = readAdminCredentials();
    const admin = await signedInApi(email, password);
    const emails = SLOTS.map((slot) => testEmail(slot));
    const since = new Date(Date.now() - 5_000);
    const body = { emails, role: 'viewer' };
    const sent = await call(admin, 'setup_invite_batch', 'POST', '/api/users/invitations', body, [
      'setup: admin invites the seven run-unique @example.test viewers in one request → 201, one pending row each',
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

interface Member {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly api: APIRequestContext;
  /** Latest refresh cookie value (secret: never written). */
  cookie: string;
  /** The password set at accept time (secret: only sent in bodies `captureExchange` redacts). */
  readonly password: string;
}

/** The test's own user: real mailed token → accept (204 + refresh cookie) → refresh (W16 access token). */
async function claim(slot: Slot, cleanup: Cleanup): Promise<Member> {
  const b = await batch();
  const user = b.users.get(slot)!;
  b.claimed.add(slot);
  cleanup.add(async () => {
    const res = await b.admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
    if (res.status() !== 200 && slot !== 'deleted') note(`cleanup DELETE /api/users/${user.id} → ${res.status()}`);
  });
  const mail = await waitForMail(user.email, b.since, 30_000, INVITE_SUBJECT);
  cleanup.add(() => deleteMails([mail.id]));
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation link has no #token');

  const fullName = `${PREFIX}${slot}`;
  const password = `Qa-${randomUUID()}`;
  const anon = await newApiContext();
  try {
    const accept = await call(anon, `${slot}_setup_accept`, 'POST', '/api/auth/invitations/accept', { token, fullName, password }, [
      'setup: invitee accepts with the real mailed token → 204 + refresh cookie (auth_recovery/router.py)',
    ]);
    expect(accept.res.status()).toBe(204);
    const accepted = setCookieValue(accept.res, REFRESH);
    const refreshed = await call(anon, `${slot}_setup_refresh`, 'POST', '/api/auth/refresh', undefined, ['setup: 200 W16 roles ["viewer"] + access token'], {
      headers: { Cookie: `${REFRESH}=${accepted}` },
    });
    expect(refreshed.res.status()).toBe(200);
    const bearer = String(asJson(refreshed.body).accessToken);
    const base = apiBaseUrl();
    const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${bearer}` } });
    cleanup.add(() => api.dispose());
    return { id: user.id, email: user.email, fullName, api, cookie: setCookieValue(refreshed.res, REFRESH), password };
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
      console.error(`[phase07 api] cleanup of unclaimed slot ${slot} failed: ${String(error)}`);
    }
  }
  await b.admin.dispose();
  batchPromise = undefined;
});

/* ------------------------------------------------------------------ tests */

test.describe('A07 phase-7 backend (/api/me N11 / N12 / N14, refresh W16)', () => {
  test('A07 · anonymous / bad Bearer: GET + PATCH (truncated JSON) + PUT /me/avatar → 401 UNAUTHENTICATED before the body', async () => {
    // core/routing.py:129-135 (Bearer read before the body, W10), :262-263; auth/tokens.py:70-73 (bad JWT → UNAUTHENTICATED).
    const anon = await newApiContext();
    try {
      const get = await call(anon, 'anon_get_me', 'GET', '/api/me', undefined, ['no Authorization → 401 UNAUTHENTICATED (routing.py:131-133)']);
      expectError(get, 401, 'UNAUTHENTICATED');
      const patch = await call(anon, 'anon_patch_me_truncated', 'PATCH', '/api/me', undefined, ['no Authorization + truncated JSON → 401 (auth before the body), not 400'], {
        raw: '{"fullName":',
      });
      expectError(patch, 401, 'UNAUTHENTICATED');
      const body = avatarBody(png(2, 2, 2));
      const put = await call(anon, 'anon_put_avatar', 'PUT', '/api/me/avatar', body, ['no Authorization → 401 before the rate limit and the decode'], {
        shown: shownAvatar(body, '2x2 RGB PNG'),
      });
      expectError(put, 401, 'UNAUTHENTICATED');
      for (const [slug, auth] of [
        ['garbage_bearer', 'Bearer not-a-jwt'],
        ['basic_scheme', 'Basic cWE6cWE='],
      ] as const) {
        const res = await call(anon, `anon_get_me_${slug}`, 'GET', '/api/me', undefined, [`Authorization "${slug}" → 401 UNAUTHENTICATED (tokens.py:70-73 / routing.py:131-133)`], {
          headers: { Authorization: auth },
        });
        expectError(res, 401, 'UNAUTHENTICATED');
      }
    } finally {
      await anon.dispose();
    }
  });

  test('A07 · profile: GET /me shape (no-store), PATCH partial / trim / NFC / boundaries / clear with "" and null, read-back, refresh user.name follows fullName', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('profile', cleanup);
      const base = { email: m.email, language: 'vi' };

      // N11: fresh invitee → only {email, fullName, language}; language default 'vi' (packages/db/models/auth.py:63).
      const first = await call(m.api, 'profile_get_initial', 'GET', '/api/me', undefined, [
        '200 MeSchema exactly {email, fullName, language:"vi"} — jobTitle/phone/avatarUrl absent when NULL (schemas.py:21-29, W2)',
        'Cache-Control: no-store (core/middleware.py:53,198)',
      ]);
      expectMe(first, { ...base, fullName: m.fullName });
      expect(first.res.headers()['cache-control']).toBe('no-store');

      // N12 partial: only jobTitle changes; trimmed (schemas.py:56-65 clean_text = strip + NFC).
      const p1 = await call(m.api, 'profile_patch_job_title', 'PATCH', '/api/me', { jobTitle: '  QA lead  ' }, [
        '200, jobTitle trimmed to "QA lead", other keys unchanged (router.py:115-122 writes only the keys present)',
      ]);
      expectMe(p1, { ...base, fullName: m.fullName, jobTitle: 'QA lead' });

      // NFD + spaces → NFC trimmed; phone trimmed; language en (schemas.py:40-54,67-76,78-84).
      const nfdName = `  ${PREFIX}Nguye\u0302\u0303n  `;
      const nfcName = `${PREFIX}Nguy\u1EC5n`;
      const p2 = await call(m.api, 'profile_patch_nfc_phone_language', 'PATCH', '/api/me', { fullName: nfdName, phone: ' +84 901 234 567 ', language: 'en' }, [
        '200, fullName NFD → NFC + trimmed, phone trimmed, language "en", jobTitle kept',
      ]);
      expectMe(p2, { email: m.email, fullName: nfcName, jobTitle: 'QA lead', phone: '+84 901 234 567', language: 'en' });

      // Upper boundaries accepted (schemas.py:16-17,52,63,74): 120 / 120 / 32.
      const longName = 'A'.repeat(FULL_NAME_MAX);
      const p3 = await call(m.api, 'profile_patch_boundaries', 'PATCH', '/api/me', { fullName: longName, jobTitle: 'B'.repeat(FULL_NAME_MAX), phone: '1'.repeat(PHONE_MAX) }, [
        '200 at the exact maxima: fullName 120, jobTitle 120, phone 32',
      ]);
      expectMe(p3, { email: m.email, fullName: longName, jobTitle: 'B'.repeat(FULL_NAME_MAX), phone: '1'.repeat(PHONE_MAX), language: 'en' });

      // W16 reads the name from users at refresh time (auth/sessions.py:314,339) → the session label follows N12.
      const anon = await newApiContext();
      try {
        const refreshed = await call(anon, 'profile_refresh_name', 'POST', '/api/auth/refresh', undefined, [
          '200 W16 user {id, name, email}: name = the fullName just PATCHed, roles ["viewer"] (auth/router.py:253-282, sessions.py:314,339)',
        ], { headers: { Cookie: `${REFRESH}=${m.cookie}` } });
        expect(refreshed.res.status()).toBe(200);
        const w16 = asJson(refreshed.body);
        expect(w16.roles).toEqual(['viewer']);
        expect(asJson(w16.user)).toEqual({ id: m.id, name: longName, email: m.email });
        m.cookie = setCookieValue(refreshed.res, REFRESH);
      } finally {
        await anon.dispose();
      }

      // Clear: "" and whitespace-only → NULL → key absent (router.py:51,115-122; schemas.py:62-65,73-76).
      const p4 = await call(m.api, 'profile_patch_clear_empty', 'PATCH', '/api/me', { jobTitle: '', phone: '   ' }, [
        '200, jobTitle "" and phone "   " clear the columns → both keys absent',
      ]);
      expectMe(p4, { email: m.email, fullName: longName, language: 'en' });

      // null on the nullable keys also clears (validators return None, router.py:121) — the FE always sends "".
      await call(m.api, 'profile_patch_set_again', 'PATCH', '/api/me', { jobTitle: 'tmp', phone: '1' }, ['setup: set jobTitle/phone again → 200']);
      const p5 = await call(m.api, 'profile_patch_clear_null', 'PATCH', '/api/me', { jobTitle: null, phone: null }, [
        '200, explicit null on jobTitle/phone clears them (schemas.py:60-61,71-72 return None; router.py:121) → keys absent',
      ]);
      expectMe(p5, { email: m.email, fullName: longName, language: 'en' });

      const last = await call(m.api, 'profile_get_final', 'GET', '/api/me', undefined, ['200 read-back = the last PATCH answer (N12 returns the re-read row, router.py:141-143)']);
      expect(last.text).toBe(p5.text);
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · PATCH /me body rules: 422 VALIDATION with field per rule, 400 MALFORMED_JSON, nothing written; phone control chars', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('rules', cleanup);
      const before = await call(m.api, 'rules_get_before', 'GET', '/api/me', undefined, ['200 snapshot before the rejected writes']);
      expectMe(before, { email: m.email, fullName: m.fullName, language: 'vi' });

      // core/errors.py:136-157,176-190: field = first Pydantic error loc (root dropped, camelCase); model-level → no field.
      const cases: readonly (readonly [string, unknown, string | null, string])[] = [
        ['empty_object', {}, null, 'no key → model validator (schemas.py:86-91) → no field'],
        ['array_body', [], null, 'body not an object → loc (body,) → no field'],
        ['extra_key_email', { fullName: `${PREFIX}x`, email: 'other@example.test' }, 'email', 'extra="forbid" (core/wire.py:46,115-118); email is not editable'],
        ['full_name_null', { fullName: null }, 'fullName', 'explicit null rejected (schemas.py:49-50)'],
        ['full_name_blank', { fullName: '   ' }, 'fullName', 'blank after trim (schemas.py:51-53)'],
        ['full_name_121', { fullName: 'A'.repeat(FULL_NAME_MAX + 1) }, 'fullName', '121 > 120 (schemas.py:52)'],
        ['full_name_number', { fullName: 123 }, 'fullName', 'not a string'],
        ['full_name_control', { fullName: `${PREFIX}\u0007bell` }, 'fullName', 'Cc char (packages/core/text.py:34-46)'],
        ['job_title_bidi', { jobTitle: `${PREFIX}\u202Eevil` }, 'jobTitle', 'bidi override U+202E (packages/core/text.py:6,34-46)'],
        ['job_title_121', { jobTitle: 'B'.repeat(FULL_NAME_MAX + 1) }, 'jobTitle', '121 > 120 (schemas.py:63-64)'],
        ['phone_33', { phone: '1'.repeat(PHONE_MAX + 1) }, 'phone', '33 > 32 (schemas.py:74-75)'],
        ['language_fr', { language: 'fr' }, 'language', 'Literal["vi","en"] (schemas.py:38)'],
        ['language_null', { language: null }, 'language', 'explicit null rejected (schemas.py:82-83)'],
        ['mixed_valid_invalid', { fullName: `${PREFIX}valid`, phone: '9'.repeat(PHONE_MAX + 1) }, 'phone', 'one bad key rejects the whole body'],
      ];
      for (const [slug, body, field, why] of cases) {
        const sent = await call(m.api, `rules_${slug}`, 'PATCH', '/api/me', body, [`422 VALIDATION ${field === null ? 'without field' : `field "${field}"`}: ${why}`]);
        expectError(sent, 422, 'VALIDATION', field);
      }
      const malformed = await call(m.api, 'rules_malformed_json', 'PATCH', '/api/me', undefined, ['truncated JSON → 400 MALFORMED_JSON, keys exactly {code, requestId} (core/errors.py:176-178)'], {
        raw: '{"fullName":',
      });
      expect(Object.keys(expectError(malformed, 400, 'MALFORMED_JSON')).sort()).toEqual(['code', 'requestId']);

      const after = await call(m.api, 'rules_get_after', 'GET', '/api/me', undefined, ['200 identical to the snapshot: no rejected PATCH wrote anything']);
      expect(after.text).toBe(before.text);

      // phone has no Cc / bidi rule (schemas.py:67-76: NFC + strip only, unlike fullName/jobTitle) → BEL is stored as sent.
      const bell = await call(m.api, 'rules_phone_control_char', 'PATCH', '/api/me', { phone: '12\u000734' }, [
        '200: phone "12<BEL>34" accepted and stored as sent — phone has no control-char rule (schemas.py:67-76), observation',
      ]);
      expectMe(bell, { email: m.email, fullName: m.fullName, phone: '12\u000734', language: 'vi' });
      note('observation: PATCH /me accepts a control char (U+0007) in phone; fullName/jobTitle reject it (schemas.py:67-76 vs 40-65)');

      // NUL is not whitespace for str.strip() and has no rule → it reaches a Postgres TEXT column, which cannot hold U+0000.
      // User input must end in a W7 4xx, never a 5xx.
      const nul = await call(m.api, 'rules_phone_nul', 'PATCH', '/api/me', { phone: '12\u000034' }, [
        'phone with U+0000: no validator rejects it (schemas.py:67-76); the answer must not be 5xx (W7 4xx or 200)',
      ]);
      expect(nul.res.status(), `PATCH phone with U+0000 → ${nul.res.status()} ${nul.text.slice(0, 200)}`).toBeLessThan(500);
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · avatar: PUT PNG → 200 MeSchema + absolute signed URL serving a ≤512 px re-encoded PNG; Idempotency-Key replay / reuse 422 / bad key 422; a new upload gets a new object key', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('avatar', cleanup);
      const initial = await call(m.api, 'avatar_get_initial', 'GET', '/api/me', undefined, ['200, no avatarUrl yet']);
      expectMe(initial, { email: m.email, fullName: m.fullName, language: 'vi' });

      // 1: 600x300 RGB PNG → thumbnail 512x256, RGB kept (avatar.py:59,190-218); key users/<id>/avatar/<ULID>.png (storage/keys.py:122-128).
      const key1 = randomUUID();
      const wide = avatarBody(png(600, 300, 2));
      const put1 = await call(m.api, 'avatar_put_png', 'PUT', '/api/me/avatar', wide, [
        '200 MeSchema {email, fullName, language, avatarUrl}; avatarUrl absolute (FE z.string().url())',
      ], { headers: { 'Idempotency-Key': key1 }, shown: shownAvatar(wide, '600x300 RGB PNG') });
      const me1 = expectMe(put1, { email: m.email, fullName: m.fullName, language: 'vi', avatarUrl: true });
      const path1 = avatarPath(me1.avatarUrl);
      expect(path1).toMatch(new RegExp(`/users/${m.id}/avatar/[0-9A-HJKMNP-TV-Z]{26}\\.png$`, 'u'));
      const served1 = await fetchAvatar(String(me1.avatarUrl), 'avatar_fetch_png', ['200 image/png, re-encoded PNG 512x256 RGB (thumbnail of 600x300, avatar.py:206-218)']);
      expect(served1.contentType).toMatch(/^image\/png/u);
      expect(pngHeader(served1.bytes)).toEqual({ width: 512, height: 256, colorType: 2 });

      // 2: same key + same body → the stored response, handler not re-run (core/idempotency.py:225-233) → same object key.
      const put2 = await call(m.api, 'avatar_put_replay', 'PUT', '/api/me/avatar', wide, ['200 replay of the stored response: same avatar object path (no new ULID key)'], {
        headers: { 'Idempotency-Key': key1 },
        shown: shownAvatar(wide, 'same body, same Idempotency-Key'),
      });
      expect(avatarPath(expectMe(put2, { email: m.email, fullName: m.fullName, language: 'vi', avatarUrl: true }).avatarUrl)).toBe(path1);
      const reread = await call(m.api, 'avatar_get_after_replay', 'GET', '/api/me', undefined, ['200, avatarUrl still points at the first object']);
      expect(avatarPath(expectMe(reread, { email: m.email, fullName: m.fullName, language: 'vi', avatarUrl: true }).avatarUrl)).toBe(path1);

      // 3: same key + another body → 422 IDEMPOTENCY_KEY_REUSED (idempotency.py:230-231).
      const square = avatarBody(png(64, 64, 6));
      const reused = await call(m.api, 'avatar_put_key_reused', 'PUT', '/api/me/avatar', square, ['422 IDEMPOTENCY_KEY_REUSED: same key, different body'], {
        headers: { 'Idempotency-Key': key1 },
        shown: shownAvatar(square, '64x64 RGBA PNG, reused key'),
      });
      expectError(reused, 422, 'IDEMPOTENCY_KEY_REUSED');

      // 4: key outside ^[A-Za-z0-9_-]{8,128}$ → 422 VALIDATION field idempotencyKey (idempotency.py:79-83, models/idempotency.py:35).
      const badKey = await call(m.api, 'avatar_put_bad_key', 'PUT', '/api/me/avatar', square, ['422 VALIDATION field "idempotencyKey" for a 5-char key'], {
        headers: { 'Idempotency-Key': 'short' },
        shown: shownAvatar(square, '64x64 RGBA PNG, bad key'),
      });
      expectError(badKey, 422, 'VALIDATION', 'idempotencyKey');

      // 5: new key → new ULID object; RGBA kept, 64x64 not upscaled (avatar.py:185-208).
      const put5 = await call(m.api, 'avatar_put_second', 'PUT', '/api/me/avatar', square, ['200, avatarUrl now a NEW object key (router.py:270-272)'], {
        headers: { 'Idempotency-Key': randomUUID() },
        shown: shownAvatar(square, '64x64 RGBA PNG, new key'),
      });
      const me5 = expectMe(put5, { email: m.email, fullName: m.fullName, language: 'vi', avatarUrl: true });
      const path5 = avatarPath(me5.avatarUrl);
      expect(path5).not.toBe(path1);
      const served5 = await fetchAvatar(String(me5.avatarUrl), 'avatar_fetch_rgba', ['200 image/png 64x64 RGBA (alpha kept, no upscale)']);
      expect(pngHeader(served5.bytes)).toEqual({ width: 64, height: 64, colorType: 6 });
      const final = await call(m.api, 'avatar_get_final', 'GET', '/api/me', undefined, ['200, avatarUrl = the second object']);
      expect(avatarPath(expectMe(final, { email: m.email, fullName: m.fullName, language: 'vi', avatarUrl: true }).avatarUrl)).toBe(path5);
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · avatar body rules: every 422 code the screen maps (VALIDATION mimeType/contentBase64, IMAGE_TOO_LARGE ×2, FILE_TYPE_MISMATCH, AVATAR_TYPE_UNSUPPORTED, AVATAR_DIMENSIONS_EXCEEDED, FILE_CORRUPT), then the 11th PUT → 429 RATE_LIMITED; nothing stored', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('avatarrules', cleanup);
      const tiny = png(4, 4, 2);
      const truncated = tiny.subarray(0, 8 + 25 + 8 + 2); // signature + IHDR + IDAT header + 2 data bytes
      const gif = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(16, 0)]);
      const decodedTooLarge = Buffer.alloc(MAX_DECODED_BYTES + 1, 0); // base64 = exactly MAX_BASE64_LEN chars
      const base64TooLong = Buffer.alloc(MAX_DECODED_BYTES + 4, 0); // base64 = MAX_BASE64_LEN + 4 chars
      expect(decodedTooLarge.toString('base64').length).toBe(MAX_BASE64_LEN);

      // 10 rejected PUTs, each counted by `me_avatar` (dependency before the body check, core/ratelimit.py:105-140).
      const cases: readonly (readonly [string, Json, string, number, string, string | null, string])[] = [
        ['mime_gif', { mimeType: 'image/gif', contentBase64: tiny.toString('base64') }, '4x4 PNG declared image/gif', 422, 'VALIDATION', 'mimeType', 'Literal png|jpeg (schemas.py:104)'],
        ['b64_empty', { mimeType: 'image/png', contentBase64: '' }, 'empty', 422, 'VALIDATION', 'contentBase64', 'min_length 1 (schemas.py:105)'],
        ['b64_invalid', { mimeType: 'image/png', contentBase64: '@@@@' }, 'not base64', 422, 'VALIDATION', 'contentBase64', 'b64decode(validate=True) (avatar.py:137-142)'],
        ['b64_too_long', avatarBody(base64TooLong), `${MAX_BASE64_LEN + 4} chars`, 422, 'VALIDATION', 'contentBase64', `max_length ${MAX_BASE64_LEN} (schemas.py:105, avatar.py:53)`],
        ['decoded_too_large', avatarBody(decodedTooLarge), `${MAX_BASE64_LEN} chars = ${MAX_DECODED_BYTES + 1} bytes`, 422, 'IMAGE_TOO_LARGE', null, '> 512 KiB decoded (avatar.py:143-144)'],
        ['png_as_jpeg', avatarBody(tiny, 'image/jpeg'), '4x4 PNG declared image/jpeg', 422, 'FILE_TYPE_MISMATCH', null, 'magic bytes ≠ mimeType (avatar.py:161-163)'],
        ['gif_as_png', avatarBody(gif), 'GIF89a bytes declared image/png', 422, 'AVATAR_TYPE_UNSUPPORTED', null, 'GIF signature (avatar.py:74-80,165-166)'],
        ['dimension_5000', avatarBody(png(5000, 1, 0)), '5000x1 gray PNG', 422, 'AVATAR_DIMENSIONS_EXCEEDED', null, 'side > 4096 (avatar.py:58,181-182)'],
        ['pixels_49m', avatarBody(png(7000, 7000, 0, 1)), '7000x7000 1-bit PNG', 422, 'IMAGE_TOO_LARGE', null, '49 M px > 40 M, checked before load (avatar.py:57,179-180)'],
        ['png_truncated', avatarBody(truncated), '4x4 PNG cut inside IDAT', 422, 'FILE_CORRUPT', null, 'decode error (avatar.py:177-178,221-222)'],
      ];
      expect(cases.length).toBe(AVATAR_LIMIT);
      for (const [slug, body, what, status, code, field, why] of cases) {
        const sent = await call(m.api, `avatarrules_${slug}`, 'PUT', '/api/me/avatar', body, [`${status} ${code}${field ? ` field "${field}"` : ''}: ${why}`], {
          shown: shownAvatar(body, what),
        });
        expectError(sent, status, code, field);
      }

      // 11th in the 900 s window, a VALID body → 429 before any decode (router.py:47-48,247-249; ratelimit.py:138-140).
      const valid = avatarBody(tiny);
      const limited = await call(m.api, 'avatarrules_11th_rate_limited', 'PUT', '/api/me/avatar', valid, [
        `429 RATE_LIMITED on the ${AVATAR_LIMIT + 1}th PUT within 900 s (rejected bodies count), Retry-After 1..10 (ratelimit.py:92-94)`,
      ], { shown: shownAvatar(valid, 'valid 4x4 PNG') });
      expectError(limited, 429, 'RATE_LIMITED');
      const retryAfter = Number(limited.res.headers()['retry-after']);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(10);

      const after = await call(m.api, 'avatarrules_get_after', 'GET', '/api/me', undefined, ['200 without avatarUrl: no rejected / limited PUT stored anything']);
      expectMe(after, { email: m.email, fullName: m.fullName, language: 'vi' });
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · soft-deleted owner: after DELETE /users/{id} the live Bearer gets 401 SESSION_REVOKED on GET / PATCH / PUT avatar, and refresh → 401 SESSION_REVOKED', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('deleted', cleanup);
      const alive = await call(m.api, 'deleted_get_before', 'GET', '/api/me', undefined, ['200 while the user exists']);
      expectMe(alive, { email: m.email, fullName: m.fullName, language: 'vi' });

      // users/service.py:451-455: deleted_at + status disabled + revoke_sessions("deleted") + token_version bump.
      const { admin } = await batch();
      const del = await call(admin, 'deleted_admin_delete', 'DELETE', `/api/users/${m.id}`, { userId: m.id, confirmEmail: m.email }, [
        '200: admin soft-deletes the test user (users/router.py:111-123)',
      ]);
      expect(del.res.status()).toBe(200);

      // Verifier (auth/sessions.py:605-621) or, inside the ≤ 5 s principal cache, the handler's own re-read
      // (me/router.py:89-93,134,261, K30) → 401 SESSION_REVOKED either way; valid bodies so no 422 can win.
      const get = await call(m.api, 'deleted_get_me', 'GET', '/api/me', undefined, ['401 SESSION_REVOKED (K30: never 500)']);
      expectError(get, 401, 'SESSION_REVOKED');
      const patch = await call(m.api, 'deleted_patch_me', 'PATCH', '/api/me', { jobTitle: `${PREFIX}ghost` }, ['401 SESSION_REVOKED, nothing written']);
      expectError(patch, 401, 'SESSION_REVOKED');
      const body = avatarBody(png(4, 4, 2));
      const put = await call(m.api, 'deleted_put_avatar', 'PUT', '/api/me/avatar', body, ['401 SESSION_REVOKED'], { shown: shownAvatar(body, 'valid 4x4 PNG') });
      expectError(put, 401, 'SESSION_REVOKED');

      const anon = await newApiContext();
      try {
        const refreshed = await call(anon, 'deleted_refresh', 'POST', '/api/auth/refresh', undefined, [
          '401 SESSION_REVOKED: the deleted owner\'s session was revoked (auth/sessions.py:451-452,462-464)',
        ], { headers: { Cookie: `${REFRESH}=${m.cookie}` } });
        expectError(refreshed, 401, 'SESSION_REVOKED');
      } finally {
        await anon.dispose();
      }
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · N13 password body rules: anonymous 401; 422 VALIDATION per field, 422 CURRENT_PASSWORD_INCORRECT, then the 6th POST → 429 RATE_LIMITED; the old password still signs in', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('pwrules', cleanup);
      const fresh = `Qa-${randomUUID()}`; // a valid new password (≥ 8, passwords.py:34)

      // Protected router: Bearer read before the rate limit and the body (core/routing.py:129-135) → no me_password count.
      const anon = await newApiContext();
      cleanup.add(() => anon.dispose());
      const anonymous = await call(anon, 'pwrules_anonymous', 'POST', '/api/me/password', { currentPassword: m.password, newPassword: fresh }, [
        'no Authorization → 401 UNAUTHENTICATED (routing.py:131-133), before me_password',
      ]);
      expectError(anonymous, 401, 'UNAUTHENTICATED');

      // 5 rejected POSTs on THIS user's me_password bucket (me/router.py:45-46,146-153,225; counted before the body
      // check, core/ratelimit.py:105-140). Field = first Pydantic loc, camelCase (core/errors.py:136-157).
      const cases: readonly (readonly [string, Json, string, string, string])[] = [
        ['missing_new', { currentPassword: m.password }, 'VALIDATION', 'newPassword', 'newPassword required (schemas.py:98)'],
        ['new_7_chars', { currentPassword: m.password, newPassword: 'Abc1234' }, 'VALIDATION', 'newPassword', 'min_length 8 (schemas.py:98, passwords.py:34)'],
        ['current_empty', { currentPassword: '', newPassword: fresh }, 'VALIDATION', 'currentPassword', 'min_length 1 (schemas.py:97)'],
        ['extra_key', { currentPassword: m.password, newPassword: fresh, email: m.email }, 'VALIDATION', 'email', 'extra="forbid" (core/wire.py:46,115-118)'],
        ['wrong_current', { currentPassword: `Wrong-${randomUUID()}`, newPassword: fresh }, 'CURRENT_PASSWORD_INCORRECT', 'currentPassword', 'verify fails → 422, never 401 (router.py:227-234, K30)'],
      ];
      for (const [slug, body, code, field, why] of cases) {
        const sent = await call(m.api, `pwrules_${slug}`, 'POST', '/api/me/password', body, [`422 ${code} field "${field}": ${why}`]);
        expectError(sent, 422, code, field);
      }

      // 6th in the 900 s window, a VALID body (right current password) → 429 before the handler (ratelimit.py:138-140).
      const limited = await call(m.api, 'pwrules_6th_rate_limited', 'POST', '/api/me/password', { currentPassword: m.password, newPassword: fresh }, [
        '429 RATE_LIMITED on the 6th POST within 900 s (rejected bodies count, me/router.py:45-46), Retry-After 1..10 (ratelimit.py:92-94)',
      ]);
      expectError(limited, 429, 'RATE_LIMITED');
      const retryAfter = Number(limited.res.headers()['retry-after']);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(10);

      // Nothing changed: the accept-time password still signs in (auth/router.py:160-192 → 204), the session still reads /me.
      const login = await call(anon, 'pwrules_old_password_still_valid', 'POST', '/api/auth/login', { email: m.email, password: m.password, rememberMe: false }, [
        '204: the original password still signs in — no rejected / limited POST changed it',
      ]);
      expect(login.res.status()).toBe(204);
      const me = await call(m.api, 'pwrules_get_after', 'GET', '/api/me', undefined, ['200: the calling session was not revoked by any rejected POST']);
      expectMe(me, { email: m.email, fullName: m.fullName, language: 'vi' });
    } finally {
      await cleanup.run();
    }
  });

  test('A07 · N13 password change: 204 empty; this session kept (GET + refresh), the other session revoked (refresh + Bearer → 401 SESSION_REVOKED); old password 401 INVALID_CREDENTIALS, new one (NFD sent, NFC typed) 204; old current now 422', async () => {
    const cleanup = new Cleanup();
    try {
      const m = await claim('pwchange', cleanup);

      // A second session S2 of the same user (auth/router.py:160-192 login → refresh → Bearer).
      const other = await newApiContext();
      cleanup.add(() => other.dispose());
      const login2 = await call(other, 'pwchange_login_second_session', 'POST', '/api/auth/login', { email: m.email, password: m.password, rememberMe: false }, [
        'setup: 204, a second session for the same user',
      ]);
      expect(login2.res.status()).toBe(204);
      const refresh2 = await call(other, 'pwchange_refresh_second_session', 'POST', '/api/auth/refresh', undefined, ['setup: 200 W16 for the second session']);
      expect(refresh2.res.status()).toBe(200);
      const base = apiBaseUrl();
      const api2 = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${String(asJson(refresh2.body).accessToken)}` } });
      cleanup.add(() => api2.dispose());
      expectMe(await call(api2, 'pwchange_second_get_before', 'GET', '/api/me', undefined, ['200: the second session is alive before the change']), {
        email: m.email,
        fullName: m.fullName,
        language: 'vi',
      });

      // New password sent in NFD; the BE hashes nfc(password) (passwords.py:120-129, C16).
      const nfd = `Qa-${randomUUID()}-Nguyễn`;
      const nfc = nfd.normalize('NFC');
      expect(nfc).not.toBe(nfd);
      const changed = await call(m.api, 'pwchange_change', 'POST', '/api/me/password', { currentPassword: m.password, newPassword: nfd }, [
        '204 with an empty body (router.py:219-244)',
      ]);
      expect(changed.res.status()).toBe(204);
      expect(changed.text).toBe('');

      // This session survives: revoke_sessions(except_sid=this sid) (router.py:217; sessions.py:266-282).
      expectMe(await call(m.api, 'pwchange_this_get_after', 'GET', '/api/me', undefined, ['200: the calling session is kept (except_sid)']), {
        email: m.email,
        fullName: m.fullName,
        language: 'vi',
      });
      const keep = await newApiContext();
      cleanup.add(() => keep.dispose());
      const kept = await call(keep, 'pwchange_this_refresh_after', 'POST', '/api/auth/refresh', undefined, ['200: the calling session still refreshes'], {
        headers: { Cookie: `${REFRESH}=${m.cookie}` },
      });
      expect(kept.res.status()).toBe(200);

      // The other session is revoked: its refresh (sessions.py:449-452 not alive) and its live Bearer (verifier, cache
      // dropped after commit, sessions.py:159-163,604-621; principal cache ≤ 5 s → polled) → 401 SESSION_REVOKED.
      const revoked = await call(other, 'pwchange_second_refresh_after', 'POST', '/api/auth/refresh', undefined, [
        '401 SESSION_REVOKED: the other session was revoked with reason password_change (router.py:217)',
      ]);
      expectError(revoked, 401, 'SESSION_REVOKED');
      await expect.poll(async () => (await api2.get('/api/me')).status(), { timeout: 10_000, intervals: [500] }).toBe(401);
      const bearer2 = await call(api2, 'pwchange_second_get_after', 'GET', '/api/me', undefined, ["401 SESSION_REVOKED: the other session's access token is refused"]);
      expectError(bearer2, 401, 'SESSION_REVOKED');

      // Old password refused, new one (typed in NFC) accepted.
      const probe = await newApiContext();
      cleanup.add(() => probe.dispose());
      const oldLogin = await call(probe, 'pwchange_login_old_password', 'POST', '/api/auth/login', { email: m.email, password: m.password, rememberMe: false }, [
        '401 INVALID_CREDENTIALS: the old password no longer matches (auth/router.py:174-177)',
      ]);
      expectError(oldLogin, 401, 'INVALID_CREDENTIALS');
      const newLogin = await call(probe, 'pwchange_login_new_password_nfc', 'POST', '/api/auth/login', { email: m.email, password: nfc, rememberMe: false }, [
        '204: the new password, typed in NFC, signs in (nfc before hash and verify, passwords.py:120-129)',
      ]);
      expect(newLogin.res.status()).toBe(204);

      // The old password is no longer the current one (router.py:227-234).
      const stale = await call(m.api, 'pwchange_old_current_rejected', 'POST', '/api/me/password', { currentPassword: m.password, newPassword: `Qa-${randomUUID()}` }, [
        '422 CURRENT_PASSWORD_INCORRECT field "currentPassword": the old password is no longer current',
      ]);
      expectError(stale, 422, 'CURRENT_PASSWORD_INCORRECT', 'currentPassword');
    } finally {
      await cleanup.run();
    }
  });
});

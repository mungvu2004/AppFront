/**
 * Phase 7 — SCR-33 BACKEND `/api/me` through the real API (QA-07b P9, skill `qa-api-test`), no browser, NO mocks.
 * Flows FL-A07-01..04 of `QA-07b/flows-C4.md` (anonymous / transport / headers, PATCH wire rules, fullName rules,
 * jobTitle + phone + language rules); one `test()` per flow, one `test.step('[<row id>] …')` per catalog row of
 * `catalog-C4.md`, in the planned order. FL-A07-05..09 (avatar, deleted owner, password) are P10's file part.
 * Endpoints: GET/PATCH /api/me (N11/N12, BE me/router.py:96-143), POST /api/auth/refresh (W16, only G-022),
 * PUT /api/me/avatar + POST /api/me/password (only their anonymous 401 in G-003/G-004). `BE:` = `F:/App/AppBack`
 * main dc510655, paths under `apps/api/`. Every 200 body is also decoded by the FE zod `MeSchema` (strict).
 * Helpers: `support/p07/P9.ts`; pool users: `support/phase03Seed.ts` `poolUser`.
 *
 * ## Non-serial, own data
 * Each flow owns one pool viewer slot (`viewer:p07-api-1..4`; FL-A07-01 also `engineer:p07-api-1`, read-only).
 * FL-A07-02..04 take a snapshot of fullName/jobTitle/phone/language first and restore it with one PATCH in `finally`.
 * The admin is only used by `poolUser` (GET /api/users, invites on the first fill of a slot); never PATCHed.
 *
 * ## Real-backend budget per run of this file
 * - `POST /api/auth/login` per IP (120 / 60 s on the QA stack, 30 BE default): 4 admin + 5 pool users = 9.
 * - `POST /api/auth/refresh`: 5 setup + FL-A07-02 G-022 1 + 3 restores (one per FL-A07-02..04) = 9 (20 / 60 s per session).
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 once the slots are filled; first run ever 5 (1 per slot).
 * - No rate limit on N11 / N12 (me/router.py:109,137: no `dependencies`): FL-A07-02 G-034 sends 12 PATCH + 12 GET,
 *   the whole file ~100 requests on /api/me. `me_avatar` / `me_password` are NOT counted: the two anonymous probes
 *   (G-003, G-004) are refused with 401 before the limiter (router.py:220-226,264).
 * - Idempotency rows: FL-A07-02 leaves 1 (key of G-031/G-032, 24 h TTL; core/idempotency.py:49).
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { apiBaseUrl, newApiContext } from './support/api';
import {
  Cleanup,
  FULL_NAME_MAX,
  PHONE_MAX,
  PREFIX,
  adminApi,
  asJson,
  bareContext,
  call,
  errBody,
  expectError,
  expectMe,
  padded,
  png,
  poolSession,
  restore,
  snapshotOf,
  type CallOptions,
  type Json,
  type Sent,
  type Session,
  type Snapshot,
} from './support/p07/P9';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const EVIL_ORIGIN = 'https://evil.example.test';

/** Expected MeSchema body for `email` + the profile `cur` (empty jobTitle / phone = NULL = key absent, W2). */
function shape(email: string, cur: Snapshot): Json {
  return {
    email,
    fullName: cur.fullName,
    language: cur.language,
    ...(cur.jobTitle ? { jobTitle: cur.jobTitle } : {}),
    ...(cur.phone ? { phone: cur.phone } : {}),
  };
}

const meText = async (s: Session): Promise<string> => (await s.api.get('/api/me')).text();

/** PATCH /api/me as `s`, evidence `A07_<name>.json`. */
const patchMe = (s: Session, name: string, body: unknown, assertions: readonly string[], options?: CallOptions): Promise<Sent> =>
  call(s.api, name, 'PATCH', '/api/me', body, assertions, options);

/** PATCH that must be refused with 422 `VALIDATION` (`field`, or none for `null`), after which GET /api/me is unchanged. */
async function expectRejected(s: Session, name: string, body: unknown, field: string | null, why: string, hard = false): Promise<Sent> {
  const before = await meText(s);
  const sent = await patchMe(s, name, body, [`422 VALIDATION ${field === null ? 'without field' : `field "${field}"`}: ${why}`, 'GET /api/me unchanged']);
  expectError(sent, 422, 'VALIDATION', field, hard);
  expect.soft(await meText(s), `${name}: nothing written`).toBe(before);
  return sent;
}

test.describe('A07 phase-7 backend (/api/me N11 / N12, refresh W16)', () => {
  test('SCR-33 · FL-A07-01 · Anonymous, bad credentials, transport and headers of /api/me', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const viewer = await poolSession(admin, 'viewer', 'p07-api-1', cleanup);
      const anon = await newApiContext();
      cleanup.add(() => anon.dispose());
      const base = apiBaseUrl();
      const initial = await viewer.api.get('/api/me');
      expect(initial.status(), 'setup: GET /api/me as the pool viewer').toBe(200);
      const profile = asJson(await initial.json());
      const bearer = { Authorization: `Bearer ${viewer.token}` };

      await test.step('[B07-G-001] anonymous GET /api/me → 401 UNAUTHENTICATED, keys code + requestId', async () => {
        const sent = await call(anon, 'B07-G-001_get_api_me_anonymous', 'GET', '/api/me', undefined, ['no Authorization → 401 UNAUTHENTICATED, keys {code, requestId} (core/routing.py:129-135)']);
        const body = expectError(sent, 401, 'UNAUTHENTICATED', undefined, true);
        expect(Object.keys(body).sort()).toEqual(['code', 'requestId']);
      });

      await test.step('[B07-G-002] anonymous PATCH with truncated JSON → 401, not 400 MALFORMED_JSON', async () => {
        const sent = await call(anon, 'B07-G-002_patch_anonymous_truncated_json', 'PATCH', '/api/me', undefined, ['truncated JSON, no Authorization → 401 UNAUTHENTICATED (Bearer read before the body, core/routing.py:129-135,262-263)'], { raw: '{"fullName":' });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[B07-G-003] anonymous PUT /api/me/avatar with a valid 2x2 PNG → 401 before limiter and decode', async () => {
        const content = png(2, 2).toString('base64');
        const sent = await call(anon, 'B07-G-003_put_avatar_anonymous', 'PUT', '/api/me/avatar', { mimeType: 'image/png', contentBase64: content }, ['valid 2x2 PNG, no Authorization → 401 UNAUTHENTICATED before the rate limit and the decode (core/routing.py:262-263; router.py:264)'], {
          shown: { mimeType: 'image/png', contentBase64: `<${content.length} base64 chars: 2x2 RGB PNG>` },
        });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[B07-G-004] anonymous POST /api/me/password with a valid body → 401 before me_password is counted', async () => {
        const sent = await call(anon, 'B07-G-004_post_password_anonymous', 'POST', '/api/me/password', { currentPassword: 'Qa-anon-current-1', newPassword: 'Qa-anon-new-pass-1' }, ['valid body, no Authorization → 401 UNAUTHENTICATED before me_password is counted and before the body is read (router.py:220-226)']);
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[B07-G-005] GET /api/me with Bearer not-a-jwt → 401 UNAUTHENTICATED', async () => {
        const sent = await call(anon, 'B07-G-005_get_api_me_garbage_bearer', 'GET', '/api/me', undefined, ['Authorization "Bearer not-a-jwt" → 401 UNAUTHENTICATED (auth/verifier.py:27-30; auth/tokens.py:70-73)'], { headers: { Authorization: 'Bearer not-a-jwt' } });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[B07-G-006] GET /api/me with the Basic scheme → 401 UNAUTHENTICATED', async () => {
        const sent = await call(anon, 'B07-G-006_get_api_me_basic_scheme', 'GET', '/api/me', undefined, ['Authorization "Basic cWE6cWE=" → 401 UNAUTHENTICATED (scheme != bearer, core/routing.py:131-133)'], { headers: { Authorization: 'Basic cWE6cWE=' } });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });

      await test.step('[B07-G-007] valid token under the lower-case scheme "bearer" → 200 MeSchema', async () => {
        const lower = await bareContext(cleanup, { Origin: base, Authorization: `bearer ${viewer.token}` });
        const sent = await call(lower, 'B07-G-007_get_api_me_lowercase_scheme', 'GET', '/api/me', undefined, ['"bearer <jwt>" → 200 MeSchema: the scheme is compared with .lower() (core/routing.py:131)']);
        expectMe(sent, profile);
      });

      await test.step('[B07-G-008] foreign Origin (Bearer, no cookie) → 200, no ORIGIN_MISMATCH', async () => {
        const bare = await bareContext(cleanup, bearer);
        const sent = await call(bare, 'B07-G-008_get_api_me_foreign_origin', 'GET', '/api/me', undefined, [`Origin ${EVIL_ORIGIN} → 200 MeSchema: /me has no require_origin (grep: auth/, auth_recovery/ only) and the app has no CORS middleware (core/app.py)`], { headers: { Origin: EVIL_ORIGIN } });
        expect.soft(sent.res.status(), 'not 403 ORIGIN_MISMATCH').not.toBe(403);
        expectMe(sent, profile);
      });

      await test.step('[B07-G-009] no Origin header at all → 200 MeSchema', async () => {
        const bare = await bareContext(cleanup, bearer);
        const sent = await call(bare, 'B07-G-009_get_api_me_no_origin', 'GET', '/api/me', undefined, ['no Origin header, Bearer only → 200 MeSchema: the Bearer is the credential, no Origin gate']);
        expectMe(sent, profile);
      });

      await test.step('[B07-G-010] error body requestId equals the X-Request-Id response header', async () => {
        const sent = await call(anon, 'B07-G-010_request_id_matches_header', 'GET', '/api/me', undefined, ['401 body requestId == response header X-Request-Id (core/errors.py:44,82-88)']);
        const body = expectError(sent, 401, 'UNAUTHENTICATED');
        expect.soft(sent.res.headers()['x-request-id'], 'X-Request-Id header present').toBeTruthy();
        expect.soft(body.requestId).toBe(sent.res.headers()['x-request-id']);
      });

      await test.step('[B07-G-011] own profile of the pool viewer: exact keys, optional keys absent', async () => {
        const sent = await call(viewer.api, 'B07-G-011_get_api_me_own_profile', 'GET', '/api/me', undefined, ['200 {email, fullName, language:"vi"} exact keys; jobTitle/phone/avatarUrl absent when NULL; FE MeSchema.strict() decodes it (router.py:96-106; schemas.py:21-29)']);
        const body = expectMe(sent, { email: viewer.user.email, fullName: profile.fullName, language: 'vi' });
        expect.soft(Object.keys(body).sort()).toEqual(['email', 'fullName', 'language']);
      });

      await test.step('[B07-G-012] GET /api/me carries the four security headers', async () => {
        const sent = await call(viewer.api, 'B07-G-012_get_api_me_headers', 'GET', '/api/me', undefined, ['Cache-Control no-store, X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy same-origin (core/middleware.py:48-53,191-199)']);
        const headers = sent.res.headers();
        expect.soft(headers['cache-control']).toBe('no-store');
        expect.soft(headers['x-content-type-options']).toBe('nosniff');
        expect.soft(headers['x-frame-options']).toBe('DENY');
        expect.soft(headers['referrer-policy']).toBe('same-origin');
      });

      await test.step('[B07-G-013] DELETE /api/me (no such method) → 404 NOT_FOUND', async () => {
        const sent = await call(viewer.api, 'B07-G-013_delete_api_me', 'DELETE', '/api/me', undefined, ['method the router does not define → 405 is mapped to 404 NOT_FOUND (core/errors.py:52-54)']);
        expectError(sent, 404, 'NOT_FOUND');
      });

      await test.step('[B07-G-014] PATCH /api/me as text/plain → 4xx W7 body, never 5xx, nothing written', async () => {
        const before = await meText(viewer);
        const sent = await call(viewer.api, 'B07-G-014_patch_api_me_text_plain', 'PATCH', '/api/me', undefined, ['Content-Type text/plain + body "fullName=x" → 4xx with {code, requestId}, never 5xx; FastAPI cannot bind the JSON model; expected 422 VALIDATION without field (recorded in the evidence)'], {
          raw: 'fullName=x',
          headers: { 'Content-Type': 'text/plain' },
        });
        const status = sent.res.status();
        expect.soft(status, `status ${status} (expected 422 VALIDATION)`).toBeGreaterThanOrEqual(400);
        expect.soft(status).toBeLessThan(500);
        const body = errBody(sent.body);
        expect.soft(typeof body.code, 'W7 body has code').toBe('string');
        expect.soft(typeof body.requestId, 'W7 body has requestId').toBe('string');
        expect.soft(await meText(viewer), 'nothing written').toBe(before);
      });

      await test.step('[B07-G-038] an engineer reads its OWN row via GET /api/me', async () => {
        const engineer = await poolSession(admin, 'engineer', 'p07-api-1', cleanup);
        const sent = await call(engineer.api, 'B07-G-038_get_api_me_engineer_own_row', 'GET', '/api/me', undefined, ['200 with the engineer\'s own email; no path id, so no IDOR surface (router.py:110-112 uses principal.user_id)']);
        const body = errBody(sent.body);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(body.email).toBe(engineer.user.email);
        expect.soft(body.email).not.toBe(viewer.user.email);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-33 · FL-A07-02 · PATCH /api/me wire rules, read-back, refresh name, idempotency, no rate limit', async () => {
    const cleanup = new Cleanup();
    let s: Session | undefined;
    let snap: Snapshot | undefined;
    try {
      const admin = await adminApi(cleanup);
      s = await poolSession(admin, 'viewer', 'p07-api-2', cleanup);
      snap = await snapshotOf(s);
      const email = s.user.email;
      const me = s;
      const newName = `${PREFIX}api2-name`;
      const fresh = { fullName: newName, jobTitle: 'QA lead', phone: '+84 901 234 567', language: 'en' };
      let patched: Sent | undefined;
      const key = randomUUID();

      await test.step('[B07-G-024] PATCH with a JSON array body → 422 VALIDATION without field', async () => {
        await expectRejected(me, 'B07-G-024_patch_array_body', [], null, 'body is not an object → loc (body,) is dropped (core/errors.py:136-157)', true);
      });

      await test.step('[B07-G-025] PATCH with an extra key email → 422 field email, GET unchanged', async () => {
        await expectRejected(me, 'B07-G-025_patch_extra_key_email', { fullName: `${PREFIX}x`, email: 'other@example.test' }, 'email', 'extra=forbid, email is not editable (core/wire.py:46,115-118)');
      });

      await test.step('[B07-G-027] PATCH with truncated JSON and a valid Bearer → 400 MALFORMED_JSON, keys code + requestId', async () => {
        const sent = await patchMe(me, 'B07-G-027_patch_truncated_json', undefined, ['truncated JSON + valid Bearer → 400 MALFORMED_JSON, body keys exactly {code, requestId} (core/errors.py:176-178)'], { raw: '{"fullName":' });
        const body = expectError(sent, 400, 'MALFORMED_JSON');
        expect.soft(Object.keys(body).sort()).toEqual(['code', 'requestId']);
      });

      await test.step('[B07-G-028] one good key + phone of 33 chars → 422 field phone, whole body rejected', async () => {
        await expectRejected(me, 'B07-G-028_patch_good_plus_bad_phone', { fullName: `${PREFIX}valid`, phone: '1'.repeat(PHONE_MAX + 1) }, 'phone', 'Pydantic rejects before the handler, so the valid fullName is not written either (core/routing.py:9-12)');
      });

      await test.step('[B07-G-015] PATCH body of 1 048 577 bytes → 413 PAYLOAD_TOO_LARGE, nothing written', async () => {
        const raw = `{"fullName":"${'A'.repeat(1_048_577 - 15)}"}`;
        expect(Buffer.byteLength(raw), 'precondition: body is 1 MiB + 1').toBe(1_048_577);
        const before = await meText(me);
        const sent = await patchMe(me, 'B07-G-015_patch_over_1mib', undefined, ['Content-Length 1 048 577 → 413 PAYLOAD_TOO_LARGE before the handler (core/middleware.py:217-250; routing.py:46 DEFAULT_BODY_LIMIT 1 MiB)'], {
          raw,
          shown: '<{"fullName":"AAAA…"} 1 048 577 bytes>',
        });
        expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
        expect.soft(await meText(me), 'nothing written').toBe(before);
      });

      await test.step('[B07-G-029] PATCH all four keys as a viewer → 200 with the four new values', async () => {
        patched = await patchMe(me, 'B07-G-029_patch_four_keys', fresh, ['200 MeSchema with the four new values; no role gate on /me (router.py:137-143)']);
        expectMe(patched, shape(email, fresh));
      });

      await test.step('[B07-G-021] GET right after the PATCH → body text identical to the PATCH answer', async () => {
        const sent = await call(me.api, 'B07-G-021_get_after_patch', 'GET', '/api/me', undefined, ['200 body text == the PATCH answer: the handler re-reads the row (router.py:141-143)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.text).toBe(patched?.text);
      });

      await test.step('[B07-G-022] POST /api/auth/refresh after PATCH fullName → user.name is the saved fullName', async () => {
        const sent = await call(me.anon, 'B07-G-022_refresh_after_patch', 'POST', '/api/auth/refresh', undefined, ['200 W16 user.name == the fullName just saved (auth/sessions.py:314,339; auth/router.py:253-282)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(errBody(errBody(sent.body).user).name).toBe(newName);
      });

      await test.step('[B07-G-031] same Idempotency-Key + same body twice → the second answer is the stored first', async () => {
        const headers = { 'Idempotency-Key': key };
        const first = await patchMe(me, 'B07-G-031_patch_idempotent_first', { jobTitle: 'idem one' }, ['first PATCH with a fresh key → 200 MeSchema'], { headers });
        expectMe(first, shape(email, { ...fresh, jobTitle: 'idem one' }));
        // An unkeyed write in between: a replay that re-ran the handler would put 'idem one' back.
        const between = await patchMe(me, 'B07-G-031_patch_between', { jobTitle: 'idem other' }, ['unkeyed PATCH between the two keyed calls → 200']);
        expect.soft(between.res.status()).toBe(200);
        const second = await patchMe(me, 'B07-G-031_patch_idempotent_replay', { jobTitle: 'idem one' }, ['same key, same body → the stored response of the first (core/idempotency.py:225-233): identical text, handler not re-run'], { headers });
        expect.soft(second.res.status()).toBe(first.res.status());
        expect.soft(second.text).toBe(first.text);
        expect.soft(errBody(JSON.parse(await meText(me))).jobTitle, 'the replay did not re-run the handler').toBe('idem other');
      });

      await test.step('[B07-G-032] same Idempotency-Key + a different body → 422 IDEMPOTENCY_KEY_REUSED', async () => {
        const sent = await patchMe(me, 'B07-G-032_patch_key_reused', { jobTitle: 'idem two' }, ['used key with a different body → 422 IDEMPOTENCY_KEY_REUSED (idempotency.py:230-231)'], { headers: { 'Idempotency-Key': key } });
        expectError(sent, 422, 'IDEMPOTENCY_KEY_REUSED');
      });

      await test.step('[B07-G-033] Idempotency-Key of 5 chars → 422 VALIDATION field idempotencyKey', async () => {
        const sent = await patchMe(me, 'B07-G-033_patch_short_key', { jobTitle: 'idem three' }, ['key must match ^[A-Za-z0-9_-]{8,128}$ → 422 VALIDATION field idempotencyKey (idempotency.py:79-83)'], { headers: { 'Idempotency-Key': 'short' } });
        expectError(sent, 422, 'VALIDATION', 'idempotencyKey');
      });

      await test.step('[B07-G-034] 12 consecutive PATCH + GET within seconds → all 200, no 429', async () => {
        const statuses: number[] = [];
        let last: Sent | undefined;
        for (let i = 1; i <= 12; i += 1) {
          const patch = await me.api.patch('/api/me', { data: { jobTitle: `burst ${i}` } });
          statuses.push(patch.status());
          const get = await me.api.get('/api/me');
          statuses.push(get.status());
          if (i === 12) last = await call(me.api, 'B07-G-034_burst_last_patch', 'PATCH', '/api/me', { jobTitle: 'burst 12' }, ['the 13th write after 12 PATCH + 12 GET within seconds → 200: N11/N12 have no rate limit (router.py:109,137: no dependencies)']);
        }
        expect.soft(statuses, '24 answers of the burst').toEqual(Array<number>(24).fill(200));
        expect.soft(last?.res.status()).toBe(200);
      });
    } finally {
      if (s && snap) await restore(s, snap);
      await cleanup.run();
    }
  });

  test('SCR-33 · FL-A07-03 · fullName rules: trim, 120/121, NFD length, empty, bidi, nothing written on 422', async () => {
    const cleanup = new Cleanup();
    let s: Session | undefined;
    let snap: Snapshot | undefined;
    try {
      const admin = await adminApi(cleanup);
      s = await poolSession(admin, 'viewer', 'p07-api-3', cleanup);
      snap = await snapshotOf(s);
      const me = s;
      const email = s.user.email;
      const cur: Mutable<Snapshot> = { ...snap };
      const nfd120 = 'ễ'.normalize('NFD').repeat(FULL_NAME_MAX);
      const nfd121 = 'ễ'.normalize('NFD').repeat(FULL_NAME_MAX + 1);

      await test.step('[B07-C-002] fullName with outer spaces → 200, trimmed', async () => {
        const sent = await patchMe(me, 'B07-C-002_fullname_outer_spaces', { fullName: `  ${PREFIX}api3-name  ` }, ['200, fullName trimmed (clean_text: strip + NFC, schemas.py:51)']);
        cur.fullName = `${PREFIX}api3-name`;
        expectMe(sent, shape(email, cur), true);
      });

      await test.step('[B07-C-003] fullName of exactly 120 chars → 200, stored whole', async () => {
        cur.fullName = padded(FULL_NAME_MAX);
        expect(cur.fullName).toHaveLength(FULL_NAME_MAX);
        const sent = await patchMe(me, 'B07-C-003_fullname_120', { fullName: cur.fullName }, ['200, 120 chars stored whole (FULL_NAME_MAX 120, schemas.py:16,52)']);
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-004] fullName of 121 chars → 422 VALIDATION field fullName', async () => {
        await expectRejected(me, 'B07-C-004_fullname_121', { fullName: padded(FULL_NAME_MAX + 1) }, 'fullName', '121 > 120 (schemas.py:52-53)');
      });

      await test.step('[B07-C-005] 120 x ễ in NFD → 200, 121 x → 422 (length counted after NFC)', async () => {
        // In NFD each ễ is 3 code points (e + U+0302 + U+0303), so the raw length is 360 / 363, far above 120.
        const ok = await patchMe(me, 'B07-C-005_fullname_nfd_120', { fullName: nfd120 }, ['120 x ễ sent in NFD → 200: the length is counted AFTER NFC (clean_text then len, schemas.py:51-52)']);
        cur.fullName = 'ễ'.repeat(FULL_NAME_MAX);
        expectMe(ok, shape(email, cur));
        await expectRejected(me, 'B07-C-005_fullname_nfd_121', { fullName: nfd121 }, 'fullName', '121 x ễ in NFD → 121 chars after NFC (schemas.py:51-52)');
      });

      await test.step('[B07-C-007] empty fullName → 422 VALIDATION field fullName', async () => {
        await expectRejected(me, 'B07-C-007_fullname_empty', { fullName: '' }, 'fullName', '1 <= len (schemas.py:52-53)');
      });

      await test.step('[B07-C-011] fullName with U+202E (bidi override) → 422 field fullName', async () => {
        await expectRejected(me, 'B07-C-011_fullname_bidi', { fullName: `${PREFIX}\u202Eevil` }, 'fullName', 'bidi override rejected (packages/core/text.py:6,34-46)');
      });

      await test.step('[B07-C-012] 120 chars + 3 outer spaces → 200 (trim before the length check)', async () => {
        const name = padded(FULL_NAME_MAX, 'B');
        const sent = await patchMe(me, 'B07-C-012_fullname_120_outer_spaces', { fullName: ` ${name}  ` }, ['200: trim happens before the length check (clean_text → len, schemas.py:51-52)']);
        cur.fullName = name;
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-013] rejected fullName writes nothing: GET equals the read before the 422s', async () => {
        const before = await call(me.api, 'B07-C-013_get_before_rejects', 'GET', '/api/me', undefined, ['read before the rejected writes']);
        expect.soft(before.res.status()).toBe(200);
        const bodies: [string, unknown][] = [
          ['121', { fullName: padded(FULL_NAME_MAX + 1) }],
          ['nfd121', { fullName: nfd121 }],
          ['empty', { fullName: '' }],
          ['bidi', { fullName: `${PREFIX}\u202Eevil` }],
        ];
        for (const [slug, body] of bodies) {
          const sent = await patchMe(me, `B07-C-013_reject_${slug}`, body, ['422 VALIDATION field fullName']);
          expectError(sent, 422, 'VALIDATION', 'fullName');
        }
        const after = await call(me.api, 'B07-C-013_get_after_rejects', 'GET', '/api/me', undefined, ['GET text equals the read before the four 422 writes']);
        expect.soft(after.text).toBe(before.text);
      });
    } finally {
      if (s && snap) await restore(s, snap);
      await cleanup.run();
    }
  });

  test('SCR-33 · FL-A07-04 · jobTitle, phone (BUG-498) and language rules', async () => {
    const cleanup = new Cleanup();
    let s: Session | undefined;
    let snap: Snapshot | undefined;
    try {
      const admin = await adminApi(cleanup);
      s = await poolSession(admin, 'viewer', 'p07-api-4', cleanup);
      snap = await snapshotOf(s);
      const me = s;
      const email = s.user.email;
      const cur: Mutable<Snapshot> = { ...snap };

      await test.step('[B07-C-020] jobTitle of exactly 120 chars → 200 stored', async () => {
        cur.jobTitle = padded(FULL_NAME_MAX, 'J');
        expect(cur.jobTitle).toHaveLength(FULL_NAME_MAX);
        const sent = await patchMe(me, 'B07-C-020_jobtitle_120', { jobTitle: cur.jobTitle }, ['200, 120 chars stored (schemas.py:63)']);
        expectMe(sent, shape(email, cur), true);
      });

      await test.step('[B07-C-021] jobTitle of 121 chars → 422 field jobTitle', async () => {
        await expectRejected(me, 'B07-C-021_jobtitle_121', { jobTitle: padded(FULL_NAME_MAX + 1, 'J') }, 'jobTitle', '121 > 120 (schemas.py:63-64)');
      });

      await test.step('[B07-C-023] jobTitle with U+0007 (Cc) → 422 field jobTitle', async () => {
        await expectRejected(me, 'B07-C-023_jobtitle_control_char', { jobTitle: `${PREFIX}\u0007bell` }, 'jobTitle', 'Cc character rejected (packages/core/text.py:34-46)');
      });

      await test.step('[B07-C-027] jobTitle with outer spaces → 200, trimmed', async () => {
        cur.jobTitle = 'QA lead';
        const sent = await patchMe(me, 'B07-C-027_jobtitle_trim', { jobTitle: '  QA lead  ' }, ['200, "QA lead" (trimmed)']);
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-030] phone of exactly 32 chars → 200 stored', async () => {
        cur.phone = '1'.repeat(PHONE_MAX);
        const sent = await patchMe(me, 'B07-C-030_phone_32', { phone: cur.phone }, ['200, 32 chars stored (PHONE_MAX 32, schemas.py:17,78)']);
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-032] ⚑ phone with U+0000 → 422 field phone, not 500 INTERNAL (BUG-498)', async () => {
        const sent = await expectRejected(me, 'B07-C-032_phone_nul', { phone: '12\u000034' }, 'phone', 'clean_text in _validate_phone (schemas.py:67-80, BUG-498): 422, NOT 500 INTERNAL');
        expect.soft(errBody(sent.body).code, 'never 500 INTERNAL').not.toBe('INTERNAL');
      });

      await test.step('[B07-C-034] ⚑ phone with U+0007 → 422 field phone (the old build stored it)', async () => {
        await expectRejected(me, 'B07-C-034_phone_bel', { phone: '12\u000734' }, 'phone', 'Cc character rejected by clean_text (schemas.py:77)');
      });

      await test.step('[B07-C-039] phone with outer spaces → 200, trimmed', async () => {
        cur.phone = '+84 901 234 567';
        const sent = await patchMe(me, 'B07-C-039_phone_trim', { phone: ' +84 901 234 567 ' }, ['200, "+84 901 234 567" (trimmed)']);
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-040] free-form phone → 200 stored as sent (no format rule)', async () => {
        cur.phone = '+84 (0)90-123 4567 ext.5';
        const sent = await patchMe(me, 'B07-C-040_phone_free_form', { phone: cur.phone }, ['200, stored as sent: the BE has no phone format rule (schemas.py:67-80)']);
        expectMe(sent, shape(email, cur));
      });

      await test.step('[B07-C-050] language en then back to vi → 200 each, value follows', async () => {
        cur.language = 'en';
        const en = await patchMe(me, 'B07-C-050_language_en', { language: 'en' }, ['200 language "en" (Literal vi|en, schemas.py:38)']);
        expectMe(en, shape(email, cur));
        cur.language = 'vi';
        const vi = await patchMe(me, 'B07-C-050_language_vi', { language: 'vi' }, ['200 language "vi"']);
        expectMe(vi, shape(email, cur));
      });

      await test.step('[B07-C-051] language fr → 422 field language', async () => {
        await expectRejected(me, 'B07-C-051_language_fr', { language: 'fr' }, 'language', 'Literal["vi","en"] (schemas.py:38)');
      });

      await test.step('[B07-C-052] language EN (upper case) → 422 field language', async () => {
        await expectRejected(me, 'B07-C-052_language_upper_case', { language: 'EN' }, 'language', 'the Literal is case-sensitive');
      });

      await test.step('[B07-C-053] language "" → 422 field language', async () => {
        await expectRejected(me, 'B07-C-053_language_empty', { language: '' }, 'language', 'empty string is not in the Literal');
      });
    } finally {
      if (s && snap) await restore(s, snap);
      await cleanup.run();
    }
  });
});

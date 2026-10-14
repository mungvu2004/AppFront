/**
 * Phase 7 — SCR-33 BACKEND through the real API, pack P10 (QA-07b): avatar N14 (FL-A07-05, 06), soft-deleted owner on all
 * four /api/me endpoints (FL-A07-07) and the password endpoint N13 (FL-A07-08, 09). Skill `qa-api-test`, no browser, NO mocks.
 * Flows + oracle: `QA-07b/flows-C4.md` / `catalog-C4.md` (BE `F:/App/AppBack` main dc510655, `apps/api/me/*`).
 * One `test()` per flow, one `test.step('[<catalog row id>] ...')` per row in the planned order; H steps use hard `expect`,
 * the rest `expect.soft`. Evidence: `A07_<row id>_<slug>.json` through `captureExchange` (signed avatar URL query redacted).
 *
 * ## Own data (non-serial)
 * Avatars cannot be unset and the 900 s windows of `me_avatar` / `me_password` live in Redis per user id, so every flow owns a
 * DISPOSABLE viewer (`support/p07/P10.ts` `claim`): ONE `POST /api/users/invitations` per worker (6 addresses) -> Mailpit
 * token -> accept -> refresh -> Bearer. Each flow deletes its user (admin `DELETE /api/users/{id}`) and its mail in `finally`;
 * `afterAll` deletes the slots no test claimed. The admin only invites and deletes; the shared pool users are not used.
 *
 * ## Request budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `POST /api/users/invitations` 30 / 3600 s per admin: 1 per worker that runs this file (+1 per worker restart).
 * - `recovery_ip` (invitation accepts) 10 / 900 s per IP (override 60): 5 flows claim 6 users (FL-06 claims 2) = 6 per worker run.
 * - `POST /api/auth/login`: admin 1 per worker; FL-08 1 (old password still valid); FL-09 1 (2nd session) + 1 (new 8-char) +
 *   1 (old, refused) + 1 (NFC) + 1 (final) = 5, of which 1 failed on the test user's own (email, IP) bucket (5 / 900 s).
 * - `me_avatar` 10 / 900 s per USER (counted before body validation, core/ratelimit.py:105-140; 413 is middleware, not counted):
 *   FL-05 6 counted (01,02,03,04,05a,05b; the 413 is last and not counted); FL-06 `avatarrl` 11 = the designed 429,
 *   `avatarb` 1; FL-07 1 (401 before the count).
 * - `me_password` 5 / 900 s per USER: FL-08 5 rejected (099,100,102,C-070, email key) + the designed 6th = 429;
 *   FL-09 exactly 5 (101, 097, 096, 111 x2); FL-07 0 (401 first).
 * - PATCH /api/me: FL-07 1 (401). PUT avatar objects: FL-05 3 (+1 rejected earlier), FL-06 1 in MinIO, purged by `purge_avatars`.
 */
import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { captureExchange, newApiContext } from './support/api';
import {
  adminApi,
  asJson,
  avatarBody,
  avatarPath,
  call,
  claim,
  Cleanup,
  cleanupUnclaimed,
  bearerContext,
  expectError,
  expectMe,
  expectPng,
  expectRateLimited,
  fetchAvatar,
  oversizedBody,
  png,
  refreshWith,
  rotatedCookie,
  shownAvatar,
  MAX_BASE64_LEN,
  MAX_DECODED_BYTES,
  type Json,
  type Sent,
} from './support/p07/P10';

const FLOW_TIMEOUT_MS = 120_000; // estimate <= 55 s (flows-C4); invite + mail wait on the first flow of a worker

test.afterAll(async () => {
  await cleanupUnclaimed();
});

/** POST /api/auth/login on a throw-away context (204 on success; the refresh cookie is not kept). */
async function login(slug: string, id: string, email: string, password: string, assertions: readonly string[]): Promise<Sent> {
  const probe = await newApiContext();
  try {
    return await call(probe, id, slug, 'POST', '/api/auth/login', { email, password, rememberMe: false }, assertions);
  } finally {
    await probe.dispose();
  }
}

test('SCR-33 · FL-A07-05 · Avatar upload: re-encode, RGBA, 4096 boundary, idempotency key, 413', async () => {
  test.setTimeout(FLOW_TIMEOUT_MS);
  const cleanup = new Cleanup();
  try {
    const m = await claim('avatar', cleanup);
    const me = { email: m.email, fullName: m.fullName, language: 'vi' };
    const key1 = randomUUID();
    const wide = avatarBody(png(600, 300, 2));
    const square = avatarBody(png(64, 64, 6));
    let path1 = '';

    await test.step('[B07-G-051] PUT 600x300 RGB PNG -> served 512x256 colour type 2', async () => {
      // avatar.py:59,190-218 (thumbnail <= 512, RGB kept); object key users/<usr_id>/avatar/<ULID>.png (storage/keys.py:122-128).
      const put = await call(m.api, 'B07-G-051', 'put_600x300_rgb_png', 'PUT', '/api/me/avatar', wide, ['200 MeSchema with an absolute avatarUrl'], {
        headers: { 'Idempotency-Key': key1 },
        shown: shownAvatar(wide, '600x300 RGB PNG'),
      });
      const body = expectMe(put, { ...me, avatarUrl: true }, true);
      path1 = avatarPath(body.avatarUrl);
      expect(path1).toMatch(new RegExp(`/users/${m.id}/avatar/[0-9A-HJKMNP-TV-Z]{26}\\.png$`, 'u'));
      expect(String(body.avatarUrl)).toMatch(/^https?:\/\//u);
      const served = await fetchAvatar(String(body.avatarUrl), 'B07-G-051', 'fetch_signed_url', ['200 image/png, re-encoded thumbnail 512x256 colour type 2'], true);
      expect(served.contentType).toMatch(/^image\/png/u);
      expectPng(served.bytes, { width: 512, height: 256, colorType: 2 }, true);
    });

    await test.step('[B07-G-077] same Idempotency-Key + different body -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
      const sent = await call(m.api, 'B07-G-077', 'put_key_reused', 'PUT', '/api/me/avatar', square, ['422 IDEMPOTENCY_KEY_REUSED (idempotency.py:230-231)'], {
        headers: { 'Idempotency-Key': key1 },
        shown: shownAvatar(square, '64x64 RGBA PNG, reused key'),
      });
      expectError(sent, 422, 'IDEMPOTENCY_KEY_REUSED');
    });

    await test.step('[B07-G-078] Idempotency-Key "short" -> 422 VALIDATION idempotencyKey', async () => {
      // key must match ^[A-Za-z0-9_-]{8,128}$ (idempotency.py:79-83).
      const sent = await call(m.api, 'B07-G-078', 'put_bad_key', 'PUT', '/api/me/avatar', square, ['422 VALIDATION field "idempotencyKey" for a 5-char key'], {
        headers: { 'Idempotency-Key': 'short' },
        shown: shownAvatar(square, '64x64 RGBA PNG, bad key'),
      });
      expectError(sent, 422, 'VALIDATION', 'idempotencyKey');
    });

    await test.step('[B07-G-052] PUT 64x64 RGBA PNG -> served 64x64 colour type 6 (alpha kept, not upscaled)', async () => {
      // avatar.py:185-208; a new key -> a new ULID object (router.py:270-272).
      const put = await call(m.api, 'B07-G-052', 'put_64x64_rgba_png', 'PUT', '/api/me/avatar', square, ['200, avatarUrl is a NEW object path'], {
        headers: { 'Idempotency-Key': randomUUID() },
        shown: shownAvatar(square, '64x64 RGBA PNG, new key'),
      });
      const body = expectMe(put, { ...me, avatarUrl: true });
      expect.soft(avatarPath(body.avatarUrl), 'a new upload gets a new object key').not.toBe(path1);
      const served = await fetchAvatar(String(body.avatarUrl), 'B07-G-052', 'fetch_signed_url', ['200 image/png 64x64 colour type 6']);
      expectPng(served.bytes, { width: 64, height: 64, colorType: 6 });
    });

    await test.step('[B07-G-071] PNG 4096x1 accepted, 4097x1 refused with AVATAR_DIMENSIONS_EXCEEDED', async () => {
      // avatar.py:181 uses `>` on the side length; both PUTs count toward me_avatar (budget: 6 of 10).
      const ok = avatarBody(png(4096, 1, 0));
      const accepted = await call(m.api, 'B07-G-071', 'put_4096x1_boundary', 'PUT', '/api/me/avatar', ok, ['200 MeSchema: 4096 is the allowed maximum'], {
        shown: shownAvatar(ok, '4096x1 gray PNG'),
      });
      expectMe(accepted, { ...me, avatarUrl: true });
      const over = avatarBody(png(4097, 1, 0));
      const refused = await call(m.api, 'B07-G-071', 'put_4097x1_refused', 'PUT', '/api/me/avatar', over, ['422 AVATAR_DIMENSIONS_EXCEEDED: 4097 > 4096'], {
        shown: shownAvatar(over, '4097x1 gray PNG'),
      });
      expectError(refused, 422, 'AVATAR_DIMENSIONS_EXCEEDED');
    });

    await test.step('[B07-G-017] PUT body just over 1 MiB -> 413 PAYLOAD_TOO_LARGE', async () => {
      // core/middleware.py:217-250, routing.py:46; before the me_avatar count and the decode, so it runs last.
      const big = oversizedBody({ mimeType: 'image/png' }, 'contentBase64');
      const sent = await call(m.api, 'B07-G-017', 'put_over_1mib', 'PUT', '/api/me/avatar', big.body, ['413 PAYLOAD_TOO_LARGE for a 1 048 577-byte body'], { shown: big.shown });
      expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
    });
  } finally {
    await cleanup.run();
  }
});

test('SCR-33 · FL-A07-06 · Avatar 422 per field/code, rejected bodies count, real 429, per-user bucket', async () => {
  test.setTimeout(FLOW_TIMEOUT_MS);
  const cleanup = new Cleanup();
  try {
    const m = await claim('avatarrl', cleanup); // limited user
    const other = await claim('avatarb', cleanup); // bystander with its own bucket
    const tiny = png(4, 4, 2);
    const tinyB64 = tiny.toString('base64');
    const put = (id: string, slug: string, body: Json, what: string, assertions: readonly string[]): Promise<Sent> =>
      call(m.api, id, slug, 'PUT', '/api/me/avatar', body, assertions, { shown: shownAvatar(body, what) });
    let limited: Sent | undefined;

    await test.step('[B07-G-060] mimeType image/gif -> 422 VALIDATION mimeType', async () => {
      // Literal png|jpeg (schemas.py:108).
      const sent = await put('B07-G-060', 'put_mimetype_image_gif', { mimeType: 'image/gif', contentBase64: tinyB64 }, '4x4 PNG declared image/gif', ['422 VALIDATION field "mimeType"']);
      expectError(sent, 422, 'VALIDATION', 'mimeType', true);
    });

    await test.step('[B07-G-061] no mimeType -> 422 VALIDATION mimeType', async () => {
      const sent = await put('B07-G-061', 'put_without_mimetype', { contentBase64: tinyB64 }, '4x4 PNG, no mimeType', ['422 VALIDATION field "mimeType"']);
      expectError(sent, 422, 'VALIDATION', 'mimeType');
    });

    await test.step('[B07-G-062] contentBase64 "" -> 422 VALIDATION contentBase64', async () => {
      // min_length 1 (schemas.py:109).
      const sent = await put('B07-G-062', 'put_empty_base64', { mimeType: 'image/png', contentBase64: '' }, 'empty', ['422 VALIDATION field "contentBase64"']);
      expectError(sent, 422, 'VALIDATION', 'contentBase64');
    });

    await test.step('[B07-G-063] invalid base64 "@@@@" -> 422 VALIDATION contentBase64', async () => {
      // b64decode(validate=True) (avatar.py:137-142).
      const sent = await put('B07-G-063', 'put_invalid_base64', { mimeType: 'image/png', contentBase64: '@@@@' }, 'not base64', ['422 VALIDATION field "contentBase64"']);
      expectError(sent, 422, 'VALIDATION', 'contentBase64');
    });

    await test.step('[B07-G-064] contentBase64 of MAX+4 chars -> 422 VALIDATION contentBase64', async () => {
      // max_length 699 052 (schemas.py:109, avatar.py:53); the body stays under the 1 MiB middleware limit.
      const long = Buffer.alloc(MAX_DECODED_BYTES + 4, 0);
      const body = avatarBody(long);
      expect.soft(String(body.contentBase64).length, 'base64 length is MAX_BASE64_LEN + 4').toBe(MAX_BASE64_LEN + 4);
      const sent = await put('B07-G-064', 'put_base64_too_long', body, `${MAX_BASE64_LEN + 4} chars`, ['422 VALIDATION field "contentBase64"']);
      expectError(sent, 422, 'VALIDATION', 'contentBase64');
    });

    await test.step('[B07-G-069] TIFF bytes declared image/png -> 422 AVATAR_TYPE_UNSUPPORTED', async () => {
      // avatar.py:77-78 (pytest parametrises GIF / WebP / BMP only).
      const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(16, 0)]);
      const sent = await put('B07-G-069', 'put_tiff_as_png', avatarBody(tiff), 'TIFF "II*\\0" declared image/png', ['422 AVATAR_TYPE_UNSUPPORTED']);
      expectError(sent, 422, 'AVATAR_TYPE_UNSUPPORTED');
    });

    await test.step('[B07-G-080] 4 more rejected PUTs make 10, then a VALID 11th -> 429 RATE_LIMITED', async () => {
      // Steps 060-069 were 6 counted requests; me_avatar counts before body validation (core/ratelimit.py:105-140).
      const extras: readonly (readonly [string, Json, string, string])[] = [
        ['png_as_jpeg', avatarBody(tiny, 'image/jpeg'), '4x4 PNG declared image/jpeg', 'FILE_TYPE_MISMATCH'],
        ['gif_as_png', avatarBody(Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(16, 0)])), 'GIF89a bytes declared image/png', 'AVATAR_TYPE_UNSUPPORTED'],
        ['dimension_5000', avatarBody(png(5000, 1, 0)), '5000x1 gray PNG', 'AVATAR_DIMENSIONS_EXCEEDED'],
        ['png_truncated', avatarBody(tiny.subarray(0, 8 + 25 + 8 + 2)), '4x4 PNG cut inside IDAT', 'FILE_CORRUPT'],
      ];
      for (const [slug, body, what, code] of extras) {
        expectError(await put('B07-G-080', `put_${slug}`, body, what, [`422 ${code}`]), 422, code);
      }
      limited = await put('B07-G-080', 'put_valid_11th', avatarBody(tiny), 'valid 4x4 PNG', ['429 RATE_LIMITED on the 11th PUT within 900 s: rejected bodies count']);
      expectError(limited, 429, 'RATE_LIMITED');
    });

    await test.step('[B07-G-081] 429 answer shape: keys code + requestId, Retry-After 1..10', async () => {
      // ratelimit.py:92-94 (W9); same response as the previous step.
      expect.soft(limited, 'the 429 response of the previous step exists').toBeDefined();
      if (limited) {
        await captureExchange('A07_B07-G-081_429_shape.json', { method: 'PUT', path: '/api/me/avatar', body: '<valid 4x4 PNG, 11th request>' }, { status: () => limited!.res.status(), headers: () => limited!.res.headers(), text: async () => limited!.text } as never, [
          '429 body keys exactly code + requestId; Retry-After integer 1..10',
        ]);
        expectRateLimited(limited);
      }
    });

    await test.step('[B07-G-082] another user is not limited while user A is at 429', async () => {
      // key_user: own bucket per user id.
      const body = avatarBody(tiny);
      const sent = await call(other.api, 'B07-G-082', 'user_b_put_valid_png', 'PUT', '/api/me/avatar', body, ['200 for user B: its own me_avatar bucket'], { shown: shownAvatar(body, 'valid 4x4 PNG') });
      expectMe(sent, { email: other.email, fullName: other.fullName, language: 'vi', avatarUrl: true });
    });

    await test.step('[B07-G-083] nothing stored by rejected / limited PUTs: GET /api/me has no avatarUrl', async () => {
      const sent = await call(m.api, 'B07-G-083', 'get_me_after', 'GET', '/api/me', undefined, ['200 without avatarUrl']);
      expectMe(sent, { email: m.email, fullName: m.fullName, language: 'vi' });
    });
  } finally {
    await cleanup.run();
  }
});

test('SCR-33 · FL-A07-07 · Soft-deleted owner: live Bearer on all four endpoints and refresh', async () => {
  test.setTimeout(FLOW_TIMEOUT_MS);
  const cleanup = new Cleanup();
  try {
    const m = await claim('deleted', cleanup);
    const admin = await adminApi();

    // Setup (step 00): alive, then admin soft-deletes it (users/service.py:451-455: revoke_sessions("deleted") + token_version bump).
    expectMe(await call(m.api, 'setup', 'deleted_get_before', 'GET', '/api/me', undefined, ['setup: 200 while the user exists']), { email: m.email, fullName: m.fullName, language: 'vi' }, true);
    const del = await call(admin, 'setup', 'deleted_admin_delete', 'DELETE', `/api/users/${m.id}`, { userId: m.id, confirmEmail: m.email }, ['setup: 200, admin soft-deletes the disposable user (users/router.py:111-123)']);
    expect(del.res.status(), 'admin DELETE /api/users/{id}').toBe(200);

    await test.step('[B07-G-044] live Bearer: GET /api/me -> 401 SESSION_REVOKED', async () => {
      // verifier (auth/sessions.py:605-621) or, inside the <= 5 s principal cache, the handler re-read (router.py:89-93, K30): never 500.
      const sent = await call(m.api, 'B07-G-044', 'live_bearer_after_delete', 'GET', '/api/me', undefined, ['401 SESSION_REVOKED']);
      expectError(sent, 401, 'SESSION_REVOKED', undefined, true);
    });

    await test.step('[B07-G-045] same Bearer: PATCH /api/me -> 401 SESSION_REVOKED', async () => {
      const sent = await call(m.api, 'B07-G-045', 'patch_after_delete', 'PATCH', '/api/me', { jobTitle: 'ghost' }, ['401 SESSION_REVOKED, nothing written']);
      expectError(sent, 401, 'SESSION_REVOKED');
    });

    await test.step('[B07-G-046] same Bearer: PUT /api/me/avatar (valid 4x4 PNG) -> 401 SESSION_REVOKED', async () => {
      const body = avatarBody(png(4, 4, 2));
      const sent = await call(m.api, 'B07-G-046', 'put_avatar_after_delete', 'PUT', '/api/me/avatar', body, ['401 SESSION_REVOKED'], { shown: shownAvatar(body, 'valid 4x4 PNG') });
      expectError(sent, 401, 'SESSION_REVOKED');
    });

    await test.step('[B07-G-047] same Bearer: POST /api/me/password with the right current password -> 401 SESSION_REVOKED', async () => {
      // Not 422: the revoked principal is refused before the handler checks the password (router.py:168-180).
      const sent = await call(m.api, 'B07-G-047', 'post_password_after_delete', 'POST', '/api/me/password', { currentPassword: m.password, newPassword: `Qa-${randomUUID()}` }, ['401 SESSION_REVOKED, not 422']);
      expectError(sent, 401, 'SESSION_REVOKED');
    });

    await test.step('[B07-G-048] refresh with the deleted owner\'s cookie -> 401 SESSION_REVOKED', async () => {
      // Sessions revoked by the delete (users/service.py:451-455; auth/sessions.py:451-452).
      const sent = await refreshWith('refresh_after_delete', 'B07-G-048', m.cookie, ['401 SESSION_REVOKED']);
      expectError(sent, 401, 'SESSION_REVOKED');
    });
  } finally {
    await cleanup.run();
  }
});

test('SCR-33 · FL-A07-08 · POST /api/me/password body rules, NFC minimum, 413, real 429 on the 6th', async () => {
  test.setTimeout(FLOW_TIMEOUT_MS);
  const cleanup = new Cleanup();
  try {
    const m = await claim('pwrules', cleanup);
    const fresh = `Qa-${randomUUID()}`; // a valid new password (>= 8, passwords.py:34)
    const post = (id: string, slug: string, body: Json, assertions: readonly string[]): Promise<Sent> => call(m.api, id, slug, 'POST', '/api/me/password', body, assertions);

    await test.step('[B07-G-099] POST without newPassword -> 422 VALIDATION newPassword', async () => {
      // schemas.py:102 (counted request 1 of 5 rejected).
      const sent = await post('B07-G-099', 'post_without_newpassword', { currentPassword: m.password }, ['422 VALIDATION field "newPassword"']);
      expectError(sent, 422, 'VALIDATION', 'newPassword', true);
    });

    await test.step('[B07-G-100] newPassword "Abc1234" (7 chars) -> 422 VALIDATION newPassword', async () => {
      // min 8 (passwords.py:34).
      const sent = await post('B07-G-100', 'post_newpassword_7_chars', { currentPassword: m.password, newPassword: 'Abc1234' }, ['422 VALIDATION field "newPassword"']);
      expectError(sent, 422, 'VALIDATION', 'newPassword');
    });

    await test.step('[B07-G-102] currentPassword "" -> 422 VALIDATION currentPassword', async () => {
      // min_length 1 (schemas.py:101).
      const sent = await post('B07-G-102', 'post_empty_currentpassword', { currentPassword: '', newPassword: fresh }, ['422 VALIDATION field "currentPassword"']);
      expectError(sent, 422, 'VALIDATION', 'currentPassword');
    });

    await test.step('[B07-C-070] newPassword = 4 x NFD "e + U+0302" (8 code points, 4 in NFC), WRONG current -> 422 VALIDATION newPassword', async () => {
      // ⚑ BUG-class (catalog Notes 2): the password is stored as nfc(password) (passwords.py:120-123), so the minimum 8 must hold for the NFC form.
      // BE today checks the raw length (schemas.py:102) and answers 422 CURRENT_PASSWORD_INCORRECT: red until fixed, NOT relaxed.
      const nfd = 'e\u0302'.repeat(4);
      expect(nfd.length).toBe(8);
      expect(nfd.normalize('NFC').length).toBe(4);
      const sent = await post('B07-C-070', 'post_newpassword_nfd_below_min', { currentPassword: `Wrong-${randomUUID()}`, newPassword: nfd }, [
        'expected 422 VALIDATION field "newPassword" (NFC length 4 < 8); the current password is wrong on purpose, so nothing can change',
      ]);
      expectError(sent, 422, 'VALIDATION', 'newPassword');
    });

    await test.step('[B07-G-016] POST body just over 1 MiB -> 413 PAYLOAD_TOO_LARGE; password unchanged', async () => {
      // Same middleware as the PATCH / PUT limits (core/middleware.py:217-250); not counted by me_password. Unchanged password: see [B07-G-105].
      const big = oversizedBody({ currentPassword: m.password }, 'newPassword');
      const sent = await call(m.api, 'B07-G-016', 'post_over_1mib', 'POST', '/api/me/password', big.body, ['413 PAYLOAD_TOO_LARGE for a 1 048 577-byte body'], { shown: big.shown });
      expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
    });

    await test.step('[B07-G-106] 5th rejected POST, then a VALID 6th -> 429 RATE_LIMITED with the W9 shape', async () => {
      // Counted before validation (core/ratelimit.py:105-140): 099,100,102,C-070 + the extra key = 5; the 413 is not counted.
      const extra = await post('B07-G-106', 'post_extra_key_email', { currentPassword: m.password, newPassword: fresh, email: m.email }, ['422 VALIDATION field "email" (extra=forbid): the 5th counted request']);
      expectError(extra, 422, 'VALIDATION', 'email');
      const sixth = await post('B07-G-106', 'post_valid_6th', { currentPassword: m.password, newPassword: fresh }, ['429 RATE_LIMITED on the 6th POST within 900 s; keys code + requestId; Retry-After 1..10']);
      expectRateLimited(sixth);
    });

    await test.step('[B07-G-105] after the 429 the old password still signs in and the session still reads /api/me', async () => {
      // Nothing changed by the 5 rejected POSTs, the 413 or the limited valid POST.
      const signed = await login('old_password_still_valid', 'B07-G-105', m.email, m.password, ['204: the original password still signs in']);
      expect.soft(signed.res.status(), 'login with the accept-time password').toBe(204);
      const sent = await call(m.api, 'B07-G-105', 'get_me_after', 'GET', '/api/me', undefined, ['200: the calling session was not revoked']);
      expectMe(sent, { email: m.email, fullName: m.fullName, language: 'vi' });
    });
  } finally {
    await cleanup.run();
  }
});

test('SCR-33 · FL-A07-09 · POST /api/me/password success: sessions, old/new password, NFD, idempotency', async () => {
  test.setTimeout(FLOW_TIMEOUT_MS);
  const cleanup = new Cleanup();
  try {
    const m = await claim('pwchange', cleanup);
    const me = { email: m.email, fullName: m.fullName, language: 'vi' };

    // Setup: a second session S2 of the same user (login -> refresh -> Bearer `api2`), alive before the change.
    const second = await newApiContext();
    cleanup.add(() => second.dispose());
    const login2 = await call(second, 'setup', 'pwchange_login_second_session', 'POST', '/api/auth/login', { email: m.email, password: m.password, rememberMe: false }, ['setup: 204, a second session of the same user']);
    expect(login2.res.status(), 'second session login').toBe(204);
    const refresh2 = await call(second, 'setup', 'pwchange_refresh_second_session', 'POST', '/api/auth/refresh', undefined, ['setup: 200 W16 for the second session']);
    expect(refresh2.res.status(), 'second session refresh').toBe(200);
    const api2: APIRequestContext = await bearerContext(String(asJson(refresh2.body).accessToken));
    cleanup.add(() => api2.dispose());
    expectMe(await call(api2, 'setup', 'pwchange_second_get_before', 'GET', '/api/me', undefined, ['setup: 200, S2 alive before the change']), me, true);

    const pw8 = `Aa1-${randomUUID().slice(0, 4)}`; // exactly 8 ASCII chars, unique per run
    const nfdPw = `Qa-${randomUUID()}-Nguye\u0302\u0303n`;
    const nfcPw = nfdPw.normalize('NFC');
    expect(pw8.length).toBe(8);
    expect(nfcPw).not.toBe(nfdPw);
    const post = (id: string, slug: string, body: Json, assertions: readonly string[], headers?: Record<string, string>): Promise<Sent> =>
      call(m.api, id, slug, 'POST', '/api/me/password', body, assertions, headers ? { headers } : {});

    await test.step('[B07-G-101] newPassword of exactly 8 chars -> 204 empty; login with it -> 204', async () => {
      // me_password request 1 of 5.
      const changed = await post('B07-G-101', 'post_newpassword_of_exactly_8', { currentPassword: m.password, newPassword: pw8 }, ['204 with an EMPTY body (router.py:208-244)']);
      expect(changed.res.status(), 'change password').toBe(204);
      expect(changed.text).toBe('');
      const signed = await login('login_with_8_char_password', 'B07-G-101', m.email, pw8, ['204: the boundary password signs in']);
      expect(signed.res.status(), 'login with the 8-char password').toBe(204);
    });

    await test.step('[B07-G-091] calling session\'s Bearer: GET /api/me -> 200', async () => {
      // `except_sid` keeps this session (router.py:217).
      expectMe(await call(m.api, 'B07-G-091', 'get_me_calling_session', 'GET', '/api/me', undefined, ['200 MeSchema: the calling session is kept']), me);
    });

    await test.step('[B07-G-092] calling session\'s cookie: refresh -> 200', async () => {
      const sent = await refreshWith('refresh_calling_session', 'B07-G-092', m.cookie, ['200 W16: the calling session is alive']);
      expect.soft(sent.res.status(), 'refresh of the calling session').toBe(200);
      if (sent.res.status() === 200) m.cookie = rotatedCookie(sent);
    });

    await test.step('[B07-G-093] OTHER session: refresh -> 401 SESSION_REVOKED', async () => {
      // Reason password_change (auth/sessions.py:449-452).
      const sent = await call(second, 'B07-G-093', 'refresh_other_session', 'POST', '/api/auth/refresh', undefined, ['401 SESSION_REVOKED']);
      expectError(sent, 401, 'SESSION_REVOKED');
    });

    await test.step('[B07-G-094] OTHER session\'s live Bearer: GET /api/me -> 401 SESSION_REVOKED within the principal cache', async () => {
      // Principal cache <= 5 s (auth/sessions.py:159-163,604-621): poll up to 10 s.
      await expect.configure({ soft: true }).poll(async () => (await api2.get('/api/me')).status(), { timeout: 10_000, intervals: [500] }).toBe(401);
      const sent = await call(api2, 'B07-G-094', 'get_me_other_session', 'GET', '/api/me', undefined, ['401 SESSION_REVOKED: the other session\'s access token is refused']);
      expectError(sent, 401, 'SESSION_REVOKED');
    });

    await test.step('[B07-G-095] login with the OLD password -> 401 INVALID_CREDENTIALS', async () => {
      // auth/router.py:173-177 (one failed attempt on the user's own bucket, 5 / 900 s).
      const sent = await login('login_old_password', 'B07-G-095', m.email, m.password, ['401 INVALID_CREDENTIALS']);
      expectError(sent, 401, 'INVALID_CREDENTIALS');
    });

    await test.step('[B07-G-097] POST with the OLD password as currentPassword -> 422 CURRENT_PASSWORD_INCORRECT', async () => {
      // router.py:231-234 (me_password request 2 of 5); the new password is valid so validation cannot win.
      const sent = await post('B07-G-097', 'post_old_current_password', { currentPassword: m.password, newPassword: `Qa-${randomUUID()}` }, ['422 CURRENT_PASSWORD_INCORRECT field "currentPassword"']);
      expectError(sent, 422, 'CURRENT_PASSWORD_INCORRECT', 'currentPassword');
    });

    await test.step('[B07-G-096] new password sent in NFD, typed in NFC at login -> 204 and 204', async () => {
      // nfc before hash and verify (auth/passwords.py:120-129); me_password request 3 of 5.
      const changed = await post('B07-G-096', 'post_newpassword_nfd', { currentPassword: pw8, newPassword: nfdPw }, ['204: the NFD password is accepted']);
      expect.soft(changed.res.status(), 'change to the NFD password').toBe(204);
      const signed = await login('login_nfc_password', 'B07-G-096', m.email, nfcPw, ['204: the NFC form signs in']);
      expect.soft(signed.res.status(), 'login with the NFC form').toBe(204);
    });

    await test.step('[B07-G-111] same Idempotency-Key + same body twice -> 204 and 204; the password changed once', async () => {
      // idempotency.py:53,225-233 (204 is storable); requests 4 and 5 of 5. Without replay the second would be 422 CURRENT_PASSWORD_INCORRECT.
      const key = randomUUID();
      const latest = `Qa-${randomUUID()}`;
      const body = { currentPassword: nfcPw, newPassword: latest };
      const first = await post('B07-G-111', 'post_idempotent_first', body, ['204'], { 'Idempotency-Key': key });
      const again = await post('B07-G-111', 'post_idempotent_replay', body, ['204: the stored response of the first, handler not re-run'], { 'Idempotency-Key': key });
      expect.soft(first.res.status(), 'first POST').toBe(204);
      expect.soft(again.res.status(), `replayed POST (${again.text.slice(0, 120)})`).toBe(204);
      const signed = await login('login_latest_password', 'B07-G-111', m.email, latest, ['204: the new password (changed exactly once) signs in']);
      expect.soft(signed.res.status(), 'login with the latest password').toBe(204);
    });
  } finally {
    await cleanup.run();
  }
});

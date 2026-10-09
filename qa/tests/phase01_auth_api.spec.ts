/**
 * Phase 1 — Auth BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints: POST /api/auth/login, /refresh, /logout (BE `apps/api/auth/router.py`), POST
 * /api/auth/password-reset, /password-reset/confirm, /invitations/accept (BE `apps/api/auth_recovery/router.py`).
 * Inventory + mock-pairing table: `qa/coverage/phase01-be.md`. `BE:` = `AppBack/fix378-x`.
 *
 * ## Non-serial, own data
 * Every test opens its own request contexts; nothing is shared between tests. Users are invited by the
 * admin (`POST /api/users/invitations`, BE:apps/api/users/router.py:55) with `qa-<runId>-…@example.test`
 * addresses, one-time tokens come from the REAL mails in Mailpit, and every test deletes its user
 * (`DELETE /api/users/{id}`) and its mails in `finally`. Cookies are passed explicitly (`Cookie` header):
 * Playwright then ignores its jar (playwright-core server/fetch.js:167), so rotation is observable.
 * The admin account is only used to sign in and to invite/disable/delete test users: its password is
 * never changed, it never fails a login, and the only admin sessions revoked are the ones these tests open.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack is meant to add qa-limits.override.yml, see below)
 * - recovery routes (`recovery_ip`, BE:apps/api/auth_recovery/settings.py:24-25 = 10 / 900 s per IP by default,
 *   shared by all three routes, counted BEFORE body validation — BE:apps/api/core/ratelimit.py:115-117):
 *   THIS file 11 = invitation 2 (accept, reuse) + reset flow 4 (setup accept, request, confirm, reuse) +
 *   token-too-long 1 + body-rule 422 pairs 4 (accept token, accept password, confirm newPassword, request email).
 *   UI specs of the phase: 7 = `phase01_auth_edge` 6 (forgot unknown address, invitation bogus token, real
 *   invitation accept 1, real reset 3) + `phase01_recovery_edge` 1 (bidi name). Phase sum 18 in one window.
 *   11 > 10 already for THIS file alone, so the stack MUST run with `qa.config.json` env.stackOverride
 *   (`qa-limits.override.yml`: RECOVERY_IP_LIMIT=60 → 18 ≤ 60). Without it (BUG-053) the last body-rule
 *   pair gets 429 and says so; the edge step then needs a fresh 900 s window.
 *   403 ORIGIN_MISMATCH costs nothing: `require_origin` runs before the limiter (router.py:232,280,342).
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:apps/api/auth/settings.py:36-37), every attempt incl. 422:
 *   THIS file 20 (validation 4, lock 7, refresh 1, logout 1, invitation 4, reset 3). Admin FAILED attempts = 0.
 * - per (email, IP): lock after 5 attempts / 900 s (settings.py:38-40): only on a run-unique address.
 * - `POST /api/users/invitations`: 30 / h per admin (BE:apps/api/users/router.py:32-43): THIS file 2.
 * - `POST /api/auth/refresh`: fail bucket 20 / 60 s per (sid, token) — exhausted on purpose only for a
 *   random, non-existent sid; total 300 / 60 s per sid (settings.py:43-46).
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { RUN_ID } from './support/evidence';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = `qa-${RUN_ID}-`;
const REFRESH = 'appback_refresh'; // BE:apps/api/auth/cookies.py:9-12
const STREAM = 'appback_stream';
const FOREIGN_ORIGIN = 'http://evil.example.test';
const GRACE_S = 30; // BE:apps/api/auth/settings.py:29 refresh_grace_s

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const testEmail = (slug: string): string => `${PREFIX}${slug}-${uniq()}@example.test`;
const testPassword = (): string => `Qa-${randomUUID()}`;

/* ------------------------------------------------------------------ phase-local helpers */

type Json = Record<string, unknown>;

async function post(
  api: APIRequestContext,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<APIResponse> {
  return api.post(path, { ...(body === undefined ? {} : { data: body }), ...(headers ? { headers } : {}) });
}

function setCookieLines(res: APIResponse): string[] {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
}

function setCookie(res: APIResponse, name: string): string | undefined {
  return setCookieLines(res).find((line) => line.startsWith(`${name}=`));
}

/** Value of a Set-Cookie (secret: never written anywhere). */
function cookieValue(res: APIResponse, name: string): string {
  const line = setCookie(res, name);
  if (!line) throw new Error(`no Set-Cookie ${name} (status ${res.status()})`);
  return line.slice(name.length + 1).split(';')[0]!;
}

/** The Set-Cookie line with its value hidden — safe to put in `assertions`. */
function cookieShape(res: APIResponse, name: string): string {
  const line = setCookie(res, name);
  return line ? line.replace(/^([^=]+)=[^;]*/u, '$1=<redacted>') : `${name}: <absent>`;
}

const asCookie = (value: string): Record<string, string> => ({ Cookie: `${REFRESH}=${value}` });

async function login(api: APIRequestContext, email: string, password: string, rememberMe = false): Promise<APIResponse> {
  return post(api, '/api/auth/login', { email, password, rememberMe });
}

async function refresh(api: APIRequestContext, cookie?: string): Promise<APIResponse> {
  return post(api, '/api/auth/refresh', undefined, cookie === undefined ? undefined : asCookie(cookie));
}

/** W7 error body (BE:apps/api/core/errors.py:82-88): `code` + `requestId` (+ `field`/`count`). */
async function expectError(res: APIResponse, status: number, code: string, field?: string): Promise<Json> {
  expect(res.status(), `${code} status`).toBe(status);
  const body = (await res.json()) as Json;
  expect(body.code).toBe(code);
  expect(typeof body.requestId).toBe('string');
  if (field !== undefined) expect(body.field).toBe(field);
  return body;
}

function expectCleared(res: APIResponse): void {
  // BE:apps/api/auth/cookies.py:33-37 — same name, same Path, Max-Age=0.
  for (const [name, path] of [
    [REFRESH, '/api/auth'],
    [STREAM, '/api/streams'],
  ] as const) {
    const line = setCookie(res, name);
    expect(line, `${name} cleared`).toBeDefined();
    expect(line!).toMatch(/Max-Age=0/iu);
    expect(line!).toContain(`Path=${path}`);
  }
}

function expectSessionCookies(res: APIResponse, remember: boolean): void {
  // BE:apps/api/auth/cookies.py:20-27 + sessions.py:176-192: HttpOnly; Secure; SameSite=Strict; narrow Path;
  // Max-Age only when remembered.
  const refreshLine = setCookie(res, REFRESH);
  const streamLine = setCookie(res, STREAM);
  expect(refreshLine, 'refresh cookie').toBeDefined();
  expect(streamLine, 'stream cookie').toBeDefined();
  for (const line of [refreshLine!, streamLine!]) {
    expect(line).toMatch(/HttpOnly/iu);
    expect(line).toMatch(/Secure/iu);
    expect(line).toMatch(/SameSite=strict/iu);
  }
  expect(refreshLine!).toContain('Path=/api/auth');
  expect(streamLine!).toContain('Path=/api/streams');
  if (remember) expect(refreshLine!).toMatch(/Max-Age=\d+/iu);
  else expect(refreshLine!).not.toMatch(/Max-Age/iu);
  // `<sid>.<43 base64url>` — BE:apps/api/auth/tokens.py:38-40
  expect(cookieValue(res, REFRESH)).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/u);
}

/** W16 refresh body (BE:apps/api/auth/router.py:82-96): exactly these keys, no secret field. */
async function expectW16(res: APIResponse, role: string, user?: { id?: string; name?: string; email?: string }): Promise<void> {
  expect(res.status()).toBe(200);
  const body = (await res.json()) as Json;
  expect(Object.keys(body).sort()).toEqual(['accessToken', 'expiresAt', 'roles', 'user']);
  expect(typeof body.accessToken).toBe('string');
  expect(body.roles).toEqual([role]);
  const ttl = Date.parse(String(body.expiresAt)) - Date.now();
  expect(ttl, 'access token ≤ 600 s (settings.py:16,27)').toBeLessThanOrEqual(605_000);
  expect(ttl).toBeGreaterThan(0);
  const wireUser = body.user as Json;
  expect(Object.keys(wireUser).sort()).toEqual(['email', 'id', 'name']);
  if (user?.id !== undefined) expect(wireUser.id).toBe(user.id);
  if (user?.name !== undefined) expect(wireUser.name).toBe(user.name);
  if (user?.email !== undefined) expect(wireUser.email).toBe(user.email);
}

function tokenFrom(mail: Mail, path: string): string {
  // BE:apps/api/auth_recovery/messages.py:46 — `{PUBLIC_BASE_URL}{path}#token=…`; FE reads the hash
  // (src/screens/auth/fragmentToken.ts:42).
  const link = new URL(linkFrom(mail, path));
  expect(link.origin).toBe(new URL(apiBaseUrl()).origin);
  expect(link.pathname).toBe(path);
  expect(link.search).toBe('');
  const token = new URLSearchParams(link.hash.slice(1)).get('token');
  if (!token) throw new Error(`mail "${mail.subject}" link has no #token`);
  return token;
}

interface Invited {
  readonly id: string;
  readonly email: string;
  readonly token: string;
  readonly mailId: string;
}

/** Admin invites one viewer (BE:apps/api/users/router.py:55-62) and reads the real token from Mailpit. */
async function invite(admin: APIRequestContext, email: string, evidence: string): Promise<Invited> {
  const since = new Date(Date.now() - 5_000);
  const body = { emails: [email], role: 'viewer' };
  const res = await post(admin, '/api/users/invitations', body);
  const out = (await captureExchange(evidence, { method: 'POST', path: '/api/users/invitations', body }, res, [
    'setup: admin invites a run-unique @example.test viewer → 201, one pending user',
  ])) as Json[];
  expect(res.status()).toBe(201);
  const user = out.find((u) => u.email === email);
  expect(user?.status).toBe('pending');
  const mail = await waitForMail(email, since);
  expect(mail.subject).toBe('Lời mời tham gia AppBack'); // messages.py:31
  return { id: String(user!.id), email, token: tokenFrom(mail, '/login/invitation'), mailId: mail.id };
}

/** `finally` cleanup: soft-delete the test user (BE:apps/api/users/router.py:111-123) + its mails. */
async function cleanup(admin: APIRequestContext | undefined, user: { id: string; email: string } | undefined, mails: string[]): Promise<void> {
  try {
    if (admin && user) {
      const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
      if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE user → ${res.status()}` });
    }
    await deleteMails(mails);
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: String(error) });
  } finally {
    await admin?.dispose();
  }
}

async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

/* ------------------------------------------------------------------ login: body rules */

test.describe('A01 POST /api/auth/login — body rules (SignInBody, BE:apps/api/auth/router.py:68-79)', () => {
  test('A01 · login 422 VALIDATION field "password" for a 7-character password (pairs E01 mocked 422 password)', async () => {
    // router.py:72 `Field(min_length=MIN_PASSWORD_LENGTH)` (passwords.py:34 = 8); errors.py:170-180 → field.
    const api = await newApiContext();
    try {
      const body = { email: testEmail('short'), password: 'Qa-1234', rememberMe: false };
      const res = await post(api, '/api/auth/login', body);
      await captureExchange('A01_login_422_password.json', { method: 'POST', path: '/api/auth/login', body }, res, [
        '422 code VALIDATION field "password" (min 8 chars, router.py:72)',
      ]);
      await expectError(res, 422, 'VALIDATION', 'password');
    } finally {
      await api.dispose();
    }
  });

  test('A01 · login 422 VALIDATION with field = the unknown key for an extra body key (strict body; pairs E01 mocked "unknown field")', async () => {
    // WireRequest extra="forbid" (core/wire.py:46,115-118) → loc (body, foo) → field "foo".
    const api = await newApiContext();
    try {
      const body = { email: testEmail('extra'), password: 'Qa-extra-key-1', rememberMe: false, foo: 1 };
      const res = await post(api, '/api/auth/login', body);
      await captureExchange('A01_login_422_extra_key.json', { method: 'POST', path: '/api/auth/login', body }, res, [
        '422 code VALIDATION field "foo" (extra="forbid", core/wire.py:46)',
      ]);
      await expectError(res, 422, 'VALIDATION', 'foo');
    } finally {
      await api.dispose();
    }
  });

  test('A01 · login 422 VALIDATION field "rememberMe" when it is the string "true" (strict bool)', async () => {
    // router.py:73 `Field(strict=True)`; FE SignInSchema rememberMe: z.boolean() (src/api/schemas/index.ts:49).
    const api = await newApiContext();
    try {
      const body = { email: testEmail('strict'), password: 'Qa-strict-bool-1', rememberMe: 'true' };
      const res = await post(api, '/api/auth/login', body);
      await captureExchange('A01_login_422_remember_me.json', { method: 'POST', path: '/api/auth/login', body }, res, [
        '422 code VALIDATION field "rememberMe" (strict bool, router.py:73)',
      ]);
      await expectError(res, 422, 'VALIDATION', 'rememberMe');
    } finally {
      await api.dispose();
    }
  });

  test('A01 · login 422 VALIDATION field "email" for an address zod .email() rejects (no dot in the domain)', async () => {
    // router.py:75-79 → emails.py:31-42 (zod 3.23.8 regex, ASCII, ≤ 254).
    const api = await newApiContext();
    try {
      const body = { email: `${PREFIX}bad@localhost`, password: 'Qa-bad-email-1', rememberMe: false };
      const res = await post(api, '/api/auth/login', body);
      await captureExchange('A01_login_422_email.json', { method: 'POST', path: '/api/auth/login', body }, res, [
        '422 code VALIDATION field "email" (emails.py:40-41)',
      ]);
      await expectError(res, 422, 'VALIDATION', 'email');
    } finally {
      await api.dispose();
    }
  });
});

/* ------------------------------------------------------------------ login: lock */

test.describe('A01 POST /api/auth/login — (email, IP) lock (BE:apps/api/auth/login_guard.py)', () => {
  test('A01 · 5 attempts on one unknown address → 401 INVALID_CREDENTIALS ×5, the 6th → 429 RATE_LIMITED + Retry-After 10; another address from the same IP still 401 (pairs E01 mocked login 429)', async () => {
    // login_guard.py:403-414 (Lua: INCR before hashing; > LOGIN_FAILURE_LIMIT=5 → SET lock EX 60, verdict 3),
    // :481 RATE_LIMITED(retry_after(60)) = min(60, 10) (core/ratelimit.py:30,92-94). Unknown address = same
    // path as a wrong password (router.py:173-177, C27). Lock key = (email_key, ip): login_guard.py:418-425.
    const api = await newApiContext();
    try {
      const email = testEmail('lock');
      const password = 'Qa-wrong-pass-1';
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const res = await login(api, email, password);
        if (attempt === 1) {
          await captureExchange('A01_login_401_unknown.json', { method: 'POST', path: '/api/auth/login', body: { email, password, rememberMe: false } }, res, [
            'attempt 1 on an unknown address → 401 INVALID_CREDENTIALS (same answer as a wrong password, C27)',
          ]);
        }
        await expectError(res, 401, 'INVALID_CREDENTIALS');
      }
      const locked = await login(api, email, password);
      await captureExchange('A01_login_429_lock.json', { method: 'POST', path: '/api/auth/login', body: { email, password, rememberMe: false } }, locked, [
        'attempt 6 on the same (email, IP) → 429 RATE_LIMITED',
        'Retry-After header = 10 (lock 60 s capped at 10, ratelimit.py:92-94)',
      ]);
      await expectError(locked, 429, 'RATE_LIMITED');
      expect(locked.headers()['retry-after']).toBe('10');

      const other = testEmail('lock-other');
      const free = await login(api, other, password);
      await captureExchange('A01_login_lock_scope.json', { method: 'POST', path: '/api/auth/login', body: { email: other, password, rememberMe: false } }, free, [
        'a different address from the same IP right after the lock → 401 INVALID_CREDENTIALS, not 429 (lock is per email+IP)',
      ]);
      await expectError(free, 401, 'INVALID_CREDENTIALS');
    } finally {
      await api.dispose();
    }
  });
});

/* ------------------------------------------------------------------ Origin */

test.describe('A01 Origin check on every phase-1 POST (BE:apps/api/core/origin.py:44-56)', () => {
  test('A01 · foreign or missing Origin → 403 ORIGIN_MISMATCH on all six routes; logout still clears both cookies (pairs the E01 mocked ORIGIN_MISMATCH cases)', async () => {
    // login/refresh: router.py:164,236; logout: router.py:288-293 (403 + clear_auth_cookies);
    // recovery: auth_recovery/router.py:232,280,342 — `require_origin` is listed before the rate limiter.
    const routes: ReadonlyArray<{ slug: string; path: string; body?: Json }> = [
      { slug: 'login', path: '/api/auth/login', body: { email: testEmail('origin'), password: 'Qa-origin-pass-1', rememberMe: false } },
      { slug: 'refresh', path: '/api/auth/refresh' },
      { slug: 'logout', path: '/api/auth/logout' },
      { slug: 'reset', path: '/api/auth/password-reset', body: { email: testEmail('origin') } },
      { slug: 'confirm', path: '/api/auth/password-reset/confirm', body: { token: 'qa-origin-token', newPassword: 'Qa-origin-pass-1' } },
      { slug: 'accept', path: '/api/auth/invitations/accept', body: { token: 'qa-origin-token', fullName: `${PREFIX}origin`, password: 'Qa-origin-pass-1' } },
    ];
    const foreign = await newApiContext({ Origin: FOREIGN_ORIGIN });
    const bare = await request.newContext({ baseURL: apiBaseUrl() }); // no Origin header at all
    try {
      for (const [variant, api] of [
        ['foreign', foreign],
        ['missing', bare],
      ] as const) {
        for (const route of routes) {
          const res = await post(api, route.path, route.body);
          await captureExchange(`A01_origin_${route.slug}_${variant}.json`, { method: 'POST', path: route.path, body: route.body ?? null }, res, [
            `${variant === 'foreign' ? `Origin: ${FOREIGN_ORIGIN}` : 'no Origin header'} → 403 code ORIGIN_MISMATCH`,
            ...(route.slug === 'logout' ? [`still clears: ${cookieShape(res, REFRESH)} | ${cookieShape(res, STREAM)}`] : []),
          ]);
          await expectError(res, 403, 'ORIGIN_MISMATCH');
          if (route.slug === 'logout') expectCleared(res);
        }
      }
    } finally {
      await foreign.dispose();
      await bare.dispose();
    }
  });
});

/* ------------------------------------------------------------------ refresh */

test.describe('A01 POST /api/auth/refresh (BE:apps/api/auth/router.py:236-282, sessions.py:423-518)', () => {
  test('A01 · refresh without a cookie or with a malformed cookie → 401 UNAUTHENTICATED', async () => {
    // router.py:239-241 — cookie missing / not `<uuid>.<43 base64url>` (tokens.py:38-40,131-138).
    const api = await newApiContext();
    try {
      const none = await refresh(api);
      await captureExchange('A01_refresh_401_no_cookie.json', { method: 'POST', path: '/api/auth/refresh' }, none, [
        'no appback_refresh cookie → 401 code UNAUTHENTICATED',
      ]);
      await expectError(none, 401, 'UNAUTHENTICATED');

      const bad = await refresh(api, 'not-a-session');
      await captureExchange('A01_refresh_401_malformed.json', { method: 'POST', path: '/api/auth/refresh' }, bad, [
        'Cookie header appback_refresh=not-a-session (malformed, no body) → 401 code UNAUTHENTICATED',
      ]);
      await expectError(bad, 401, 'UNAUTHENTICATED');
    } finally {
      await api.dispose();
    }
  });

  test('A01 · rotation: new cookie per refresh; the old one inside the 30 s grace gets the SAME successor; after the grace it is reuse → 401 SESSION_REVOKED and the whole session is dead', async () => {
    // sessions.py:423-437 (_judge: current+grace → hand, previous+grace → successor, previous after grace →
    // reuse), :447-455 (reuse revokes the sid → SESSION_REVOKED; revoked session → SESSION_REVOKED).
    const { email, password } = readAdminCredentials();
    const api = await newApiContext();
    try {
      const signedIn = await login(api, email, password);
      await captureExchange('A01_rotation_login.json', { method: 'POST', path: '/api/auth/login', body: { email, password, rememberMe: false } }, signedIn, [
        '204, sets the two session cookies (session opened only for this test)',
        cookieShape(signedIn, REFRESH),
        cookieShape(signedIn, STREAM),
      ]);
      expect(signedIn.status()).toBe(204);
      expectSessionCookies(signedIn, false);
      const c0 = cookieValue(signedIn, REFRESH);

      const first = await refresh(api, c0);
      await captureExchange('A01_rotation_first.json', { method: 'POST', path: '/api/auth/refresh' }, first, [
        '200 W16 body {accessToken, expiresAt, roles:["admin"], user{id,name,email}} and no other key',
        'Set-Cookie rotates appback_refresh (new token, same sid) and re-issues appback_stream',
      ]);
      await expectW16(first, 'admin', { email: email.toLowerCase() });
      const c1 = cookieValue(first, REFRESH);
      expect(c1).not.toBe(c0);
      expect(c1.split('.')[0]).toBe(c0.split('.')[0]);

      const graceOld = await refresh(api, c0);
      await captureExchange('A01_rotation_grace_old.json', { method: 'POST', path: '/api/auth/refresh' }, graceOld, [
        'the PREVIOUS cookie inside the grace → 200 and the SAME successor cookie as the first refresh (K35, no second rotation)',
      ]);
      await expectW16(graceOld, 'admin');
      expect(cookieValue(graceOld, REFRESH)).toBe(c1);

      const graceNew = await refresh(api, c1);
      await captureExchange('A01_rotation_grace_current.json', { method: 'POST', path: '/api/auth/refresh' }, graceNew, [
        'the CURRENT cookie inside the grace → 200 and the same cookie handed back (no rotation)',
      ]);
      await expectW16(graceNew, 'admin');
      expect(cookieValue(graceNew, REFRESH)).toBe(c1);

      await new Promise((resolve) => setTimeout(resolve, (GRACE_S + 2) * 1_000));

      const reuse = await refresh(api, c0);
      await captureExchange('A01_rotation_reuse.json', { method: 'POST', path: '/api/auth/refresh' }, reuse, [
        `the PREVIOUS cookie ${GRACE_S + 2} s after the rotation (grace ${GRACE_S} s) → 401 code SESSION_REVOKED (reuse)`,
      ]);
      await expectError(reuse, 401, 'SESSION_REVOKED');

      const after = await refresh(api, c1);
      await captureExchange('A01_rotation_after_reuse.json', { method: 'POST', path: '/api/auth/refresh' }, after, [
        'the CURRENT cookie after the reuse → 401 code SESSION_REVOKED (whole session revoked)',
      ]);
      await expectError(after, 401, 'SESSION_REVOKED');
    } finally {
      await api.dispose();
    }
  });

  test('A01 · failure limit: 20 × 401 UNAUTHENTICATED for one (sid, token), the 21st → 429 RATE_LIMITED + Retry-After', async () => {
    // router.py:206-233 — bucket `rl:auth_refresh_fail:{sid}:{hash16}`; settings.py:39-40 = 20 / 60 s.
    // A random, non-existent sid: the bucket is this test's alone (no IP-wide effect).
    const api = await newApiContext();
    try {
      const cookie = `${randomUUID()}.${'A'.repeat(21)}${'b'.repeat(22)}`;
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        const res = await refresh(api, cookie);
        if (attempt === 1) {
          await captureExchange('A01_refresh_fail_first.json', { method: 'POST', path: '/api/auth/refresh' }, res, [
            'unknown sid → 401 code UNAUTHENTICATED (sessions.py:449-450), counted in the fail bucket',
          ]);
        }
        await expectError(res, 401, 'UNAUTHENTICATED');
      }
      const limited = await refresh(api, cookie);
      await captureExchange('A01_refresh_fail_429.json', { method: 'POST', path: '/api/auth/refresh' }, limited, [
        'attempt 21 on the same (sid, token) → 429 code RATE_LIMITED',
        'Retry-After header between 1 and 10',
      ]);
      await expectError(limited, 429, 'RATE_LIMITED');
      const retry = Number(limited.headers()['retry-after']);
      expect(retry).toBeGreaterThanOrEqual(1);
      expect(retry).toBeLessThanOrEqual(10);
    } finally {
      await api.dispose();
    }
  });
});

/* ------------------------------------------------------------------ logout */

test.describe('A01 POST /api/auth/logout (BE:apps/api/auth/router.py:285-296)', () => {
  test('A01 · foreign Origin → 403 + cookies cleared but the session survives; real logout → 204 + cookies cleared + session revoked; logout without a cookie → 204', async () => {
    const { email, password } = readAdminCredentials();
    const api = await newApiContext();
    const foreign = await newApiContext({ Origin: FOREIGN_ORIGIN });
    try {
      const signedIn = await login(api, email, password);
      expect(signedIn.status()).toBe(204);
      const c0 = cookieValue(signedIn, REFRESH);

      const denied = await post(foreign, '/api/auth/logout', undefined, asCookie(c0));
      await captureExchange('A01_logout_403_foreign.json', { method: 'POST', path: '/api/auth/logout' }, denied, [
        '403 code ORIGIN_MISMATCH, still clears both cookies (router.py:290-293)',
        `${cookieShape(denied, REFRESH)} | ${cookieShape(denied, STREAM)}`,
      ]);
      await expectError(denied, 403, 'ORIGIN_MISMATCH');
      expectCleared(denied);

      const alive = await refresh(api, c0);
      await captureExchange('A01_logout_403_session_alive.json', { method: 'POST', path: '/api/auth/refresh' }, alive, [
        'after the 403 logout the server session is NOT revoked → refresh 200',
      ]);
      await expectW16(alive, 'admin');
      const c1 = cookieValue(alive, REFRESH);

      const out = await post(api, '/api/auth/logout', undefined, asCookie(c1));
      await captureExchange('A01_logout_204.json', { method: 'POST', path: '/api/auth/logout' }, out, [
        '204, clears appback_refresh (Path=/api/auth) and appback_stream (Path=/api/streams) with Max-Age=0',
        `${cookieShape(out, REFRESH)} | ${cookieShape(out, STREAM)}`,
      ]);
      expect(out.status()).toBe(204);
      expectCleared(out);

      const dead = await refresh(api, c1);
      await captureExchange('A01_logout_session_revoked.json', { method: 'POST', path: '/api/auth/refresh' }, dead, [
        'refresh with the logged-out cookie → 401 code SESSION_REVOKED (sessions.py:452-453)',
      ]);
      await expectError(dead, 401, 'SESSION_REVOKED');

      const again = await post(api, '/api/auth/logout');
      await captureExchange('A01_logout_idempotent.json', { method: 'POST', path: '/api/auth/logout' }, again, [
        'logout without any cookie → 204 + clear commands (idempotent, router.py:287)',
      ]);
      expect(again.status()).toBe(204);
      expectCleared(again);
    } finally {
      await api.dispose();
      await foreign.dispose();
    }
  });
});

/* ------------------------------------------------------------------ invitation (real token) */

test.describe('A01 POST /api/auth/invitations/accept — real Mailpit token (BE:apps/api/auth_recovery/router.py:337-365)', () => {
  test('A01 · pending login 401; accept 204 + session; W16 has the trimmed name; token single-use → 422 INVITATION_TOKEN_INVALID; disabled → refresh 401 SESSION_REVOKED, right password 403 ACCOUNT_DISABLED, wrong 401 (pairs SCR-03 mocked "signed in, 204", E01 mocked 403 ACCOUNT_DISABLED)', async () => {
    let admin: APIRequestContext | undefined;
    let invited: Invited | undefined;
    const mails: string[] = [];
    const api = await newApiContext();
    try {
      admin = await adminApi();
      invited = await invite(admin, testEmail('invite'), 'A01_invite_setup.json');
      mails.push(invited.mailId);
      const password = testPassword();

      // router.py:173-177: `pending` → no usable hash → same 401 as a wrong password (C27).
      const pending = await login(api, invited.email, password);
      await captureExchange('A01_invite_pending_login.json', { method: 'POST', path: '/api/auth/login', body: { email: invited.email, password, rememberMe: false } }, pending, [
        'login of a still-pending invitee → 401 code INVALID_CREDENTIALS (not ACCOUNT_DISABLED, C27)',
      ]);
      await expectError(pending, 401, 'INVALID_CREDENTIALS');

      const fullName = `  ${PREFIX}Nguyễn Thử  `;
      const body = { token: invited.token, fullName, password };
      const accepted = await post(api, '/api/auth/invitations/accept', body);
      await captureExchange('A01_invite_accept_204.json', { method: 'POST', path: '/api/auth/invitations/accept', body }, accepted, [
        '204 with the real mailed token; pending → active and a session opens (router.py:352-364)',
        `${cookieShape(accepted, REFRESH)} | ${cookieShape(accepted, STREAM)}`,
        'refresh cookie has no Max-Age (remember=False, router.py:360)',
      ]);
      expect(accepted.status()).toBe(204);
      expectSessionCookies(accepted, false);

      const session = await refresh(api, cookieValue(accepted, REFRESH));
      await captureExchange('A01_invite_session_w16.json', { method: 'POST', path: '/api/auth/refresh' }, session, [
        `200 W16: roles ["viewer"], user.id = invited id, user.email = invited address, user.name = "${fullName.trim()}" (NFC + trim, router.py:64-69)`,
      ]);
      await expectW16(session, 'viewer', { id: invited.id, email: invited.email, name: fullName.trim() });
      const rotated = cookieValue(session, REFRESH);

      const reuseBody = { ...body, password: testPassword() };
      const reuse = await post(api, '/api/auth/invitations/accept', reuseBody);
      await captureExchange('A01_invite_reuse_422.json', { method: 'POST', path: '/api/auth/invitations/accept', body: reuseBody }, reuse, [
        'same token again → 422 code INVITATION_TOKEN_INVALID (used_at set, tokens.py:61-63; router.py:348-349)',
      ]);
      await expectError(reuse, 422, 'INVITATION_TOKEN_INVALID');

      const disabled = await post(admin, `/api/users/${invited.id}/disable`, {});
      await captureExchange('A01_invite_disable.json', { method: 'POST', path: `/api/users/${invited.id}/disable`, body: {} }, disabled, [
        'setup: admin disables the invitee → 200 status "disabled" (users/service.py:297-307 revokes sessions)',
      ]);
      expect(disabled.status()).toBe(200);
      expect(((await disabled.json()) as Json).status).toBe('disabled');

      const revoked = await refresh(api, rotated);
      await captureExchange('A01_invite_disabled_refresh.json', { method: 'POST', path: '/api/auth/refresh' }, revoked, [
        'refresh of the disabled user\'s session → 401 code SESSION_REVOKED',
      ]);
      await expectError(revoked, 401, 'SESSION_REVOKED');

      const right = await login(api, invited.email, password);
      await captureExchange('A01_invite_disabled_login_403.json', { method: 'POST', path: '/api/auth/login', body: { email: invited.email, password, rememberMe: false } }, right, [
        'disabled user, RIGHT password → 403 code ACCOUNT_DISABLED, no Set-Cookie (router.py:178-179)',
      ]);
      await expectError(right, 403, 'ACCOUNT_DISABLED');
      expect(setCookie(right, REFRESH)).toBeUndefined();

      const wrong = await login(api, invited.email, testPassword());
      await captureExchange('A01_invite_disabled_login_401.json', { method: 'POST', path: '/api/auth/login', body: { email: invited.email, password: 'wrong', rememberMe: false } }, wrong, [
        'disabled user, WRONG password → 401 code INVALID_CREDENTIALS (status revealed only after a right password)',
      ]);
      await expectError(wrong, 401, 'INVALID_CREDENTIALS');
    } finally {
      await api.dispose();
      await cleanup(admin, invited, mails);
    }
  });
});

/* ------------------------------------------------------------------ password reset (real token) */

test.describe('A01 POST /api/auth/password-reset + /confirm — real Mailpit token (BE:apps/api/auth_recovery/router.py:227-292)', () => {
  test('A01 · request 204 + mailed link; confirm 204 clears cookies and revokes sessions; old password 401, new 204; token single-use → 422 PASSWORD_RESET_TOKEN_INVALID (pairs SCR-04 mocked 204, E01 mocked reset 422)', async () => {
    let admin: APIRequestContext | undefined;
    let invited: Invited | undefined;
    const mails: string[] = [];
    const api = await newApiContext();
    try {
      admin = await adminApi();
      invited = await invite(admin, testEmail('reset'), 'A01_reset_invite_setup.json');
      mails.push(invited.mailId);
      const oldPassword = testPassword();
      const acceptBody = { token: invited.token, fullName: `${PREFIX}reset`, password: oldPassword };
      const accepted = await post(api, '/api/auth/invitations/accept', acceptBody);
      await captureExchange('A01_reset_accept_setup.json', { method: 'POST', path: '/api/auth/invitations/accept', body: acceptBody }, accepted, [
        'setup: invitee accepts → 204, active user with a live session',
      ]);
      expect(accepted.status()).toBe(204);
      const session = cookieValue(accepted, REFRESH);

      const since = new Date(Date.now() - 5_000);
      const requestBody = { email: invited.email };
      const requested = await post(api, '/api/auth/password-reset', requestBody);
      await captureExchange('A01_reset_request_204.json', { method: 'POST', path: '/api/auth/password-reset', body: requestBody }, requested, [
        '204 no body for an active user (router.py:234-245; same 204 as an unknown address, C27)',
      ]);
      expect(requested.status()).toBe(204);
      expect(await requested.text()).toBe('');
      const mail = await waitForMail(invited.email, since, 30_000, 'Yêu cầu đặt lại mật khẩu AppBack'); // messages.py:36
      mails.push(mail.id);
      const token = tokenFrom(mail, '/login/reset-password');

      const newPassword = testPassword();
      const confirmBody = { token, newPassword };
      const confirmed = await post(api, '/api/auth/password-reset/confirm', confirmBody, asCookie(session));
      await captureExchange('A01_reset_confirm_204.json', { method: 'POST', path: '/api/auth/password-reset/confirm', body: confirmBody }, confirmed, [
        '204 with the real mailed token; clears both cookies (router.py:268-272)',
        `${cookieShape(confirmed, REFRESH)} | ${cookieShape(confirmed, STREAM)}`,
      ]);
      expect(confirmed.status()).toBe(204);
      expectCleared(confirmed);

      const revoked = await refresh(api, session);
      await captureExchange('A01_reset_session_revoked.json', { method: 'POST', path: '/api/auth/refresh' }, revoked, [
        'the session opened before the reset → 401 code SESSION_REVOKED (revoke_sessions reason password_reset, router.py:270)',
      ]);
      await expectError(revoked, 401, 'SESSION_REVOKED');

      const old = await login(api, invited.email, oldPassword);
      await captureExchange('A01_reset_old_password_401.json', { method: 'POST', path: '/api/auth/login', body: { email: invited.email, password: oldPassword, rememberMe: false } }, old, [
        'old password after the reset → 401 code INVALID_CREDENTIALS',
      ]);
      await expectError(old, 401, 'INVALID_CREDENTIALS');

      const fresh = await login(api, invited.email, newPassword, true);
      await captureExchange('A01_reset_new_password_204.json', { method: 'POST', path: '/api/auth/login', body: { email: invited.email, password: newPassword, rememberMe: true } }, fresh, [
        'new password → 204 + session cookies; rememberMe=true → refresh cookie carries Max-Age (sessions.py:189)',
        cookieShape(fresh, REFRESH),
      ]);
      expect(fresh.status()).toBe(204);
      expectSessionCookies(fresh, true);

      const reuseBody = { token, newPassword: testPassword() };
      const reuse = await post(api, '/api/auth/password-reset/confirm', reuseBody);
      await captureExchange('A01_reset_reuse_422.json', { method: 'POST', path: '/api/auth/password-reset/confirm', body: reuseBody }, reuse, [
        'same reset token again → 422 code PASSWORD_RESET_TOKEN_INVALID (router.py:286-287; never 401, K30)',
      ]);
      await expectError(reuse, 422, 'PASSWORD_RESET_TOKEN_INVALID');
    } finally {
      await api.dispose();
      await cleanup(admin, invited, mails);
    }
  });

  test('A01 · confirm with a 513-character token → 422 VALIDATION field "token" (FE: dead-end, recoveryShared.ts:51-56; pairs SCR-04 mocked 422 field token)', async () => {
    // router.py:58,87 `max_length=TOKEN_MAX_LEN` (512); FE tokenSchema max(512) (src/api/schemas/auth.ts:15).
    const api = await newApiContext();
    try {
      const body = { token: 'x'.repeat(513), newPassword: 'Qa-token-long-1' };
      const res = await post(api, '/api/auth/password-reset/confirm', body);
      await captureExchange('A01_reset_confirm_422_token.json', { method: 'POST', path: '/api/auth/password-reset/confirm', body }, res, [
        '422 code VALIDATION field "token" (513 > 512 chars)',
      ]);
      await expectError(res, 422, 'VALIDATION', 'token');
    } finally {
      await api.dispose();
    }
  });
});

/* ------------------------------------------------------------------ recovery body rules (mock pairs) */

/**
 * One real request each, proving the BE really answers the 422 VALIDATION {field, count: 1} that an E01 UI
 * test fakes. Body validation runs before any token/user lookup (FastAPI body model), so a bogus token is
 * enough and nothing is created, mailed or consumed. Last in the file: under the default recovery_ip 10/900 s
 * (no override, BUG-053) these are the requests that run out, and the 429 check below says so.
 */
const RECOVERY_422_PAIRS: ReadonlyArray<{ slug: string; path: string; body: Json; field: string; title: string; why: string }> = [
  {
    slug: 'accept_422_token',
    path: '/api/auth/invitations/accept',
    body: { token: 'x'.repeat(513), fullName: `${PREFIX}vtoken`, password: 'Qa-token-long-1' },
    field: 'token',
    title: 'accept with a 513-character token → 422 VALIDATION field "token" (pairs recovery_edge SCR-03 mocked 422 field token)',
    why: 'router.py:94 token max_length TOKEN_MAX_LEN 512 (:58); BE test test_router_accept_invitation.py:57-61',
  },
  {
    slug: 'accept_422_password',
    path: '/api/auth/invitations/accept',
    body: { token: `qa-bogus-${uniq()}`, fullName: `${PREFIX}vpass`, password: 'Qa-1234' },
    field: 'password',
    title: 'accept with a 7-character password → 422 VALIDATION field "password" (pairs recovery_edge SCR-03 mocked 422 field password)',
    why: 'router.py:96 password min_length MIN_PASSWORD_LENGTH 8 (auth/passwords.py:34); BE test test_router_accept_invitation.py:53-56',
  },
  {
    slug: 'confirm_422_new_password',
    path: '/api/auth/password-reset/confirm',
    body: { token: `qa-bogus-${uniq()}`, newPassword: 'Qa-1234' },
    field: 'newPassword',
    title: 'confirm with a 7-character newPassword → 422 VALIDATION field "newPassword" (pairs recovery_edge SCR-04 mocked 422 field newPassword)',
    why: 'router.py:88 new_password min_length 8, wire alias camelCase (core/wire.py:46, core/errors.py:136-158); BE test test_router_confirm_reset.py:51-55',
  },
  {
    slug: 'reset_422_email',
    path: '/api/auth/password-reset',
    body: { email: `${PREFIX}bad@localhost` },
    field: 'email',
    title: 'password-reset with an address zod .email() rejects → 422 VALIDATION field "email", no mail (pairs auth_edge mocked forgot 422 VALIDATION(email))',
    why: 'router.py:72-81 validate_wire_email (auth/emails.py:31-42); BE test test_router_request_reset.py:68-72',
  },
];

test.describe('A01 recovery routes — body rules, real 422 for every mocked 422 VALIDATION (BE:apps/api/auth_recovery/router.py:72-102)', () => {
  for (const pair of RECOVERY_422_PAIRS) {
    test(`A01 · ${pair.title}`, async () => {
      // errors.py:170-180: first Pydantic error → field (camelCase), count = number of errors (one bad field → 1).
      const api = await newApiContext();
      try {
        const res = await post(api, pair.path, pair.body);
        await captureExchange(`A01_${pair.slug}.json`, { method: 'POST', path: pair.path, body: pair.body }, res, [
          `422 code VALIDATION field "${pair.field}" count 1 (${pair.why})`,
        ]);
        expect(res.status(), 'recovery_ip spent: 429 = stack runs without qa-limits.override.yml (BUG-053)').not.toBe(429);
        const body = await expectError(res, 422, 'VALIDATION', pair.field);
        expect(body.count).toBe(1);
      } finally {
        await api.dispose();
      }
    });
  }
});

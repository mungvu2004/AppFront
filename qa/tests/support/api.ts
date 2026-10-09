import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { request, test, type APIRequestContext, type APIResponse } from '@playwright/test';

import { EVIDENCE_DIR } from './evidence';

/**
 * API layer (skill `qa-api-test`): talk to the real backend without a browser.
 * Base URL = the web origin (`/api` is proxied by the web container), and every request carries
 * `Origin: <base>` because cookie-auth routes reject other origins with 403 `ORIGIN_MISMATCH`
 * (AppBack `require_origin`).
 */
export function apiBaseUrl(): string {
  const base = process.env.E2E_FULLSTACK_BASE_URL?.replace(/\/+$/u, '');
  if (!base) throw new Error('E2E_FULLSTACK_BASE_URL is not set (qa.config.json env.vars)');
  return base;
}

export async function newApiContext(extraHeaders: Record<string, string> = {}): Promise<APIRequestContext> {
  const base = apiBaseUrl();
  return request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, ...extraHeaders } });
}

/**
 * Signed-in API client: `POST /api/auth/login` (refresh cookie, AppBack `auth/router.py` SignInBody,
 * camelCase on the wire) → `POST /api/auth/refresh` → access token (`accessToken`/`access_token`,
 * FE `src/lib/auth/refresh.ts:95-96,377`) → `Authorization: Bearer` on every later call.
 * Each call is one real login request: count it in the spec's rate-limit budget.
 */
export async function signedInApi(email: string, password: string, rememberMe = false): Promise<APIRequestContext> {
  const anon = await newApiContext();
  const login = await anon.post('/api/auth/login', { data: { email, password, rememberMe } });
  if (login.status() !== 204) {
    await anon.dispose();
    throw new Error(`signedInApi: POST /api/auth/login → ${login.status()} (expected 204)`);
  }
  const refreshed = await anon.post('/api/auth/refresh');
  const body = (await refreshed.json().catch(() => ({}))) as { accessToken?: string; access_token?: string };
  const token = body.accessToken ?? body.access_token;
  const state = await anon.storageState();
  await anon.dispose();
  if (refreshed.status() !== 200 || !token) {
    throw new Error(`signedInApi: POST /api/auth/refresh → ${refreshed.status()} without an access token`);
  }
  const base = apiBaseUrl();
  return request.newContext({
    baseURL: base,
    storageState: state,
    extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${token}` },
  });
}

const SECRET_KEY = /pass(word)?|token|secret|cookie|authorization|refresh|sid/iu;
const EXCHANGE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/u;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? '<redacted>' : redact(v)]),
    );
  }
  return value;
}

export interface ExchangeRequest {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}

/**
 * Evidence for an API case (rule of skill `qa-evidence`: every executed case ≥ 1 artifact — a JSON
 * exchange for API cases). Writes `<EVIDENCE_DIR>/<name>.json` (secrets redacted) and attaches it.
 * `assertions` = what the case claims, in words, so a reviewer can check the JSON against it.
 */
export async function captureExchange(
  name: string,
  req: ExchangeRequest,
  res: APIResponse,
  assertions: readonly string[],
): Promise<unknown> {
  if (!EXCHANGE_NAME.test(name)) throw new Error(`Exchange evidence "${name}" must be <id>_<slug>.json`);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep the raw text */
  }
  const record = {
    request: { method: req.method, path: req.path, body: redact(req.body ?? null) },
    response: {
      status: res.status(),
      headers: redact(Object.fromEntries(Object.entries(res.headers()).filter(([k]) => !/^(date|etag|vary)$/iu.test(k)))),
      body: redact(body),
    },
    assertions,
    capturedAt: new Date().toISOString(),
  };
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, name);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  await test.info().attach(name, { path, contentType: 'application/json' });
  return body;
}

/**
 * Phase 6 — rules, export / data, versions BACKEND through the real API (skill `qa-api-test`), no browser, NO mocks.
 * Endpoints the phase-6 screens call (FE `src/api/endpoints.ts:247-250` ruleConfig.*, `:251-266` spatial.*,
 * `:331-339` versions.*; FE client `src/api/client.ts:1284-1300,1425-1478`; UI spec `phase06_rules_export_versions.spec.ts`):
 *   GET   /api/projects/:p/rule-config (N21)                 BE rules/router.py:21-26 → service.py:90-95
 *   PUT   /api/projects/:p/rule-config (N22, versioned)      BE rules/router.py:29-38 → service.py:98-148, schemas.py:23-50
 *   GET   /api/projects/:p/versions?floorId= (N17)           BE versions/router.py:37-45 → service.py:142-163
 *   GET   /api/projects/:p/versions/:v (#36)                 BE versions/router.py:48-51 → service.py:129-139
 *   GET   /api/projects/:p/versions/:v/snapshot?floorId= (N18)  BE versions/router.py:54-59 → service.py:166-176
 *   POST  /api/projects/:p/versions/:v/restore (N19, versioned) BE versions/router.py:62-82 → service.py:217-298
 *   PATCH /api/projects/:p/versions/:v/label (N20)           BE versions/router.py:85-91 → service.py:301-338
 *   GET   /api/projects/:p/spatial (N15) + …/floors/:f/spatial/layer (N16) — the data viewer / export reads: rules
 *         unchanged since phase 4 (`git diff bf83f815 2ee030c5` on spatial_read/, spatial_write/, projects/, core/ is
 *         empty) and covered by `phase04_qc_layers_api.spec.ts`; here N16 is only the read-back of N18 / N19.
 * `BE:` = `F:/App/AppBack` (qa.config backendSourceRoot, HEAD 2ee030c5), paths under `apps/api/` unless noted.
 * Every 200/201 body is also parsed with the FE zod the screens decode it with (`ProjectRuleConfigSchema`,
 * `FloorVersionPageSchema`, `FloorVersionSummarySchema`, `FloorVersionSnapshotSchema`) — FE <-> BE contract.
 * Inventory + mock-pairing table: `qa/coverage/phase06-be.md`.
 *
 * ## Non-serial, own data
 * Every test signs in on its own and creates its projects (`qa-<runId>-…` names). Versions only come from the pipeline
 * (BE apps/worker/pipeline_persist/service.py:182-198: a "before" + an "after" version; autosave never makes one), so the
 * version tests upload `E2E_DRAWING_PNG` to their OWN project and wait for the real (fake-ML) run — the same calls as
 * `phase03_pipeline_api.spec.ts` happy path. Projects are deleted in `finally` (soft delete hides floors and versions).
 * The one non-admin user is REAL: admin invites a run-unique `@example.test` viewer, the token comes from Mailpit, the
 * invitee accepts; later admin changes its role to engineer (#41) and it signs in once. Cleanup: `DELETE /api/users/{id}`
 * + mails. The admin account is only read.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - No rate limit on N15-N22 / #36 (grep `rate_limit(` in rules/, versions/, spatial_read/, spatial_write/: none).
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37; override LOGIN_IP_LIMIT=120): THIS file 7
 *   (one admin login in each of the 6 signed-in tests) + 1 engineer login in "roles" = 8, 0 failed. Phase-6 UI layers:
 *   main `phase06_rules_export_versions.spec.ts` 2 (`signedInApi` fixture + `signInAdmin`); ui
 *   `phase06_rules_export_versions_ui.spec.ts` 2 (`signedInApi` per group, +1 browser login only for a dead stored
 *   session, its header); edge 0 (+1 for a dead stored session). Layers run sequentially → ≤ 14 per run, far below 30
 *   even without the override.
 * - `drawings_init` 60 / 600 s per user (BE:drawings/settings.py:135-136): ADMIN 4 (one pipeline project in "versions
 *   read", "restore", "label", "roles"); main 1 and ui 1 (QA-06: each seeds its own pipeline project instead of reading
 *   CP-5/CP-6; +1 per worker restart after a failed test); edge 4 → Phase 6 ≈ 10 per run, far below 60.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:55-63): THIS file 1. Phases 1-5 spend 27
 *   (phase05 header) → Phases 1-6 in one hour = 28 ≤ 30.
 * - `recovery_ip` 10 / 900 s per IP (override 60): 1 invitation accept.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/settings.py:14): admin 1.
 * - Idempotency records: "label" leaves 1 row (24 h TTL, core/idempotency.py:49). N19 / N22 are versioned → no
 *   idempotency table (core/routing.py:227-232).
 * - Mailpit: 1 invitation mail, deleted in `finally`.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { ProjectRuleConfigSchema, UpdateRuleConfigSchema } from '../../src/api/schemas/ruleConfig';
import {
  FloorVersionPageSchema,
  FloorVersionSnapshotSchema,
  FloorVersionSummarySchema,
  LabelVersionSchema,
  RestoreVersionSchema,
} from '../../src/api/schemas/versions';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { apiBaseUrl, captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, testEmail } from './support/evidence';
import { qcLayer, writeLayer } from './support/layerSeed';
import { deleteMails, linkFrom, waitForMail, type Mail } from './support/mailpit';

const PREFIX = TEST_DATA_PREFIX;
const REFRESH = 'appback_refresh'; // BE:auth/cookies.py:13
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase01-05 api specs)
const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)
const MISSING_VERSION = `ver_${'0'.repeat(26)}`;
const SYSTEM_PIPELINE = 'system:pipeline'; // packages/core/errors.py:144
const PIPELINE_NAME = 'hệ thống AI'; // apps/worker/pipeline_persist/constants.py:5
const BEFORE_PIPELINE_NOTE = 'trạng thái trước khi ghi kết quả AI'; // versions/messages.py:18-20
const afterNote = (n: number): string => `phục hồi nội dung của phiên bản v${String(n)}`; // messages.py:8-10
const beforeNote = (n: number): string => `trạng thái trước khi phục hồi phiên bản v${String(n)}`; // messages.py:13-15
const RULE_CONFIG_KEYS = ['overrides', 'revision'] as const; // rules/schemas.py:61-65
const SUMMARY_KEYS = ['createdAt', 'creatorId', 'creatorName', 'floorRevision', 'hasSnapshot', 'id', 'sequence'] as const; // versions/schemas.py:31-42
const SUMMARY_OPTIONAL = ['label', 'note'] as const;
const VERSION_KEYS = ['createdAt', 'creatorId', 'id', 'projectId', 'sequence'] as const; // versions/schemas.py:20-28
const SNAPSHOT_KEYS = ['dimensions', 'layer', 'versionId'] as const; // versions/schemas.py:45-50
const ACTIVITY_KEYS = ['at', 'id', 'kind', 'objectCode', 'objectLabel'] as const; // users/schemas.py (phase03 api)
const CHUNK_BYTES = 5 * 1024 * 1024; // BE drawings/settings.py:131 UPLOAD_CHUNK_BYTES

type Json = Record<string, unknown>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ruleConfigPath = (p: string): string => `/api/projects/${p}/rule-config`;
const listPath = (p: string, floorId: string, extra = ''): string => `/api/projects/${p}/versions?floorId=${encodeURIComponent(floorId)}${extra}`;
const versionPath = (p: string, v: string): string => `/api/projects/${p}/versions/${v}`;
const snapshotPath = (p: string, v: string, floorId: string): string => `${versionPath(p, v)}/snapshot?floorId=${encodeURIComponent(floorId)}`;
const restorePath = (p: string, v: string): string => `${versionPath(p, v)}/restore`;
const labelPath = (p: string, v: string): string => `${versionPath(p, v)}/label`;
const layerPath = (p: string, f: string): string => `/api/projects/${p}/floors/${f}/spatial/layer`;

/* ------------------------------------------------------------------ phase-local helpers (pattern of phase05 api) */

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

/** Every `required` key present and nothing outside `required` ∪ `optional`. */
function expectKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): Json {
  const record = asJson(value);
  const keys = Object.keys(record);
  for (const key of required) expect.soft(keys, `key "${key}"`).toContain(key);
  expect.soft(keys.filter((key) => !required.includes(key) && !optional.includes(key)), 'unexpected keys').toEqual([]);
  return record;
}

/** The FE decodes this body with `schema`; a failure is an FE<->BE contract break. */
function expectZod(schema: ZodTypeAny, value: unknown, what: string): void {
  const parsed = schema.safeParse(value);
  const issues = parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3));
  expect.soft(parsed.success, `${what} decodes with the FE zod schema ${issues}`).toBe(true);
}

interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `A06_<ev>.json` (secrets redacted by `captureExchange`).
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
  const shown: unknown = raw ? data.toString('utf8') : (data ?? null);
  const body = await captureExchange(`A06_${ev}.json`, { method, path, body: shown }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource`). `field: null` = must be absent. */
function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string | null; readonly resource?: string } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field === null) expect.soft(body, `${code} has no field`).not.toHaveProperty('field');
  else if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  return body;
}

/** 409 W20 of a versioned write (core/errors.py:82-87): `currentVersion` + `remoteChanges`. */
function expectConflict(sent: Sent, currentVersion: number): unknown[] {
  const body = expectError(sent, 409, 'VERSION_CONFLICT');
  expect.soft(body.currentVersion, '409 currentVersion').toBe(currentVersion);
  return Array.isArray(body.remoteChanges) ? body.remoteChanges : [];
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

interface Project {
  readonly id: string;
  readonly floors: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly adminId: string;
  readonly adminName: string;
}

/** Setup: admin creates `qa-<runId>-<slug>-…` with `floorNames` (#25 drafts) and registers its deletion. */
async function newProject(api: APIRequestContext, ev: string, cleanup: Cleanup, floorNames: readonly string[] = []): Promise<Project> {
  const data: Json = { name: `${PREFIX}${ev}-${uniq()}` };
  if (floorNames.length > 0) {
    data.floors = floorNames.map((name, order) => ({ name, order, elevationMm: order * 3_000, heightMm: 3_000 }));
  }
  const sent = await call(api, `${ev}_create`, 'POST', '/api/projects', data, ['setup: 201 ProjectOut (projects/router.py)']);
  expect(sent.res.status(), 'setup create project').toBe(201);
  const created = asJson(sent.body);
  const id = String(created.id);
  cleanup.add(async () => {
    const res = await api.delete(`/api/projects/${id}`);
    if (res.status() !== 200 && res.status() !== 404) note(`DELETE /api/projects/${id} → ${String(res.status())}`);
  });
  const members = asArray(created.members, 'members').map((m) => asJson(m));
  expect(members, 'a fresh project has its creator as the only member').toHaveLength(1);
  let floors: Array<{ id: string; name: string }> = [];
  if (floorNames.length > 0) {
    const read = await api.get(`/api/projects/${id}`);
    expect(read.status(), 'setup: GET /api/projects/:id').toBe(200);
    const rows = asArray(asJson(await read.json()).floors, 'floors').map((f) => asJson(f));
    floors = floorNames.map((name) => {
      const row = rows.find((f) => f.name === name);
      if (typeof row?.id !== 'string') throw new Error(`setup: floor "${name}" was not created`);
      return { id: row.id, name };
    });
  }
  return { id, floors, adminId: String(members[0]?.id), adminName: String(members[0]?.name) };
}

const floorOf = (project: Project, index = 0): string => {
  const floor = project.floors[index];
  if (floor === undefined) throw new Error(`project has no floor #${String(index)}`);
  return floor.id;
};

async function updatedAt(api: APIRequestContext, id: string, ev: string): Promise<unknown> {
  const sent = await call(api, ev, 'GET', `/api/projects/${id}`, undefined, ['read-back: 200 ProjectOut.updatedAt (#24)']);
  expect(sent.res.status()).toBe(200);
  return asJson(sent.body).updatedAt;
}

/** `activity_log` rows of `userId` whose `objectCode` is `code` and kind is `kind` (GET /api/users/{id}/activity). */
async function activityOf(admin: APIRequestContext, userId: string, code: string, kind: string, ev: string): Promise<Json[]> {
  const sent = await call(admin, ev, 'GET', `/api/users/${userId}/activity`, undefined, [
    `read-back: 200 activity rows of the admin, newest first; filtered here by objectCode + kind "${kind}"`,
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body)
    .map((row) => expectKeys(row, ACTIVITY_KEYS))
    .filter((row) => row.objectCode === code && row.kind === kind);
}

const drawingPng = (): Buffer => {
  const path = process.env.E2E_DRAWING_PNG;
  if (!path) throw new Error('E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
  return readFileSync(path);
};

/**
 * Own versions: project with `floorNames`, `E2E_DRAWING_PNG` uploaded to the FIRST floor (#5 → #6 → #7, FE body
 * uploadTask.ts:424-433), #8 polled until the run is final (must be `completed`), then N17 polled until the pipeline's
 * "before" + "after" versions are listed (pipeline_persist/service.py:182-198).
 */
async function pipelineProject(admin: APIRequestContext, ev: string, cleanup: Cleanup, floorNames: readonly string[] = ['Tầng 1']): Promise<Project> {
  const project = await newProject(admin, ev, cleanup, floorNames);
  const pid = project.id;
  const fid = floorOf(project);
  const png = drawingPng();
  expect(png.length, 'drawing.png fits one upload chunk').toBeLessThanOrEqual(CHUNK_BYTES);
  const init = await call(admin, `${ev}_upload_init`, 'POST', `/api/projects/${pid}/floors/${fid}/drawings/uploads`, {
    fileName: `${PREFIX}${ev}.png`, floorId: fid, mimeType: 'image/png', projectId: pid, sizeBytes: png.length,
  }, ['setup: #5 init → 200 receiving upload']);
  expect(init.res.status(), 'setup: upload init').toBe(200);
  const uid = String(asJson(init.body).id);
  const base = `/api/projects/${pid}/drawings/uploads/${uid}`;
  const chunk = await admin.post(`${base}/chunks`, { data: { chunk: png.toString('base64'), chunkIndex: 0 } });
  expect(chunk.status(), 'setup: upload chunk 0 (#6)').toBe(200);
  const done = await call(admin, `${ev}_upload_complete`, 'POST', `${base}/complete`, { uploadId: uid }, ['setup: #7 → 200 pending run']);
  expect(done.res.status(), 'setup: upload complete').toBe(200);
  let status = '';
  await expect
    .poll(
      async () => {
        const res = await admin.get(`${base}/progress`);
        status = res.status() === 200 ? String(asJson(await res.json()).status) : `#8 ${String(res.status())}`;
        return status === 'completed' || status === 'failed';
      },
      { message: 'setup: pipeline run reaches a final status', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
    )
    .toBe(true);
  expect(status, 'setup: the fake-ML pipeline run completed (it writes the AI layer + 2 versions)').toBe('completed');
  await expect
    .poll(async () => {
      const res = await admin.get(listPath(pid, fid));
      return res.status() === 200 ? asArray(asJson(await res.json()).items).length : -1;
    }, { message: 'setup: N17 lists the pipeline "before" + "after" versions', timeout: 60_000, intervals: [1_000] })
    .toBeGreaterThanOrEqual(2);
  return project;
}

/** N17 read-back: 200 `{items[, nextCursor]}` decoded by the FE page schema; items with exact summary keys. */
async function versions(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string, extra = ''): Promise<{ items: Json[]; body: Json }> {
  const sent = await call(api, ev, 'GET', listPath(pid, fid, extra), undefined, [claim]);
  expect(sent.res.status(), `N17 ${ev}`).toBe(200);
  const body = expectKeys(sent.body, ['items'], ['nextCursor']);
  expectZod(FloorVersionPageSchema, sent.body, `N17 ${ev}`);
  const items = asArray(body.items, 'items').map((item) => {
    expectZod(FloorVersionSummarySchema, item, 'N17 item');
    return expectKeys(item, SUMMARY_KEYS, SUMMARY_OPTIONAL);
  });
  return { items, body };
}

const byId = (items: readonly Json[], id: string): Json => {
  const found = items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`version ${id} not listed`);
  return found;
};

/** N16 read-back (the data viewer / export read): `revision`, `layer`, `dimensions`. */
async function layerDoc(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', layerPath(pid, fid), undefined, [claim]);
  expect(sent.res.status(), `N16 ${ev}`).toBe(200);
  return asJson(sent.body);
}

/* ---- the real non-admin user (invitation → Mailpit → accept → refresh), as phase05 api */

interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly api: APIRequestContext;
}

function cookieFrom(res: APIResponse, name: string): string | undefined {
  const line = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${name}=`));
  return line?.value.slice(name.length + 1).split(';')[0];
}

async function realUser(admin: APIRequestContext, role: 'viewer' | 'engineer', ev: string, cleanup: Cleanup): Promise<TestUser> {
  const email = testEmail(ev);
  const password = `Qa-${randomUUID()}`;
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
  try {
    const accept = await call(anon, `${ev}_accept`, 'POST', '/api/auth/invitations/accept', { token, fullName: `${PREFIX}${ev}`, password }, [
      'setup: invitee accepts with the real mailed token → 204 + refresh cookie',
    ]);
    expect(accept.res.status()).toBe(204);
    const refreshCookie = cookieFrom(accept.res, REFRESH);
    if (!refreshCookie) throw new Error('accept: no refresh cookie');
    const refreshed = await call(anon, `${ev}_refresh`, 'POST', '/api/auth/refresh', undefined, [
      `setup: 200 W16 roles ["${role}"] + access token`,
    ], { Cookie: `${REFRESH}=${refreshCookie}` });
    expect(refreshed.res.status()).toBe(200);
    bearer = String(((await refreshed.res.json()) as Json).accessToken);
  } finally {
    await anon.dispose();
  }
  const base = apiBaseUrl();
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${bearer}` } });
  cleanup.add(() => api.dispose());
  return { id, email, password, api };
}

/* ------------------------------------------------------------------ tests */

test.describe('A06 phase-6 backend (rule-config N21 / N22, versions N17-N20 / #36)', () => {
  test('A06 · anonymous: N21 / N22 / N17 / #36 / N18 / N19 / N20 → 401 UNAUTHENTICATED before the project gate, the 428 guard and the body (also truncated JSON)', async () => {
    // core/routing.py:129-135 (principal before the body); rules/router.py:17; versions/router.py:30.
    const anon = await newApiContext();
    try {
      const routes: Array<[string, Method, string, unknown]> = [
        ['rule_config_get', 'GET', ruleConfigPath(MISSING_PROJECT), undefined],
        ['rule_config_put', 'PUT', ruleConfigPath(MISSING_PROJECT), { baseVersion: 0, body: { overrides: {} } }],
        ['rule_config_put_no_base', 'PUT', ruleConfigPath(MISSING_PROJECT), { body: { overrides: {} } }],
        ['rule_config_put_malformed', 'PUT', ruleConfigPath(MISSING_PROJECT), Buffer.from('{"baseVersion": 0,')],
        ['versions_list', 'GET', listPath(MISSING_PROJECT, 'F1'), undefined],
        ['version_read', 'GET', versionPath(MISSING_PROJECT, MISSING_VERSION), undefined],
        ['snapshot', 'GET', snapshotPath(MISSING_PROJECT, MISSING_VERSION, 'F1'), undefined],
        ['restore', 'POST', restorePath(MISSING_PROJECT, MISSING_VERSION), { baseVersion: 0, body: { floorId: 'F1' } }],
        ['label', 'PATCH', labelPath(MISSING_PROJECT, MISSING_VERSION), { label: 'e2e' }],
      ];
      for (const [slug, method, path, data] of routes) {
        const sent = await call(anon, `anon_${slug}_401`, method, path, data, [
          '401 UNAUTHENTICATED: no Bearer, checked before the project gate / 428 guard / body (core/routing.py:129-135)',
        ]);
        expectError(sent, 401, 'UNAUTHENTICATED');
      }
    } finally {
      await anon.dispose();
    }
  });

  test('A06 · rule-config N21 / N22: fresh → {revision 0, overrides {}}; PUT base 0 → 200 revision 1 echoed + read back + touch + activity rules.config_update; own repeat (C09b) → 200 same revision, nothing written; stale / future base → 409 VERSION_CONFLICT remoteChanges []; reset {} → 200; two parallel writes on one base → {200, 409}; Idempotency-Key ignored', async () => {
    // rules/service.py:90-95 (read), 98-148 (INSERT … ON CONFLICT, UPDATE … WHERE revision = base, C09b, 409);
    // rules/router.py:29-38 (versioned → no idempotency guard, core/routing.py:227-232); access/kinds.py:35.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'rules-write', cleanup);
      const pid = project.id;
      const fresh = await call(admin, 'rules_read_fresh', 'GET', ruleConfigPath(pid), undefined, [
        '200 {revision: 0, overrides: {}} for a project that never saved (service.py:90-94); no row created',
      ]);
      expect(fresh.res.status()).toBe(200);
      expect.soft(expectKeys(fresh.body, RULE_CONFIG_KEYS)).toEqual({ revision: 0, overrides: {} });
      expectZod(ProjectRuleConfigSchema, fresh.body, 'N21 fresh');
      const t0 = await updatedAt(admin, pid, 'rules_project_t0');

      const overrides = {
        'WALL-THICKNESS': { enabled: false },
        'DOOR-WIDTH': { severity: 'critical', thresholds: { 'door.minWidthMm': 600 } },
        GENERAL: { thresholds: { 'general.jointToleranceMm': 500 } },
        'ROOM-AREA-BELOW-MINIMUM': { thresholds: { 'room.minArea.bedroom': 60 } },
        'WALL-UNSUPPORTED': { thresholds: { 'wallSupport.minSupportShare': 0.5 } },
      };
      const first = { baseVersion: 0, body: { overrides } };
      expectZod(UpdateRuleConfigSchema, first, 'own N22 body (the FE could send it)');
      const put1 = await call(admin, 'rules_put_base0_200', 'PUT', ruleConfigPath(pid), first, [
        '200 {revision: 1, overrides}: catalog bounds are inclusive (door.minWidthMm 600, room.minArea 60, minSupportShare 0.5; catalog.py:72-93); GENERAL carries thresholds only',
      ]);
      expect.soft(put1.res.status()).toBe(200);
      expect.soft(expectKeys(put1.body, RULE_CONFIG_KEYS)).toEqual({ revision: 1, overrides });
      expectZod(ProjectRuleConfigSchema, put1.body, 'N22 200');
      const read1 = await call(admin, 'rules_read_after_put', 'GET', ruleConfigPath(pid), undefined, ['200: N21 = the N22 answer']);
      expect.soft(read1.body).toEqual(put1.body);
      const t1 = await updatedAt(admin, pid, 'rules_project_t1');
      expect.soft(t1, 'a won write touches the project (service.py:142)').not.toBe(t0);
      expect.soft((await activityOf(admin, project.adminId, pid, 'rules.config_update', 'rules_activity_1')).length, 'one activity row per won write (service.py:133-141)').toBe(1);

      const repeat = await call(admin, 'rules_put_repeat_200', 'PUT', ruleConfigPath(pid), first, [
        '200 revision 1: same writer + same body digest + base = revision - 1 → own repeat, nothing written (service.py:145-147)',
      ]);
      expect.soft(repeat.res.status()).toBe(200);
      expect.soft(repeat.body).toEqual(put1.body);
      expect.soft(await updatedAt(admin, pid, 'rules_project_t2'), 'a repeat does not touch the project').toBe(t1);
      expect.soft((await activityOf(admin, project.adminId, pid, 'rules.config_update', 'rules_activity_2')).length, 'a repeat logs nothing').toBe(1);

      const stale = await call(admin, 'rules_put_stale_409', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: { 'WALL-LENGTH': { enabled: false } } } }, [
        '409 VERSION_CONFLICT currentVersion 1 remoteChanges []: base 0 already used by another body (service.py:148)',
      ]);
      expect.soft(expectConflict(stale, 1), 'rule-config conflicts carry no field changes').toEqual([]);
      const future = await call(admin, 'rules_put_future_409', 'PUT', ruleConfigPath(pid), { ...first, baseVersion: 7 }, [
        '409 VERSION_CONFLICT currentVersion 1: base > revision is a conflict, not a 422 (service.py:103,148)',
      ]);
      expect.soft(expectConflict(future, 1)).toEqual([]);
      const kept = await call(admin, 'rules_read_after_409', 'GET', ruleConfigPath(pid), undefined, ['200: unchanged after the two 409']);
      expect.soft(kept.body).toEqual(put1.body);

      const reset = await call(admin, 'rules_put_reset_200', 'PUT', ruleConfigPath(pid), { baseVersion: 1, body: { overrides: {} } }, [
        '200 {revision: 2, overrides: {}}: "Khôi phục mặc định" = an empty override map (PUT replaces the whole map)',
      ]);
      expect.soft(reset.res.status()).toBe(200);
      expect.soft(reset.body).toEqual({ revision: 2, overrides: {} });

      const bodies = [{ 'WALL-LENGTH': { enabled: false } }, { 'ROOM-UNNAMED': { severity: 'suggestion' } }];
      const race = await Promise.all(bodies.map((o, i) => call(admin, `rules_race_${String(i)}`, 'PUT', ruleConfigPath(pid), { baseVersion: 2, body: { overrides: o } }, [
        'one of {200, 409}: two writes on base 2; the row-level UPDATE … WHERE revision = 2 picks one winner (service.py:118-131)',
      ])));
      expect.soft(race.map((s) => s.res.status()).sort()).toEqual([200, 409]);
      const winner = race.find((s) => s.res.status() === 200);
      const loser = race.find((s) => s.res.status() === 409);
      if (loser) expect.soft(expectConflict(loser, 3)).toEqual([]);
      const afterRace = await call(admin, 'rules_read_after_race', 'GET', ruleConfigPath(pid), undefined, ['200: revision 3 = the 200 winner']);
      expect.soft(afterRace.body).toEqual(winner?.body);

      const keyed = await call(admin, 'rules_put_idempotency_key_ignored_200', 'PUT', ruleConfigPath(pid), { baseVersion: 3, body: { overrides: {} } }, [
        '200 revision 4: a malformed Idempotency-Key is not even read on a versioned route (core/routing.py:227-232)',
      ], { 'Idempotency-Key': 'abc' });
      expect.soft(keyed.res.status()).toBe(200);
      expect.soft(asJson(keyed.body).revision).toBe(4);
    } finally {
      await cleanup.run();
    }
  });

  test('A06 · N22 body rules: project gate → 428 (no baseVersion / not an object) → 400 truncated → W21 → Pydantic 422 VALIDATION with field (strict baseVersion ≥ 0, strict keys, code / key patterns, override ≥ 1 key / no null, StrictBool, severity enum, finite strict numbers) → catalog 422 RULE_CODE_UNKNOWN / RULE_THRESHOLD_UNKNOWN / RULE_THRESHOLD_OUT_OF_RANGE / RULE_GENERAL_NOT_TOGGLEABLE (sorted, first wins, before the version check); nothing written', async () => {
    // core/routing.py:138-163 (W21, 428), core/errors.py:136-157 (field_of camelCases alnum segments, stops at a non-alnum dict key);
    // rules/schemas.py:14-50; rules/service.py:62-80 (check_catalog), errors.py:5-15; catalog.py:72-93.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await newProject(admin, 'rules-body', cleanup);
      const pid = project.id;
      const t0 = await updatedAt(admin, pid, 'rbody_project_t0');
      const put = (ev: string, data: unknown, claims: readonly string[]): Promise<Sent> => call(admin, ev, 'PUT', ruleConfigPath(pid), data, claims);
      const ok = (overrides: unknown): Json => ({ baseVersion: 0, body: { overrides } });

      for (const [slug, data] of [
        ['no_base', { body: { overrides: {} } }],
        ['array_body', []],
        ['string_body', 'junk'],
      ] as const) {
        expectError(await put(`rbody_${slug}_428`, data, ['428 PRECONDITION_REQUIRED: body is not an object with baseVersion; guard runs before Pydantic (core/routing.py:154-163)']), 428, 'PRECONDITION_REQUIRED');
      }
      expectError(await put('rbody_truncated_400', Buffer.from('{"baseVersion": 0,'), ['400 MALFORMED_JSON (core/errors.py:170-174)']), 400, 'MALFORMED_JSON', { field: null });
      for (const [slug, project_] of [['malformed', 'prj_bad'], ['missing', MISSING_PROJECT]] as const) {
        const sent = await call(admin, `rbody_${slug}_project_no_base_404`, 'PUT', ruleConfigPath(project_), { body: {} }, [
          '404 resource project: require_project (param dependency) runs before the 428 guard (rules/router.py:3-4; projects/access.py:28-33)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      }
      expectError(await put('rbody_project_id_mismatch_422', { ...ok({}), projectId: MISSING_PROJECT }, ['422 PATH_BODY_MISMATCH field projectId (W21, core/routing.py:138-151)']), 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });

      const validation: Array<[string, unknown, string]> = [
        ['base_string', { baseVersion: '0', body: { overrides: {} } }, 'baseVersion'],
        ['base_negative', { baseVersion: -1, body: { overrides: {} } }, 'baseVersion'],
        ['base_fraction', { baseVersion: 1.5, body: { overrides: {} } }, 'baseVersion'],
        ['base_null', { baseVersion: null, body: { overrides: {} } }, 'baseVersion'],
        ['body_missing', { baseVersion: 0 }, 'body'],
        ['top_extra_key', { ...ok({}), note: 'x' }, 'note'],
        ['project_id_equal', { ...ok({}), projectId: pid }, 'projectId'],
        ['overrides_missing', { baseVersion: 0, body: {} }, 'body.overrides'],
        ['body_extra_key', { baseVersion: 0, body: { overrides: {}, revision: 1 } }, 'body.revision'],
        ['overrides_array', ok([]), 'body.overrides'],
        ['code_pattern', ok({ 'wall-thickness': { enabled: false } }), 'body.overrides'],
        ['override_empty', ok({ 'WALL-THICKNESS': {} }), 'body.overrides'],
        ['override_empty_alnum_code', ok({ GENERAL: {} }), 'body.overrides.general'], // field_of camelCases every alnum segment (to_camel, core/errors.py:136-157)
        ['enabled_null', ok({ 'WALL-THICKNESS': { enabled: null } }), 'body.overrides'],
        ['enabled_string', ok({ 'WALL-THICKNESS': { enabled: 'false' } }), 'body.overrides'],
        ['severity_unknown', ok({ 'WALL-THICKNESS': { severity: 'error' } }), 'body.overrides'],
        ['thresholds_empty', ok({ 'WALL-THICKNESS': { thresholds: {} } }), 'body.overrides'],
        ['threshold_key_pattern', ok({ 'WALL-THICKNESS': { thresholds: { minThickness: 50 } } }), 'body.overrides'],
        ['threshold_string', ok({ 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': '50' } } }), 'body.overrides'],
        ['override_extra_key', ok({ 'WALL-THICKNESS': { enabled: false, note: 'x' } }), 'body.overrides'],
        ['threshold_nan', Buffer.from('{"baseVersion":0,"body":{"overrides":{"WALL-THICKNESS":{"thresholds":{"wall.minThicknessMm":NaN}}}}}'), 'body.overrides'],
        ['threshold_1e400', Buffer.from('{"baseVersion":0,"body":{"overrides":{"WALL-THICKNESS":{"thresholds":{"wall.minThicknessMm":1e400}}}}}'), 'body.overrides'],
      ];
      for (const [slug, data, field] of validation) {
        expectError(await put(`rbody_${slug}_422`, data, [
          `422 VALIDATION field ${field} (rules/schemas.py:14-50; field_of keeps alnum segments only, core/errors.py:136-157)`,
        ]), 422, 'VALIDATION', { field });
      }

      const catalog: Array<[string, unknown, string, string]> = [
        ['code_unknown', ok({ 'WALL-FOO': { enabled: false } }), 'RULE_CODE_UNKNOWN', 'body.overrides'],
        ['threshold_other_rule', ok({ 'WALL-THICKNESS': { thresholds: { 'door.minWidthMm': 800 } } }), 'RULE_THRESHOLD_UNKNOWN', 'body.overrides'],
        ['threshold_unknown_key', ok({ 'WALL-THICKNESS': { thresholds: { 'wall.unknownMm': 50 } } }), 'RULE_THRESHOLD_UNKNOWN', 'body.overrides'],
        ['general_foreign_threshold', ok({ GENERAL: { thresholds: { 'wall.minThicknessMm': 50 } } }), 'RULE_THRESHOLD_UNKNOWN', 'body.overrides'],
        ['threshold_below_min', ok({ 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 29 } } }), 'RULE_THRESHOLD_OUT_OF_RANGE', 'body.overrides'],
        ['threshold_above_max', ok({ 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 201 } } }), 'RULE_THRESHOLD_OUT_OF_RANGE', 'body.overrides'],
        ['general_enabled', ok({ GENERAL: { enabled: true } }), 'RULE_GENERAL_NOT_TOGGLEABLE', 'body.overrides.GENERAL.enabled'],
        ['general_severity', ok({ GENERAL: { severity: 'warning' } }), 'RULE_GENERAL_NOT_TOGGLEABLE', 'body.overrides.GENERAL.severity'],
        ['order_code_first', ok({ GENERAL: { enabled: true }, 'AAA-X': { enabled: false } }), 'RULE_CODE_UNKNOWN', 'body.overrides'],
        ['order_general_first', ok({ 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 1 } }, GENERAL: { severity: 'warning' } }), 'RULE_GENERAL_NOT_TOGGLEABLE', 'body.overrides.GENERAL.severity'],
        ['catalog_before_version', { baseVersion: 9, body: { overrides: { 'WALL-FOO': { enabled: false } } } }, 'RULE_CODE_UNKNOWN', 'body.overrides'],
      ];
      for (const [slug, data, code, field] of catalog) {
        expectError(await put(`rbody_${slug}_422`, data, [
          `422 ${code} field ${field}: catalog tier 2, codes then keys in sorted order, first error wins, before the version check (service.py:62-80,106-108)`,
        ]), 422, code, { field });
      }

      const after = await call(admin, 'rbody_read_after', 'GET', ruleConfigPath(pid), undefined, ['200 {revision 0, overrides {}}: no rejected body was written']);
      expect.soft(after.body).toEqual({ revision: 0, overrides: {} });
      expect.soft(await updatedAt(admin, pid, 'rbody_project_t1'), 'rejected writes never touch the project').toBe(t0);

      const bounds = { 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 30, 'wall.maxThicknessMm': 1000 } }, 'ESCAPE-DISTANCE': { thresholds: { 'escape.maxDistanceMm': 100000 } } };
      const edge = await put('rbody_bounds_inclusive_200', ok(bounds), ['200 revision 1: min / max are inclusive (service.py:79), integer thresholds accepted (strict float takes int)']);
      expect.soft(edge.res.status()).toBe(200);
      expect.soft(edge.body).toEqual({ revision: 1, overrides: bounds });
    } finally {
      await cleanup.run();
    }
  });

  test('A06 · versions read after a real pipeline run: N17 → v2 "after" + v1 "before" (system:pipeline, "hệ thống AI", sequence desc, FE zod), empty floor → []; limit / cursor paging, cursor bound to its floor, garbage → 422 CURSOR_INVALID; floorId required, unknown floor → 404 floor; #36 six keys; N18 = N16 layer at that revision, floor mismatch → 422 VERSION_FLOOR_MISMATCH; malformed / missing / other project\'s version → 404 version', async () => {
    // versions/router.py:37-59; service.py:93-112 (_locate), 142-163 (N17), 166-176 (N18); core/pagination.py:44-113;
    // snapshots.py:147-183; pipeline_persist/service.py:182-198; messages.py:18-20.
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await pipelineProject(admin, 'ver-read', cleanup, ['Tầng 1', 'Tầng 2']);
      const pid = project.id;
      const f1 = floorOf(project, 0);
      const f2 = floorOf(project, 1);
      const doc = await layerDoc(admin, 'read_layer_f1', pid, f1, '200 N16 of the AI-written floor (revision after the pipeline write)');

      const { items, body } = await versions(admin, 'read_list_f1', pid, f1, '200 {items}: the pipeline wrote a "before" + an "after" version, sequence desc, no nextCursor on the last page');
      expect.soft(body, 'single page → no nextCursor key').not.toHaveProperty('nextCursor');
      expect.soft(items.map((v) => v.sequence)).toEqual([2, 1]);
      const [v2, v1] = items;
      if (v2 === undefined || v1 === undefined) throw new Error('N17 did not list two versions');
      expect.soft(v2).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME, hasSnapshot: true, floorRevision: doc.revision });
      expect.soft(v2, 'the "after" version has no note (pipeline_persist/service.py:193-198)').not.toHaveProperty('note');
      expect.soft(v2).not.toHaveProperty('label');
      expect.soft(v1).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME, hasSnapshot: true, note: BEFORE_PIPELINE_NOTE });
      expect.soft(Number(v1.floorRevision), 'before < after').toBeLessThan(Number(v2.floorRevision));
      const v2id = String(v2.id);
      const v1id = String(v1.id);

      expect.soft((await versions(admin, 'read_list_f2_empty', pid, f2, '200 {items: []} for a floor without versions')).items).toEqual([]);
      const page1 = await versions(admin, 'read_list_limit1', pid, f1, '200 limit 1 → [v2] + nextCursor (service.py:157-163)', '&limit=1');
      expect.soft(page1.items.map((v) => v.id)).toEqual([v2id]);
      const cursor = String(page1.body.nextCursor);
      expect.soft(typeof page1.body.nextCursor).toBe('string');
      const page2 = await versions(admin, 'read_list_page2', pid, f1, '200 page 2 = [v1], no nextCursor (sequence < cursor position)', `&limit=1&cursor=${encodeURIComponent(cursor)}`);
      expect.soft(page2.items.map((v) => v.id)).toEqual([v1id]);
      expect.soft(page2.body).not.toHaveProperty('nextCursor');
      const max = await versions(admin, 'read_list_limit200', pid, f1, '200: limit 200 is the route ceiling (router.py:42)', '&limit=200');
      expect.soft(max.items).toHaveLength(2);

      const listErrors: Array<[string, string, number, string, Json]> = [
        ['cursor_other_floor', listPath(pid, f2, `&cursor=${encodeURIComponent(cursor)}`), 422, 'CURSOR_INVALID', {}],
        ['cursor_garbage', listPath(pid, f1, '&cursor=abc.def'), 422, 'CURSOR_INVALID', {}],
        ['cursor_before_floor_lookup', listPath(pid, 'nope', '&cursor=abc.def'), 422, 'CURSOR_INVALID', {}],
        ['limit_0', listPath(pid, f1, '&limit=0'), 422, 'VALIDATION', { field: 'limit' }],
        ['limit_201', listPath(pid, f1, '&limit=201'), 422, 'VALIDATION', { field: 'limit' }],
        ['limit_abc', listPath(pid, f1, '&limit=abc'), 422, 'VALIDATION', { field: 'limit' }],
        ['floor_missing', `/api/projects/${pid}/versions`, 422, 'VALIDATION', { field: 'floorId' }],
        ['floor_empty', `/api/projects/${pid}/versions?floorId=`, 422, 'VALIDATION', { field: 'floorId' }],
        ['floor_unknown', listPath(pid, 'nope'), 404, 'NOT_FOUND', { resource: 'floor' }],
      ];
      for (const [slug, path, status, code, params] of listErrors) {
        const sent = await call(admin, `read_list_${slug}_${String(status)}`, 'GET', path, undefined, [
          `${String(status)} ${code}: cursor MAC + op + floor digest checked BEFORE the floor lookup (service.py:149-153; pagination.py:96-113); limit 1..200, floorId min 1 (router.py:39-42)`,
        ]);
        expectError(sent, status, code, params);
      }

      for (const [slug, v, hasNote] of [['v2', v2id, false], ['v1', v1id, true]] as const) {
        const sent = await call(admin, `read_version_${slug}_200`, 'GET', versionPath(pid, v), undefined, ['200 #36 Version: id, projectId, sequence, createdAt, creatorId (+ note only when set) (schemas.py:20-28)']);
        expect.soft(sent.res.status()).toBe(200);
        const out = expectKeys(sent.body, VERSION_KEYS, ['note']);
        expect.soft(out).toMatchObject({ id: v, projectId: pid, creatorId: SYSTEM_PIPELINE });
        expect.soft('note' in out, `${slug} note present`).toBe(hasNote);
      }

      const snap2 = await call(admin, 'read_snapshot_v2_200', 'GET', snapshotPath(pid, v2id, f1), undefined, [
        '200 {versionId, layer, dimensions}: v2 = the AI layer, equal to N16 at the same revision (service.py:166-176)',
      ]);
      expect.soft(snap2.res.status()).toBe(200);
      const s2 = expectKeys(snap2.body, SNAPSHOT_KEYS);
      expectZod(FloorVersionSnapshotSchema, snap2.body, 'N18 v2');
      expect.soft(s2.versionId).toBe(v2id);
      expect.soft(s2.layer, 'N18 v2 layer = N16 layer').toEqual(doc.layer);
      expect.soft(s2.dimensions, 'N18 v2 dimensions = N16 dimensions').toEqual(doc.dimensions);
      expect.soft(asArray(asJson(s2.layer).walls, 'walls').length, 'the AI layer has walls').toBeGreaterThan(0);
      const snap1 = await call(admin, 'read_snapshot_v1_200', 'GET', snapshotPath(pid, v1id, f1), undefined, ['200: v1 = the floor before the AI write (no walls)']);
      expect.soft(snap1.res.status()).toBe(200);
      expectZod(FloorVersionSnapshotSchema, snap1.body, 'N18 v1');
      expect.soft(asArray(asJson(asJson(snap1.body).layer).walls, 'walls')).toEqual([]);

      const snapErrors: Array<[string, string, number, string, Json]> = [
        ['other_floor', snapshotPath(pid, v2id, f2), 422, 'VERSION_FLOOR_MISMATCH', { field: 'floorId' }],
        ['unknown_floor', snapshotPath(pid, v2id, 'nope'), 422, 'VERSION_FLOOR_MISMATCH', { field: 'floorId' }],
        ['floor_missing', `${versionPath(pid, v2id)}/snapshot`, 422, 'VALIDATION', { field: 'floorId' }],
        ['version_malformed', snapshotPath(pid, 'ver_bad', f1), 404, 'NOT_FOUND', { resource: 'version' }],
        ['version_missing', snapshotPath(pid, MISSING_VERSION, f1), 404, 'NOT_FOUND', { resource: 'version' }],
        ['version_malformed_other_floor', snapshotPath(pid, 'ver_bad', f2), 404, 'NOT_FOUND', { resource: 'version' }],
      ];
      for (const [slug, path, status, code, params] of snapErrors) {
        const sent = await call(admin, `read_snapshot_${slug}_${String(status)}`, 'GET', path, undefined, [
          `${String(status)} ${code}: order 404 version → floor mismatch → snapshot (service.py:166-173); malformed id → 404 without a query (service.py:99-100)`,
        ]);
        expectError(sent, status, code, params);
      }
      for (const [slug, v] of [['malformed', 'ver_bad'], ['missing', MISSING_VERSION]] as const) {
        expectError(await call(admin, `read_version_${slug}_404`, 'GET', versionPath(pid, v), undefined, ['404 resource version (#36, service.py:93-112)']), 404, 'NOT_FOUND', { resource: 'version' });
      }

      // IDOR across my own projects: the version belongs to P; Q's path never reaches it (service.py:105).
      const other = await newProject(admin, 'ver-read-q', cleanup);
      const q = other.id;
      const cross: Array<[string, Method, string, unknown]> = [
        ['read', 'GET', versionPath(q, v2id), undefined],
        ['snapshot', 'GET', snapshotPath(q, v2id, f1), undefined],
        ['label', 'PATCH', labelPath(q, v2id), { label: 'e2e' }],
        ['restore', 'POST', restorePath(q, v2id), { baseVersion: Number(doc.revision), body: { floorId: f1 } }],
      ];
      for (const [slug, method, path, data] of cross) {
        expectError(await call(admin, `read_other_project_${slug}_404`, method, path, data, [
          '404 resource version: the version id of project P under project Q (_locate filters project_id, service.py:105)',
        ]), 404, 'NOT_FOUND', { resource: 'version' });
      }
      expect.soft((await versions(admin, 'read_list_after_cross', pid, f1, '200: nothing labelled / restored by the cross-project calls')).items).toEqual(items);

      const gone = await call(admin, 'read_delete_q', 'DELETE', `/api/projects/${q}`, undefined, ['setup: soft-delete project Q → 200']);
      expect(gone.res.status()).toBe(200);
      expectError(await call(admin, 'read_deleted_project_list_404', 'GET', listPath(q, f1), undefined, ['404 resource project: soft-deleted project (projects/access.py:64-86)']), 404, 'NOT_FOUND', { resource: 'project' });
    } finally {
      await cleanup.run();
    }
  });

  test('A06 · restore N19: guards (428, strict baseVersion, body.floorId, W21, other floor → 422 VERSION_FLOOR_MISMATCH body.floorId, base > revision → 422 baseVersion, 404 version); stale base → 409 VERSION_CONFLICT with remoteChanges and NO version written; restore the AI version → 201 "after" (+ "before") with notes, N16 = its snapshot, activity version.restore; own repeat → 200 same row; restore of the current content → 201 existing row, no new version; restore v1 → empty layer, "before" not duplicated', async () => {
    // versions/router.py:62-82; service.py:179-298 (replay C09b before the snapshot, base > revision 422, before → write →
    // after), snapshots.py:223-264 (K18: latest at the doc revision → no insert); spatial_write/writer.py:349-372 (409).
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await pipelineProject(admin, 'ver-restore', cleanup, ['Tầng 1', 'Tầng 2']);
      const pid = project.id;
      const f1 = floorOf(project, 0);
      const f2 = floorOf(project, 1);
      const start = await versions(admin, 'restore_list_start', pid, f1, '200: [v2 after, v1 before] from the pipeline');
      const v2 = start.items[0];
      const v1 = start.items[1];
      if (v2 === undefined || v1 === undefined) throw new Error('setup: N17 did not list two versions');
      const v2id = String(v2.id);
      const v1id = String(v1.id);
      const r1 = Number(v2.floorRevision);
      const snap2 = await call(admin, 'restore_snapshot_v2', 'GET', snapshotPath(pid, v2id, f1), undefined, ['200: the content restore must bring back']);
      expect(snap2.res.status()).toBe(200);
      const aiLayer = asJson(snap2.body).layer;

      // A human edit after the pipeline (#35 at base r1, the layerSeed fixture) — CP-6: the AI row is no longer current.
      await writeLayer({ request: admin, headers: {} }, pid, f1, qcLayer);
      const r2 = r1 + 1;
      expect.soft((await layerDoc(admin, 'restore_layer_after_edit', pid, f1, '200: revision r1 + 1 after the #35 edit')).revision).toBe(r2);
      const post = (ev: string, v: string, data: unknown, claims: readonly string[]): Promise<Sent> => call(admin, ev, 'POST', restorePath(pid, v), data, claims);
      const good = (base: number, floorId = f1): Json => ({ baseVersion: base, body: { floorId } });
      expectZod(RestoreVersionSchema, good(r2), 'own N19 body (the FE could send it)');

      expectError(await post('restore_no_base_428', v2id, { body: { floorId: f1 } }, ['428 PRECONDITION_REQUIRED before Pydantic (router.py:67; core/routing.py:154-163)']), 428, 'PRECONDITION_REQUIRED');
      expectError(await post('restore_truncated_400', v2id, Buffer.from('{"baseVersion": 1,'), ['400 MALFORMED_JSON']), 400, 'MALFORMED_JSON', { field: null });
      expectError(await post('restore_project_id_mismatch_422', v2id, { ...good(r2), projectId: MISSING_PROJECT }, ['422 PATH_BODY_MISMATCH field projectId (W21)']), 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      expectError(await post('restore_version_id_mismatch_422', v2id, { ...good(r2), versionId: v1id }, ['422 PATH_BODY_MISMATCH field versionId (W21 on the path param version_id)']), 422, 'PATH_BODY_MISMATCH', { field: 'versionId' });
      const bodyRules: Array<[string, unknown, string]> = [
        ['base_string', { baseVersion: String(r2), body: { floorId: f1 } }, 'baseVersion'],
        ['base_negative', { baseVersion: -1, body: { floorId: f1 } }, 'baseVersion'],
        ['body_missing', { baseVersion: r2 }, 'body'],
        ['floor_empty', { baseVersion: r2, body: { floorId: '' } }, 'body.floorId'],
        ['floor_missing', { baseVersion: r2, body: {} }, 'body.floorId'],
        ['body_extra_key', { baseVersion: r2, body: { floorId: f1, note: 'x' } }, 'body.note'],
        ['top_extra_key', { ...good(r2), label: 'x' }, 'label'],
      ];
      for (const [slug, data, field] of bodyRules) {
        expectError(await post(`restore_${slug}_422`, v2id, data, [`422 VALIDATION field ${field} (versions/schemas.py:53-63, strict baseVersion ≥ 0)`]), 422, 'VALIDATION', { field });
      }
      expectError(await post('restore_other_floor_422', v2id, good(r2, f2), ['422 VERSION_FLOOR_MISMATCH field body.floorId: v2 belongs to floor 1 (service.py:228-229)']), 422, 'VERSION_FLOOR_MISMATCH', { field: 'body.floorId' });
      expectError(await post('restore_future_base_422', v2id, good(r2 + 5), ['422 VALIDATION field baseVersion: base > floor revision (service.py:235-236), not a 409']), 422, 'VALIDATION', { field: 'baseVersion' });
      for (const [slug, v] of [['malformed', 'ver_bad'], ['missing', MISSING_VERSION]] as const) {
        expectError(await post(`restore_${slug}_404`, v, good(r2), ['404 resource version (service.py:93-112)']), 404, 'NOT_FOUND', { resource: 'version' });
      }

      const stale = await post('restore_stale_base_409', v2id, good(r1), [
        '409 VERSION_CONFLICT currentVersion r2 + remoteChanges of the #35 edit; the "before" version is rolled back with the request (service.py:1-5,279-287; writer.py:365-372)',
      ]);
      const changes = expectConflict(stale, r2);
      expect.soft(changes.length, 'remoteChanges lists the human edit').toBeGreaterThan(0);
      expect.soft(changes.every((c) => asJson(c).changedBy === project.adminId), 'every remote change is the admin #35 write').toBe(true);
      expect.soft((await versions(admin, 'restore_list_after_409', pid, f1, '200: still [v2, v1] — no version survives the 409')).items.map((v) => v.id)).toEqual([v2id, v1id]);

      const restored = await post('restore_v2_201', v2id, good(r2), [
        '201 FloorVersionSummary of the "after" version: sequence 4, floorRevision r2 + 1, note "phục hồi nội dung của phiên bản v2", creator = the caller (service.py:254-298)',
      ]);
      expect.soft(restored.res.status()).toBe(201);
      expectZod(FloorVersionSummarySchema, restored.body, 'N19 201');
      const after = expectKeys(restored.body, SUMMARY_KEYS, SUMMARY_OPTIONAL);
      expect.soft(after).toMatchObject({
        sequence: 4, floorRevision: r2 + 1, note: afterNote(2), creatorId: project.adminId, creatorName: project.adminName, hasSnapshot: true,
      });
      expect.soft(after).not.toHaveProperty('label');
      const list4 = await versions(admin, 'restore_list_after_201', pid, f1, '200: [v4 after, v3 before, v2, v1]');
      expect.soft(list4.items.map((v) => v.sequence)).toEqual([4, 3, 2, 1]);
      expect.soft(list4.items[0], 'N17 head = the 201 body').toEqual(after);
      expect.soft(list4.items[1]).toMatchObject({ sequence: 3, floorRevision: r2, note: beforeNote(2), creatorId: project.adminId, creatorName: project.adminName });
      const restoredDoc = await layerDoc(admin, 'restore_layer_after_201', pid, f1, '200 N16: revision r2 + 1, layer = the v2 snapshot');
      expect.soft(restoredDoc.revision).toBe(r2 + 1);
      expect.soft(restoredDoc.layer, 'N16 layer after the restore = N18 v2 layer').toEqual(aiLayer);
      expect.soft((await activityOf(admin, project.adminId, v2id, 'version.restore', 'restore_activity_1')).length, 'one version.restore row (service.py:241-250)').toBe(1);

      const replay = await post('restore_v2_replay_200', v2id, good(r2), [
        '200: own repeat (same version, caller, baseVersion; latest = its "after" at the doc revision) → the same row, nothing written (service.py:179-197,232-234)',
      ]);
      expect.soft(replay.res.status()).toBe(200);
      expect.soft(replay.body).toEqual(restored.body);
      const v4id = String(after.id);
      const noop = await post('restore_current_content_201', v4id, good(r2 + 1), [
        '201 with the EXISTING v4: restoring content equal to the floor → write_layer unchanged, record_version returns the latest (K18); floorRevision = baseVersion (FE "unchanged")',
      ]);
      expect.soft(noop.res.status()).toBe(201);
      expect.soft(noop.body).toEqual(restored.body);
      expect.soft((await versions(admin, 'restore_list_after_replays', pid, f1, '200: still 4 versions after the replay and the no-op')).items.map((v) => v.sequence)).toEqual([4, 3, 2, 1]);
      expect.soft((await activityOf(admin, project.adminId, v2id, 'version.restore', 'restore_activity_2')).length, 'the replay logs nothing').toBe(1);
      expect.soft((await activityOf(admin, project.adminId, v4id, 'version.restore', 'restore_activity_noop')).length, 'a no-op restore logs nothing (service.py:241)').toBe(0);

      const empty = await post('restore_v1_201', v1id, good(r2 + 1), [
        '201 sequence 5 note "phục hồi nội dung của phiên bản v1": the "before" is NOT inserted because v4 is already at the doc revision (snapshots.py:242-244)',
      ]);
      expect.soft(empty.res.status()).toBe(201);
      expect.soft(asJson(empty.body)).toMatchObject({ sequence: 5, floorRevision: r2 + 2, note: afterNote(1) });
      expect.soft((await versions(admin, 'restore_list_final', pid, f1, '200: [v5, v4, v3, v2, v1]')).items.map((v) => v.sequence)).toEqual([5, 4, 3, 2, 1]);
      const emptyDoc = await layerDoc(admin, 'restore_layer_final', pid, f1, '200 N16: revision r2 + 2, no walls (v1 = before the AI write)');
      expect.soft(emptyDoc.revision).toBe(r2 + 2);
      expect.soft(asArray(asJson(emptyDoc.layer).walls, 'walls')).toEqual([]);
    } finally {
      await cleanup.run();
    }
  });

  test('A06 · label N20: set → 200 NFC + trimmed, same row (no version, no floor revision change), activity version.label once, same label again → no write; 60 UTF-16 units ok / 61 → 422 label (emoji count 2); Cc / Cf (U+0007, U+202E, U+200E) → 422; non-string / missing / extra key → 422; W21 versionId; "" and spaces remove the label; label checked before the version lookup; Idempotency-Key "auto" (bad key 422, replay, reuse 422)', async () => {
    // versions/router.py:85-91; schemas.py:66-69 (strict str); service.py:301-338 (normalize_label, FOR UPDATE, no-op);
    // core/routing.py:164-185 + core/idempotency.py:79-96,198-234 (PATCH, protected, not versioned → idempotency auto).
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await pipelineProject(admin, 'ver-label', cleanup);
      const pid = project.id;
      const f1 = floorOf(project);
      const start = await versions(admin, 'label_list_start', pid, f1, '200: [v2, v1] from the pipeline');
      const v2 = start.items[0];
      if (v2 === undefined) throw new Error('setup: no v2');
      const v2id = String(v2.id);
      const revision0 = (await layerDoc(admin, 'label_layer_t0', pid, f1, '200 N16 revision before labelling')).revision;
      const patch = (ev: string, data: unknown, claims: readonly string[], headers?: Record<string, string>, v = v2id): Promise<Sent> =>
        call(admin, ev, 'PATCH', labelPath(pid, v), data, claims, headers);
      const labelled = (sent: Sent, label: string | null, what: string): void => {
        expect.soft(sent.res.status(), `${what} status`).toBe(200);
        expectZod(FloorVersionSummarySchema, sent.body, what);
        const body = expectKeys(sent.body, SUMMARY_KEYS, SUMMARY_OPTIONAL);
        const { label: _drop, ...rest } = body;
        const { label: _drop2, ...base } = v2;
        expect.soft(rest, `${what}: every other field unchanged`).toEqual(base);
        if (label === null) expect.soft(body, `${what}: label removed`).not.toHaveProperty('label');
        else expect.soft(body.label, `${what}: label`).toBe(label);
      };

      const raw = `  ${'Bản gửi chủ đầu tư'.normalize('NFD')}  `;
      expectZod(LabelVersionSchema, { label: raw }, 'own N20 body');
      const set = await patch('label_set_200', { label: raw }, ['200: label stored nfc(strip) "Bản gửi chủ đầu tư" (service.py:301-311), same row returned']);
      labelled(set, 'Bản gửi chủ đầu tư', 'N20 set');
      expect.soft((await activityOf(admin, project.adminId, v2id, 'version.label', 'label_activity_1')).length, 'one version.label row (service.py:329-336)').toBe(1);
      const same = await patch('label_same_200', { label: 'Bản gửi chủ đầu tư' }, ['200: label unchanged → no UPDATE, no activity (service.py:324-325)']);
      labelled(same, 'Bản gửi chủ đầu tư', 'N20 same');
      expect.soft((await activityOf(admin, project.adminId, v2id, 'version.label', 'label_activity_2')).length, 'the unchanged label logs nothing').toBe(1);
      const listed = await versions(admin, 'label_list_after_set', pid, f1, '200: still 2 versions, v2 carries the label (a label is no new version)');
      expect.soft(listed.items.map((v) => v.sequence)).toEqual([2, 1]);
      expect.soft(listed.items[0]?.label).toBe('Bản gửi chủ đầu tư');
      expect.soft((await layerDoc(admin, 'label_layer_t1', pid, f1, '200 N16: revision unchanged by a label')).revision).toBe(revision0);

      const accepted: Array<[string, string, string]> = [
        ['60_units', 'a'.repeat(60), 'a'.repeat(60)],
        ['30_emoji_60_units', '\u{1F600}'.repeat(30), '\u{1F600}'.repeat(30)],
        ['trailing_spaces', `a${' '.repeat(70)}`, 'a'],
      ];
      for (const [slug, label, stored] of accepted) {
        labelled(await patch(`label_${slug}_200`, { label }, [`200: ≤ 60 UTF-16 units after nfc + strip (service.py:54-55,307-311) → "${stored.length > 20 ? `${stored.slice(0, 10)}…` : stored}"`]), stored, slug);
      }
      const rejected: Array<[string, unknown, string]> = [
        ['61_units', { label: 'a'.repeat(61) }, 'label'],
        ['31_emoji_62_units', { label: '\u{1F600}'.repeat(31) }, 'label'],
        ['bell_cc', { label: 'Bản\u0007' }, 'label'],
        ['rlo_cf', { label: 'Bản\u202E' }, 'label'],
        ['lrm_cf', { label: 'Bản\u200E' }, 'label'],
        ['number', { label: 5 }, 'label'],
        ['null', { label: null }, 'label'],
        ['missing', {}, 'label'],
        ['extra_key', { label: 'x', note: 'y' }, 'note'],
      ];
      for (const [slug, data, field] of rejected) {
        expectError(await patch(`label_${slug}_422`, data, [`422 VALIDATION field ${field}: > 60 UTF-16 units / Cc / Cf (incl. LRM) / not a strict string / strict keys (service.py:301-311; schemas.py:66-69)`]), 422, 'VALIDATION', { field });
      }
      expectError(await patch('label_version_id_mismatch_422', { label: 'x', versionId: String(start.items[1]?.id) }, ['422 PATH_BODY_MISMATCH field versionId (W21)']), 422, 'PATH_BODY_MISMATCH', { field: 'versionId' });
      expect.soft((await versions(admin, 'label_list_after_rejects', pid, f1, '200: v2 label = "a" (the last accepted)')).items[0]?.label).toBe('a');

      labelled(await patch('label_empty_removes_200', { label: '' }, ['200: "" removes the label (service.py:311 → None → key absent, W2)']), null, 'N20 ""');
      labelled(await patch('label_spaces_removes_200', { label: '    ' }, ['200: spaces only → stripped to "" → no label']), null, 'N20 spaces');

      expectError(await patch('label_malformed_version_404', { label: 'x' }, ['404 resource version (service.py:93-100)'], undefined, 'ver_bad'), 404, 'NOT_FOUND', { resource: 'version' });
      expectError(await patch('label_missing_version_404', { label: 'x' }, ['404 resource version'], undefined, MISSING_VERSION), 404, 'NOT_FOUND', { resource: 'version' });
      expectError(await patch('label_invalid_before_lookup_422', { label: 'a'.repeat(61) }, ['422 field label: normalize_label runs before _locate (service.py:322-323)'], undefined, 'ver_bad'), 422, 'VALIDATION', { field: 'label' });

      expectError(await patch('label_idem_bad_key_422', { label: 'k' }, ['422 VALIDATION field idempotencyKey: key shorter than 8 (core/idempotency.py:79-83)'], { 'Idempotency-Key': 'abc' }), 422, 'VALIDATION', { field: 'idempotencyKey' });
      const key = `qa-${randomUUID()}`;
      const first = await patch('label_idem_first_200', { label: 'k1' }, ['200 label k1, response stored under the key'], { 'Idempotency-Key': key });
      labelled(first, 'k1', 'idem first');
      const replay = await patch('label_idem_replay_200', { label: 'k1' }, ['200 replayed: same key + same body (core/idempotency.py:232-233)'], { 'Idempotency-Key': key });
      expect.soft(replay.res.status()).toBe(200);
      expect.soft(replay.body).toEqual(first.body);
      expectError(await patch('label_idem_reused_422', { label: 'k2' }, ['422 IDEMPOTENCY_KEY_REUSED: same key, other body (core/idempotency.py:230-231)'], { 'Idempotency-Key': key }), 422, 'IDEMPOTENCY_KEY_REUSED');
      expect.soft((await versions(admin, 'label_list_final', pid, f1, '200: v2 label k1, still 2 versions')).items.map((v) => [v.sequence, v.label ?? null])).toEqual([[2, 'k1'], [1, null]]);
    } finally {
      await cleanup.run();
    }
  });

  test('A06 · roles: viewer member → N21 / N17 / #36 / N18 200 but N22 / N19 / N20 → 403 FORBIDDEN (before 428 and Pydantic); viewer non-member → 404 project on all; after #41 role → engineer: N22 still 403 (ruleset.edit is admin only), N20 → 200, N19 → 201 by the engineer; engineer non-member → 404', async () => {
    // rules/router.py:21-38 (N21 any member, N22 ruleset.edit); versions/router.py:33-34 (_Member / _Editor layer.edit);
    // packages/domain/permissions/matrix.py:47,53; projects/access.py:45-86 (404 beats 403).
    test.setTimeout(PIPELINE_TIMEOUT_MS + 180_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const p1 = await pipelineProject(admin, 'ver-roles', cleanup);
      const pid = p1.id;
      const f1 = floorOf(p1);
      const p2 = await newProject(admin, 'ver-roles-outside', cleanup);
      const start = await versions(admin, 'roles_list_start', pid, f1, '200: [v2, v1] from the pipeline');
      const v2 = start.items[0];
      const v1 = start.items[1];
      if (v2 === undefined || v1 === undefined) throw new Error('setup: N17 did not list two versions');
      const v2id = String(v2.id);
      const v1id = String(v1.id);
      const r1 = Number(v2.floorRevision);

      const user = await realUser(admin, 'viewer', 'roles', cleanup);
      const add = await call(admin, 'roles_add_member', 'POST', `/api/projects/${pid}/members`, { email: user.email }, ['setup: N3 adds the viewer to project 1 → 201']);
      expect(add.res.status()).toBe(201);
      const viewer = user.api;

      const reads: Array<[string, string]> = [
        ['rule_config', ruleConfigPath(pid)],
        ['versions', listPath(pid, f1)],
        ['version', versionPath(pid, v2id)],
        ['snapshot', snapshotPath(pid, v2id, f1)],
      ];
      for (const [slug, path] of reads) {
        const sent = await call(viewer, `roles_viewer_${slug}_200`, 'GET', path, undefined, ['200: any member reads (require_project() without a key)']);
        expect.soft(sent.res.status(), slug).toBe(200);
      }
      const writes: Array<[string, Method, string, unknown]> = [
        ['rule_config_valid', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: {} } }],
        ['rule_config_no_base', 'PUT', ruleConfigPath(pid), { body: {} }],
        ['restore_valid', 'POST', restorePath(pid, v1id), { baseVersion: r1, body: { floorId: f1 } }],
        ['restore_no_base', 'POST', restorePath(pid, v1id), { body: { floorId: f1 } }],
        ['restore_malformed_version', 'POST', restorePath(pid, 'ver_bad'), { baseVersion: r1, body: { floorId: f1 } }],
        ['label_valid', 'PATCH', labelPath(pid, v2id), { label: 'viewer' }],
        ['label_invalid', 'PATCH', labelPath(pid, v2id), { label: 5 }],
      ];
      for (const [slug, method, path, data] of writes) {
        const body = expectError(await call(viewer, `roles_viewer_${slug}_403`, method, path, data, [
          '403 FORBIDDEN without resource: ruleset.edit / layer.edit false for viewer; the gate runs before the 428 guard, Pydantic and the version lookup',
        ]), 403, 'FORBIDDEN');
        expect.soft(body, '403 carries no resource').not.toHaveProperty('resource');
      }
      const outside: Array<[string, Method, string, unknown]> = [
        ['rule_config_get', 'GET', ruleConfigPath(p2.id), undefined],
        ['rule_config_put', 'PUT', ruleConfigPath(p2.id), { baseVersion: 0, body: { overrides: {} } }],
        ['versions', 'GET', listPath(p2.id, f1), undefined],
        ['snapshot', 'GET', snapshotPath(p2.id, v2id, f1), undefined],
        ['restore', 'POST', restorePath(p2.id, v2id), { baseVersion: r1, body: { floorId: f1 } }],
        ['label', 'PATCH', labelPath(p2.id, v2id), { label: 'x' }],
      ];
      for (const [slug, method, path, data] of outside) {
        expectError(await call(viewer, `roles_viewer_outside_${slug}_404`, method, path, data, [
          '404 NOT_FOUND resource project: not a member — 404 beats 403 (access.py:78-86)',
        ]), 404, 'NOT_FOUND', { resource: 'project' });
      }
      const rc = await call(admin, 'roles_rule_config_after_viewer', 'GET', ruleConfigPath(pid), undefined, ['200: viewer changed nothing (revision 0)']);
      expect.soft(rc.body).toEqual({ revision: 0, overrides: {} });
      expect.soft((await versions(admin, 'roles_list_after_viewer', pid, f1, '200: still [v2, v1], no label')).items).toEqual(start.items);

      const role = await call(admin, 'roles_change_to_engineer', 'PATCH', `/api/users/${user.id}/role`, { role: 'engineer', userId: user.id }, [
        'setup: #41 viewer → engineer (users/router.py:85-92); old tokens die (bump_token_version)',
      ]);
      expect(role.res.status()).toBe(200);
      const engineer = await signedInApi(user.email, user.password);
      cleanup.add(() => engineer.dispose());
      const eRules = expectError(await call(engineer, 'roles_engineer_rule_config_403', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: {} } }, [
        '403 FORBIDDEN: ruleset.edit is admin only (matrix.py:53)',
      ]), 403, 'FORBIDDEN');
      expect.soft(eRules).not.toHaveProperty('resource');
      const eLabel = await call(engineer, 'roles_engineer_label_200', 'PATCH', labelPath(pid, v2id), { label: 'engineer' }, ['200: engineer has layer.edit (matrix.py:47)']);
      expect.soft(eLabel.res.status()).toBe(200);
      expect.soft(asJson(eLabel.body).label).toBe('engineer');
      const eRestore = await call(engineer, 'roles_engineer_restore_201', 'POST', restorePath(pid, v1id), { baseVersion: r1, body: { floorId: f1 } }, [
        '201: engineer restores v1; the "after" version is created by the engineer (service.py:230,288-297)',
      ]);
      expect.soft(eRestore.res.status()).toBe(201);
      expectZod(FloorVersionSummarySchema, eRestore.body, 'engineer N19');
      expect.soft(asJson(eRestore.body)).toMatchObject({ creatorId: user.id, note: afterNote(1), floorRevision: r1 + 1 });
      expectError(await call(engineer, 'roles_engineer_outside_404', 'PATCH', labelPath(p2.id, v2id), { label: 'x' }, ['404 project: engineer is not a member of project 2']), 404, 'NOT_FOUND', { resource: 'project' });
    } finally {
      await cleanup.run();
    }
  });
});

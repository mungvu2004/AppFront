/**
 * Phase 6 API helpers (QA-06b P8, skill `qa-api-test`): the spec-local helpers of the old
 * `phase06_rules_export_versions_api.spec.ts` (`call`, `expectError`, `expectConflict`, `expectKeys`, `Cleanup`, ...)
 * moved here for `phase06_api.spec.ts`. Real backend only; every request writes a JSON exchange `<ev>.json`
 * (ev = `<catalog row id>_<slug>`, secrets redacted by `captureExchange`).
 */
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { FloorVersionPageSchema, FloorVersionSummarySchema } from '../../../../src/api/schemas/versions';
import { captureExchange, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { deleteSeededProject } from '../drawingSeed';
import { listFloors, type SeededFloorRow } from '../phase03Seed';

export type Json = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)
export const MISSING_VERSION = `ver_${'0'.repeat(26)}`;
export const SYSTEM_PIPELINE = 'system:pipeline'; // packages/core/errors.py:144
export const PIPELINE_NAME = 'hệ thống AI'; // apps/worker/pipeline_persist/constants.py:5
export const BEFORE_PIPELINE_NOTE = 'trạng thái trước khi ghi kết quả AI'; // versions/messages.py:18-20
export const afterNote = (n: number): string => `phục hồi nội dung của phiên bản v${String(n)}`; // messages.py:8-10
export const beforeNote = (n: number): string => `trạng thái trước khi phục hồi phiên bản v${String(n)}`; // messages.py:13-15
export const RULE_CONFIG_KEYS = ['overrides', 'revision'] as const; // rules/schemas.py:61-65
export const SUMMARY_KEYS = ['createdAt', 'creatorId', 'creatorName', 'floorRevision', 'hasSnapshot', 'id', 'sequence'] as const; // versions/schemas.py:31-42
export const SUMMARY_OPTIONAL = ['label', 'note'] as const;
export const VERSION_KEYS = ['createdAt', 'creatorId', 'id', 'projectId', 'sequence'] as const; // versions/schemas.py:20-28
export const SNAPSHOT_KEYS = ['dimensions', 'layer', 'versionId'] as const; // versions/schemas.py:45-50

export const ruleConfigPath = (p: string): string => `/api/projects/${p}/rule-config`;
export const listPath = (p: string, floorId: string, extra = ''): string => `/api/projects/${p}/versions?floorId=${encodeURIComponent(floorId)}${extra}`;
export const versionPath = (p: string, v: string): string => `/api/projects/${p}/versions/${v}`;
export const snapshotPath = (p: string, v: string, floorId: string): string => `${versionPath(p, v)}/snapshot?floorId=${encodeURIComponent(floorId)}`;
export const restorePath = (p: string, v: string): string => `${versionPath(p, v)}/restore`;
export const labelPath = (p: string, v: string): string => `${versionPath(p, v)}/label`;
export const layerPath = (p: string, f: string): string => `/api/projects/${p}/floors/${f}/spatial/layer`;

export function note(description: string): void {
  test.info().annotations.push({ type: 'note', description });
}

export function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

export function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

/** Every `required` key present and nothing outside `required` + `optional`. */
export function expectKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): Json {
  const record = asJson(value);
  const keys = Object.keys(record);
  for (const key of required) expect.soft(keys, `key "${key}"`).toContain(key);
  expect.soft(keys.filter((key) => !required.includes(key) && !optional.includes(key)), 'unexpected keys').toEqual([]);
  return record;
}

/** The FE decodes this body with `schema`; a failure is an FE<->BE contract break. */
export function expectZod(schema: ZodTypeAny, value: unknown, what: string): void {
  const parsed = schema.safeParse(value);
  const issues = parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3));
  expect.soft(parsed.success, `${what} decodes with the FE zod schema ${issues}`).toBe(true);
}

export interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/**
 * One request + its JSON exchange evidence `<ev>.json`. A `Buffer` is sent raw (a string `data` would be JSON-encoded
 * again by Playwright, BUG-107/279).
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
  const raw = Buffer.isBuffer(data);
  const res = await api.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    headers: { ...(raw ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
  });
  const shown: unknown = raw ? (data.length > 2_000 ? `<${String(data.length)} bytes>` : data.toString('utf8')) : (data ?? null);
  const body = await captureExchange(`${ev}.json`, { method, path, body: shown }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource`). `field: null` = must be absent. */
export function expectError(
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

/** 409 W20 of a versioned write: `currentVersion` + `remoteChanges`. */
export function expectConflict(sent: Sent, currentVersion: number): unknown[] {
  const body = expectError(sent, 409, 'VERSION_CONFLICT');
  expect.soft(body.currentVersion, '409 currentVersion').toBe(currentVersion);
  return Array.isArray(body.remoteChanges) ? body.remoteChanges : [];
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

/** Admin API client (1 login), disposed by `cleanup`. */
export async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

/** Registers the soft-delete of a seeded project (any owner; `deleteSeededProject` falls back to the admin on 403). */
export function deleteOnCleanup(cleanup: Cleanup, api: APIRequestContext, projectId: string): void {
  cleanup.add(async () => {
    const problem = await deleteSeededProject(api, projectId);
    if (problem) note(problem);
  });
}

export interface Floors {
  readonly f1: string;
  readonly f2: string;
}

/** Floor ids (by `order`) of a seeded project; `f2` is '' when the project has one floor. */
export async function floorIds(api: APIRequestContext, projectId: string): Promise<Floors> {
  const rows: SeededFloorRow[] = await listFloors(api, projectId);
  return { f1: rows[0]?.id ?? '', f2: rows[1]?.id ?? '' };
}

/** `GET /api/projects/:id` `updatedAt` (#24). */
export async function updatedAt(api: APIRequestContext, id: string, ev: string): Promise<unknown> {
  const sent = await call(api, ev, 'GET', `/api/projects/${id}`, undefined, ['read-back: 200 ProjectOut.updatedAt (#24)']);
  expect(sent.res.status()).toBe(200);
  return asJson(sent.body).updatedAt;
}

/** N17 read-back: 200 `{items[, nextCursor]}` decoded by the FE page schema; items with exact summary keys. */
export async function versions(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string, extra = ''): Promise<{ items: Json[]; body: Json }> {
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

/** N16 read-back: `revision`, `layer`, `dimensions`. */
export async function layerDoc(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', layerPath(pid, fid), undefined, [claim]);
  expect(sent.res.status(), `N16 ${ev}`).toBe(200);
  return asJson(sent.body);
}

const ACTIVITY_KEYS = ['at', 'id', 'kind', 'objectCode', 'objectLabel'] as const; // users/schemas.py

/** Creator of a fresh project = its only member: `{id, name}` from `GET /api/projects/:id` (`members`, FE schemas/index.ts:227). */
export async function ownerOf(api: APIRequestContext, projectId: string): Promise<{ id: string; name: string }> {
  const read = await api.get(`/api/projects/${projectId}`);
  expect(read.status(), 'setup: GET /api/projects/:id').toBe(200);
  const member = asArray(asJson(await read.json()).members, 'members').map((m) => asJson(m))[0];
  if (member === undefined) throw new Error('setup: project has no member');
  return { id: String(member.id), name: String(member.name) };
}

/** `activity_log` rows of `userId` whose `objectCode` is `code` and kind is `kind` (GET /api/users/{id}/activity). */
export async function activityOf(admin: APIRequestContext, userId: string, code: string, kind: string, ev: string): Promise<Json[]> {
  const sent = await call(admin, ev, 'GET', `/api/users/${userId}/activity`, undefined, [
    `read-back: 200 activity rows of the admin, newest first; filtered here by objectCode + kind "${kind}"`,
  ]);
  expect(sent.res.status()).toBe(200);
  return asArray(sent.body)
    .map((row) => expectKeys(row, ACTIVITY_KEYS))
    .filter((row) => row.objectCode === code && row.kind === kind);
}

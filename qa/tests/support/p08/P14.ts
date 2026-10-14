/**
 * P14 helpers (phase 08 C6 ML admin API, part B: FL-B08M-06..10). Only imported by `phase08_ml_b_api.spec.ts`.
 * Wire facts: BE `apps/api/admin_ml_registry` (router/service/upload), `admin_ml_datasets`; FE `src/api/schemas/adminMl.ts`.
 */
import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';

import { apiBaseUrl, captureExchange } from '../api';
import { recordActiveVersions, restoreActiveVersions } from './admin';
import { ML, NO_DATASET, NO_MODEL_VERSION, OPENING, FAMILIES, type Json } from './mlApi';

export { ML, NO_DATASET, NO_MODEL_VERSION, OPENING, FAMILIES, type Json };

export const WALL = 'wallSegmentation';
export const DIMENSION = 'dimensionReading';

export const asJson = (v: unknown): Json => {
  expect(v !== null && typeof v === 'object' && !Array.isArray(v), 'JSON object expected').toBe(true);
  return v as Json;
};

export interface Sent {
  readonly res: APIResponse;
  readonly text: string;
  readonly body: unknown;
}
export interface CallOptions {
  readonly headers?: Record<string, string>;
  /** Raw body (Buffer) sent as is; the caller sets `Content-Type` in `headers`. */
  readonly raw?: Buffer;
}

/** One exchange + evidence `A08_<id>_<slug>.json` (skill qa-evidence). `id` e.g. `B08M-G-049`. */
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
  const res = await api.fetch(path, {
    method,
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.raw !== undefined ? { data: options.raw } : body === undefined ? {} : { data: body as object }),
  });
  const text = await res.text();
  const parsed = await captureExchange(
    `A08_${id}_${slug}.json`,
    { method, path, body: options.raw !== undefined ? `<${options.raw.length} raw bytes>` : body },
    res,
    assertions,
  );
  return { res, text, body: parsed };
}

/** W7 error body (BE core/errors.py:82-88): `code` + `requestId` (+ `field`/`resource`); `null` = the key must be absent. */
export function expectError(sent: Sent, status: number, code: string, field?: string | null, resource?: string, hard = false): Json {
  const check = hard ? expect : expect.soft;
  check(sent.res.status(), `${code} status`).toBe(status);
  const body = asJson(JSON.parse(sent.text));
  check(body.code, `${code} code`).toBe(code);
  check(typeof body.requestId).toBe('string');
  if (field === null) check(body).not.toHaveProperty('field');
  else if (field !== undefined) check(body.field, `${code} field`).toBe(field);
  if (resource !== undefined) check(body.resource, `${code} resource`).toBe(resource);
  return body;
}

/* ------------------------------------------------------------------ families / versions reads */

export interface FamilyRow {
  readonly family: string;
  readonly activeVersionId?: string;
  readonly revision: number;
}
export interface VersionRow {
  readonly id: string;
  readonly family: string;
  readonly weightsFormat: string;
  readonly evaluationStatus: string;
}

export async function readFamilies(api: APIRequestContext): Promise<FamilyRow[]> {
  const res = await api.get(`${ML}/model-families`);
  expect(res.status(), 'GET model-families').toBe(200);
  return ((await res.json()) as { items: FamilyRow[] }).items;
}
export async function readVersions(api: APIRequestContext): Promise<VersionRow[]> {
  const res = await api.get(`${ML}/model-versions?limit=200`);
  expect(res.status(), 'GET model-versions').toBe(200);
  return ((await res.json()) as { items: VersionRow[] }).items;
}
export const familyRow = (rows: readonly FamilyRow[], family: string): FamilyRow => {
  const row = rows.find((r) => r.family === family);
  expect(row, `family ${family} in GET model-families`).toBeDefined();
  return row!;
};

/** N24 body (MC:121-125): `{ baseVersion, body: { versionId } }`. */
export const activeBody = (baseVersion: number, versionId: string | null): Json => ({ baseVersion, body: { versionId } });
export const activePath = (family: string): string => `${ML}/model-families/${family}/active`;

/**
 * The single real activation of this file (wall family, FL-B08M-07): records the wall family's active version first and
 * puts it back in `finally` (a no-op when the flow's own restore step already did). Revision keeps growing: not restorable.
 */
export async function withWallRestore<T>(api: APIRequestContext, fn: (wall: FamilyRow) => Promise<T>): Promise<T> {
  const snapshot = await recordActiveVersions(api, [WALL]);
  try {
    return await fn(familyRow(await readFamilies(api), WALL));
  } finally {
    await restoreActiveVersions(api, snapshot);
  }
}

/* ------------------------------------------------------------------ multipart upload (N26) */

export interface Part {
  readonly name: string;
  readonly content: Buffer | string;
  readonly filename?: string;
}
export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/**
 * Hand-rolled multipart/form-data (upload.py needs `metadata` as the FIRST part, `weights` second, nothing else):
 * `parts` overrides the default `[metadata, weights]`; `metadata` may be a raw string (17 KiB, bad JSON).
 */
export function buildMlUpload(o: {
  metadata?: Json | string;
  weights?: Buffer;
  parts?: readonly Part[];
}): { headers: Record<string, string>; data: Buffer } {
  const boundary = `----qa08${Date.now().toString(16)}`;
  const meta = typeof o.metadata === 'string' ? o.metadata : JSON.stringify(o.metadata ?? {});
  const parts: readonly Part[] = o.parts ?? [
    { name: 'metadata', content: meta },
    { name: 'weights', content: o.weights ?? Buffer.alloc(0), filename: 'weights.bin' },
  ];
  const chunks: Buffer[] = [];
  for (const p of parts) {
    const disp = `form-data; name="${p.name}"${p.filename ? `; filename="${p.filename}"` : ''}`;
    const type = p.filename ? 'application/octet-stream' : 'application/json';
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: ${disp}\r\nContent-Type: ${type}\r\n\r\n`), Buffer.from(p.content), Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, data: Buffer.concat(chunks) };
}

/**
 * POST with a FALSE Content-Length and no body (Playwright cannot do this): resolves with status + body once the server
 * answered, then destroys the socket. Sent without credentials: the 413 comes from the middleware before routing/auth
 * (core/middleware.py:218-233).
 */
export function rawPost413(path: string, contentLength: number): Promise<{ status: number; text: string }> {
  const base = new URL(apiBaseUrl());
  const send = base.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = send(
      {
        host: base.hostname,
        port: base.port || undefined,
        method: 'POST',
        path,
        headers: { Origin: base.origin, 'Content-Type': 'multipart/form-data; boundary=qa08', 'Content-Length': String(contentLength) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let done = false;
        const finish = (): void => {
          if (done) return;
          done = true;
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') });
          req.destroy();
        };
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.flushHeaders();
  });
}

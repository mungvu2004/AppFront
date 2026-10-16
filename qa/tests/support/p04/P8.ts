/**
 * Phase 04 pack P8 (backend flows) — call helpers for `phase04_spatial_api.spec.ts` only (QA-04c).
 * Real HTTP, no mocks. Everything here is a thin layer over `support/api.ts` (`captureExchange` evidence) and the FE zod
 * schemas the screens decode with; the data builders mirror the wire shapes of `phase04_qc_layers_api.spec.ts`.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { apiBaseUrl, captureExchange } from '../api';

export type Json = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const MISSING_PROJECT = `prj_${'0'.repeat(26)}`; // well-formed, no row (packages/core/ids.py:73-77)

/** W4 spatial id `<letter>-<base36 UPPER 10..64>` (packages/core/ids.py:23-31,92-94). */
export const sid = (letter: 'L' | 'W' | 'D' | 'R' | 'F'): string =>
  `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

export const layerPath = (p: string, f: string): string => `/api/projects/${p}/floors/${f}/spatial/layer`;
export const qualityPath = (p: string, f: string, tail = ''): string => `/api/projects/${p}/floors/${f}/quality${tail}`;
export const versionsPath = (p: string, query = ''): string => `/api/projects/${p}/versions${query}`;
export const writeBody = (base: unknown, body: Json): Json => ({ baseVersion: base, body });

/** A clockwise TL → TR → BR → BL frame well inside the page (BE:quality/geometry.py:54-78). */
export const GOOD_CORNERS = [
  { xRatio: 0.05, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.95 }, { xRatio: 0.05, yRatio: 0.95 },
];

/** A valid N6 body (BE:project_settings/schemas.py:103-111). */
export const settingsBody = (over: Json = {}): Json => ({
  buildingType: 'residential',
  lengthUnit: 'mm',
  snapToleranceMm: 50,
  confidenceThreshold: 0.75,
  defaultScaleMmPerPx: 1,
  ...over,
});

/* ------------------------------------------------------------------ JSON helpers */

export function asJson(value: unknown, what = 'body'): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what} is not a JSON object`);
  return value as Json;
}

export function asArray(value: unknown, what = 'body'): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${what} is not a JSON array`);
  return value;
}

export const objs = (value: unknown, what: string): Json[] => asArray(value, what).map((v) => asJson(v, what));

/** Every `required` key present and nothing outside `required` ∪ `optional`. */
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

export function note(description: string): void {
  test.info().annotations.push({ type: 'note', description });
}

/* ------------------------------------------------------------------ requests */

export interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

/** One request + its JSON exchange evidence `P8_<ev>.json` (secrets redacted by `captureExchange`). */
export async function call(
  api: APIRequestContext,
  ev: string,
  method: Method,
  path: string,
  data: unknown,
  claims: readonly string[],
  headers?: Record<string, string>,
): Promise<Sent> {
  const res = await api.fetch(path, {
    method,
    ...(data === undefined ? {} : { data }),
    ...(headers === undefined ? {} : { headers }),
  });
  const body = await captureExchange(`P8_${ev}.json`, { method, path, body: data ?? null }, res, claims);
  return { res, body };
}

/** W7 error body (BE:core/errors.py:82-87): `code` + `requestId` (+ `field` / `resource` / `count`). */
export function expectError(
  sent: Sent,
  status: number,
  code: string,
  params: { readonly field?: string; readonly resource?: string } = {},
): Json {
  expect.soft(sent.res.status(), `${code} status`).toBe(status);
  const body = typeof sent.body === 'object' && sent.body !== null && !Array.isArray(sent.body) ? (sent.body as Json) : {};
  expect.soft(body.code, `${code} code`).toBe(code);
  expect.soft(typeof body.requestId, `${code} requestId`).toBe('string');
  if (params.field !== undefined) expect.soft(body.field, `${code} field`).toBe(params.field);
  if (params.resource !== undefined) expect.soft(body.resource, `${code} resource`).toBe(params.resource);
  return body;
}

/** `{revision, layer}` of a #35 200 (soft status check); returns the body. */
export function expectWritten(sent: Sent, revision: number | undefined, what: string): Json {
  expect.soft(sent.res.status(), `${what} status`).toBe(200);
  const body = expectKeys(sent.body, ['layer', 'revision']);
  if (revision !== undefined) expect.soft(body.revision, `${what} revision`).toBe(revision);
  return body;
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

/**
 * A request context that carries `api`'s Bearer but NO `Origin` header (or the given one): a fresh `POST /api/auth/refresh`
 * on the signed-in context returns a second access token (the refresh cookie rotates inside `api`'s own jar).
 */
export async function bearerContext(api: APIRequestContext, origin?: string): Promise<APIRequestContext> {
  const refreshed = await api.post('/api/auth/refresh');
  const body = (await refreshed.json().catch(() => ({}))) as { accessToken?: string; access_token?: string };
  const token = body.accessToken ?? body.access_token;
  if (refreshed.status() !== 200 || !token) throw new Error(`bearerContext: POST /api/auth/refresh → ${String(refreshed.status())}`);
  return request.newContext({
    baseURL: apiBaseUrl(),
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, ...(origin === undefined ? {} : { Origin: origin }) },
  });
}

/* ------------------------------------------------------------------ layer builders (domain model.py:95-257) */

interface Review {
  readonly source?: 'ai' | 'human';
  readonly reviewed?: boolean;
}

/** `confidence` 1 for human items — sent as the JSON integer `1`, exactly what the FE serialises. */
export const meta = (r: Review = {}): Json => ({
  confidence: (r.source ?? 'ai') === 'human' ? 1 : 0.8,
  source: r.source ?? 'ai',
  reviewed: r.reviewed ?? false,
});

export function wallOf(levelId: string, o: Review & { id?: string; from?: readonly [number, number]; to?: readonly [number, number] } = {}): Json {
  const [x1, y1] = o.from ?? [0, 0];
  const [x2, y2] = o.to ?? [4000, 0];
  return {
    id: o.id ?? sid('W'),
    levelId,
    centreline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thicknessMm: 110,
    heightMm: 3000,
    kind: 'partition',
    openingIds: [],
    ...meta(o),
  };
}

export function roomOf(levelId: string, o: Review & { id?: string; name?: string; w?: number; h?: number } = {}): Json {
  const w = o.w ?? 4000;
  const h = o.h ?? 5000;
  return {
    id: o.id ?? sid('R'),
    levelId,
    name: o.name ?? 'Bếp',
    usage: 'kitchen',
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    areaM2: 0,
    wallIds: [],
    ...meta(o),
  };
}

export function furnitureOf(levelId: string, o: Review & { id?: string } = {}): Json {
  return {
    id: o.id ?? sid('F'),
    levelId,
    kind: 'table',
    centre: { x: 400, y: 300 },
    boundingBox: { min: { x: 0, y: 0 }, max: { x: 800, y: 600 } },
    rotationDeg: 0,
    ...meta(o),
  };
}

export const layerOf = (p: { walls?: Json[]; openings?: Json[]; rooms?: Json[]; furniture?: Json[] } = {}): Json => ({
  walls: p.walls ?? [],
  openings: p.openings ?? [],
  rooms: p.rooms ?? [],
  furniture: p.furniture ?? [],
});

const LIST_KEYS = ['walls', 'openings', 'rooms', 'furniture'] as const;

/** Every item of `layer` marked as a human review (SCR-16/17/20 approve: `reviewed` + `source "human"`, A5). */
export function approveAll(layer: Json): Json {
  return Object.fromEntries(
    LIST_KEYS.map((key) => [key, objs(layer[key], key).map((item) => ({ ...item, source: 'human', reviewed: true, confidence: 1 }))]),
  );
}

/** Number of items in the four lists of `layer`. */
export const itemCount = (layer: Json): number => LIST_KEYS.reduce((sum, key) => sum + objs(layer[key], key).length, 0);

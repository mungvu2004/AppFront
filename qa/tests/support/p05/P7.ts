/**
 * QA-05c P7 helpers (phase-5 backend behind the 3D screens, spec `phase05_3d_api.spec.ts`). API layer only, no browser.
 * Own copies on purpose (brief: helpers of other packs are not imported); nothing here is shared with P1/P4.
 * Evidence: every `call` writes the exchange `A05_<ev>.json` (`captureExchange`, secrets redacted).
 */
import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodTypeAny } from 'zod';

import { createId } from '../../../../src/domain/spatial/ids';
import { captureExchange, signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { TEST_DATA_PREFIX } from '../evidence';
import { createQcProject, deleteProject, type LayerApi, type SeededFloor } from '../layerSeed';
import { addProjectMember, poolUser, type PoolRole, type PoolUser } from '../phase03Seed';

export type Json = Record<string, unknown>;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

/** Pool slots of this pack (brief: `p05-api*`; the demoted engineer has its own slot). */
export const API_SLOT = 'p05-api';
export const DEMOTE_SLOT = 'p05-api-demote';
/** Well-formed project id with no row (packages/core/ids.py:73-77). */
export const MISSING_PROJECT = `prj_${'0'.repeat(26)}`;

export interface Sent {
  readonly res: APIResponse;
  readonly body: unknown;
}

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

export const objs = (value: unknown, what: string): Json[] => asArray(value, what).map((v) => asJson(v, what));

/** Items of a bare array or of a cursor page `{items}` (versions / notifications lists). */
export const itemsOf = (value: unknown, what: string): Json[] => (Array.isArray(value) ? objs(value, what) : objs(asJson(value, what).items, `${what}.items`));

/** One request + its exchange evidence. A `Buffer` is sent raw (a string `data` would be JSON-encoded again). */
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
  const shown: unknown = raw ? data.toString('utf8').slice(0, 2048) : (data ?? null);
  const body = await captureExchange(`A05_${ev}.json`, { method, path, body: shown }, res, claims);
  return { res, body };
}

/** W7 error body: `code` + `requestId` (+ `field` / `resource`); `field: null` = must be absent. */
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

/** The FE decodes this body with `schema`; a failure is an FE<->BE contract break. */
export function expectZod(schema: ZodTypeAny, value: unknown, what: string): void {
  const parsed = schema.safeParse(value);
  const issues = parsed.success ? '' : JSON.stringify(parsed.error.issues.slice(0, 3));
  expect.soft(parsed.success, `${what} decodes with the FE zod schema ${issues}`).toBe(true);
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

export async function adminApi(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const admin = await signedInApi(email, password);
  cleanup.add(() => admin.dispose());
  return admin;
}

/** A signed-in context already carries Origin + Bearer, so fixture calls need no extra headers. */
export const layerApi = (api: APIRequestContext): LayerApi => ({ request: api, headers: {} });

/** Seed `Q2L` / `P1`: own project (qcLayer on the first `layered` floors), deleted in `finally` via `cleanup`. */
export async function seedProject(
  admin: APIRequestContext,
  cleanup: Cleanup,
  slug: string,
  floors: readonly string[] = ['Tầng 1'],
  layered = 1,
): Promise<SeededFloor[]> {
  const made = await createQcProject(layerApi(admin), slug, floors, layered);
  const projectId = made[0]?.projectId ?? '';
  cleanup.add(async () => {
    const problem = await deleteProject(layerApi(admin), projectId);
    if (problem) note(problem);
  });
  return made;
}

/** Pool user of `role` (slot `p05-api*`), a member of `projectId`, signed in over the API. */
export async function memberApi(
  admin: APIRequestContext,
  cleanup: Cleanup,
  role: PoolRole,
  projectId: string | null,
  slot = API_SLOT,
): Promise<{ readonly user: PoolUser; readonly api: APIRequestContext }> {
  const user = await poolUser(admin, role, slot);
  if (projectId !== null) await addProjectMember(admin, projectId, user.email);
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return { user, api };
}

/** Soft-deleted project id (seed `DEL`). */
export async function deletedProjectId(admin: APIRequestContext): Promise<string> {
  const [floor] = await createQcProject(layerApi(admin), 'p05be-del');
  const id = floor?.projectId ?? '';
  expect(await deleteProject(layerApi(admin), id), 'setup: soft-delete the DEL project').toBeNull();
  return id;
}

/* ---- paths */
export const projectPath = (p: string): string => `/api/projects/${p}`;
export const graphPath = (p: string): string => `/api/projects/${p}/spatial`;
export const layerPath = (p: string, f: string): string => `/api/projects/${p}/floors/${f}/spatial/layer`;
export const rulePath = (p: string): string => `/api/projects/${p}/rule-config`;
export const measurementsPath = (p: string): string => `/api/projects/${p}/measurements`;
export const templatesPath = (p: string): string => `/api/projects/${p}/property-templates`;
export const versionsPath = (p: string, f: string): string => `/api/projects/${p}/versions?floorId=${f}`;

/* ---- reads */
export async function readLayerDoc(api: APIRequestContext, ev: string, p: string, f: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', layerPath(p, f), undefined, ['read-back: 200 N16 {revision, level, layer}']);
  expect(sent.res.status(), `N16 ${ev}`).toBe(200);
  return asJson(sent.body, 'N16');
}

export async function readGraphDoc(api: APIRequestContext, ev: string, p: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', graphPath(p), undefined, ['read-back: 200 N15 {floorRevisions, graph}']);
  expect(sent.res.status(), `N15 ${ev}`).toBe(200);
  return asJson(sent.body, 'N15');
}

/** `floorRevisions[floor].revision` of an N15 document (-1 when the floor is missing). */
export const revisionIn = (graph: Json, floorId: string): number => {
  const row = objs(graph.floorRevisions, 'floorRevisions').find((r) => r.floorId === floorId);
  return typeof row?.revision === 'number' ? row.revision : -1;
};

export async function projectDoc(api: APIRequestContext, ev: string, p: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', projectPath(p), undefined, ['read-back: 200 ProjectOut (#24)']);
  expect(sent.res.status(), `#24 ${ev}`).toBe(200);
  return asJson(sent.body, '#24');
}

/** #35 `{baseVersion, body: {layer}}` (FE spatialLayerSave.ts:283). */
export async function putLayer(
  api: APIRequestContext,
  ev: string,
  p: string,
  f: string,
  baseVersion: number,
  layer: Json,
  claims: readonly string[],
): Promise<Sent> {
  return call(api, ev, 'PUT', layerPath(p, f), { baseVersion, body: { layer } }, claims);
}

/* ---- layer edits (wire shape of layerSeed.qcLayer / src/api/schemas/spatial.ts) */
export type Layer = { walls: Json[]; openings: Json[]; rooms: Json[]; furniture: Json[] };

export function layerOf(doc: Json): Layer {
  const layer = JSON.parse(JSON.stringify(asJson(doc.layer, 'N16.layer'))) as Json;
  return {
    walls: objs(layer.walls, 'walls'),
    openings: objs(layer.openings, 'openings'),
    rooms: objs(layer.rooms, 'rooms'),
    furniture: objs(layer.furniture, 'furniture'),
  };
}

/** Moves the centreline of wall `index` by `dx` mm along x (a geometry edit, id kept). */
export function moveWall(layer: Layer, index: number, dx: number): Layer {
  const wall = layer.walls[index];
  if (!wall) throw new Error(`no wall ${String(index)}`);
  const c = asJson(wall.centreline, 'centreline');
  const shift = (p: unknown): Json => {
    const pt = asJson(p, 'point');
    return { ...pt, x: Number(pt.x) + dx };
  };
  wall.centreline = { start: shift(c.start), end: shift(c.end) };
  return layer;
}

const aiMeta = (): Json => ({ confidence: 0.9, reviewed: false, source: 'ai' });

/** Entities the way the FE mints them for Pascal-drawn nodes: ids from `createId` (src/domain/spatial/ids.ts). */
export function mintedEntities(levelId: string): { wall: Json; opening: Json; room: Json; furniture: Json } {
  const wall = {
    ...aiMeta(),
    centreline: { start: { x: 500, y: 500 }, end: { x: 3500, y: 500 } },
    heightMm: 3000,
    id: createId('wall'),
    kind: 'partition',
    levelId,
    openingIds: [] as string[],
    thicknessMm: 100,
  };
  const opening = {
    ...aiMeta(),
    heightMm: 2100,
    id: createId('opening'),
    kind: 'door',
    offsetMm: 600,
    sillHeightMm: 0,
    swing: 'left',
    wallId: wall.id,
    widthMm: 800,
  };
  wall.openingIds.push(opening.id);
  const room = {
    ...aiMeta(),
    areaM2: 9,
    id: createId('room'),
    levelId,
    name: `${TEST_DATA_PREFIX}Phòng mới`,
    outline: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
    usage: 'bedroom',
    wallIds: [wall.id],
  };
  const furniture = {
    ...aiMeta(),
    boundingBox: { min: { x: 100, y: 100 }, max: { x: 500, y: 500 } },
    centre: { x: 300, y: 300 },
    id: createId('furniture'),
    kind: 'chair',
    levelId,
    roomId: room.id,
    rotationDeg: 0,
  };
  return { wall, opening, room, furniture };
}

/** Time-ordered instants of an ISO string (project `updatedAt`). */
export const instant = (value: unknown): number => Date.parse(String(value));

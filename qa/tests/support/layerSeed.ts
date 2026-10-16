/**
 * Own spatial layer for the phase-4 QC and phase-5 3D screens (BUG-346 / BUG-323). Instead of Phase 3's CP-5 work floor
 * (run-22: CP-5 recorded, GET …/spatial/layer 404, so every layer case timed out), `phase04_pipeline.spec.ts`, `phase04_qc_layers_ui.spec.ts` and
 * `phase05_3d_viewer{,_ui}.spec.ts` create a run-unique `qa-<runId>-…` project through the real API, write its layer through
 * #35 (`PUT /api/projects/:p/floors/:f/spatial/layer`; a fresh floor takes `baseVersion` = its N16 `revision`, 0 —
 * BE spatial_write/writer.py:311-327, the path `phase04_qc_layers_api.spec.ts` and `_edge.spec.ts` already use) and delete
 * the project when done (soft delete hides its floors). The write body is checked against the FE zod schema the screens
 * send with (`FloorLayerWriteSchema`) and the answer against the one they decode with (`FloorLayerWriteResultSchema`).
 * Only states that need the pipeline itself (drawing, OCR dimensions, the AI version of Phase 6) still read CP-5.
 *
 * Budget per seeded project: `POST /api/projects` 1, `GET /api/projects/:id` 1, N16 GET + #35 PUT 1 each per layered
 * floor, `DELETE` 1 — no rate limit on any of them (projects/router.py:54, spatial_read/, spatial_write/: no `rate_limit(`).
 */
import { randomUUID } from 'node:crypto';

import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

import { FloorLayerWriteResultSchema, FloorLayerWriteSchema } from '../../../src/api/schemas/spatialLayer';
import { readBaseUrl } from '../../../e2e/fullstack/env';
import { TEST_DATA_PREFIX } from './evidence';

type Json = Record<string, unknown>;

const PROJECTS = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;

/** Fixture calls: a request context and the headers that authenticate them (empty when the context carries its own). */
export interface LayerApi {
  readonly request: APIRequestContext;
  readonly headers: Record<string, string>;
}

export interface SeededFloor {
  readonly projectId: string;
  readonly floorId: string;
  readonly floorName: string;
}

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

export const layerPathOf = (projectId: string, floorId: string): string =>
  `${PROJECTS}/${projectId}/floors/${floorId}/spatial/layer`;

/**
 * Bearer for fixture calls from a browser context's OWN session: one `POST /api/auth/refresh`, no login (phase04 edge
 * `openAdmin`). The refresh cookie rotates in the context's jar, so call it while no page of the context is refreshing
 * (before the first page, or between page loads). Body `accessToken`/`access_token`, optional `data` wrapper
 * (src/lib/auth/refresh.ts:85-100).
 */
export async function layerApiOf(context: BrowserContext): Promise<LayerApi> {
  const origin = readBaseUrl();
  const refreshed = await context.request.post('/api/auth/refresh', { headers: { Origin: origin } });
  expect(refreshed.status(), 'setup: POST /api/auth/refresh (fixture token)').toBe(200);
  const body = asRecord(await refreshed.json(), 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = root.accessToken ?? root.access_token;
  if (typeof token !== 'string' || token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return { request: context.request, headers: { Origin: origin, Authorization: `Bearer ${token}` } };
}

/** HTTP status of the N16 read of a floor (200 = a layer the screens can open). */
export async function layerStatus(api: LayerApi, projectId: string, floorId: string): Promise<number> {
  return (await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers })).status();
}

/** Deletes a fixture project; 200 or 404 (already gone) is fine, anything else is reported, never thrown. */
export async function deleteProject(api: LayerApi, projectId: string): Promise<string | null> {
  try {
    const res = await api.request.delete(`${PROJECTS}/${projectId}`, { headers: api.headers });
    return res.status() === 200 || res.status() === 404 ? null : `DELETE ${PROJECTS}/${projectId} → ${String(res.status())}`;
  } catch (error) {
    return `DELETE ${PROJECTS}/${projectId}: ${String(error)}`;
  }
}

/** Writes `build(levelId)` as the floor's whole layer through #35 at the floor's current revision; returns the saved layer. */
export async function writeLayer(api: LayerApi, projectId: string, floorId: string, build: (levelId: string) => Json): Promise<Json> {
  const saved = await putFloorBody(api, projectId, floorId, (levelId) => ({ layer: build(levelId) }));
  return asRecord(saved.layer, '#35.layer');
}

/**
 * Replaces the floor's dimension strings through #35 `body.dimensions` (BUG-577, QD-001) at the current revision.
 * `build` gets the level id and the floor's wall ids (for `referenceIds`).
 */
export async function writeDimensions(
  api: LayerApi,
  projectId: string,
  floorId: string,
  build: (levelId: string, wallIds: readonly string[]) => Json[],
): Promise<void> {
  await putFloorBody(api, projectId, floorId, (levelId, wallIds) => ({ dimensions: build(levelId, wallIds) }));
}

async function putFloorBody(
  api: LayerApi,
  projectId: string,
  floorId: string,
  build: (levelId: string, wallIds: readonly string[]) => Json,
): Promise<Json> {
  const path = layerPathOf(projectId, floorId);
  const read = await api.request.get(path, { headers: api.headers });
  expect(read.status(), `setup: GET ${path} (N16)`).toBe(200);
  const doc = asRecord(await read.json(), 'N16');
  const level = asRecord(doc.level, 'N16.level');
  if (typeof level.id !== 'string') throw new Error('N16.level has no id');
  const walls = (asRecord(doc.layer, 'N16.layer').walls as Json[] | undefined) ?? [];
  const data = { baseVersion: doc.revision, body: build(level.id, walls.map((wall) => String(wall.id))) };
  // Our own fixture must be a body the FE itself could send.
  FloorLayerWriteSchema.parse(data);
  const put = await api.request.put(path, { headers: api.headers, data });
  expect(put.status(), `setup: PUT ${path} (#35): ${(await put.text()).slice(0, 300)}`).toBe(200);
  const result = await put.json();
  FloorLayerWriteResultSchema.parse(result);
  return asRecord(result, '#35');
}

/* ---- the QC fixture layer (wire shape: src/api/schemas/spatial.ts) ---- */

/** W4 id `<letter>-<base36 UPPER 10..64>` (BE packages/core/ids.py:23-31,92-94). */
const sid = (letter: 'W' | 'D' | 'R' | 'F'): string => `${letter}-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 20)}`;

/** A5: AI output is never `reviewed` (schemas/spatial.ts humanOnlyReview). < 0.70 = "needsReview" (materialMap.ts:144). */
const ai = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' });

type Pt = readonly [number, number];

/**
 * One floor that every phase-4 layer screen can work on, without a drawing:
 * - walls: an 8 × 6 m load-bearing 220 mm rectangle, two collinear segments per side (merge pairs for SCR-16 "nối đoạn";
 *   SCR-19 previews one axis per side, domain/axes/detect.ts MIN_WALLS_PER_AXIS = 2), plus two 200 mm partitions (SCR-21:
 *   one group within the 30 mm default tolerance of 220 mm), one of them low-confidence ("Chỉ hiện độ tin cậy thấp");
 * - openings: a door (swing left) on the left side, a window on the right side (SCR-17 swing / type / approve);
 * - rooms: "Bếp" and "PHONG NGU 2" (SCR-20 rename, "Chuẩn hoá tên" has a row to change, "Gộp phòng" has a partner);
 * - furniture: one table in the kitchen.
 */
export function qcLayer(levelId: string): Json {
  const wall = (from: Pt, to: Pt, extra: Json = {}): Json => ({
    ...ai(),
    centreline: { start: { x: from[0], y: from[1] }, end: { x: to[0], y: to[1] } },
    heightMm: FLOOR_HEIGHT_MM,
    id: sid('W'),
    kind: 'loadBearing',
    levelId,
    openingIds: [],
    thicknessMm: 220,
    ...extra,
  });
  const doorId = sid('D');
  const windowId = sid('D');
  const walls = [
    wall([0, 0], [4000, 0]),
    wall([4000, 0], [8000, 0]),
    wall([0, 6000], [4000, 6000]),
    wall([4000, 6000], [8000, 6000]),
    wall([0, 0], [0, 3000], { openingIds: [doorId] }),
    wall([0, 3000], [0, 6000]),
    wall([8000, 0], [8000, 3000], { openingIds: [windowId] }),
    wall([8000, 3000], [8000, 6000]),
    wall([1000, 2000], [7000, 2000], { kind: 'partition', thicknessMm: 200 }),
    wall([1000, 4000], [7000, 4000], { kind: 'partition', thicknessMm: 200, confidence: 0.5 }),
  ];
  const wallId = (index: number): unknown => walls[index]?.id;
  const kitchen = sid('R');
  const room = (id: string, name: string, usage: string, y0: number, y1: number): Json => ({
    ...ai(),
    areaM2: 16,
    id,
    levelId,
    name,
    outline: [
      { x: 0, y: y0 },
      { x: 8000, y: y0 },
      { x: 8000, y: y1 },
      { x: 0, y: y1 },
    ],
    usage,
    wallIds: [],
  });
  return {
    walls,
    openings: [
      { ...ai(), heightMm: 2100, id: doorId, kind: 'door', offsetMm: 1000, sillHeightMm: 0, swing: 'left', wallId: wallId(4), widthMm: 900 },
      { ...ai(), heightMm: 1200, id: windowId, kind: 'window', offsetMm: 1000, sillHeightMm: 900, swing: 'fixed', wallId: wallId(6), widthMm: 1200 },
    ],
    rooms: [room(kitchen, 'Bếp', 'kitchen', 0, 2000), room(sid('R'), 'PHONG NGU 2', 'bedroom', 4000, 6000)],
    furniture: [
      {
        ...ai(),
        boundingBox: { min: { x: 1600, y: 700 }, max: { x: 2400, y: 1300 } },
        centre: { x: 2000, y: 1000 },
        id: sid('F'),
        kind: 'table',
        levelId,
        roomId: kitchen,
        rotationDeg: 0,
      },
    ],
  };
}

/**
 * Project `qa-<runId>-<slug>-<uniq>` with `floorNames` (BE #25 `floors` drafts), layer {@link qcLayer} on the first
 * `layered` floors (default 1; the phase-5 3D screens seed two, so the exploded view has two storeys with geometry); the
 * others stay empty (floor nav targets). Deletes the project again when any setup step fails. Returns every floor.
 */
export async function createQcProject(
  api: LayerApi,
  slug: string,
  floorNames: readonly string[] = ['Tầng 1'],
  layered = 1,
): Promise<SeededFloor[]> {
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await api.request.post(PROJECTS, {
    headers: api.headers,
    data: {
      name,
      floors: floorNames.map((floorName, order) => ({ name: floorName, order, elevationMm: order * FLOOR_HEIGHT_MM, heightMm: FLOOR_HEIGHT_MM })),
    },
  });
  expect(created.status(), `setup: POST ${PROJECTS} "${name}"`).toBe(201);
  const projectId = asRecord(await created.json(), `POST ${PROJECTS}`).id;
  if (typeof projectId !== 'string' || projectId === '') throw new Error(`POST ${PROJECTS}: no project id`);
  try {
    const read = await api.request.get(`${PROJECTS}/${projectId}`, { headers: api.headers });
    expect(read.status(), `setup: GET ${PROJECTS}/${projectId}`).toBe(200);
    const rows = asRecord(await read.json(), `GET ${PROJECTS}/:id`).floors;
    if (!Array.isArray(rows)) throw new Error(`GET ${PROJECTS}/:id: no floors array`);
    const floors = floorNames.map((floorName) => {
      const row = rows.map((item) => asRecord(item, 'floor')).find((item) => item.name === floorName);
      if (row === undefined || typeof row.id !== 'string') throw new Error(`setup: floor "${floorName}" was not created`);
      return { projectId, floorId: row.id, floorName };
    });
    if (layered < 1 || layered > floors.length) throw new Error(`setup: cannot layer ${String(layered)} of ${String(floors.length)} floors`);
    for (const floor of floors.slice(0, layered)) await writeLayer(api, projectId, floor.floorId, qcLayer);
    return floors;
  } catch (error) {
    await deleteProject(api, projectId);
    throw error;
  }
}

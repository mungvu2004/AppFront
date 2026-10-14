/**
 * QA-06b P7 — seeds for the SCR-32 UI file (`phase06_versions_ui.spec.ts`). Owned by P7 only; the same seeds exist in
 * P6's `versionSeed.ts` (merged by the coordinator at S4), hence the `dup-of` marks.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { TEST_DATA_PREFIX } from '../evidence';
import { layerPathOf, type LayerApi } from '../layerSeed';

type Json = Record<string, unknown>;
const PROJECTS = '/api/projects';

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/** `E2E_DRAWING_PNG` path, or a `test.skip` with an "Environment:" reason (call inside a `beforeAll`/test). */
export function drawingPathOrSkip(): string {
  const path = process.env.E2E_DRAWING_PNG?.trim() ?? '';
  test.skip(path === '', 'Environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars); versions only come from the pipeline');
  return path;
}

/** The floor's level id (N16 `level.id`), for snapshots that must build a scene from the project's graph. */
export async function readLevelId(api: LayerApi, projectId: string, floorId: string): Promise<string> {
  const read = await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers });
  expect(read.status(), 'setup: N16 GET …/spatial/layer (level id)').toBe(200);
  const level = asRecord(asRecord(await read.json(), 'N16').level, 'N16.level');
  if (typeof level.id !== 'string') throw new Error('N16.level has no id');
  return level.id;
}

/** Newest-first N17 items (`limit`, default 50) of a floor. */
export async function listVersions(api: APIRequestContext, projectId: string, floorId: string, limit = 50): Promise<Json[]> {
  const res = await api.get(`${PROJECTS}/${projectId}/versions?floorId=${encodeURIComponent(floorId)}&limit=${String(limit)}`);
  expect(res.status(), 'setup: N17 GET versions').toBe(200);
  const items = asRecord(await res.json(), 'N17').items;
  if (!Array.isArray(items)) throw new Error('N17: no items');
  return items.map((item) => asRecord(item, 'N17 item'));
}

/** N19 `POST …/versions/:v/restore` `{baseVersion, body:{floorId}}` → 201 summary (carries the new `floorRevision`). */
// dup-of: versionSeed.ts restoreVia
export async function restoreVia(api: APIRequestContext, projectId: string, floorId: string, versionId: string, baseVersion: number): Promise<Json> {
  const res = await api.post(`${PROJECTS}/${projectId}/versions/${versionId}/restore`, { data: { baseVersion, body: { floorId } } });
  expect(res.status(), `setup: N19 POST restore ${versionId}: ${(await res.text()).slice(0, 200)}`).toBe(201);
  return asRecord(await res.json(), 'N19');
}

/** N20 `PATCH …/versions/:v/label` `{label}` → 200. */
export async function labelVia(api: APIRequestContext, projectId: string, versionId: string, label: string): Promise<void> {
  const res = await api.patch(`${PROJECTS}/${projectId}/versions/${versionId}/label`, { data: { label } });
  expect(res.status(), `setup: N20 PATCH label: ${(await res.text()).slice(0, 200)}`).toBe(200);
}

/**
 * Grows the floor's history to `total` versions through N19 restores: each restore of the second-newest version (the
 * "before" the previous restore made, always among the 50 newest) adds a "before" + an "after" version, so the content
 * alternates and every restore really changes the floor. Needs the floor to hold ≥ 2 versions with content and a layer
 * written once (a pipeline floor after `writeLayer`). Ends with `total` versions; v(total−49)..v(total) keep content, the
 * older ones lose it (BE keeps the 50 newest snapshots).
 */
// dup-of: versionSeed.ts seedVersionLadder
export async function seedVersionLadder(api: LayerApi, projectId: string, floorId: string, total = 58): Promise<void> {
  const read = await api.request.get(layerPathOf(projectId, floorId), { headers: api.headers });
  expect(read.status(), 'setup: N16 GET layer (ladder base)').toBe(200);
  let revision = Number(asRecord(await read.json(), 'N16').revision);
  let count = (await listVersions(api.request, projectId, floorId, 2)).length;
  while (count < total) {
    const [, before] = await listVersions(api.request, projectId, floorId, 2);
    if (before === undefined) throw new Error('setup: ladder needs a second-newest version');
    const restored = await restoreVia(api.request, projectId, floorId, String(before.id), revision);
    revision = Number(restored.floorRevision);
    count += 2;
  }
  const oldest = await api.request.get(`${PROJECTS}/${projectId}/versions?floorId=${encodeURIComponent(floorId)}&limit=200`, { headers: api.headers });
  const items = asRecord(await oldest.json(), 'N17').items as Json[];
  // S5-confirm: the BE keeps snapshots for the 50 newest versions only (snapshots.py:53 versions_keep_snapshots = 50).
  expect(items.filter((item) => item.hasSnapshot === true).length, 'setup: 50 versions keep content').toBe(50);
}

/** Project with ONE floor named with 65 characters and an 80-character name (`…_ui.spec.ts` old U06 no-layer block). */
// dup-of: versionSeed.ts createLongNameProject
export const LONG_FLOOR_NAME = 'Tầng kỹ thuật mái và phòng máy bơm nước sinh hoạt khu B phía Đông';
export async function createLongNameProject(api: APIRequestContext, slug: string): Promise<{ projectId: string; floorId: string; floorName: string }> {
  const name = `${`${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, 79)}A`;
  const created = await api.post(PROJECTS, { data: { name, floors: [{ name: LONG_FLOOR_NAME, order: 0, elevationMm: 0, heightMm: 3_000 }] } });
  expect(created.status(), `setup: POST ${PROJECTS} (long names): ${(await created.text()).slice(0, 200)}`).toBe(201);
  const projectId = String(asRecord(await created.json(), 'POST /api/projects').id);
  const read = await api.get(`${PROJECTS}/${projectId}`);
  const floors = asRecord(await read.json(), 'GET project').floors as Json[];
  const floorId = String(floors[0]?.id);
  return { projectId, floorId, floorName: LONG_FLOOR_NAME };
}

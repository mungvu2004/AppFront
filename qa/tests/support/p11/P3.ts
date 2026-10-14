/**
 * QA-11 pack P3 helpers for `phase11_floors_c_edge.spec.ts` (SCR-09 delete / undo / restore window).
 * Re-exports the phase-3 floor helpers (read-only source) so the spec has a single import; adds the layer seed + wall count.
 */
import { expect, type APIRequestContext } from '@playwright/test';

import { readBaseUrl } from '../../../../e2e/fullstack/env';
import { layerPathOf, qcLayer, writeLayer } from '../layerSeed';

// dup-of: p03/P3.withFloorsAdmin, watchWrites, nthCall, callsSince, createStack, readFloors, apiAddFloor, apiDeleteFloor, undoFromToast
export {
  apiAddFloor,
  apiDeleteFloor,
  callsSince,
  createStack,
  nthCall,
  readFloors,
  undoFromToast,
  watchWrites,
  withFloorsAdmin,
  type FloorDraft,
  type FloorFull,
  type FloorsAdmin,
  type Write,
} from '../p03/P3';

/** Seeds {@link qcLayer} (10 walls, 2 rooms, 1 table) on one floor through #35 with the admin Bearer context. */
export async function seedFloorLayer(api: APIRequestContext, projectId: string, floorId: string): Promise<void> {
  await writeLayer({ request: api, headers: { Origin: readBaseUrl() } }, projectId, floorId, qcLayer);
}

/** Wall count of the floor's layer read (N16 `GET …/spatial/layer`, 200). */
export async function wallCount(api: APIRequestContext, projectId: string, floorId: string): Promise<number> {
  const res = await api.get(layerPathOf(projectId, floorId));
  expect(res.status(), `GET ${layerPathOf(projectId, floorId)}`).toBe(200);
  const doc = (await res.json()) as { layer?: { walls?: unknown[] } };
  return doc.layer?.walls?.length ?? -1;
}

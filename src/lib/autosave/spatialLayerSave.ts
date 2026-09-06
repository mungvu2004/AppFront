import type { SpatialApi, SpatialLayer } from '@/api/client';

/**
 * What one autosave cycle of a floor's spatial layer needs to send: the
 * whole four-list write `WriteSpatialLayerInput` (`@/api/client`) expects,
 * per its own docblock — "the autosave flush of everything on this floor
 * right now", not a per-field patch.
 */
export interface SpatialLayerChanges {
  readonly floorId: string;
  readonly projectId: string;
  readonly layer: SpatialLayer;
}

/**
 * Wraps U4's `SpatialApi.writeLayer` (walls/openings/rooms/furniture, added
 * in `feat(api): endpoint luu lop khong gian`) as a `createAutosave`-shaped
 * `save` callback — resolves on a successful write, throws on failure so
 * `createAutosave`'s own retry schedule (`retrySchedule.ts`: 5s/15s/45s) and
 * offline detection take over. No retry logic lives in this file; duplicating
 * it here would be the second independent retry mechanism this task exists
 * to remove.
 *
 * Not wired to a caller yet. The one screen that needs it —
 * `usePropertyInspector.ts`, whose `persist` always throws because
 * `gateway.persistProperties()` has nowhere to send to
 * (`PERSIST_PROPERTIES_UNSUPPORTED_REASON`) — is outside this task's
 * whitelist and is being edited concurrently by another workstream. That
 * workstream plugs this in as:
 * `createAutosave({ getChanges, save: createSpatialLayerSave(apiClient.spatial) })`.
 */
export function createSpatialLayerSave(
  spatialApi: Pick<SpatialApi, 'writeLayer'>,
): (changes: SpatialLayerChanges) => Promise<void> {
  return async (changes) => {
    const result = await spatialApi.writeLayer({
      body: changes.layer,
      floorId: changes.floorId,
      projectId: changes.projectId,
    });

    if (!result.ok) {
      throw new Error(`Không lưu được lớp không gian (${result.error.kind})`);
    }
  };
}

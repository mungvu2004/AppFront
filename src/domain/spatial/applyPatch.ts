/**
 * Immutable patching of the normalized spatial graph.
 *
 * The update style is the one immer gives you — write as if you were editing
 * in place, get structural sharing out — but implemented with plain
 * copy-on-write so the domain layer stays dependency-free. Every table, bucket
 * and entity is copied at most once per call, and only along the branch a
 * patch actually touches: a level whose entities nobody patched keeps its
 * exact array reference, and so does every untouched entity.
 *
 * This module only reshapes data. No geometry, no derived measurements.
 */

import type { EntityKind, IdByKind } from './ids';
import {
  isEntityOfKind,
  resolveLevelId,
  type EntityByKind,
  type NormalizedSpatial,
  type SpatialEntity,
} from './normalize';
import type { EntityId, LevelId } from './types';

/** Inserts an entity, or replaces it when the id is already present. */
interface AddPatch<K extends EntityKind> {
  op: 'add';
  kind: K;
  entity: EntityByKind[K];
}

/** Merges a shallow set of changes into an existing entity. */
interface UpdatePatch<K extends EntityKind> {
  op: 'update';
  kind: K;
  id: IdByKind[K];
  changes: Partial<EntityByKind[K]>;
}

/** Drops an entity from every index. Children are not removed with it. */
interface RemovePatch<K extends EntityKind> {
  op: 'remove';
  kind: K;
  id: IdByKind[K];
}

/**
 * One patch against the normalized graph.
 *
 * The union is built per kind, so `changes` and `entity` are always typed
 * against the kind named in the same patch.
 */
export type SpatialPatch = {
  [K in EntityKind]: AddPatch<K> | UpdatePatch<K> | RemovePatch<K>;
}[EntityKind];

const readField = (source: object, key: string): unknown => Reflect.get(source, key);

const isShallowEqual = (left: object, right: object): boolean => {
  const leftKeys = Object.keys(left);

  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }

  return leftKeys.every((key) => Object.is(readField(left, key), readField(right, key)));
};

/**
 * Applies patches in order and returns a new normalized graph.
 *
 * The input is never mutated. When no patch changes anything, the very same
 * object is returned.
 */
export const applyPatch = (
  normalized: NormalizedSpatial,
  patches: readonly SpatialPatch[],
): NormalizedSpatial => {
  if (patches.length === 0) {
    return normalized;
  }

  let byId = normalized.byId;
  let byKind = normalized.byKind;
  let byLevel = normalized.byLevel;

  let byIdDrafted = false;
  let byKindDrafted = false;
  let byLevelDrafted = false;
  const draftedKinds = new Set<EntityKind>();
  const draftedLevels = new Set<string>();

  const draftById = (): Record<string, SpatialEntity> => {
    if (!byIdDrafted) {
      byId = { ...byId };
      byIdDrafted = true;
    }

    return byId as Record<string, SpatialEntity>;
  };

  const draftKind = (kind: EntityKind): EntityId[] => {
    if (!byKindDrafted) {
      byKind = { ...byKind };
      byKindDrafted = true;
    }

    const table = byKind as Record<EntityKind, readonly EntityId[]>;

    if (!draftedKinds.has(kind)) {
      table[kind] = [...table[kind]];
      draftedKinds.add(kind);
    }

    return table[kind] as EntityId[];
  };

  const draftLevel = (levelId: LevelId): EntityId[] => {
    if (!byLevelDrafted) {
      byLevel = { ...byLevel };
      byLevelDrafted = true;
    }

    const table = byLevel as Record<string, readonly EntityId[]>;

    if (!draftedLevels.has(levelId)) {
      table[levelId] = [...(table[levelId] ?? [])];
      draftedLevels.add(levelId);
    }

    return table[levelId] as EntityId[];
  };

  const attachToLevel = (levelId: LevelId | null, id: EntityId): void => {
    if (levelId === null) {
      return;
    }

    const bucket = draftLevel(levelId);

    if (!bucket.includes(id)) {
      bucket.push(id);
    }
  };

  const detachFromLevel = (levelId: LevelId | null, id: EntityId): void => {
    if (levelId === null) {
      return;
    }

    const bucket = draftLevel(levelId);
    const index = bucket.indexOf(id);

    if (index !== -1) {
      bucket.splice(index, 1);
    }
  };

  const moveBetweenLevels = (id: EntityId, from: LevelId | null, to: LevelId | null): void => {
    if (from === to) {
      return;
    }

    detachFromLevel(from, id);
    attachToLevel(to, id);
  };

  /** A wall carries its openings with it when it changes level. */
  const moveOpeningsOfWall = (wallId: EntityId, from: LevelId | null, to: LevelId | null): void => {
    if (from === to) {
      return;
    }

    for (const id of byKind.opening) {
      const opening = byId[id];

      if (opening !== undefined && isEntityOfKind('opening', opening) && opening.wallId === wallId) {
        moveBetweenLevels(id, from, to);
      }
    }
  };

  for (const patch of patches) {
    const existing = patch.op === 'add' ? byId[patch.entity.id] : byId[patch.id];

    if (patch.op === 'add') {
      const { entity } = patch;

      if (existing !== undefined && isShallowEqual(existing, entity)) {
        continue;
      }

      const previousLevelId = existing === undefined ? null : resolveLevelId(existing, byId);

      draftById()[entity.id] = entity;

      if (existing === undefined) {
        draftKind(patch.kind).push(entity.id);
      }

      moveBetweenLevels(entity.id, previousLevelId, resolveLevelId(entity, byId));

      continue;
    }

    if (existing === undefined) {
      continue;
    }

    if (patch.op === 'remove') {
      const levelId = resolveLevelId(existing, byId);

      delete draftById()[patch.id];

      const kindBucket = draftKind(patch.kind);
      const kindIndex = kindBucket.indexOf(patch.id);

      if (kindIndex !== -1) {
        kindBucket.splice(kindIndex, 1);
      }

      detachFromLevel(levelId, patch.id);

      continue;
    }

    const changedKeys = Object.keys(patch.changes).filter(
      (key) => !Object.is(readField(existing, key), readField(patch.changes, key)),
    );

    if (changedKeys.length === 0) {
      continue;
    }

    // Copy first, then write the changed fields onto the copy. `changes` is
    // typed against `patch.kind`, so the writes stay within the entity's own
    // fields; going through the spread of a not-yet-narrowed union would only
    // produce a cross-product type, not extra safety.
    const updated: SpatialEntity = { ...existing };

    for (const key of changedKeys) {
      Reflect.set(updated, key, readField(patch.changes, key));
    }

    const previousLevelId = resolveLevelId(existing, byId);

    draftById()[patch.id] = updated;

    const nextLevelId = resolveLevelId(updated, byId);

    moveBetweenLevels(patch.id, previousLevelId, nextLevelId);

    if (patch.kind === 'wall') {
      moveOpeningsOfWall(patch.id, previousLevelId, nextLevelId);
    }
  }

  if (!byIdDrafted && !byKindDrafted && !byLevelDrafted) {
    return normalized;
  }

  return {
    building: normalized.building,
    byId,
    byLevel,
    byKind,
    notes: normalized.notes,
  };
};

/** Convenience wrapper for the common case of a single patch. */
export const applySinglePatch = (normalized: NormalizedSpatial, patch: SpatialPatch): NormalizedSpatial =>
  applyPatch(normalized, [patch]);

/** Reads an entity of a known kind, or `null` when it is absent or of another kind. */
export const readEntity = <K extends EntityKind>(
  normalized: NormalizedSpatial,
  kind: K,
  id: IdByKind[K],
): EntityByKind[K] | null => {
  const entity = normalized.byId[id];

  if (entity === undefined || !isEntityOfKind(kind, entity)) {
    return null;
  }

  return entity;
};

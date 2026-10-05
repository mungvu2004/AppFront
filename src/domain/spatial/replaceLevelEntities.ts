/**
 * Replaces what one level holds with a server layer, without touching any other
 * level: their `byLevel` arrays and entities keep the same references, so
 * `changedLevelIds` and every selector see them as unchanged.
 */

import {
  isEntityOfKind,
  resolveLevelId,
  type EntityByKind,
  type NormalizedSpatial,
  type SpatialEntity,
} from './normalize';
import type { EntityKind } from './ids';
import type { Axis, Dimension, EntityId, Furniture, Level, LevelId, Opening, Room, Wall } from './types';

/** The parts of a level to replace; a missing key keeps what the level has now. */
export interface LevelParts {
  level?: Level;
  walls?: readonly Wall[];
  openings?: readonly Opening[];
  rooms?: readonly Room[];
  furniture?: readonly Furniture[];
  axes?: readonly Axis[];
  dimensions?: readonly Dimension[];
}

type ReplaceableKind = 'wall' | 'opening' | 'room' | 'furniture' | 'axis' | 'dimension';

/** Order the ids of one level are listed in: walls first so openings resolve. */
const ORDER: readonly ReplaceableKind[] = ['wall', 'opening', 'furniture', 'room', 'axis', 'dimension'];

const partsOfKind = (parts: LevelParts, kind: ReplaceableKind): readonly SpatialEntity[] | undefined =>
  ({
    wall: parts.walls,
    opening: parts.openings,
    furniture: parts.furniture,
    room: parts.rooms,
    axis: parts.axes,
    dimension: parts.dimensions,
  })[kind];

export function replaceLevelEntities(
  normalized: NormalizedSpatial,
  levelId: LevelId,
  parts: LevelParts,
): NormalizedSpatial {
  const byId: Record<string, SpatialEntity> = { ...normalized.byId };
  const byKind: Record<EntityKind, readonly EntityId[]> = { ...normalized.byKind };
  const oldOnLevel = normalized.byLevel[levelId] ?? [];
  const removed = new Set<string>();
  const added: EntityId[] = [];

  for (const kind of ORDER) {
    const replacement = partsOfKind(parts, kind);

    if (replacement === undefined) {
      continue;
    }

    const gone = oldOnLevel.filter((id) => {
      const entity = normalized.byId[id];

      return entity !== undefined && isEntityOfKind(kind, entity);
    });

    for (const id of gone) {
      removed.add(id);
      delete byId[id];
    }

    const goneSet = new Set<string>(gone);

    for (const entity of replacement) {
      byId[entity.id] = entity;
    }

    byKind[kind] = [...byKind[kind].filter((id) => !goneSet.has(id)), ...replacement.map((entity) => entity.id)];

    for (const entity of replacement) {
      // An opening belongs to the level of its wall; one whose wall sits elsewhere is not listed here.
      // ponytail: it stays in `byId`/`byKind` only; fix `byLevel` of the other level if a layer ever carries one.
      const owner = isEntityOfKind('opening', entity) ? resolveLevelId(entity, byId) : levelId;

      if (owner === levelId) {
        added.push(entity.id);
      }
    }
  }

  const levelEntity: EntityByKind['level'] | undefined = parts.level;

  if (levelEntity !== undefined) {
    byId[levelEntity.id] = levelEntity;

    if (!byKind.level.includes(levelEntity.id)) {
      byKind.level = [...byKind.level, levelEntity.id];
    }
  }

  return {
    ...normalized,
    byId,
    byKind,
    byLevel: {
      ...normalized.byLevel,
      [levelId]: [...oldOnLevel.filter((id) => !removed.has(id)), ...added],
    },
  };
}

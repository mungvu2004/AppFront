/**
 * Structural conversion between the nested graph the server sends and the flat
 * lookup tables the application reads.
 *
 * The server payload nests entities through references: a building holds
 * levels, a level holds the walls / rooms / furniture / axes / dimensions that
 * carry its `levelId`, and a wall holds its openings. Reading that shape means
 * scanning arrays, so the app keeps a normalized form instead:
 *
 * - `byId`    — every entity keyed by its prefixed id, for O(1) lookup;
 * - `byLevel` — the ids placed on each level, for O(1) level filtering;
 * - `byKind`  — the ids of each kind, **in the original array order**, which is
 *   what makes `denormalizeSpatial` give the input back untouched.
 *
 * This module only reshapes data. No geometry, no derived measurements.
 */

import { isIdOfKind, type EntityKind } from './ids';
import type {
  Axis,
  Building,
  Dimension,
  EntityId,
  Furniture,
  Level,
  LevelId,
  Note,
  Opening,
  Room,
  SpatialGraph,
  Wall,
} from './types';

/** Maps an entity kind to the entity type it stores. */
export interface EntityByKind {
  level: Level;
  wall: Wall;
  opening: Opening;
  furniture: Furniture;
  room: Room;
  axis: Axis;
  dimension: Dimension;
}

/** Any entity that lives in `byId`. */
export type SpatialEntity = EntityByKind[EntityKind];

/** The flat form of a spatial graph. */
export interface NormalizedSpatial {
  building: Building;
  byId: Readonly<Record<string, SpatialEntity>>;
  byLevel: Readonly<Record<string, readonly EntityId[]>>;
  byKind: Readonly<Record<EntityKind, readonly EntityId[]>>;
  notes: readonly Note[];
}

const NO_IDS: readonly EntityId[] = Object.freeze([]);

/**
 * Narrows an entity by its id prefix.
 *
 * Entities share no discriminant field, so the prefix is the only reliable
 * runtime marker of what a `SpatialEntity` actually is.
 */
export const isEntityOfKind = <K extends EntityKind>(kind: K, entity: SpatialEntity): entity is EntityByKind[K] =>
  isIdOfKind(kind, entity.id);

/**
 * Resolves the level an entity sits on.
 *
 * A level sits on no other level, and an opening inherits the level of the
 * wall it is cut into. Returns `null` when the level cannot be resolved.
 */
export const resolveLevelId = (
  entity: SpatialEntity,
  byId: Readonly<Record<string, SpatialEntity>>,
): LevelId | null => {
  if (isEntityOfKind('level', entity)) {
    return null;
  }

  if (isEntityOfKind('opening', entity)) {
    const wall = byId[entity.wallId];

    return wall !== undefined && isEntityOfKind('wall', wall) ? wall.levelId : null;
  }

  return entity.levelId;
};

const createEmptyKindIndex = (): Record<EntityKind, EntityId[]> => ({
  level: [],
  wall: [],
  opening: [],
  furniture: [],
  room: [],
  axis: [],
  dimension: [],
});

/**
 * Flattens a spatial graph into lookup tables.
 *
 * The input is never mutated: entities are carried over by reference and every
 * index is a freshly built object.
 */
export const normalizeSpatial = (graph: SpatialGraph): NormalizedSpatial => {
  const byId: Record<string, SpatialEntity> = {};
  const byKind = createEmptyKindIndex();
  const byLevel: Record<string, EntityId[]> = {};

  const registerId = (kind: EntityKind, id: EntityId): void => {
    byKind[kind].push(id);
  };

  const registerOnLevel = (levelId: LevelId, id: EntityId): void => {
    const bucket = byLevel[levelId];

    if (bucket === undefined) {
      byLevel[levelId] = [id];

      return;
    }

    bucket.push(id);
  };

  for (const level of graph.levels) {
    byId[level.id] = level;
    registerId('level', level.id);

    if (byLevel[level.id] === undefined) {
      byLevel[level.id] = [];
    }
  }

  for (const wall of graph.walls) {
    byId[wall.id] = wall;
    registerId('wall', wall.id);
    registerOnLevel(wall.levelId, wall.id);
  }

  for (const opening of graph.openings) {
    byId[opening.id] = opening;
    registerId('opening', opening.id);

    // Walls are registered above, so the opening's level is one lookup away.
    const levelId = resolveLevelId(opening, byId);

    if (levelId !== null) {
      registerOnLevel(levelId, opening.id);
    }
  }

  for (const item of graph.furniture) {
    byId[item.id] = item;
    registerId('furniture', item.id);
    registerOnLevel(item.levelId, item.id);
  }

  for (const room of graph.rooms) {
    byId[room.id] = room;
    registerId('room', room.id);
    registerOnLevel(room.levelId, room.id);
  }

  for (const axis of graph.axes) {
    byId[axis.id] = axis;
    registerId('axis', axis.id);
    registerOnLevel(axis.levelId, axis.id);
  }

  for (const dimension of graph.dimensions) {
    byId[dimension.id] = dimension;
    registerId('dimension', dimension.id);
    registerOnLevel(dimension.levelId, dimension.id);
  }

  return {
    building: graph.building,
    byId,
    byLevel,
    byKind,
    notes: graph.notes,
  };
};

const collectByKind = <K extends EntityKind>(
  normalized: NormalizedSpatial,
  kind: K,
): EntityByKind[K][] => {
  const entities: EntityByKind[K][] = [];

  for (const id of normalized.byKind[kind]) {
    const entity = normalized.byId[id];

    if (entity === undefined) {
      throw new Error(`normalize: byKind.${kind} points at a missing entity ${id}`);
    }

    if (!isEntityOfKind(kind, entity)) {
      throw new Error(`normalize: byKind.${kind} points at ${id}, which is not a ${kind}`);
    }

    entities.push(entity);
  }

  return entities;
};

/**
 * Rebuilds the nested graph from its flat form.
 *
 * `byKind` keeps the original array order, so for any graph `g` the identity
 * `denormalizeSpatial(normalizeSpatial(g))` deep-equals `g`.
 */
export const denormalizeSpatial = (normalized: NormalizedSpatial): SpatialGraph => ({
  building: normalized.building,
  levels: collectByKind(normalized, 'level'),
  walls: collectByKind(normalized, 'wall'),
  openings: collectByKind(normalized, 'opening'),
  furniture: collectByKind(normalized, 'furniture'),
  rooms: collectByKind(normalized, 'room'),
  axes: collectByKind(normalized, 'axis'),
  dimensions: collectByKind(normalized, 'dimension'),
  notes: normalized.notes,
});

/** Reads the ids placed on a level; returns a shared empty array when unknown. */
export const idsOnLevel = (normalized: NormalizedSpatial, levelId: LevelId): readonly EntityId[] =>
  normalized.byLevel[levelId] ?? NO_IDS;

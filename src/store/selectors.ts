/**
 * Memoized selectors over the store.
 *
 * Derived data — areas, violations, resolved selections — is never stored in a
 * slice; it is computed here by calling the domain functions that already
 * exist, and memoized so the canvas can call a selector on every frame:
 *
 * - a selector never allocates when its inputs did not change;
 * - a selector returning a collection keeps the previous reference whenever
 *   the fresh result is shallow-equal, so unrelated edits do not re-render
 *   subscribers;
 * - the rule pass is incremental: the runner is handed the previous
 *   `RuleRunState` plus the entities that changed, so editing a wall on one
 *   floor never re-evaluates the rules of another floor.
 */

import { computeArea, totalArea } from '../domain/rooms/area';
import type { Violation } from '../domain/rules/registry';
import {
  runRules,
  type ChangedEntity,
  type RuleRunState,
  type RuleTask,
} from '../domain/rules/runner';
import {
  isEntityOfKind,
  resolveLevelId,
  type NormalizedSpatial,
  type SpatialEntity,
} from '../domain/spatial/normalize';
import type { EntityId, LevelId, Point, Room } from '../domain/spatial/types';
import type { PointMm } from '../domain/units/compare';
import { millimetres, type SquareMetres } from '../domain/units/types';
import type { RootState } from './index';

/* -------------------------------------------------------------------------- */
/* Memoization helpers.                                                        */
/* -------------------------------------------------------------------------- */

/** Caches the latest call; the same inputs return the same result untouched. */
const memoizeLatest = <TArgs extends readonly unknown[], TResult>(
  compute: (...args: TArgs) => TResult,
): ((...args: TArgs) => TResult) => {
  let cachedArgs: TArgs | null = null;
  let cachedResult: TResult;

  return (...args: TArgs): TResult => {
    const previousArgs = cachedArgs;

    if (
      previousArgs !== null &&
      previousArgs.length === args.length &&
      args.every((arg, index) => Object.is(arg, previousArgs[index]))
    ) {
      return cachedResult;
    }

    cachedArgs = args;
    cachedResult = compute(...args);

    return cachedResult;
  };
};

/** Keeps the previous array when the fresh one is shallow-equal to it. */
const keepIfShallowEqualArray = <TItem>(
  previous: readonly TItem[] | null,
  next: readonly TItem[],
): readonly TItem[] => {
  if (previous === null || previous.length !== next.length) {
    return next;
  }

  return next.every((item, index) => Object.is(item, previous[index])) ? previous : next;
};

/** Keeps the previous record when the fresh one matches it field by field. */
const keepIfShallowEqualRecord = <TValue>(
  previous: Readonly<Record<string, TValue>> | null,
  next: Readonly<Record<string, TValue>>,
): Readonly<Record<string, TValue>> => {
  if (previous === null) {
    return next;
  }

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);

  if (previousKeys.length !== nextKeys.length) {
    return next;
  }

  return nextKeys.every((key) => Object.is(previous[key], next[key])) ? previous : next;
};

const EMPTY_ROOMS_WITH_AREA: readonly RoomWithArea[] = Object.freeze([]);
const EMPTY_VIOLATIONS: readonly Violation[] = Object.freeze([]);
const EMPTY_VIOLATIONS_BY_FLOOR: ViolationsByFloor = Object.freeze({});
const EMPTY_ENTITIES: readonly SpatialEntity[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* Rooms and areas.                                                            */
/* -------------------------------------------------------------------------- */

/** A room together with its area as the domain computes it from the outline. */
export interface RoomWithArea {
  readonly room: Room;
  readonly areaM2: SquareMetres;
}

const pointToMm = (point: Point): PointMm => ({ x: millimetres(point.x), y: millimetres(point.y) });

const outlineCache = new WeakMap<Room, readonly PointMm[]>();

const outlineOf = (room: Room): readonly PointMm[] => {
  let outline = outlineCache.get(room);

  if (outline === undefined) {
    outline = room.outline.map(pointToMm);
    outlineCache.set(room, outline);
  }

  return outline;
};

const roomEntryCache = new WeakMap<Room, RoomWithArea>();

const roomWithArea = (room: Room): RoomWithArea => {
  let entry = roomEntryCache.get(room);

  if (entry === undefined) {
    entry = { room, areaM2: computeArea(outlineOf(room)) };
    roomEntryCache.set(room, entry);
  }

  return entry;
};

let lastRoomsWithArea: readonly RoomWithArea[] | null = null;

const roomsWithAreaOf = memoizeLatest((spatial: NormalizedSpatial | null): readonly RoomWithArea[] => {
  if (spatial === null) {
    return EMPTY_ROOMS_WITH_AREA;
  }

  const entries: RoomWithArea[] = [];

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity !== undefined && isEntityOfKind('room', entity)) {
      entries.push(roomWithArea(entity));
    }
  }

  lastRoomsWithArea = keepIfShallowEqualArray(lastRoomsWithArea, entries);

  return lastRoomsWithArea;
});

/** Every room of the loaded floor, each with its computed area. */
export const selectRoomsWithArea = (state: RootState): readonly RoomWithArea[] =>
  roomsWithAreaOf(state.spatial);

const totalAreaOf = memoizeLatest((rooms: readonly RoomWithArea[]): SquareMetres =>
  totalArea(rooms.map((entry) => outlineOf(entry.room))),
);

/**
 * The total area of every room, summed in mm² and rounded once by the domain —
 * deliberately not the sum of the already-rounded per-room figures.
 */
export const selectTotalAreaM2 = (state: RootState): SquareMetres =>
  totalAreaOf(roomsWithAreaOf(state.spatial));

/* -------------------------------------------------------------------------- */
/* Violations.                                                                 */
/* -------------------------------------------------------------------------- */

/** Key under which building-scoped violations (no floor) are grouped. */
export const BUILDING_VIOLATIONS_KEY = 'building';

export type ViolationsByFloor = Readonly<Record<string, readonly Violation[]>>;

interface ViolationCache {
  readonly graph: NormalizedSpatial;
  readonly runState: RuleRunState;
  readonly violations: readonly Violation[];
  readonly byFloor: ViolationsByFloor;
  readonly evaluated: readonly RuleTask[];
  readonly reusedTaskCount: number;
}

let violationCache: ViolationCache | null = null;

/** Entities whose reference differs between two graphs, deletions included. */
const changedEntitiesBetween = (
  previous: NormalizedSpatial,
  next: NormalizedSpatial,
): ChangedEntity[] => {
  const changes: ChangedEntity[] = [];

  for (const [entityId, entity] of Object.entries(next.byId)) {
    if (previous.byId[entityId] !== entity) {
      changes.push({ entityId });
    }
  }

  for (const [entityId, entity] of Object.entries(previous.byId)) {
    if (next.byId[entityId] === undefined) {
      // A deleted entity can no longer be resolved from the new graph, so its
      // floor is read from the old one and reported explicitly.
      const levelId = isEntityOfKind('level', entity)
        ? entity.id
        : resolveLevelId(entity, previous.byId);

      changes.push(levelId === null ? { entityId } : { entityId, levelId });
    }
  }

  return changes;
};

const ensureViolations = (spatial: NormalizedSpatial): ViolationCache => {
  if (violationCache !== null && violationCache.graph === spatial) {
    return violationCache;
  }

  const previous = violationCache;
  const result =
    previous === null
      ? runRules(spatial)
      : runRules(spatial, {
          changes: changedEntitiesBetween(previous.graph, spatial),
          previous: previous.runState,
        });

  const grouped = new Map<string, Violation[]>();

  for (const violation of result.violations) {
    const key = violation.levelId ?? BUILDING_VIOLATIONS_KEY;
    const bucket = grouped.get(key);

    if (bucket === undefined) {
      grouped.set(key, [violation]);
    } else {
      bucket.push(violation);
    }
  }

  const byFloor: Record<string, readonly Violation[]> = {};

  for (const [key, bucket] of grouped) {
    byFloor[key] = keepIfShallowEqualArray(previous?.byFloor[key] ?? null, bucket);
  }

  violationCache = {
    byFloor: keepIfShallowEqualRecord(previous?.byFloor ?? null, byFloor),
    evaluated: result.evaluated,
    graph: spatial,
    reusedTaskCount: result.reusedTaskCount,
    runState: result.state,
    violations: keepIfShallowEqualArray(previous?.violations ?? null, result.violations),
  };

  return violationCache;
};

/** Every violation of the loaded data, in stable rule-book order. */
export const selectViolations = (state: RootState): readonly Violation[] =>
  state.spatial === null ? EMPTY_VIOLATIONS : ensureViolations(state.spatial).violations;

/** Violations grouped by floor; building-scoped ones sit under `BUILDING_VIOLATIONS_KEY`. */
export const selectViolationsByFloor = (state: RootState): ViolationsByFloor =>
  state.spatial === null ? EMPTY_VIOLATIONS_BY_FLOOR : ensureViolations(state.spatial).byFloor;

/** The violations of one floor; a shared frozen empty list when it has none. */
export const selectFloorViolations = (state: RootState, levelId: LevelId): readonly Violation[] =>
  selectViolationsByFloor(state)[levelId] ?? EMPTY_VIOLATIONS;

/* -------------------------------------------------------------------------- */
/* Selection.                                                                  */
/* -------------------------------------------------------------------------- */

let lastSelectedEntities: readonly SpatialEntity[] | null = null;

const selectedEntitiesOf = memoizeLatest(
  (spatial: NormalizedSpatial | null, selectedIds: readonly EntityId[]): readonly SpatialEntity[] => {
    if (spatial === null || selectedIds.length === 0) {
      return EMPTY_ENTITIES;
    }

    const entities: SpatialEntity[] = [];

    for (const id of selectedIds) {
      const entity = spatial.byId[id];

      if (entity !== undefined) {
        entities.push(entity);
      }
    }

    lastSelectedEntities = keepIfShallowEqualArray(lastSelectedEntities, entities);

    return lastSelectedEntities;
  },
);

/**
 * The selected entities in full, resolved from the ids the selection slice
 * stores. Ids pointing at nothing (just-deleted entities) are skipped.
 */
export const selectSelectedEntities = (state: RootState): readonly SpatialEntity[] =>
  selectedEntitiesOf(state.spatial, state.selectedIds);

/* -------------------------------------------------------------------------- */
/* Introspection.                                                              */
/* -------------------------------------------------------------------------- */

/** What the latest rule pass actually did; how tests prove floors were reused. */
export interface RuleRunDiagnostics {
  readonly evaluated: readonly RuleTask[];
  readonly reusedTaskCount: number;
}

export const getRuleRunDiagnostics = (): RuleRunDiagnostics | null =>
  violationCache === null
    ? null
    : { evaluated: violationCache.evaluated, reusedTaskCount: violationCache.reusedTaskCount };

/** Drops every module-level cache; for tests and hot reload only. */
export const resetSelectorCaches = (): void => {
  violationCache = null;
  lastRoomsWithArea = null;
  lastSelectedEntities = null;
};

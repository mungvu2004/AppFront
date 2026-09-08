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
import type { RuleConfig, RuleOverride, RuleThresholds } from '../domain/rules/config';
import { createDefaultRuleRegistry } from '../domain/rules/defaults';
import {
  createRuleRegistry,
  type Rule,
  type RuleCode,
  type RuleContext,
  type RuleRegistry,
  type Violation,
} from '../domain/rules/registry';
import {
  runRules,
  type ChangedEntity,
  type RunRulesOptions,
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
import { draftEntityId, type DraftOperation } from './draftSlice';
import type { RootState } from './index';
import { INITIAL_RULE_CONFIG } from './ruleConfigSlice';

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
const EMPTY_DRAFT_IDS: readonly EntityId[] = Object.freeze([]);

let lastDraftIds: readonly EntityId[] | null = null;

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
  /** Cấu hình bộ luật lượt chạy này đã dùng; nửa còn lại của khoá cache (Đ4). */
  readonly config: RuleConfig;
  readonly runState: RuleRunState;
  readonly violations: readonly Violation[];
  readonly byFloor: ViolationsByFloor;
  readonly evaluated: readonly RuleTask[];
  readonly reusedTaskCount: number;
}

let violationCache: ViolationCache | null = null;

/* -------------------------------------------------------------------------- */
/* Sổ luật mà một cấu hình mô tả.                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ngữ cảnh một luật đọc, kèm ngưỡng đã đè.
 *
 * Khai tại chỗ thay vì chờ `RuleContext` mọc thêm trường: một object thừa trường
 * vẫn gán được vào tham số `RuleContext`, nên bọc ở đây chạy cả trước lẫn sau
 * khi tầng domain nhận `thresholds` vào ngữ cảnh (quyết định Đ1). Luật nào chưa
 * đọc `context.thresholds` thì vẫn dùng hằng số của chính nó — đúng đường lui mà
 * Đ1 mô tả.
 */
type ThresholdContext = RuleContext & { readonly thresholds: RuleThresholds };

const EMPTY_THRESHOLDS: RuleThresholds = Object.freeze({});

/**
 * Một luật như cấu hình mô tả nó: mức nghiêm trọng đã đè, ngưỡng đã bơm vào.
 *
 * Không có gì để đè thì trả về ĐÚNG object cũ, không phải bản sao — sổ luật mặc
 * định giữ nguyên danh tính từng luật, nên lượt chạy sau vẫn so sánh tham chiếu
 * được với lượt chạy trước.
 */
const withOverride = (rule: Rule, override: RuleOverride | undefined): Rule => {
  if (override === undefined) {
    return rule;
  }

  const { severity, thresholds } = override;

  if (severity === undefined && thresholds === undefined) {
    return rule;
  }

  const applied: RuleThresholds = thresholds ?? EMPTY_THRESHOLDS;

  return {
    ...rule,
    severity: severity ?? rule.severity,
    check: (context) => {
      const withThresholds: ThresholdContext = { ...context, thresholds: applied };

      return rule.check(withThresholds);
    },
  };
};

/**
 * Sổ luật để chạy một cấu hình.
 *
 * `null` nghĩa là "không đè gì cả" ⇒ người gọi để `runRules` dùng sổ chung, y
 * như trước khi màn cài đặt tồn tại. Đây là lý do một dự án chưa ai chỉnh luật
 * không phải trả thêm một lượt dựng sổ nào.
 *
 * Sổ được dựng MỚI mỗi lần cấu hình đổi, không phải `setEnabled` lên sổ chung:
 * sổ chung là singleton toàn tiến trình, ghi vào nó thì không hoàn tác được và
 * rò sang mọi người đọc khác (quyết định Đ3).
 */
const buildRegistry = (config: RuleConfig): RuleRegistry | null => {
  const codes = Object.keys(config.overrides);

  if (codes.length === 0) {
    return null;
  }

  const base = createDefaultRuleRegistry();
  const rules = base.list();
  const registry = createRuleRegistry(
    rules.map((rule) => withOverride(rule, config.overrides[rule.code])),
  );

  for (const rule of rules) {
    // Luật không bị đè giữ nguyên trạng thái mặc định của nó — đó là cách hai
    // luật bị thay thế (ROOM-HAS-DOOR, ROOM-MIN-AREA) ở yên chỗ đã tắt.
    registry.setEnabled(rule.code, config.overrides[rule.code]?.enabled ?? base.isEnabled(rule.code));
  }

  return registry;
};

const registryOf = memoizeLatest(buildRegistry);

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

/**
 * Khoá cache của quyết định Đ4: mô hình không gian VÀ cấu hình bộ luật.
 *
 * Trước đây chỉ có nửa đầu, và nửa thiếu là một lỗi câm: đổi cấu hình luật không
 * đụng vào `spatial`, nên `graph === spatial` vẫn đúng và mảng vi phạm cũ được
 * trả lại nguyên vẹn. Màn cài đặt in ra hai con số bằng nhau trước và sau khi
 * tắt một luật, không có lỗi nào để đọc.
 *
 * So cả danh tính object lẫn `version`: `version` là khoá hợp đồng nêu, còn
 * danh tính bắt thêm được trường hợp một lượt ghi quên tăng version — vẫn là một
 * hỏng hóc không phát ra tiếng nào.
 */
const isFresh = (
  cache: ViolationCache,
  spatial: NormalizedSpatial,
  config: RuleConfig,
): boolean =>
  cache.graph === spatial && cache.config === config && cache.config.version === config.version;

const ensureViolations = (spatial: NormalizedSpatial, config: RuleConfig): ViolationCache => {
  if (violationCache !== null && isFresh(violationCache, spatial, config)) {
    return violationCache;
  }

  const previous = violationCache;
  const registry = registryOf(config);
  // `exactOptionalPropertyTypes` không cho đặt `registry: undefined`: một cấu
  // hình không đè gì phải BỎ TRỐNG trường ấy để `runRules` dùng sổ chung.
  const options: RunRulesOptions = registry === null ? {} : { registry };
  // Đổi cấu hình làm MỌI kết quả cũ hết hạn, kể cả của luật không bị đụng tới:
  // chạy tăng dần dựa trên "đối tượng nào đổi", mà ở đây không đối tượng nào
  // đổi. Tái dùng `runState` lúc này chính là trả về đúng con số cũ.
  const result =
    previous === null || previous.config !== config
      ? runRules(spatial, options)
      : runRules(spatial, {
          ...options,
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
    config,
    evaluated: result.evaluated,
    graph: spatial,
    reusedTaskCount: result.reusedTaskCount,
    runState: result.state,
    violations: keepIfShallowEqualArray(previous?.violations ?? null, result.violations),
  };

  return violationCache;
};

/**
 * Cấu hình bộ luật đang áp.
 *
 * Đường lui về {@link INITIAL_RULE_CONFIG} là để một bộ kiểm thay nguyên trạng
 * thái store bằng một object dựng tay vẫn đọc được vi phạm, thay vì ngã ở
 * `config.overrides` của `undefined`.
 */
export const selectRuleConfig = (state: RootState): RuleConfig =>
  state.ruleConfig ?? INITIAL_RULE_CONFIG;

/** Every violation of the loaded data, in stable rule-book order. */
export const selectViolations = (state: RootState): readonly Violation[] =>
  state.spatial === null
    ? EMPTY_VIOLATIONS
    : ensureViolations(state.spatial, selectRuleConfig(state)).violations;

/** Violations grouped by floor; building-scoped ones sit under `BUILDING_VIOLATIONS_KEY`. */
export const selectViolationsByFloor = (state: RootState): ViolationsByFloor =>
  state.spatial === null
    ? EMPTY_VIOLATIONS_BY_FLOOR
    : ensureViolations(state.spatial, selectRuleConfig(state)).byFloor;

/** The violations of one floor; a shared frozen empty list when it has none. */
export const selectFloorViolations = (state: RootState, levelId: LevelId): readonly Violation[] =>
  selectViolationsByFloor(state)[levelId] ?? EMPTY_VIOLATIONS;

let allRuleCodes: readonly RuleCode[] | null = null;
let lastImpactCounts: Readonly<Record<RuleCode, number>> | null = null;

/** Mọi mã luật trong sổ mặc định; cấu hình chỉ bật/tắt chúng, không thêm bớt. */
const ruleCodes = (): readonly RuleCode[] => {
  if (allRuleCodes === null) {
    allRuleCodes = createDefaultRuleRegistry()
      .list()
      .map((rule) => rule.code);
  }

  return allRuleCodes;
};

const impactCountsOf = memoizeLatest(
  (violations: readonly Violation[]): Readonly<Record<RuleCode, number>> => {
    const counts: Record<RuleCode, number> = {};

    for (const code of ruleCodes()) {
      counts[code] = 0;
    }

    for (const violation of violations) {
      counts[violation.ruleCode] = (counts[violation.ruleCode] ?? 0) + 1;
    }

    return counts;
  },
);

/**
 * Mỗi luật đang ảnh hưởng bao nhiêu đối tượng.
 *
 * Đủ mọi mã luật trong sổ, kể cả luật đang tắt và luật không tìm thấy gì — chúng
 * mang số 0. Bộ khoá cố định là thứ làm cho {@link keepIfShallowEqualRecord} có
 * việc: hai lượt đọc liên tiếp trả về đúng một object, nên một dòng luật không
 * vẽ lại chỉ vì một dòng khác đổi số.
 */
export const selectRuleImpactCounts = (state: RootState): Readonly<Record<RuleCode, number>> => {
  const counts = impactCountsOf(selectViolations(state));

  lastImpactCounts = keepIfShallowEqualRecord(lastImpactCounts, counts);

  return lastImpactCounts;
};

/** Tổng số vi phạm — con số chạy số ở đầu màn cài đặt. */
export const selectTotalViolationCount = (state: RootState): number =>
  selectViolations(state).length;

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
/* Draft: the unconfirmed edit, read as a graph.                               */
/* -------------------------------------------------------------------------- */

/**
 * The saved graph with the staged operations laid over it.
 *
 * A draft carries whole entities (`draftSlice`), so laying one over the graph is
 * a replacement in `byId` and nothing else: no index is rebuilt, because a
 * preview never changes what kind a thing is nor which storey it stands on — it
 * is the same wall, thicker. That is what makes this cheap enough to run on
 * every frame of a drag.
 *
 * `null` when nothing is staged, and that is the answer a consumer wants: it
 * says "there is no preview" without asking the consumer to compare two graphs
 * to find out. The saved graph is never mutated and never re-normalized, so the
 * real one keeps its identity and nothing downstream of `state.spatial`
 * re-renders because somebody previewed something.
 *
 * A create-draft is skipped here rather than added to the graph: nothing in the
 * product stages one yet, and inventing an index entry for an entity that has
 * no saved counterpart would be writing a path no caller walks.
 */
const draftGraphOf = memoizeLatest(
  (
    spatial: RootState['spatial'],
    operations: readonly DraftOperation[],
  ): RootState['spatial'] => {
    if (spatial === null || operations.length === 0) {
      return null;
    }

    const byId: Record<string, SpatialEntity> = { ...spatial.byId };
    let replaced = 0;

    for (const operation of operations) {
      if (operation.kind !== 'editEntity' || byId[operation.entityId] === undefined) {
        continue;
      }

      byId[operation.entityId] = operation.preview;
      replaced += 1;
    }

    return replaced === 0 ? null : { ...spatial, byId };
  },
);

/**
 * The saved graph with the unconfirmed edit applied, or `null` when there is
 * none — the graph a 3D preview draws from.
 */
export const selectDraftPreviewGraph = (state: RootState): RootState['spatial'] =>
  draftGraphOf(state.spatial, state.draftOperations);

const draftIdsOf = memoizeLatest(
  (operations: readonly DraftOperation[]): readonly EntityId[] => {
    if (operations.length === 0) {
      return EMPTY_DRAFT_IDS;
    }

    const ids = operations.map(draftEntityId);

    lastDraftIds = keepIfShallowEqualArray(lastDraftIds, ids);

    return lastDraftIds;
  },
);

/** Which entities the staged operations are about, in the order they were made. */
export const selectDraftEntityIds = (state: RootState): readonly EntityId[] =>
  draftIdsOf(state.draftOperations);

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
  lastDraftIds = null;
  lastImpactCounts = null;
};

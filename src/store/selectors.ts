/**
 * Selector của bộ luật: chạy `runRules` một lượt tăng dần rồi nhớ kết quả.
 *
 * Dữ liệu dẫn xuất không bao giờ nằm trong slice; nó được tính ở đây bằng những
 * hàm domain đã có, và được ghi nhớ để canvas gọi được mỗi khung hình:
 *
 * - một selector không cấp phát khi đầu vào không đổi;
 * - một selector trả về tập hợp giữ nguyên tham chiếu cũ khi kết quả mới bằng
 *   nông với nó, nên một sửa đổi không liên quan không làm người nghe vẽ lại;
 * - lượt chạy luật là tăng dần: runner nhận `RuleRunState` cũ cộng danh sách đối
 *   tượng đã đổi, nên sửa một bức tường ở tầng này không chạy lại luật tầng kia.
 *
 * ## File này chỉ còn phần LUẬT
 *
 * Phần đọc đồ thị — diện tích phòng, đối tượng đang chọn, bản nháp — đã sang
 * `./graphSelectors.ts` và được tái xuất ở cuối file này, nên mọi đường nhập cũ
 * (`@/store/selectors`) giữ nguyên. Lý do tách ghi ở đầu file kia: nhập file này
 * là nhập cả `domain/rules/runner`, và một màn chỉ vẽ hình không nên trả tiền
 * cho engine luật. Màn chỉ đọc đồ thị thì nhập thẳng `@/store/graphSelectors`.
 */

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
} from '../domain/spatial/normalize';
import type { LevelId } from '../domain/spatial/types';
import { resetGraphSelectorCaches } from './graphSelectors';
import type { RootState } from './index';
import { keepIfShallowEqualArray, keepIfShallowEqualRecord, memoizeLatest } from './memoize';
import { INITIAL_RULE_CONFIG } from './ruleConfigSlice';

const EMPTY_VIOLATIONS: readonly Violation[] = Object.freeze([]);
const EMPTY_VIOLATIONS_BY_FLOOR: ViolationsByFloor = Object.freeze({});

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
  lastImpactCounts = null;
  resetGraphSelectorCaches();
};

/* -------------------------------------------------------------------------- */
/* Tái xuất phần đọc đồ thị.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Đường nhập cũ giữ nguyên: `@/store/selectors` vẫn trả về đủ mọi selector.
 *
 * Tái xuất một chiều — file này nhập `./graphSelectors`, không bao giờ ngược
 * lại. Nơi gọi nào chỉ cần phần đồ thị thì nhập thẳng `@/store/graphSelectors`
 * để không kéo theo engine luật.
 */
export type { RoomWithArea } from './graphSelectors';
export {
  selectDraftEntityIds,
  selectDraftPreviewGraph,
  selectRoomsWithArea,
  selectSelectedEntities,
  selectTotalAreaM2,
} from './graphSelectors';

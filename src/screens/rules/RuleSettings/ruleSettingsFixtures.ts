/**
 * Dữ liệu mẫu dùng chung cho `RuleSettings.test.tsx` và `RuleSettings.stories.tsx`.
 *
 * Khuôn theo `RuleReport` (S-33): số luật và số đối tượng bị ảnh hưởng không viết
 * tay, mà tính từ sổ đăng ký luật thật (`ALL_RULES`, `createDefaultRuleRegistry`)
 * và một lượt `runRules()` thật trên bộ mẫu chuẩn A14
 * (`VIOLATED_BUILDING_SCENARIO`) — R-70 cấm bịa dữ liệu mẫu tại chỗ. Chỉ có ba thứ
 * ở đây KHÔNG lấy từ một hệ thống thật, vì hệ thống đó chưa tồn tại trong domain:
 * mô tả từng dòng luật, hai ngưỡng cấu hình được (bề dày tường / bề rộng cửa) và ba
 * bộ luật sẵn theo loại công trình — cả ba đều là quyết định hiển thị của màn này,
 * không phải số liệu có thể tính sai.
 *
 * `enabled` của mỗi dòng lấy đúng từ `createDefaultRuleRegistry()`: 23 luật bật,
 * `ROOM-HAS-DOOR` và `ROOM-MIN-AREA` tắt vì bị nhóm `function` thay thế — khớp
 * `SUPERSEDED_BY` bên dưới với `SUPERSEDED_BUILT_IN_CODES` của
 * `src/domain/rules/function/index.ts`.
 */

import {
  ALL_RULES,
  createDefaultRuleRegistry,
} from '@/domain/rules/defaults';
import { JOINT_TOLERANCE_MM, PARALLEL_ANGLE_DEG } from '@/domain/rules/geometry';
import {
  createRuleRegistry,
  MIN_DOOR_WIDTH_MM,
  MIN_WALL_THICKNESS_MM,
  RULE_GROUPS,
  RULE_GROUP_LABELS,
  RULE_SEVERITY_LABELS,
  type Rule,
  type RuleCode,
} from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { formatNumber } from '@/lib/format/number';
import { VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';

import type {
  BuildingKind,
  RuleSettingsActions,
  RuleSettingsCapabilities,
  RuleSettingsGroup,
  RuleSettingsPresetOption,
  RuleSettingsProps,
  RuleSettingsRow,
  RuleSettingsStatus,
  RuleSettingsThreshold,
  RuleSettingsViewModel,
} from './types';

/* ==========================================================================
 * 0. Số thật từ sổ đăng ký — không viết tay 25 hay 23 ở đâu khác.
 * ========================================================================== */

const DEFAULT_REGISTRY = createDefaultRuleRegistry();

/** Đăng ký cả 25 luật, không tắt hai luật bị thay thế — để đo "sẽ ảnh hưởng bao nhiêu nếu bật". */
const ALL_ENABLED_REGISTRY = createRuleRegistry(ALL_RULES);

const NORMALIZED_VIOLATED = normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph);
const IMPACT_RESULT = runRules(NORMALIZED_VIOLATED, { registry: ALL_ENABLED_REGISTRY });

/** Tổng số luật trong sổ đăng ký: 25. */
export const RULE_SETTINGS_TOTAL_RULE_COUNT = ALL_RULES.length;

/** Số luật đang bật theo mặc định: 23 (hai luật bị nhóm function thay thế). */
export const RULE_SETTINGS_ENABLED_RULE_COUNT = DEFAULT_REGISTRY.listEnabled().length;

function impactCountOf(code: RuleCode): number {
  return IMPACT_RESULT.violations.filter((violation) => violation.ruleCode === code).length;
}

/** Mã luật đã thay thế → mã luật fuller hơn của nhóm `function` (chỉ hai luật có giá trị). */
const SUPERSEDED_BY: Readonly<Partial<Record<RuleCode, RuleCode>>> = {
  'ROOM-HAS-DOOR': 'ROOM-NO-DOOR',
  'ROOM-MIN-AREA': 'ROOM-AREA-BELOW-MINIMUM',
};

/* ==========================================================================
 * 1. Ngưỡng — hai luật cấu hình được, cộng "Ngưỡng chung".
 * ========================================================================== */

function thresholdsFor(code: RuleCode): readonly RuleSettingsThreshold[] {
  if (code === 'WALL-THICKNESS') {
    return [
      {
        key: 'minThicknessMm',
        label: 'bề dày tường tối thiểu',
        unit: 'mm',
        value: MIN_WALL_THICKNESS_MM,
        min: 10,
        max: 200,
        step: 5,
        error: null,
      },
    ];
  }

  if (code === 'DOOR-WIDTH') {
    return [
      {
        key: 'minDoorWidthMm',
        label: 'bề rộng cửa tối thiểu',
        unit: 'mm',
        value: MIN_DOOR_WIDTH_MM,
        min: 600,
        max: 1200,
        step: 10,
        error: null,
      },
    ];
  }

  return [];
}

/** Thẻ "Ngưỡng chung" — dung sai hình học của nhóm `geometry`, dùng chung cho nhiều luật. */
export const GENERAL_THRESHOLDS: readonly RuleSettingsThreshold[] = [
  {
    key: 'jointToleranceMm',
    label: 'dung sai nối đầu tường',
    unit: 'mm',
    value: JOINT_TOLERANCE_MM,
    min: 10,
    max: 150,
    step: 5,
    error: null,
  },
  {
    key: 'parallelAngleDeg',
    label: 'dung sai góc song song',
    unit: '°',
    value: PARALLEL_ANGLE_DEG,
    min: 1,
    max: 15,
    step: 1,
    error: null,
  },
];

/**
 * Bản sao của ngưỡng "bề dày tường tối thiểu", với giá trị NGOÀI khoảng hợp lệ và
 * câu lỗi đã giải xong — nêu đúng cả hai đầu số (10 và 200). Dùng cho test kiểm
 * ô ngưỡng chặn giá trị sai (mục 2.(b).6).
 */
export const WALL_THICKNESS_THRESHOLD_OUT_OF_RANGE: RuleSettingsThreshold = {
  key: 'minThicknessMm',
  label: 'bề dày tường tối thiểu',
  unit: 'mm',
  value: 500,
  min: 10,
  max: 200,
  step: 5,
  error: 'Giá trị phải nằm trong khoảng 10 đến 200 mm.',
};

/* ==========================================================================
 * 2. Dòng luật và nhóm luật.
 * ========================================================================== */

/** Cách impactCaption được tính từ impactCount, theo đúng chú thích của types.ts. */
const NO_MODEL_IMPACT_CAPTION = 'Chưa có dữ liệu để đánh giá';
const LOADING_IMPACT_CAPTION = 'Đang tải dữ liệu…';

export type ImpactMode = 'real' | 'noModel' | 'loading';

function impactCaptionFor(mode: ImpactMode, count: number | null): string {
  if (mode === 'loading') {
    return LOADING_IMPACT_CAPTION;
  }

  if (mode === 'noModel' || count === null) {
    return NO_MODEL_IMPACT_CAPTION;
  }

  return `Đang ảnh hưởng ${formatNumber(count, { fractionDigits: 0 })} đối tượng`;
}

interface RowOptions {
  readonly impactMode: ImpactMode;
  readonly allDisabled: boolean;
}

function toRow(rule: Rule, options: RowOptions): RuleSettingsRow {
  const impactCount = options.impactMode === 'real' ? impactCountOf(rule.code) : null;

  return {
    code: rule.code,
    sentence: rule.name,
    description: `${RULE_GROUP_LABELS[rule.group]} · mức ${RULE_SEVERITY_LABELS[rule.severity]}.`,
    enabled: options.allDisabled ? false : DEFAULT_REGISTRY.isEnabled(rule.code),
    severity: rule.severity,
    thresholds: thresholdsFor(rule.code),
    impactCaption: impactCaptionFor(options.impactMode, impactCount),
    impactCount,
    supersededBy: SUPERSEDED_BY[rule.code] ?? null,
  };
}

export interface BuildGroupsOptions {
  readonly impactMode?: ImpactMode;
  readonly allDisabled?: boolean;
}

/** Đủ 25 luật, nhóm theo `RULE_GROUPS` — không viết tay danh sách luật ở đây, đọc thẳng `ALL_RULES`. */
export function buildRuleSettingsGroups(options: BuildGroupsOptions = {}): readonly RuleSettingsGroup[] {
  const impactMode = options.impactMode ?? 'real';
  const allDisabled = options.allDisabled ?? false;

  return RULE_GROUPS.map((group) => {
    const rows = ALL_RULES.filter((rule) => rule.group === group).map((rule) =>
      toRow(rule, { impactMode, allDisabled }),
    );

    return {
      group,
      label: RULE_GROUP_LABELS[group],
      description: `Các luật về ${RULE_GROUP_LABELS[group]}.`,
      enabled: rows.some((row) => row.enabled),
      rows,
    };
  });
}

/** Nhóm luật đầy đủ, đã tính impact thật — dùng cho hầu hết bảy trạng thái. */
export const READY_GROUPS: readonly RuleSettingsGroup[] = buildRuleSettingsGroups();

/** Nhóm luật khi chưa có mô hình — mọi impactCaption là "Chưa có dữ liệu để đánh giá". */
export const NO_MODEL_GROUPS: readonly RuleSettingsGroup[] = buildRuleSettingsGroups({
  impactMode: 'noModel',
});

/* ==========================================================================
 * 3. Bộ luật sẵn theo loại công trình.
 * ========================================================================== */

export const PRESET_OPTIONS: readonly RuleSettingsPresetOption[] = [
  {
    kind: 'residential',
    label: 'Nhà ở',
    caption: 'Giữ nguyên 23 luật mặc định cho nhà ở, không tắt thêm luật nào.',
    changedRuleCount: 0,
  },
  {
    kind: 'commercial',
    label: 'Thương mại',
    caption: 'Tắt 3 luật về đồ đạc và ghi chú, giữ nguyên luật an toàn thoát nạn.',
    changedRuleCount: 3,
  },
  {
    kind: 'industrial',
    label: 'Nhà xưởng',
    caption: 'Tắt 5 luật về diện tích ở và cửa sổ, không áp dụng cho nhà xưởng.',
    changedRuleCount: 5,
  },
];

function presetOf(kind: BuildingKind): RuleSettingsPresetOption {
  const preset = PRESET_OPTIONS.find((candidate) => candidate.kind === kind);

  if (preset === undefined) {
    throw new Error(`không tìm thấy bộ luật sẵn cho loại công trình "${kind}"`);
  }

  return preset;
}

/** Bộ luật sẵn cho nhà xưởng — dùng trong test áp preset (mục 2.(b).7). */
export const INDUSTRIAL_PRESET: RuleSettingsPresetOption = presetOf('industrial');

/* ==========================================================================
 * 4. Năng lực.
 * ========================================================================== */

export const EDITABLE_CAPABILITIES: RuleSettingsCapabilities = {
  canEditRules: true,
  canApplyPreset: true,
  readOnlyReason: null,
};

/** Chỉ đọc — câu lý do nêu rõ AI được đổi (mục 2.(a) forbidden). */
export const READ_ONLY_CAPABILITIES: RuleSettingsCapabilities = {
  canEditRules: false,
  canApplyPreset: false,
  readOnlyReason: 'Chỉ chủ dự án hoặc quản trị viên được đổi cài đặt bộ luật này.',
};

/* ==========================================================================
 * 5. Câu cảnh báo và câu lỗi dùng chung.
 * ========================================================================== */

export const ALL_DISABLED_WARNING =
  'Tắt hết luật thì bản vẽ không còn được kiểm tra gì nữa — mọi vi phạm sẽ trôi qua mà không ai biết.';

export const LOAD_ERROR_MESSAGE = 'Không tải được cài đặt bộ luật. Thử lại sau ít phút.';

/* ==========================================================================
 * 6. Mô hình hoàn chỉnh, theo trạng thái.
 * ========================================================================== */

const SAVED_CAPTION = 'Đã lưu lúc 14:32';
const SAVING_CAPTION = 'Đang lưu…';

export interface BuildModelOptions {
  readonly status: RuleSettingsStatus;
  /** Ghi đè impact mode mặc định của trạng thái — hiếm khi cần. */
  readonly impactMode?: ImpactMode;
  /** Tắt sạch cả 25 luật — dùng cho test cảnh báo hậu quả (mục 2.(b).4). */
  readonly allDisabled?: boolean;
}

function defaultImpactModeFor(status: RuleSettingsStatus): ImpactMode {
  if (status === 'empty') {
    return 'noModel';
  }

  if (status === 'loading') {
    return 'loading';
  }

  return 'real';
}

/** Mọi thứ view cần để vẽ, cho một trạng thái cụ thể — không tính thêm gì ở view. */
export function buildRuleSettingsModel(options: BuildModelOptions): RuleSettingsViewModel {
  const { status } = options;
  const allDisabled = options.allDisabled ?? false;
  const hasList = status !== 'loading' && status !== 'error';
  const impactMode = options.impactMode ?? defaultImpactModeFor(status);

  const groups = hasList ? buildRuleSettingsGroups({ impactMode, allDisabled }) : [];
  const enabledRuleCount = groups.reduce(
    (total, group) => total + group.rows.filter((row) => row.enabled).length,
    0,
  );

  const isSaving = status === 'partial';
  const isSaved = status === 'ready' || status === 'forbidden' || status === 'collapsed';

  return {
    status,
    groups,
    generalThresholds: hasList ? GENERAL_THRESHOLDS : [],
    presets: PRESET_OPTIONS,
    isDefault: !allDisabled,
    saveState: isSaving ? 'saving' : isSaved ? 'saved' : 'idle',
    saveCaption: isSaving ? SAVING_CAPTION : isSaved ? SAVED_CAPTION : '',
    totalRuleCount: RULE_SETTINGS_TOTAL_RULE_COUNT,
    enabledRuleCount,
    disableAllWarning: allDisabled ? ALL_DISABLED_WARNING : null,
    errorMessage: status === 'error' ? LOAD_ERROR_MESSAGE : null,
  };
}

/* ==========================================================================
 * 7. Hành động không làm gì — mỗi test tự ghi đè bằng `vi.fn()` khi cần.
 * ========================================================================== */

export const NOOP_RULE_SETTINGS_ACTIONS: RuleSettingsActions = {
  onToggleRule: () => undefined,
  onToggleGroup: () => undefined,
  onChangeSeverity: () => undefined,
  onChangeThreshold: () => undefined,
  onChangeGeneralThreshold: () => undefined,
  onApplyPreset: () => undefined,
  onRestoreDefaults: () => undefined,
};

export interface BuildPropsOverrides {
  readonly capabilities?: RuleSettingsCapabilities;
  readonly actions?: Partial<RuleSettingsActions>;
}

/** Một `RuleSettingsProps` hợp lệ cho một trạng thái cụ thể. */
export function buildRuleSettingsProps(
  modelOptions: BuildModelOptions,
  overrides: BuildPropsOverrides = {},
): RuleSettingsProps {
  return {
    model: buildRuleSettingsModel(modelOptions),
    capabilities: overrides.capabilities ?? EDITABLE_CAPABILITIES,
    ...NOOP_RULE_SETTINGS_ACTIONS,
    ...overrides.actions,
  };
}

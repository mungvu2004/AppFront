/**
 * Rule presets by building type.
 *
 * A project's rule configuration is data (see `config.ts`), and these three
 * `RulePreset`s are the built-in starting points a project settings screen
 * offers: what "nhà ở" (residential), "văn phòng" (commercial) and "nhà xưởng"
 * (industrial) mean in terms of that data, plus `diffPreset` to show the
 * consequence of applying one before it is committed.
 *
 * Each threshold override below is located by matching `RULE_THRESHOLD_SPECS`
 * against the *current running constant* for that rule (the numbers in the
 * contract's threshold table), not by a hardcoded spec key — `config.ts`
 * chooses its own key strings, and this file has no business guessing them.
 * `defaultValue` is contractually required to equal that running constant, so
 * matching on it is exact, not a heuristic.
 */
import type { RuleCode } from './registry';
import { defaultRuleRegistry } from './defaults';
import {
  EMPTY_RULE_CONFIG,
  resolveRules,
  setRuleEnabled,
  setRuleSeverity,
  setRuleThreshold,
  thresholdSpecsFor,
  type RuleConfig,
  type RuleThresholds,
} from './config';

export type BuildingKind = 'residential' | 'commercial' | 'industrial';

export interface RulePreset {
  readonly kind: BuildingKind;
  readonly label: string;
  readonly caption: string;
  readonly config: RuleConfig;
}

export interface PresetDiff {
  readonly changedRuleCount: number;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly thresholdCount: number;
  readonly changedCodes: readonly RuleCode[];
}

/**
 * Finds the threshold spec for `code` whose `defaultValue` matches the
 * running constant `currentDefault` (e.g. `MIN_WALL_THICKNESS_MM = 60`).
 * A rule can own more than one threshold (`WALL-THICKNESS` has a min *and* a
 * max), so matching by value rather than position picks the right one.
 */
function thresholdByDefault(code: RuleCode, currentDefault: number) {
  const spec = thresholdSpecsFor(code).find((candidate) => candidate.defaultValue === currentDefault);

  if (spec === undefined) {
    throw new Error(
      `presets.ts: không tìm thấy ngưỡng mặc định ${currentDefault} cho luật ${code} trong RULE_THRESHOLD_SPECS`,
    );
  }

  return spec;
}

/** Sets a threshold to `target`, clamped to the spec's own valid range. */
function withTightenedThreshold(
  config: RuleConfig,
  code: RuleCode,
  currentDefault: number,
  target: number,
): RuleConfig {
  const spec = thresholdByDefault(code, currentDefault);
  const clamped = Math.min(spec.max, Math.max(spec.min, target));

  return setRuleThreshold(config, code, spec.key, clamped);
}

/**
 * Nhà ở: giữ nguyên toàn bộ. Bảng diện tích tối thiểu hiện hành
 * (`MIN_ROOM_AREA_M2`: phòng khách, phòng ngủ, bếp, phòng tắm) và yêu cầu cửa
 * sổ của `ROOM-NO-WINDOW` đã được hiệu chỉnh sẵn theo phòng ở — đây chính là
 * "hằng số đang chạy hôm nay", nên bộ này không có gì để đổi.
 */
const RESIDENTIAL_CONFIG: RuleConfig = EMPTY_RULE_CONFIG;

/**
 * Văn phòng: nới một cảnh báo hay báo giả, siết hai ngưỡng lưu thông cho mật
 * độ người cao hơn nhà ở.
 */
function buildCommercialConfig(): RuleConfig {
  let config = EMPTY_RULE_CONFIG;

  // Phòng họp nội bộ trong văn phòng thường cố ý không có cửa sổ (lõi PCCC,
  // phòng máy chiếu, phòng điện) — đó là cách bố trí bình thường, không phải
  // lỗi, nên hạ từ "cảnh báo" xuống "gợi ý" để không tạo nhiễu trên mọi mặt
  // bằng văn phòng thật.
  config = setRuleSeverity(config, 'ROOM-NO-WINDOW', 'suggestion');

  // Hành lang văn phòng đông người vào giờ cao điểm hơn hành lang nhà ở
  // (900mm), cần rộng hơn để dòng người không ùn ứ.
  config = withTightenedThreshold(config, 'CORRIDOR-WIDTH', 900, 1200);

  // Cùng lý do lưu lượng người cao: khoảng trống trước cửa để cánh cửa mở hết
  // cỡ mà không chặn lối đi cần rộng hơn mức nhà ở (750mm).
  config = withTightenedThreshold(config, 'DOOR-BLOCKS-PATH', 750, 900);

  return config;
}

/**
 * Nhà xưởng: tắt các luật chỉ có nghĩa với phòng ở, siết ngưỡng thoát nạn, lỗ
 * thông (cửa/lối đi) và chịu lực — đúng bối cảnh một dự án nhà xưởng đang cấu
 * hình, nơi luật về phòng ngủ hoàn toàn không liên quan.
 */
function buildIndustrialConfig(): RuleConfig {
  let config = EMPTY_RULE_CONFIG;

  // Ngưỡng diện tích tối thiểu tra theo công năng phòng ở (phòng khách, phòng
  // ngủ, bếp, phòng tắm) — nhà xưởng không có các công năng này nên luật chỉ
  // sinh báo giả.
  config = setRuleEnabled(config, 'ROOM-AREA-BELOW-MINIMUM', false);

  // Chỉ phòng ở (khách, ngủ) mới bắt buộc cửa sổ lấy sáng tự nhiên trong bảng
  // `USAGE_REQUIREMENTS`; nhà xưởng dùng chiếu sáng và thông gió cơ khí.
  config = setRuleEnabled(config, 'ROOM-NO-WINDOW', false);

  // Bảng đồ đạc-công năng chỉ phân biệt bếp/phòng ngủ/phòng khách/phòng tắm;
  // nhà xưởng không có các công năng đó nên không có gì để so khớp.
  config = setRuleEnabled(config, 'ROOM-FURNITURE-MISMATCH', false);

  // Lối đi trong xưởng phải đủ rộng cho xe nâng và dòng người thoát hiểm đông
  // hơn nhiều so với hành lang nhà ở (900mm).
  config = withTightenedThreshold(config, 'CORRIDOR-WIDTH', 900, 1500);

  // Cửa xưởng phải đủ rộng cho máy móc/hàng hoá ra vào lẫn dòng người thoát
  // hiểm, rộng hơn cửa đi nhà ở (700mm).
  config = withTightenedThreshold(config, 'DOOR-WIDTH', 700, 1200);
  // Cửa hẹp cản trở thoát hiểm và xe nâng — nâng từ "cảnh báo" lên "nghiêm
  // trọng".
  config = setRuleSeverity(config, 'DOOR-WIDTH', 'critical');

  // Mặt bằng xưởng thường rộng và trải dài; khoảng cách thoát nạn cho phép
  // phải ngắn hơn nhà ở (30000mm) để không ai bị kẹt quá xa lối ra.
  config = withTightenedThreshold(config, 'ESCAPE-DISTANCE', 30000, 20000);

  // Tường chịu lực nhà xưởng đỡ tải trọng lớn hơn nhà ở (mái thép nhịp lớn,
  // cầu trục), cần dày tối thiểu lớn hơn (60mm).
  config = withTightenedThreshold(config, 'WALL-THICKNESS', 60, 200);
  // Sai lệch bề dày tường ảnh hưởng trực tiếp an toàn kết cấu chịu tải công
  // nghiệp — nâng từ "cảnh báo" lên "nghiêm trọng".
  config = setRuleSeverity(config, 'WALL-THICKNESS', 'critical');

  // Kết cấu chịu lực trong xưởng cần điểm tựa gần như toàn phần để đỡ tải
  // trọng công nghiệp — siết từ 80% lên 95%.
  config = withTightenedThreshold(config, 'WALL-UNSUPPORTED', 0.8, 0.95);

  return config;
}

export const RULE_PRESETS: readonly RulePreset[] = [
  {
    kind: 'residential',
    label: 'nhà ở',
    caption: 'giữ nguyên mọi luật và ngưỡng mặc định vì bộ mặc định vốn được hiệu chỉnh cho nhà ở.',
    config: RESIDENTIAL_CONFIG,
  },
  {
    kind: 'commercial',
    label: 'văn phòng',
    caption:
      'hạ mức phòng không cửa sổ xuống gợi ý, siết bề rộng hành lang và khoảng trống trước cửa cho mật độ người văn phòng.',
    config: buildCommercialConfig(),
  },
  {
    kind: 'industrial',
    label: 'nhà xưởng',
    caption:
      'tắt các luật về phòng ở (diện tích, cửa sổ, đồ đạc), siết ngưỡng thoát nạn, bề rộng cửa/lối đi và bề dày tường chịu lực.',
    config: buildIndustrialConfig(),
  },
];

function thresholdsEqual(a: RuleThresholds, b: RuleThresholds): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Counts exactly how many rules would change if `preset` were applied on top
 * of `current` — this is what a "show the consequence before you commit"
 * screen renders, so the count must match what `resolveRules` would actually
 * produce, not an approximation over raw override objects. Resolving against
 * the shared default registry is what lets this function see the *effective*
 * change (enabled, severity, thresholds) without needing rule defaults itself.
 */
export function diffPreset(current: RuleConfig, preset: RulePreset): PresetDiff {
  const registry = defaultRuleRegistry();
  const before = resolveRules(registry, current);
  const after = resolveRules(registry, preset.config);
  const afterByCode = new Map(after.map((resolved) => [resolved.rule.code, resolved]));

  let enabledCount = 0;
  let disabledCount = 0;
  let thresholdCount = 0;
  const changedCodes: RuleCode[] = [];

  for (const resolvedBefore of before) {
    const resolvedAfter = afterByCode.get(resolvedBefore.rule.code);

    if (resolvedAfter === undefined) {
      continue;
    }

    const enabledChanged = resolvedBefore.enabled !== resolvedAfter.enabled;
    const severityChanged = resolvedBefore.severity !== resolvedAfter.severity;
    const thresholdChanged = !thresholdsEqual(resolvedBefore.thresholds, resolvedAfter.thresholds);

    if (enabledChanged) {
      if (resolvedAfter.enabled) {
        enabledCount += 1;
      } else {
        disabledCount += 1;
      }
    }

    if (thresholdChanged) {
      thresholdCount += 1;
    }

    if (enabledChanged || severityChanged || thresholdChanged) {
      changedCodes.push(resolvedBefore.rule.code);
    }
  }

  return {
    changedRuleCount: changedCodes.length,
    enabledCount,
    disabledCount,
    thresholdCount,
    changedCodes,
  };
}

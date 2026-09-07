/**
 * Bảy kịch bản của màn Tách tầng (`ExplodedView`), và bộ dữ liệu tầng mẫu chúng
 * dùng chung.
 *
 * File này viết TRƯỚC cả view lẫn hook — cả hai đọc `explodedViewTypes.ts`,
 * KHÔNG sửa nó (đóng băng cùng hợp đồng, R-70). Cùng khuôn
 * `overlayComparisonScenarios.ts` và `viewerShellScenarios.ts`: một
 * `ExplodedViewProps` đầy đủ cho mỗi trong bảy trạng thái, để
 * `ExplodedView.test.tsx` và `.stories.tsx` cắm thẳng vào thay vì bịa dữ liệu
 * tại chỗ.
 *
 * ## Bốn tầng, cao độ thật
 *
 * Cao độ 0 / 3.600 / 7.200 / 10.800 mm lấy tinh thần chiều cao tầng 3.600 mm
 * của bộ mẫu chuẩn A14 (`sampleBuilding.ts`). Diện tích bốn tầng — 74,20 ·
 * 68,10 · 68,10 · 38,20 m² — cộng đúng 248,60 m², tổng diện tích của chính bộ
 * mẫu đó (`SAMPLE_TOTAL_AREA_M2`); không phải trùng hợp.
 *
 * ## Chỉ báo thẳng hàng KHÔNG bịa câu — gọi thật `alignFloors`
 *
 * {@link SAMPLE_ALIGNMENT_ISSUE} không phải một chuỗi gõ tay: nó là kết quả
 * THẬT của `alignFloors()` chạy trên {@link SAMPLE_MISALIGNED_FLOORS} — hai
 * trục cùng phương của hai tầng, một trục khớp tuyệt đối và trục kia lệch
 * TƯƠNG ĐỐI 180 mm. Đây đúng là kiểu lệch `alignFloors` KHÔNG tịnh tiến bù trừ
 * hết được — khác một lệch ĐỀU tuyệt đối, thứ mà phép tịnh tiến tự do hấp thụ
 * trọn vẹn (xem bài kiểm riêng cho trường hợp đó trong `ExplodedView.test.tsx`).
 *
 * ## Không có thuộc tính màu nào theo tầng
 *
 * `ExplodedFloorViewModel` không có trường màu; `alignmentPaths[].tone` chỉ có
 * hai giá trị cố định (`aligned` | `attention`), không phụ thuộc chỉ số tầng.
 */

import { alignFloors, type FloorIssue, type FloorPlan } from '@/domain/axes/alignFloors';
import type { DetectedAxis } from '@/domain/axes/detect';
import type { WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import { formatArea, formatLength } from '@/lib/format/measure';
import { MISSING_VALUE } from '@/lib/format/number';

import {
  EXPLODE_PRESETS,
  LABEL_REVEAL_SEPARATION,
  type ExplodedAlignmentPath,
  type ExplodedElevationTick,
  type ExplodedFloorViewModel,
  type ExplodedViewActions,
  type ExplodedViewProps,
  type ExplodedViewState,
  type ExplodePresetId,
} from './explodedViewTypes';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái, cùng thứ tự A11.                                            */
/* -------------------------------------------------------------------------- */

export const EXPLODED_VIEW_STATES: readonly ExplodedViewState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);

/* -------------------------------------------------------------------------- */
/* Ba mức sẵn — đọc separation ngược từ EXPLODE_PRESETS, không viết tay 0/0,5/1 */
/* (R-71): giá trị đã có tên và nguồn ở chính hợp đồng.                        */
/* -------------------------------------------------------------------------- */

function separationForPreset(id: ExplodePresetId): number {
  const preset = EXPLODE_PRESETS.find((candidate) => candidate.id === id);

  if (preset === undefined) {
    throw new Error(`explodedViewScenarios: không có mức sẵn "${id}".`);
  }

  return preset.separation;
}

/** Mức sẵn khớp với một độ tách, hoặc `null` khi đang kéo tự do — đúng định nghĩa của hợp đồng. */
function presetFor(separation: number): ExplodePresetId | null {
  const match = EXPLODE_PRESETS.find((preset) => preset.separation === separation);

  return match?.id ?? null;
}

const MERGED_SEPARATION = separationForPreset('merged');
const MEDIUM_SEPARATION = separationForPreset('medium');
const FULL_SEPARATION = separationForPreset('full');

/** Độ tách của kịch bản `partial`: một điểm KHÔNG khớp mức sẵn nào, để chứng minh `activePresetId` trả `null` khi người dùng đang kéo tự do. */
const PARTIAL_SEPARATION = 0.62;

/* -------------------------------------------------------------------------- */
/* Bốn tầng mẫu — cao độ thật, diện tích cộng đúng 248,60 m² (A14).             */
/* -------------------------------------------------------------------------- */

interface SampleFloorDef {
  readonly id: string;
  readonly name: string;
  readonly elevationMm: number;
  readonly areaM2: number;
}

/** Chiều cao mỗi tầng, tinh thần `LEVEL_HEIGHT_MM` của bộ mẫu chuẩn (`sampleBuilding.ts`, không export nên không nhập thẳng được). */
const SAMPLE_FLOOR_HEIGHT_MM = 3600;

const FLOOR_1: SampleFloorDef = { id: 'L-01', name: 'Tầng 01', elevationMm: 0, areaM2: 74.2 };
const FLOOR_2: SampleFloorDef = {
  id: 'L-02',
  name: 'Tầng 02',
  elevationMm: SAMPLE_FLOOR_HEIGHT_MM,
  areaM2: 68.1,
};
const FLOOR_3: SampleFloorDef = {
  id: 'L-03',
  name: 'Tầng 03',
  elevationMm: SAMPLE_FLOOR_HEIGHT_MM * 2,
  areaM2: 68.1,
};
const FLOOR_4: SampleFloorDef = {
  id: 'L-04',
  name: 'Tầng 04',
  elevationMm: SAMPLE_FLOOR_HEIGHT_MM * 3,
  areaM2: 38.2,
};

const SAMPLE_FLOOR_DEFS: readonly SampleFloorDef[] = Object.freeze([FLOOR_1, FLOOR_2, FLOOR_3, FLOOR_4]);

/** Đỉnh mái: cao độ sàn tầng trên cùng cộng chiều cao của chính nó. */
const STACK_TOP_MM = FLOOR_4.elevationMm + SAMPLE_FLOOR_HEIGHT_MM;

function buildFloor(
  def: SampleFloorDef,
  overrides: Partial<ExplodedFloorViewModel> = {},
): ExplodedFloorViewModel {
  return {
    id: def.id,
    name: def.name,
    elevationLabel: formatLength(millimetres(def.elevationMm), { unit: 'm' }),
    areaLabel: formatArea(def.areaM2),
    isVisible: true,
    isReady: true,
    needsReview: false,
    attentionCaption: null,
    railFraction: def.elevationMm / STACK_TOP_MM,
    ...overrides,
  };
}

function buildTick(def: SampleFloorDef): ExplodedElevationTick {
  return {
    storeyId: def.id,
    fraction: def.elevationMm / STACK_TOP_MM,
    label: formatLength(millimetres(def.elevationMm), { unit: 'm' }),
  };
}

const ALL_READY_FLOORS: readonly ExplodedFloorViewModel[] = Object.freeze(
  SAMPLE_FLOOR_DEFS.map((def) => buildFloor(def)),
);

const ALL_TICKS: readonly ExplodedElevationTick[] = Object.freeze(SAMPLE_FLOOR_DEFS.map(buildTick));

const MIN_LABEL = formatLength(millimetres(0), { unit: 'm' });
const MAX_LABEL = formatLength(millimetres(STACK_TOP_MM), { unit: 'm' });

/* -------------------------------------------------------------------------- */
/* Chỉ báo thẳng hàng — gọi thật alignFloors, không bịa message (R-61).        */
/* -------------------------------------------------------------------------- */

function verticalAxis(coordinateMm: number, wallIds: readonly [WallId, WallId]): DetectedAxis {
  return {
    direction: 'vertical',
    coordinateMm: millimetres(coordinateMm),
    startMm: millimetres(0),
    endMm: millimetres(SAMPLE_FLOOR_HEIGHT_MM),
    spreadMm: millimetres(0),
    wallIds,
  };
}

/**
 * Hai tầng, hai trục dọc mỗi tầng: một trục khớp tuyệt đối (x = 0 mm), trục
 * còn lại lệch TƯƠNG ĐỐI 180 mm (3.000 mm ở tầng dưới, 3.180 mm ở tầng trên).
 * `alignFloors` không tịnh tiến bù trừ hết được kiểu lệch này — khác một lệch
 * ĐỀU tuyệt đối, thứ mà phép tịnh tiến tự do hấp thụ trọn vẹn.
 */
export const SAMPLE_MISALIGNED_FLOORS: readonly FloorPlan[] = Object.freeze([
  {
    levelId: 'L-01',
    name: FLOOR_1.name,
    floorElevationMm: millimetres(FLOOR_1.elevationMm),
    clearHeightMm: millimetres(SAMPLE_FLOOR_HEIGHT_MM),
    axes: [verticalAxis(0, ['W-001', 'W-002']), verticalAxis(3000, ['W-003', 'W-004'])],
  },
  {
    levelId: 'L-02',
    name: FLOOR_2.name,
    floorElevationMm: millimetres(FLOOR_2.elevationMm),
    clearHeightMm: millimetres(SAMPLE_FLOOR_HEIGHT_MM),
    axes: [verticalAxis(0, ['W-005', 'W-006']), verticalAxis(3180, ['W-007', 'W-008'])],
  },
]);

function findAlignmentIssue(floors: readonly FloorPlan[]): FloorIssue {
  const report = alignFloors(floors);
  const issue = report.issues.find((candidate) => candidate.kind === 'alignment');

  if (issue === undefined) {
    throw new Error(
      'explodedViewScenarios: bộ mẫu lệch trục 180 mm không còn sinh cảnh báo — kiểm tra lại alignFloors.',
    );
  }

  return issue;
}

/** Cảnh báo thẳng hàng THẬT — kết quả của `alignFloors`, không phải một câu gõ tay. */
export const SAMPLE_ALIGNMENT_ISSUE: FloorIssue = findAlignmentIssue(SAMPLE_MISALIGNED_FLOORS);

const ALIGNMENT_PATHS_ALIGNED: readonly ExplodedAlignmentPath[] = Object.freeze([
  { id: 'A-01', xFraction: 0.3, tone: 'aligned', caption: null, residualMm: millimetres(0) },
  { id: 'A-02', xFraction: 0.7, tone: 'aligned', caption: null, residualMm: millimetres(0) },
]);

const ALIGNMENT_PATHS_PARTIAL: readonly ExplodedAlignmentPath[] = Object.freeze([
  { id: 'A-01', xFraction: 0.3, tone: 'aligned', caption: null, residualMm: millimetres(0) },
  {
    id: 'A-02',
    xFraction: 0.7,
    tone: 'attention',
    caption: SAMPLE_ALIGNMENT_ISSUE.message,
    residualMm: millimetres(SAMPLE_ALIGNMENT_ISSUE.amountMm),
  },
]);

/* -------------------------------------------------------------------------- */
/* Không nối dây thật — mọi hành động là một hàm không làm gì (khuôn           */
/* OverlayComparison.stories.tsx).                                             */
/* -------------------------------------------------------------------------- */

const NO_OP = (): void => undefined;

const ACTIONS: ExplodedViewActions = {
  onPresetSelect: NO_OP,
  onSeparationChange: NO_OP,
  onFloorHover: NO_OP,
  onFloorActivate: NO_OP,
  onFloorVisibilityToggle: NO_OP,
  onCapture: NO_OP,
};

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/** Một trạng thái, đóng gói cùng `ExplodedViewProps` đầy đủ của nó. */
export interface ExplodedViewScenario {
  readonly state: ExplodedViewState;
  readonly props: ExplodedViewProps;
}

const LIVE_MESSAGES: Readonly<Record<ExplodedViewState, string>> = Object.freeze({
  empty: 'chỉ có một tầng, chưa tách được.',
  loading: 'đang tải các tầng.',
  partial: 'đã tách vừa; hai tầng trên vẫn đang dựng hình.',
  error: 'không tải được các tầng.',
  success: 'đã tách hết bốn tầng.',
  forbidden: 'bạn không có quyền xem tầng này.',
  collapsed: 'đã thu gọn thanh điều khiển.',
});

/** Câu chú ý trên thẻ của tầng chưa được duyệt, trong kịch bản `partial`. */
const PARTIAL_REVIEW_CAPTION = 'tầng 02 chưa được người duyệt xác nhận.';

const BASE: ExplodedViewProps = {
  state: 'success',
  separation: FULL_SEPARATION,
  activePresetId: presetFor(FULL_SEPARATION),
  presets: EXPLODE_PRESETS,
  minLabel: MIN_LABEL,
  maxLabel: MAX_LABEL,
  areLabelsVisible: FULL_SEPARATION > LABEL_REVEAL_SEPARATION,
  floors: ALL_READY_FLOORS,
  ticks: ALL_TICKS,
  alignmentPaths: ALIGNMENT_PATHS_ALIGNED,
  hoveredStoreyId: null,
  reducedMotion: false,
  isCollapsed: false,
  liveMessage: LIVE_MESSAGES.success,
  isCapturing: false,
  captureError: null,
  actions: ACTIONS,
  canvasRef: NO_OP,
};

const EMPTY_FLOOR = buildFloor(FLOOR_1);
const EMPTY_TICK = buildTick(FLOOR_1);
const EMPTY_TOP_MM = FLOOR_1.elevationMm + SAMPLE_FLOOR_HEIGHT_MM;

const PROPS_BY_STATE: Readonly<Record<ExplodedViewState, ExplodedViewProps>> = Object.freeze({
  // Đúng MỘT tầng: không đủ để tách, và không đủ để so trục (readAlignment cần ≥2 tầng).
  empty: {
    ...BASE,
    state: 'empty',
    separation: MERGED_SEPARATION,
    activePresetId: presetFor(MERGED_SEPARATION),
    minLabel: MIN_LABEL,
    maxLabel: formatLength(millimetres(EMPTY_TOP_MM), { unit: 'm' }),
    areLabelsVisible: MERGED_SEPARATION > LABEL_REVEAL_SEPARATION,
    floors: Object.freeze([EMPTY_FLOOR]),
    ticks: Object.freeze([EMPTY_TICK]),
    alignmentPaths: Object.freeze([]),
    liveMessage: LIVE_MESSAGES.empty,
  },

  loading: {
    ...BASE,
    state: 'loading',
    separation: MERGED_SEPARATION,
    activePresetId: presetFor(MERGED_SEPARATION),
    minLabel: MISSING_VALUE,
    maxLabel: MISSING_VALUE,
    areLabelsVisible: false,
    floors: Object.freeze([]),
    ticks: Object.freeze([]),
    alignmentPaths: Object.freeze([]),
    liveMessage: LIVE_MESSAGES.loading,
  },

  // 2/4 tầng dựng xong (Tầng 01, Tầng 02); Tầng 03/04 còn khung dây. Tầng 02
  // cần xem lại, và trục A-02 của nó lệch 180 mm thật (SAMPLE_ALIGNMENT_ISSUE).
  partial: {
    ...BASE,
    state: 'partial',
    separation: PARTIAL_SEPARATION,
    activePresetId: presetFor(PARTIAL_SEPARATION),
    minLabel: MIN_LABEL,
    maxLabel: MAX_LABEL,
    areLabelsVisible: PARTIAL_SEPARATION > LABEL_REVEAL_SEPARATION,
    floors: Object.freeze([
      buildFloor(FLOOR_1),
      buildFloor(FLOOR_2, { needsReview: true, attentionCaption: PARTIAL_REVIEW_CAPTION }),
      buildFloor(FLOOR_3, { isReady: false }),
      buildFloor(FLOOR_4, { isReady: false }),
    ]),
    ticks: ALL_TICKS,
    alignmentPaths: ALIGNMENT_PATHS_PARTIAL,
    hoveredStoreyId: FLOOR_2.id,
    liveMessage: LIVE_MESSAGES.partial,
  },

  error: {
    ...BASE,
    state: 'error',
    separation: MERGED_SEPARATION,
    activePresetId: presetFor(MERGED_SEPARATION),
    minLabel: MISSING_VALUE,
    maxLabel: MISSING_VALUE,
    areLabelsVisible: false,
    floors: Object.freeze([]),
    ticks: Object.freeze([]),
    alignmentPaths: Object.freeze([]),
    liveMessage: LIVE_MESSAGES.error,
  },

  // Bốn tầng, tách hết, mọi trục thẳng hàng.
  success: BASE,

  forbidden: {
    ...BASE,
    state: 'forbidden',
    separation: MERGED_SEPARATION,
    activePresetId: presetFor(MERGED_SEPARATION),
    minLabel: MISSING_VALUE,
    maxLabel: MISSING_VALUE,
    areLabelsVisible: false,
    floors: Object.freeze([]),
    ticks: Object.freeze([]),
    alignmentPaths: Object.freeze([]),
    liveMessage: LIVE_MESSAGES.forbidden,
  },

  collapsed: {
    ...BASE,
    state: 'collapsed',
    separation: MEDIUM_SEPARATION,
    activePresetId: presetFor(MEDIUM_SEPARATION),
    areLabelsVisible: MEDIUM_SEPARATION > LABEL_REVEAL_SEPARATION,
    isCollapsed: true,
    liveMessage: LIVE_MESSAGES.collapsed,
  },
});

export const EXPLODED_VIEW_SCENARIOS: readonly ExplodedViewScenario[] = Object.freeze(
  EXPLODED_VIEW_STATES.map((state) => Object.freeze({ state, props: PROPS_BY_STATE[state] })),
);

/** Props đầy đủ của một trạng thái. Dùng chung bởi bài kiểm và story (R-70). */
export function explodedViewScenarioFor(state: ExplodedViewState): ExplodedViewProps {
  return PROPS_BY_STATE[state];
}

/** Cùng một kịch bản, ở một độ tách khác — cho bài kiểm ngưỡng hiện thẻ nhãn. */
export function withSeparation(props: ExplodedViewProps, separation: number): ExplodedViewProps {
  return {
    ...props,
    separation,
    activePresetId: presetFor(separation),
    areLabelsVisible: separation > LABEL_REVEAL_SEPARATION,
  };
}

/** Cùng một kịch bản, bật/tắt giảm chuyển động — dữ liệu tầng và độ tách giữ nguyên. */
export function withReducedMotion(props: ExplodedViewProps, reducedMotion: boolean): ExplodedViewProps {
  return { ...props, reducedMotion };
}

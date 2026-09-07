/**
 * Bảy kịch bản của màn Đo lường (`MeasurementTool`), cùng khuôn
 * `explodedViewScenarios.ts` (xem `04-shell-ui-gates.md` mục 1c của hợp đồng).
 *
 * File này viết TRƯỚC view (`MeasurementTool.tsx` do worker khác đang dựng
 * song song) — cả hai đọc `measurementToolTypes.ts`, KHÔNG sửa nó (đóng băng
 * cùng hợp đồng, R-70). `.test.tsx` và `.stories.tsx` cắm thẳng vào
 * {@link measurementToolScenarioFor} thay vì bịa props tại chỗ.
 *
 * ## Không viết tay một mm hay một m² nào
 *
 * Mọi toạ độ lấy từ {@link CLEAN_BUILDING_SCENARIO} — bộ mẫu chuẩn A14 (4
 * tầng, 48 tường, 14 phòng, 248,60 m²) — rồi mọi giá trị đo là kết quả THẬT
 * của `measureDistance`/`measureHeight` (`src/domain/measure`) chạy trên
 * hình học đó, định dạng bằng `formatLength` (`src/lib/format/measure`).
 * Không có con số đo nào gõ tay ở đây (R-61, R-70).
 *
 * `perpendicular` chưa có `measurePointToPlane` — việc logic LG-1 đang làm
 * song song và `measurementToolTypes.ts` đã ghi rõ ánh xạ dự kiến. Hai hàng
 * mang `mode: 'perpendicular'` ở đây dùng `measureDistance` giữa hai điểm
 * thật của bộ mẫu làm giá trị tạm thời — con số vẫn thật, chỉ nhãn chế độ là
 * minh hoạ cho tới khi LG-1 về và điều phối viên nối lại.
 *
 * ## `displayValue`/`displayFractionDigits`/`unitSuffix` — cùng một đơn vị cho cả bảng
 *
 * `unit` của mọi kịch bản ở đây là `'mm'` (xem `BASE.unit`), nên mọi hàng đã
 * ghim gọi `formatLength(..., { unit: 'mm' })` một lần rồi lấy CẢ chuỗi
 * (`valueLabel`) LẪN số (`displayValue`) từ đúng một lần gọi đó — không có
 * phép chia đơn vị nào viết tay ở đây (`mm` là đơn vị lưu trữ gốc nên
 * `displayValue` chỉ là `rawValueMm` không đổi, không phải một phép quy đổi).
 *
 * ## `screenPoints` — pixel khung nhìn, không phải hình học
 *
 * Đây là bố cục minh hoạ cho story/test, không phải dữ liệu nghiệp vụ, nên
 * không lấy từ fixture (R-70 nói tới dữ liệu MẪU, không nói tới toạ độ bố
 * cục). Kịch bản `ready` cố ý để một hàng có `screenPoints: null` — phép đo
 * đó "nằm ngoài khung nhìn", đúng ca `MeasurementOverlay.tsx` phải xử lý.
 */

import { measureDistance, measureHeight, type MeasurePoint } from '@/domain/measure/measure';
import { millimetres, type Millimetres } from '@/domain/units/types';
import { formatLength } from '@/lib/format/measure';
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';

import type {
  DraftMeasurement,
  MeasurementScreenState,
  MeasurementToolProps,
  PinnedMeasurement,
  ScreenPoint,
  SnapIndicator,
} from './measurementToolTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi + số cùng một lần định dạng — một đơn vị cho mọi kịch bản (`unit: 'mm'`). */
/* -------------------------------------------------------------------------- */

const DISPLAY_UNIT_SUFFIX = 'mm';
const DISPLAY_FRACTION_DIGITS = 0;

interface FormattedMillimetreValue {
  readonly valueLabel: string;
  readonly displayValue: number;
  readonly displayFractionDigits: number;
  readonly unitSuffix: string;
}

/** `mm` là đơn vị lưu trữ gốc nên không có phép quy đổi nào ở đây, chỉ định dạng lại. */
function formatPinnedValue(valueMm: Millimetres): FormattedMillimetreValue {
  return {
    valueLabel: formatLength(valueMm, { unit: 'mm' }),
    displayValue: valueMm,
    displayFractionDigits: DISPLAY_FRACTION_DIGITS,
    unitSuffix: DISPLAY_UNIT_SUFFIX,
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái, cùng thứ tự A11.                                            */
/* -------------------------------------------------------------------------- */

export const MEASUREMENT_TOOL_STATES: readonly MeasurementScreenState[] = Object.freeze([
  'empty',
  'measuring',
  'partial',
  'error',
  'ready',
  'forbidden',
  'collapsed',
]);

/* -------------------------------------------------------------------------- */
/* Hình học mẫu — đọc thẳng từ bộ mẫu chuẩn A14, không viết tay một mm nào.    */
/* -------------------------------------------------------------------------- */

const SAMPLE_GRAPH = CLEAN_BUILDING_SCENARIO.graph;

/** Một đầu tường thật của bộ mẫu chuẩn, làm điểm đo. */
function wallEndpoint(wallIndex: number, endpoint: 'start' | 'end'): MeasurePoint {
  const wall = SAMPLE_GRAPH.walls[wallIndex];

  if (wall === undefined) {
    throw new Error(`measurementToolScenarios: bộ mẫu chuẩn không có tường số ${String(wallIndex)}.`);
  }

  const point = wall.centreline[endpoint];

  return { x: millimetres(point.x), y: millimetres(point.y) };
}

/** Cùng một điểm mặt bằng, nâng lên cao độ thật của một tầng — cho phép đo chiều cao. */
function levelPoint(levelIndex: number, base: MeasurePoint): MeasurePoint {
  const level = SAMPLE_GRAPH.levels[levelIndex];

  if (level === undefined) {
    throw new Error(`measurementToolScenarios: bộ mẫu chuẩn không có tầng số ${String(levelIndex)}.`);
  }

  return { x: base.x, y: base.y, z: millimetres(level.elevationMm) };
}

/* -------------------------------------------------------------------------- */
/* Năm phép đo đã ghim của kịch bản `ready` — mỗi giá trị là một lần gọi thật  */
/* vào `src/domain/measure`.                                                  */
/* -------------------------------------------------------------------------- */

const DISTANCE_1 = measureDistance(wallEndpoint(0, 'start'), wallEndpoint(0, 'end'));
const DISTANCE_2 = measureDistance(wallEndpoint(20, 'start'), wallEndpoint(27, 'end'));
const PERPENDICULAR_1 = measureDistance(wallEndpoint(6, 'start'), wallEndpoint(14, 'start'));
const HEIGHT_1 = measureHeight(
  levelPoint(0, wallEndpoint(2, 'start')),
  levelPoint(1, wallEndpoint(2, 'start')),
);
const HEIGHT_2 = measureHeight(
  levelPoint(1, wallEndpoint(9, 'start')),
  levelPoint(2, wallEndpoint(9, 'start')),
);

/** Bốn trong năm hàng có toạ độ pixel thật; xem `PINNED_4` cho ca "ngoài khung nhìn". */
const SCREEN_POINTS_1: readonly ScreenPoint[] = [
  { x: 340, y: 420 },
  { x: 560, y: 430 },
];
const SCREEN_POINTS_2: readonly ScreenPoint[] = [
  { x: 680, y: 220 },
  { x: 740, y: 360 },
];
const SCREEN_POINTS_3: readonly ScreenPoint[] = [
  { x: 820, y: 120 },
  { x: 820, y: 380 },
];
const SCREEN_POINTS_5: readonly ScreenPoint[] = [
  { x: 180, y: 520 },
  { x: 260, y: 560 },
];

const PINNED_1: PinnedMeasurement = {
  id: 'MS-0001',
  name: 'Phép đo 1',
  mode: 'pointToPoint',
  ...formatPinnedValue(DISTANCE_1.lengthMm),
  rawValueMm: DISTANCE_1.lengthMm,
  points: DISTANCE_1.points,
  screenPoints: SCREEN_POINTS_1,
  visible: true,
  stale: false,
  staleReason: null,
};

const PINNED_2: PinnedMeasurement = {
  id: 'MS-0002',
  name: 'Phép đo 2',
  mode: 'perpendicular',
  ...formatPinnedValue(PERPENDICULAR_1.lengthMm),
  rawValueMm: PERPENDICULAR_1.lengthMm,
  points: PERPENDICULAR_1.points,
  screenPoints: SCREEN_POINTS_2,
  visible: true,
  stale: false,
  staleReason: null,
};

const PINNED_3: PinnedMeasurement = {
  id: 'MS-0003',
  name: 'Phép đo 3',
  mode: 'height',
  ...formatPinnedValue(HEIGHT_1.heightMm),
  rawValueMm: HEIGHT_1.heightMm,
  points: HEIGHT_1.points,
  screenPoints: SCREEN_POINTS_3,
  visible: true,
  stale: false,
  staleReason: null,
};

/** Camera đang nhìn chỗ khác — phép đo này còn đó nhưng ngoài khung nhìn. */
const PINNED_4: PinnedMeasurement = {
  id: 'MS-0004',
  name: 'Phép đo 4',
  mode: 'height',
  ...formatPinnedValue(HEIGHT_2.heightMm),
  rawValueMm: HEIGHT_2.heightMm,
  points: HEIGHT_2.points,
  screenPoints: null,
  visible: true,
  stale: false,
  staleReason: null,
};

const PINNED_5: PinnedMeasurement = {
  id: 'MS-0005',
  name: 'Phép đo 5',
  mode: 'pointToPoint',
  ...formatPinnedValue(DISTANCE_2.lengthMm),
  rawValueMm: DISTANCE_2.lengthMm,
  points: DISTANCE_2.points,
  screenPoints: SCREEN_POINTS_5,
  visible: true,
  stale: false,
  staleReason: null,
};

/** Đúng năm phép đo — bài nghiệm thu xoay camera và đổi đơn vị dùng đúng bộ này. */
const READY_MEASUREMENTS: readonly PinnedMeasurement[] = Object.freeze([
  PINNED_1,
  PINNED_2,
  PINNED_3,
  PINNED_4,
  PINNED_5,
]);

/** Hình học mà hàng này neo vào đã bị xoá khỏi mô hình — trạng thái Một phần. */
const STALE_REASON = 'Hình học mà phép đo này tham chiếu đã bị xoá.';

const STALE_MEASUREMENT: PinnedMeasurement = {
  ...PINNED_2,
  id: 'MS-0006',
  name: 'Phép đo 6',
  stale: true,
  staleReason: STALE_REASON,
};

const PARTIAL_MEASUREMENTS: readonly PinnedMeasurement[] = Object.freeze([PINNED_1, STALE_MEASUREMENT]);

const FORBIDDEN_MEASUREMENTS: readonly PinnedMeasurement[] = Object.freeze([PINNED_1, PINNED_3]);

/* -------------------------------------------------------------------------- */
/* Chip bắt điểm — loại đang bắt luôn được gọi tên (điều cấm thứ ba).          */
/* -------------------------------------------------------------------------- */

const SNAP_NONE: SnapIndicator = { kind: null, label: 'chưa bắt được điểm nào' };
const SNAP_ERROR: SnapIndicator = { kind: null, label: 'không tìm thấy bề mặt để bắt' };
const SNAP_VERTEX: SnapIndicator = { kind: 'vertex', label: 'đỉnh' };
const SNAP_MIDPOINT: SnapIndicator = { kind: 'midpoint', label: 'trung điểm' };
const SNAP_AXIS: SnapIndicator = { kind: 'axisIntersection', label: 'giao trục' };

/* -------------------------------------------------------------------------- */
/* Phần đang đo dở (trạng thái Đang đo) — một điểm đã đặt, chưa có gì để đọc,  */
/* nhãn bám con trỏ nên `valueLabel` là `null` (điều cấm thứ hai).             */
/* -------------------------------------------------------------------------- */

/** Điểm duy nhất đã đặt, chiếu ra cùng một toạ độ pixel với `cursorPx`: con trỏ vừa đặt điểm đó, chưa kịp nhúc nhích. */
const MEASURING_CURSOR: ScreenPoint = { x: 540, y: 310 };

const MEASURING_DRAFT: DraftMeasurement = {
  mode: 'pointToPoint',
  points: [wallEndpoint(30, 'start')],
  valueLabel: null,
  screenPoints: [MEASURING_CURSOR],
  cursorPx: MEASURING_CURSOR,
  snap: SNAP_VERTEX,
};

/* -------------------------------------------------------------------------- */
/* Không nối dây thật — mọi hành động là một hàm không làm gì (khuôn           */
/* `explodedViewScenarios.ts`).                                               */
/* -------------------------------------------------------------------------- */

const NO_OP = (): void => undefined;

const BASE: MeasurementToolProps = {
  state: 'ready',
  mode: 'perpendicular',
  onModeChange: NO_OP,
  snap: SNAP_MIDPOINT,
  draft: null,
  measurements: READY_MEASUREMENTS,
  countLabel: '5 phép đo',
  highlightedId: null,
  onHighlight: NO_OP,
  onToggleVisibility: NO_OP,
  onDelete: NO_OP,
  onToggleTool: NO_OP,
  onEscape: NO_OP,
  onPin: NO_OP,
  unit: 'mm',
  onUnitChange: NO_OP,
  unitJustChanged: false,
  canPin: true,
  pinBlockedCaption: null,
  collapsed: false,
  onToggleCollapsed: NO_OP,
  errorMessage: null,
  onRetry: NO_OP,
};

const PROPS_BY_STATE: Readonly<Record<MeasurementScreenState, MeasurementToolProps>> = Object.freeze({
  // Chưa ghim gì; công cụ đang chờ điểm đầu tiên.
  empty: {
    ...BASE,
    state: 'empty',
    mode: 'pointToPoint',
    snap: SNAP_NONE,
    measurements: Object.freeze([]),
    countLabel: '0 phép đo',
  },

  // Một điểm đã đặt, đang chờ điểm thứ hai — nhãn bám con trỏ, không chạy số.
  measuring: {
    ...BASE,
    state: 'measuring',
    mode: 'pointToPoint',
    snap: SNAP_VERTEX,
    draft: MEASURING_DRAFT,
    measurements: Object.freeze([]),
    countLabel: '0 phép đo',
  },

  // Hai phép đo đã ghim, một trong đó neo vào hình học vừa bị xoá.
  partial: {
    ...BASE,
    state: 'partial',
    mode: 'pointToPoint',
    snap: SNAP_AXIS,
    measurements: PARTIAL_MEASUREMENTS,
    countLabel: '2 phép đo',
  },

  // Không bắt được bề mặt nào dưới con trỏ.
  error: {
    ...BASE,
    state: 'error',
    mode: 'pointToPoint',
    snap: SNAP_ERROR,
    measurements: Object.freeze([]),
    countLabel: '0 phép đo',
    errorMessage: 'Không bắt được bề mặt nào dưới con trỏ. Xoay lại góc nhìn rồi thử lại.',
  },

  // Năm phép đo đã ghim, không đang đo dở — bài nghiệm thu xoay camera và đổi
  // đơn vị dùng đúng bộ này (CONTRACT.md mục 5).
  ready: BASE,

  // Vẫn đo được, không ghim được — danh sách các phép đo đã ghim từ trước
  // vẫn xem được.
  forbidden: {
    ...BASE,
    state: 'forbidden',
    snap: SNAP_VERTEX,
    measurements: FORBIDDEN_MEASUREMENTS,
    countLabel: '2 phép đo',
    canPin: false,
    pinBlockedCaption: 'Bạn không có quyền ghim phép đo trong dự án này. Liên hệ quản trị dự án.',
  },

  // Cùng năm phép đo của `ready`, mục "Phép đo" thu gọn thành một chip đếm.
  collapsed: {
    ...BASE,
    state: 'collapsed',
    collapsed: true,
  },
});

/** Một trạng thái, đóng gói cùng `MeasurementToolProps` đầy đủ của nó. */
export interface MeasurementToolScenario {
  readonly state: MeasurementScreenState;
  readonly props: MeasurementToolProps;
}

export const MEASUREMENT_TOOL_SCENARIOS: readonly MeasurementToolScenario[] = Object.freeze(
  MEASUREMENT_TOOL_STATES.map((state) => Object.freeze({ state, props: PROPS_BY_STATE[state] })),
);

/** Props đầy đủ của một trạng thái. Dùng chung bởi bài kiểm và story (R-70). */
export function measurementToolScenarioFor(state: MeasurementScreenState): MeasurementToolProps {
  return PROPS_BY_STATE[state];
}

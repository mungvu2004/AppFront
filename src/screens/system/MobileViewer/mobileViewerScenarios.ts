/**
 * Bảy kịch bản của màn `/m/du-an/:projectId` — xem 3D chỉ đọc trên điện thoại
 * (T8), cùng khuôn `explodedViewScenarios.ts` / `measurementToolScenarios.ts`.
 *
 * File này viết TRƯỚC `MobileViewer.tsx` lẫn `useMobileViewer.ts` — cả ba đọc
 * `mobileViewerTypes.ts`, KHÔNG sửa nó (đóng băng cùng hợp đồng, R-70).
 * `MobileViewer.test.tsx` và `.stories.tsx` cắm thẳng vào
 * {@link mobileViewerScenarioFor} thay vì bịa props tại chỗ.
 *
 * ## KHÔNG dùng bộ mẫu chuẩn A14 (`createSampleBuilding`/`fixtures.ts`)
 *
 * Ghi chú khảo sát `a14-fixture-is-not-a-valid-floor-plan` (và câu cảnh báo
 * trong đặc tả T8) đã đo: hình học của bộ mẫu chuẩn đo ra 238,00 m² chứ không
 * phải 248,60 m² đã khai, và một số tên phòng của nó là tiếng Anh — rớt thẳng
 * `expectVietnamese`. `measurementToolScenarios.ts` dùng được bộ đó vì nó chỉ
 * đọc TOẠ ĐỘ tường (không hiển thị tên phòng); màn này thì hiển thị nhãn tầng
 * và tiêu đề đối tượng ra màn hình, nên rủi ro cao hơn. An toàn hơn là tự dựng
 * bốn tầng bằng tay (giống cách `explodedViewScenarios.ts` tự dựng bốn tầng
 * của nó) và chỉ gọi hàm domain THẬT (`measureDistance`, `formatLength`) trên
 * toạ độ tự đặt — không có số đã định dạng nào gõ tay (A15, R-61).
 *
 * ## Bốn tầng mẫu
 *
 * Nhãn tầng viết thường theo đúng ví dụ của hợp đồng
 * (`mobileViewerTypes.ts` mục 3, "ví dụ tầng 2"): "tầng trệt" · "tầng 1" ·
 * "tầng 2" · "tầng mái".
 */

import { measureDistance, type MeasurePoint } from '@/domain/measure/measure';
import { millimetres } from '@/domain/units/types';
import { formatLength } from '@/lib/format/measure';

import type {
  MobileViewerFloor,
  MobileViewerInfoRow,
  MobileViewerMeasurement,
  MobileViewerProps,
  MobileViewerSelection,
  MobileViewerState,
} from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái, cùng thứ tự A11.                                            */
/* -------------------------------------------------------------------------- */

export const MOBILE_VIEWER_STATES: readonly MobileViewerState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);

/* -------------------------------------------------------------------------- */
/* Bốn tầng mẫu, tự dựng bằng tay — không lấy từ bộ mẫu chuẩn A14.             */
/* -------------------------------------------------------------------------- */

interface SampleFloorDef {
  readonly id: string;
  readonly label: string;
}

const FLOOR_GROUND: SampleFloorDef = { id: 'T-00', label: 'tầng trệt' };
const FLOOR_1: SampleFloorDef = { id: 'T-01', label: 'tầng 1' };
const FLOOR_2: SampleFloorDef = { id: 'T-02', label: 'tầng 2' };
const FLOOR_ROOF: SampleFloorDef = { id: 'T-03', label: 'tầng mái' };

const SAMPLE_FLOOR_DEFS: readonly SampleFloorDef[] = Object.freeze([
  FLOOR_GROUND,
  FLOOR_1,
  FLOOR_2,
  FLOOR_ROOF,
]);

function buildFloor(def: SampleFloorDef, isLoaded: boolean): MobileViewerFloor {
  return { id: def.id, label: def.label, isLoaded };
}

/** Bốn tầng, tất cả đã dựng xong. */
const ALL_FLOORS_LOADED: readonly MobileViewerFloor[] = Object.freeze(
  SAMPLE_FLOOR_DEFS.map((def) => buildFloor(def, true)),
);

/** Bốn tầng, chưa tầng nào dựng xong — mức gọn đang tải. */
const ALL_FLOORS_LOADING: readonly MobileViewerFloor[] = Object.freeze(
  SAMPLE_FLOOR_DEFS.map((def) => buildFloor(def, false)),
);

/** Đúng hai tầng dưới đã dựng xong, hai tầng trên còn đang tải — "mạng yếu, chỉ tải được 2 tầng". */
const TWO_FLOORS_LOADED: readonly MobileViewerFloor[] = Object.freeze([
  buildFloor(FLOOR_GROUND, true),
  buildFloor(FLOOR_1, true),
  buildFloor(FLOOR_2, false),
  buildFloor(FLOOR_ROOF, false),
]);

/* -------------------------------------------------------------------------- */
/* Một lượt chọn (tấm thông tin) — chỉ đọc, giá trị đến từ `measureDistance`   */
/* thật trên toạ độ tự đặt, định dạng bằng `formatLength` thật (A15).          */
/* -------------------------------------------------------------------------- */

const WALL_START: MeasurePoint = { x: millimetres(0), y: millimetres(0) };
const WALL_END: MeasurePoint = { x: millimetres(12400), y: millimetres(0) };
const WALL_LENGTH = measureDistance(WALL_START, WALL_END);
const WALL_THICKNESS_MM = millimetres(220);

const SELECTION_ROWS: readonly MobileViewerInfoRow[] = Object.freeze([
  { id: 'r-length', label: 'chiều dài', value: formatLength(WALL_LENGTH.lengthMm, { unit: 'm' }) },
  { id: 'r-thickness', label: 'độ dày', value: formatLength(WALL_THICKNESS_MM, { unit: 'mm' }) },
]);

/** Một tường đang được chọn — sửa được chỉ trên máy tính (điểm chính của màn này). */
const SAMPLE_SELECTION: MobileViewerSelection = Object.freeze({
  entityId: 'W-014',
  kindLabel: 'tường',
  title: 'Tường trục A-B',
  rows: SELECTION_ROWS,
  needsDesktopToEdit: true,
});

/* -------------------------------------------------------------------------- */
/* Hai phép đo đã ghim — cùng khuôn, giá trị THẬT từ `measureDistance`.        */
/* -------------------------------------------------------------------------- */

const MEASURE_A_START: MeasurePoint = { x: millimetres(0), y: millimetres(0) };
const MEASURE_A_END: MeasurePoint = { x: millimetres(3400), y: millimetres(0) };
const MEASURE_A = measureDistance(MEASURE_A_START, MEASURE_A_END);

const MEASURE_B_START: MeasurePoint = { x: millimetres(0), y: millimetres(0) };
const MEASURE_B_END: MeasurePoint = { x: millimetres(0), y: millimetres(5200) };
const MEASURE_B = measureDistance(MEASURE_B_START, MEASURE_B_END);

const MEASUREMENT_A: MobileViewerMeasurement = {
  id: 'MS-M01',
  kindLabel: 'khoảng cách',
  valueLabel: formatLength(MEASURE_A.lengthMm, { unit: 'm' }),
};

const MEASUREMENT_B: MobileViewerMeasurement = {
  id: 'MS-M02',
  kindLabel: 'khoảng cách',
  valueLabel: formatLength(MEASURE_B.lengthMm, { unit: 'm' }),
};

const SAMPLE_MEASUREMENTS: readonly MobileViewerMeasurement[] = Object.freeze([MEASUREMENT_A, MEASUREMENT_B]);

/* -------------------------------------------------------------------------- */
/* Không nối dây thật — mọi hành động là một hàm không làm gì (khuôn           */
/* `explodedViewScenarios.ts`).                                               */
/* -------------------------------------------------------------------------- */

const NO_OP = (): void => undefined;

/** Tên dự án mẫu — một danh xưng riêng, không phải một câu (A6 không áp dụng ở đây). */
const SAMPLE_PROJECT_NAME = 'Trạm bơm Nhơn Trạch';

/** Liên kết sang bản 2D — lối thoát của trạng thái `error` (máy yếu). */
const SAMPLE_FALLBACK_2D_HREF = '/2d/P-NHONTRACH01';

const BASE: MobileViewerProps = {
  state: 'success',
  projectName: SAMPLE_PROJECT_NAME,
  onShare: NO_OP,
  canvasRef: undefined,
  isCompact: false,
  activeTool: null,
  onSelectTool: NO_OP,
  floors: ALL_FLOORS_LOADED,
  activeFloorId: FLOOR_GROUND.id,
  onSelectFloor: NO_OP,
  selection: SAMPLE_SELECTION,
  onDismissSelection: NO_OP,
  onSendDesktopLink: NO_OP,
  measurements: SAMPLE_MEASUREMENTS,
  detailLabel: null,
  fallback2dHref: SAMPLE_FALLBACK_2D_HREF,
};

const PROPS_BY_STATE: Readonly<Record<MobileViewerState, MobileViewerProps>> = Object.freeze({
  // Chưa có gì để xem — dự án chưa có bản vẽ nào được dựng thành mô hình.
  empty: {
    ...BASE,
    state: 'empty',
    floors: Object.freeze([]),
    activeFloorId: null,
    selection: null,
    measurements: Object.freeze([]),
    detailLabel: null,
  },

  // Đang tải — hiện mức gọn trước rồi mới nâng dần (mục 2 của hợp đồng).
  loading: {
    ...BASE,
    state: 'loading',
    floors: ALL_FLOORS_LOADING,
    activeFloorId: null,
    selection: null,
    measurements: Object.freeze([]),
    detailLabel: 'đang tải mức gọn',
  },

  // Mạng yếu: chỉ tải được 2 tầng.
  partial: {
    ...BASE,
    state: 'partial',
    floors: TWO_FLOORS_LOADED,
    activeFloorId: FLOOR_GROUND.id,
    selection: null,
    measurements: Object.freeze([MEASUREMENT_A]),
    detailLabel: 'đang tải mức gọn',
  },

  // Máy yếu: mời xem bản 2D thay vì cố dựng.
  error: {
    ...BASE,
    state: 'error',
    floors: Object.freeze([]),
    activeFloorId: null,
    selection: null,
    measurements: Object.freeze([]),
    detailLabel: null,
  },

  // Bốn tầng dựng xong, đang xem thông tin một tường.
  success: BASE,

  // Không có quyền xem dự án này từ điện thoại.
  forbidden: {
    ...BASE,
    state: 'forbidden',
    activeTool: null,
    floors: Object.freeze([]),
    activeFloorId: null,
    selection: null,
    measurements: Object.freeze([]),
    detailLabel: null,
  },

  // Màn rất nhỏ (320): thanh dưới còn ba biểu tượng.
  collapsed: {
    ...BASE,
    state: 'collapsed',
    isCompact: true,
    activeTool: 'floors',
    selection: null,
  },
});

/** Một trạng thái, đóng gói cùng `MobileViewerProps` đầy đủ của nó. */
export interface MobileViewerScenario {
  readonly state: MobileViewerState;
  readonly props: MobileViewerProps;
}

export const MOBILE_VIEWER_SCENARIOS: readonly MobileViewerScenario[] = Object.freeze(
  MOBILE_VIEWER_STATES.map((state) => Object.freeze({ state, props: PROPS_BY_STATE[state] })),
);

/** Props đầy đủ của một trạng thái. Dùng chung bởi bài kiểm và story (R-70). */
export function mobileViewerScenarioFor(state: MobileViewerState): MobileViewerProps {
  return PROPS_BY_STATE[state];
}

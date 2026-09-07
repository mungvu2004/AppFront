/**
 * Bảy kịch bản của màn Đối chiếu bản vẽ, và bộ vùng lệch mẫu chúng dùng chung.
 *
 * File này do điều phối viên viết và **đóng băng** cùng `types.ts`. Worker Lớp 2
 * đọc nó, không sửa nó. Test và story cắm thẳng vào đây thay vì bịa dữ liệu tại
 * chỗ (R-70).
 *
 * ## Vì sao bộ số là bộ này
 *
 * Đặc tả đòi ba con số cụ thể — **trung bình 8 mm · lớn nhất 41 mm · vượt ngưỡng
 * 3 vùng** — và đòi rằng đổi dung sai **20 → 50 mm** thì số vùng vượt ngưỡng
 * **giảm** và chạy số. Ba con số đó không phải thứ hook được phép tự khai; chúng
 * là **thuộc tính của dữ liệu**. {@link SAMPLE_DEVIATIONS_MM} được chọn để phép
 * tính rơi ra đúng chúng:
 *
 * ```
 * tổng    = 41+25+21+5+4+3+3+2+2+2+1+1+1+1 = 112
 * số vùng = 14
 * trung bình = 112 / 14 = 8   -> "8 mm"
 * lớn nhất   = 41              -> "41 mm"
 * vượt 20 mm = {41, 25, 21}    -> 3 vùng
 * vượt 50 mm = {}              -> 0 vùng   (giảm, và chạy số)
 * ```
 *
 * Phép "vượt ngưỡng" là **ngặt**: `độ lệch > dung sai`, không phải `>=`. Với dung
 * sai 21 mm kết quả phải là 2, không phải 3 — đây là phép kiểm biên mà test bắt
 * buộc phải có, và là lý do hằng số này nằm ở đây chứ không rải trong test.
 *
 * ## Vì sao `success` dùng lại đúng bộ đó
 *
 * Trạng thái *Xong* là chính bộ này ở dung sai 50 mm. Nhờ vậy phép nghiệm thu
 * "20 → 50 mm" **chính là** phép chuyển *Một phần* → *Xong*, và một lượt test
 * chứng minh được cả hai thứ cùng lúc.
 */

import { formatLength } from '@/lib/format/measure';
import { ROUTES } from '@/routes/paths';
import { MISSING_VALUE } from '@/lib/format/number';
import type { LevelId } from '@/domain/spatial/types';
import type { ViewportState } from '@/hooks/useCanvasViewport';

import type {
  DeviationMarkViewModel,
  DeviationRowViewModel,
  FloorOptionViewModel,
  GeometryPolyline,
  MatchMetricsViewModel,
  OverlayComparisonState,
  OverlayComparisonViewModel,
  OverlayLayerId,
  OverlayLayerViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Bộ vùng lệch mẫu — nguồn của mọi con số nghiệm thu.                          */
/* -------------------------------------------------------------------------- */

/** Dung sai mặc định khi mở màn, theo milimét. */
export const DEFAULT_TOLERANCE_MM = 20;

/** Dung sai nới ra ở phép nghiệm thu, theo milimét. */
export const RELAXED_TOLERANCE_MM = 50;

/**
 * Mười bốn độ lệch, milimét, đã sắp **tệ nhất lên đầu**.
 *
 * Đừng đổi bộ này. Ba con số đặc tả đòi rơi ra từ nó; đổi một phần tử là đổi
 * tiêu chí nghiệm thu.
 */
export const SAMPLE_DEVIATIONS_MM: readonly number[] = Object.freeze([
  41, 25, 21, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1,
]);

/** Vị trí tham chiếu và đối tượng bị ảnh hưởng, một dòng cho mỗi độ lệch trên. */
const SAMPLE_REFERENCES: readonly Readonly<{ reference: string; object: string }>[] =
  Object.freeze([
    { reference: 'trục A-3', object: 'W-12' },
    { reference: 'trục B-1', object: 'W-07' },
    { reference: 'phòng bếp', object: 'R-04' },
    { reference: 'trục C-2', object: 'W-19' },
    { reference: 'phòng khách', object: 'R-01' },
    { reference: 'trục A-1', object: 'W-03' },
    { reference: 'trục D-4', object: 'W-22' },
    { reference: 'phòng ngủ 1', object: 'R-02' },
    { reference: 'trục B-3', object: 'W-15' },
    { reference: 'cửa chính', object: 'D-01' },
    { reference: 'trục C-1', object: 'W-08' },
    { reference: 'phòng tắm', object: 'R-05' },
    { reference: 'trục D-2', object: 'W-27' },
    { reference: 'phòng ngủ 2', object: 'R-03' },
  ]);

/**
 * Đếm số vùng vượt dung sai. Ngặt: `> dung sai`, không phải `>=`.
 *
 * Đây là phép đếm trên dữ liệu mẫu, phục vụ test và story. Bản sản phẩm lấy con
 * số này từ `src/domain/overlay`, không từ đây.
 */
export function countOverTolerance(
  deviationsMm: readonly number[],
  toleranceMm: number,
): number {
  return deviationsMm.filter((deviationMm) => deviationMm > toleranceMm).length;
}

/* -------------------------------------------------------------------------- */
/* Dựng các mảnh viewmodel từ bộ mẫu.                                          */
/* -------------------------------------------------------------------------- */

const METRIC_LABELS = Object.freeze({
  mean: 'sai số trung bình',
  max: 'sai số lớn nhất',
  overTolerance: 'số vùng vượt ngưỡng',
});

/** Ba con số ở đầu panel, tính từ bộ mẫu tại một dung sai cho trước. */
export function buildMetrics(
  deviationsMm: readonly number[],
  toleranceMm: number,
): MatchMetricsViewModel {
  if (deviationsMm.length === 0) {
    return {
      meanText: MISSING_VALUE,
      maxText: MISSING_VALUE,
      overToleranceCount: null,
      labels: METRIC_LABELS,
    };
  }

  const total = deviationsMm.reduce((sum, deviationMm) => sum + deviationMm, 0);
  const mean = total / deviationsMm.length;
  const max = deviationsMm.reduce((worst, deviationMm) => Math.max(worst, deviationMm), 0);

  return {
    meanText: formatLength(mean),
    maxText: formatLength(max),
    overToleranceCount: countOverTolerance(deviationsMm, toleranceMm),
    labels: METRIC_LABELS,
  };
}

/** Ba con số của một trạng thái chưa đo được: gạch ngang, không phải số không. */
export const UNMEASURED_METRICS: MatchMetricsViewModel = Object.freeze({
  meanText: MISSING_VALUE,
  maxText: MISSING_VALUE,
  overToleranceCount: null,
  labels: METRIC_LABELS,
});

/** Danh sách hàng của panel, sắp tệ nhất lên đầu, tại một dung sai cho trước. */
export function buildRows(
  deviationsMm: readonly number[],
  toleranceMm: number,
  selectedId: string | null = null,
): readonly DeviationRowViewModel[] {
  return deviationsMm.map((deviationMm, index) => {
    const place = SAMPLE_REFERENCES[index] ?? { reference: 'trục A-1', object: 'W-01' };
    const id = `dev-${String(index)}`;
    return {
      id,
      referenceLabel: place.reference,
      deviationText: formatLength(deviationMm),
      affectedObjectCode: place.object,
      statusCode: deviationMm > toleranceMm ? 'attention' : 'neutral',
      isSelected: id === selectedId,
    };
  });
}

/** Dấu gạch chéo trên canvas, một dấu cho mỗi vùng lệch. */
export function buildMarks(
  deviationsMm: readonly number[],
  toleranceMm: number,
  selectedId: string | null = null,
): readonly DeviationMarkViewModel[] {
  return deviationsMm.map((deviationMm, index) => {
    const id = `dev-${String(index)}`;
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      id,
      box: {
        x: 0.12 + column * 0.2,
        y: 0.14 + row * 0.22,
        width: 0.14,
        height: 0.16,
      },
      isOverTolerance: deviationMm > toleranceMm,
      isSelected: id === selectedId,
      hasJustCrossedTolerance: false,
    };
  });
}

/** Ba lớp thị giác ở độ mờ mặc định của đặc tả: nguồn 25%, hình học 60%. */
export function buildLayers(
  scanOpacityPercent: number,
  hasDeviations: boolean,
): Readonly<Record<OverlayLayerId, OverlayLayerViewModel>> {
  const layer = (
    id: OverlayLayerId,
    label: string,
    opacity: number,
    isVisible: boolean,
  ): OverlayLayerViewModel => ({ id, isVisible, opacity, label });

  return Object.freeze({
    scan: layer('scan', 'ảnh quét gốc', scanOpacityPercent / 100, true),
    geometry: layer('geometry', 'hình học sinh ra', 0.6, true),
    deviation: layer('deviation', 'vùng lệch', 1, hasDeviations),
  });
}

/* -------------------------------------------------------------------------- */
/* Tầng mẫu.                                                                   */
/* -------------------------------------------------------------------------- */

const levelId = (suffix: string): LevelId => `L-${suffix}`;

/** Bốn tầng: hai có ảnh quét, một chỉ có hình học, một nhập từ CAD. */
export const SAMPLE_FLOORS: readonly FloorOptionViewModel[] = Object.freeze([
  { levelId: levelId('01'), label: 'tầng trệt', hasScan: true, hasGeometry: true },
  { levelId: levelId('02'), label: 'tầng 2', hasScan: true, hasGeometry: true },
  { levelId: levelId('03'), label: 'tầng 3', hasScan: false, hasGeometry: true },
  { levelId: levelId('04'), label: 'tầng mái', hasScan: false, hasGeometry: false },
]);

/**
 * Hình học mô hình mẫu, đã ở hệ tỉ lệ `0..1` của khung đối chiếu.
 *
 * Một đường bao khép kín (ngôi nhà) và ba nét tường trong. Đủ để test đếm được
 * lớp `geometry` có vẽ hay không, và đủ để story nhìn ra hình.
 *
 * Lớp này có dữ liệu ở **mọi** kịch bản có hình học — kể cả `empty` (tầng không có
 * ảnh gốc) và `error` (không căn được tỷ lệ). Đó là điểm khác cốt lõi giữa nó và
 * lớp `scan`: thiếu `imageToModelTransform` làm hỏng việc đặt **ảnh**, không làm
 * mất **mô hình**.
 */
export const SAMPLE_GEOMETRY: readonly GeometryPolyline[] = Object.freeze([
  {
    id: 'R-outline',
    isClosed: true,
    points: [
      { x: 0.08, y: 0.1 },
      { x: 0.92, y: 0.1 },
      { x: 0.92, y: 0.9 },
      { x: 0.08, y: 0.9 },
    ],
  },
  {
    id: 'W-03',
    isClosed: false,
    points: [
      { x: 0.4, y: 0.1 },
      { x: 0.4, y: 0.55 },
    ],
  },
  {
    id: 'W-07',
    isClosed: false,
    points: [
      { x: 0.4, y: 0.55 },
      { x: 0.92, y: 0.55 },
    ],
  },
  {
    id: 'W-12',
    isClosed: false,
    points: [
      { x: 0.08, y: 0.62 },
      { x: 0.4, y: 0.62 },
    ],
  },
]);

/** Viewport mặc định: chưa kéo, chưa thu phóng. */
export const IDENTITY_VIEWPORT: ViewportState = Object.freeze({ x: 0, y: 0, zoom: 1 });

/** Ảnh quét mẫu. Chuỗi này KHÔNG bắt đầu bằng `/` hay `http` (R-65). */
/** Dự án mẫu, để dựng đường dẫn điều hướng thật thay vì chuỗi thô (R-65). */
export const SAMPLE_PROJECT_ID = 'P-01';

export const SAMPLE_SCAN_URL = 'data:image/svg+xml;base64,PHN2Zy8+';

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

const BASE: OverlayComparisonViewModel = {
  state: 'success',
  stateNotice: null,
  scaleFixHref: null,
  floors: SAMPLE_FLOORS,
  activeFloorId: levelId('01'),
  scanUrl: SAMPLE_SCAN_URL,
  compareMode: 'overlay',
  disabledCompareModes: {},
  scanOpacityPercent: 25,
  scanOpacityText: '25%',
  swipePosition: 0.5,
  isAlignmentLocked: false,
  layers: buildLayers(25, true),
  geometry: SAMPLE_GEOMETRY,
  viewport: IDENTITY_VIEWPORT,
  marks: buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM),
  measurement: null,
  metrics: buildMetrics(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM),
  toleranceMm: DEFAULT_TOLERANCE_MM,
  toleranceLabel: 'dung sai',
  rows: buildRows(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM),
  confirmation: {
    buttonLabel: 'xác nhận mô hình khớp bản vẽ',
    isConfirmed: false,
    canConfirm: true,
    confirmedNotice: null,
  },
  role: 'engineer',
  unsupported: [],
};

/**
 * Bảy trạng thái, tên lấy nguyên văn từ `SEVEN_STATES`.
 *
 * `success` là bộ mẫu ở dung sai 50 mm — không vùng nào vượt, badge đã duyệt, và
 * một câu xác nhận điềm đạm. Đó cũng chính là đích của phép nghiệm thu "20 → 50".
 */
export const OVERLAY_COMPARISON_SCENARIOS: Readonly<
  Record<OverlayComparisonState, OverlayComparisonViewModel>
> = Object.freeze({
  empty: {
    ...BASE,
    state: 'empty',
    stateNotice: 'tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.',
    activeFloorId: levelId('04'),
    scanUrl: null,
    layers: buildLayers(25, false),
    marks: [],
    rows: [],
    metrics: UNMEASURED_METRICS,
    confirmation: { ...BASE.confirmation, canConfirm: false },
  },

  loading: {
    ...BASE,
    state: 'loading',
    stateNotice: 'đang tải ảnh bản vẽ gốc.',
    scanUrl: null,
    layers: buildLayers(25, false),
    marks: [],
    rows: [],
    metrics: UNMEASURED_METRICS,
    confirmation: { ...BASE.confirmation, canConfirm: false },
  },

  partial: {
    ...BASE,
    state: 'partial',
    stateNotice: 'chỉ 2 trong 4 tầng có ảnh gốc; tầng mái cũng chưa dựng hình học.',
  },

  error: {
    ...BASE,
    state: 'error',
    stateNotice: 'không căn được vì hai tầng đang dùng tỷ lệ khác nhau.',
    scaleFixHref: ROUTES.project.scale(SAMPLE_PROJECT_ID, levelId('02')),
    layers: buildLayers(25, false),
    marks: [],
    rows: [],
    metrics: UNMEASURED_METRICS,
    confirmation: { ...BASE.confirmation, canConfirm: false },
  },

  success: {
    ...BASE,
    state: 'success',
    toleranceMm: RELAXED_TOLERANCE_MM,
    marks: buildMarks(SAMPLE_DEVIATIONS_MM, RELAXED_TOLERANCE_MM),
    rows: buildRows(SAMPLE_DEVIATIONS_MM, RELAXED_TOLERANCE_MM),
    metrics: buildMetrics(SAMPLE_DEVIATIONS_MM, RELAXED_TOLERANCE_MM),
    confirmation: {
      buttonLabel: 'xác nhận mô hình khớp bản vẽ',
      isConfirmed: true,
      canConfirm: false,
      confirmedNotice: {
        text: 'mọi vùng nằm trong dung sai, và bạn đã xác nhận tầng này khớp bản vẽ.',
        statusCode: 'verified',
      },
    },
  },

  forbidden: {
    ...BASE,
    state: 'forbidden',
    stateNotice: 'bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.',
    isAlignmentLocked: true,
    role: 'viewer',
    confirmation: { ...BASE.confirmation, canConfirm: false },
  },

  collapsed: {
    ...BASE,
    state: 'collapsed',
    disabledCompareModes: {
      sideBySide: 'khung quá hẹp để đặt hai khung nhìn cạnh nhau; hãy dùng trượt.',
    },
  },
});

/** Bảy trạng thái theo đúng thứ tự của `SEVEN_STATES`, cho vòng lặp trong test. */
export const OVERLAY_COMPARISON_STATES: readonly OverlayComparisonState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);

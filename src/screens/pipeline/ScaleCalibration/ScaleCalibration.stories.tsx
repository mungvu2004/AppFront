/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link ScaleCalibration} — không container, không provider,
 * không cổng dữ liệu, không một lời gọi mạng nào. Đó là thứ mục D mua được: xem
 * được cả bảy trạng thái mà không phải dựng nổi một máy chủ. Cùng khuôn
 * `ProcessingScreen.stories.tsx`.
 *
 * ## Dữ liệu đến từ bộ mẫu chuẩn, không bịa tại chỗ (R-70)
 *
 * 34 chuỗi kích thước của story là 34 `Dimension` thật của bộ mẫu A14
 * (`createSampleBuilding()`), và chiều dài pixel của mỗi hàng do chính
 * {@link REFERENCE_SCALE} quy đổi từ giá trị mi-li-mét của bộ mẫu — nên mọi hàng
 * cùng nói một tỷ lệ 12 mm/px. Không có bảng dữ liệu thứ hai ở đây, và **không
 * một phép chia nào**: `Scale` của `@/domain/units/scale` làm mọi phép quy đổi.
 *
 * ## Ba con số viết ra, và vì sao được phép
 *
 * `400 px`, `4.800 mm`, `12 mm/px` là chính ví dụ đặc tả nêu — cùng ba con số
 * `domain/units/__tests__/scale.test.ts` đang kiểm và `useScaleCalibration.test.ts`
 * đang dùng. Chúng đi vào `createScale`, không đi vào một phép tính viết tay.
 *
 * ## Chuỗi ở đây là chuỗi của hook, không phải bản dịch thứ hai
 *
 * Story đứng vào đúng chỗ `useScaleCalibration` đứng, nên nó định dạng số bằng
 * chính `@/lib/format` mà hook dùng (A15). Đây không phải view: view nhận chuỗi
 * đã xong và không được biết tới `formatNumber`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import {
  createScale,
  millimetresPerPixel,
  pixels,
  type Pixels,
  type Scale,
} from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import {
  formatArea,
  formatDrawingScaleRatio,
  formatLength,
  formatScaleDensity,
} from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { ScaleCalibration } from './ScaleCalibration';
import type {
  DimensionStringRow,
  ImageRatioBox,
  ScaleApplyScopeOption,
  ScaleCalibrationActions,
  ScaleCalibrationProps,
  ScaleCalibrationState,
  ScaleCanvasViewModel,
  ScaleComputationViewModel,
  ScaleCrossCheckRow,
  ScaleMethodOption,
  ScalePanelViewModel,
  ScaleShortcutHint,
  ScaleStatusBarViewModel,
  ScaleWarningNotice,
} from './types';

/** Story không nối dây; mọi hành động là một hàm không làm gì. */
const NO_OP = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Ví dụ của chính đặc tả: 4.800 mm ÷ 400 px = 12 mm/px.                       */
/* -------------------------------------------------------------------------- */

const REFERENCE_PIXEL_LENGTH: Pixels = pixels(400);
const REFERENCE_REAL_LENGTH = millimetres(4800);
const REFERENCE_SCALE: Scale = createScale({
  pixelLength: REFERENCE_PIXEL_LENGTH,
  realLength: REFERENCE_REAL_LENGTH,
});

/**
 * Cạnh ngắn của ảnh bản vẽ, tính bằng pixel.
 *
 * Con số này là ví dụ đã tính sẵn của `formatDrawingScaleRatio` — ở 12 mm/px nó
 * cho ra đúng `"1:100"`, tỷ lệ nguyên đồ mà đặc tả nêu.
 */
const SAMPLE_SHORT_EDGE_PX: Pixels = pixels(2475);

/** Đuôi đơn vị pixel — cùng chuỗi `useScaleCalibration` gắn, không có bản thứ hai. */
const PIXEL_SUFFIX = ' px';

/** Ví dụ `"400 px"`. Số do `formatNumber` viết; chỗ này không chọn số chữ số. */
function pixelLabel(value: Pixels): string {
  return `${formatNumber(value)}${PIXEL_SUFFIX}`;
}

/** Tỷ lệ nguyên đồ và mật độ của thanh trạng thái, đã định dạng (A15). */
const SAMPLE_SCALE_RATIO = formatDrawingScaleRatio(
  REFERENCE_SCALE.millimetresPerPixel,
  SAMPLE_SHORT_EDGE_PX,
);
const SAMPLE_SCALE_DENSITY = formatScaleDensity(REFERENCE_SCALE.millimetresPerPixel);

/** Số hàng chuỗi kích thước một story hiện — đủ để thấy danh sách, không phủ kín màn. */
const STORY_ROW_COUNT = 6;

/* -------------------------------------------------------------------------- */
/* Chuỗi kích thước — 34 `Dimension` thật của bộ mẫu A14.                       */
/* -------------------------------------------------------------------------- */

/** Hộp bao trên khung ảnh, tỉ lệ `0..1`. Xếp so le để nhìn ra từng hàng. */
function boxAt(index: number): ImageRatioBox {
  const top = index * 0.06;

  return { min: { x: 0.12, y: top }, max: { x: 0.34, y: top + 0.04 } };
}

/**
 * Chuỗi kích thước của bộ mẫu, đã gắn nhãn sẵn như hook sẽ gắn.
 *
 * `lowConfidenceCount` hàng đầu bị hạ độ tin cậy để dựng nửa thứ hai của trạng
 * thái `partial` — hàng tin cậy thấp, gạch chéo, mức cần chú ý.
 */
function sampleRows(lowConfidenceCount = 0): readonly DimensionStringRow[] {
  const graph = createSampleBuilding();

  return graph.dimensions.slice(0, STORY_ROW_COUNT).map((dimension, index) => {
    const realLength = millimetres(dimension.valueMm);
    const pixelLength = REFERENCE_SCALE.millimetresToPixels(realLength);
    const isLowConfidence = index < lowConfidenceCount;

    return {
      id: dimension.id,
      realLength,
      pixelLength,
      confidence: isLowConfidence ? 0.42 : dimension.confidence,
      isLowConfidence,
      boundingBox: boxAt(index),
      valueLabel: formatNumber(realLength),
      pixelLengthLabel: pixelLabel(pixelLength),
      statusCode: isLowConfidence ? 'attention' : 'neutral',
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Ba dòng kiểm chứng — luôn đủ ba.                                            */
/* -------------------------------------------------------------------------- */

const TYPICAL_WALL_THICKNESS = millimetres(220);
const TYPICAL_DOOR_WIDTH = millimetres(900);
const LARGEST_ROOM_AREA_M2 = 24.8;

/** Ba dòng, đúng thứ tự `ScaleCrossCheckId`. `—` khi chưa đo được, không biến mất. */
function crossChecks(isMeasured: boolean): readonly ScaleCrossCheckRow[] {
  return [
    {
      id: 'wallThickness',
      label: 'độ dày tường điển hình',
      valueLabel: isMeasured ? formatLength(TYPICAL_WALL_THICKNESS) : '—',
      expectedRangeLabel: `khoảng hợp lý ${formatLength(millimetres(80))} – ${formatLength(millimetres(400))}`,
      statusCode: 'neutral',
    },
    {
      id: 'doorWidth',
      label: 'bề rộng cửa đi điển hình',
      valueLabel: isMeasured ? formatLength(TYPICAL_DOOR_WIDTH) : '—',
      expectedRangeLabel: `khoảng hợp lý từ ${formatLength(millimetres(600))} trở lên`,
      statusCode: 'neutral',
    },
    {
      id: 'largestRoomArea',
      label: 'diện tích phòng lớn nhất',
      valueLabel: isMeasured ? formatArea(LARGEST_ROOM_AREA_M2) : '—',
      expectedRangeLabel: `khoảng hợp lý từ ${formatArea(4)} trở lên`,
      statusCode: 'neutral',
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Các mảnh dùng lại.                                                          */
/* -------------------------------------------------------------------------- */

const METHOD_OPTIONS: readonly ScaleMethodOption[] = [
  { value: 'dimensionString', label: 'Từ chuỗi kích thước', isDisabled: false },
  { value: 'referenceLine', label: 'Vẽ đường tham chiếu', isDisabled: false },
];

/** Trạng thái `empty`: không có chuỗi nào, nên mục thứ nhất khoá lại nhưng vẫn hiện. */
const METHOD_OPTIONS_WITHOUT_DIMENSIONS: readonly ScaleMethodOption[] = [
  { value: 'dimensionString', label: 'Từ chuỗi kích thước', isDisabled: true },
  { value: 'referenceLine', label: 'Vẽ đường tham chiếu', isDisabled: false },
];

const APPLY_SCOPE_OPTIONS: readonly ScaleApplyScopeOption[] = [
  { value: 'allFloors', label: 'Áp cho mọi tầng' },
  { value: 'thisFloor', label: 'Chỉ áp cho tầng này' },
];

const SHORTCUT_HINTS: readonly ScaleShortcutHint[] = [
  { id: 'cancelDrag', comboLabel: 'Esc', description: 'huỷ đoạn đang kéo' },
  { id: 'axisLock', comboLabel: 'Shift', description: 'khoá đoạn theo trục' },
  { id: 'remeasure', comboLabel: 'R', description: 'đo lại' },
  { id: 'confirm', comboLabel: 'Enter', description: 'xác nhận' },
  { id: 'nudgeFine', comboLabel: '←', description: 'nhích đầu đoạn một pixel' },
  { id: 'nudgeCoarse', comboLabel: 'Shift + ←', description: 'nhích đầu đoạn mười pixel' },
];

/** Phép tính đã đủ ba vế — `4.800 mm ÷ 400 px = 12 mm/px`. */
const COMPLETE_COMPUTATION: ScaleComputationViewModel = {
  numeratorLabel: formatLength(REFERENCE_REAL_LENGTH),
  denominatorLabel: pixelLabel(REFERENCE_PIXEL_LENGTH),
  resultLabel: formatScaleDensity(REFERENCE_SCALE.millimetresPerPixel),
  isComplete: true,
};

/** Thiếu tử số, và chỗ trống đọc được vẫn có mặt — view vẫn vẽ đủ ba phần. */
const INCOMPLETE_COMPUTATION: ScaleComputationViewModel = {
  numeratorLabel: '—',
  denominatorLabel: pixelLabel(REFERENCE_PIXEL_LENGTH),
  resultLabel: '—',
  isComplete: false,
};

/** Cảnh báo tường ba mét — đúng ví dụ đặc tả, và nó KHÔNG chặn nút áp. */
const IMPLAUSIBLE_WARNING: ScaleWarningNotice = {
  warning: {
    kind: 'implausible',
    proposed: millimetresPerPixel(250),
    impliedWallThickness: millimetres(3000),
  },
  message: `Giá trị này cho ra bức tường dày ${formatLength(millimetres(3000))}. Kiểm tra lại đơn vị hoặc chiều dài tham chiếu.`,
  statusCode: 'attention',
};

const STATUS_BAR: ScaleStatusBarViewModel = {
  x: pixels(1240),
  y: pixels(860),
  scaleRatio: SAMPLE_SCALE_RATIO,
  scaleDensity: SAMPLE_SCALE_DENSITY,
  saveText: 'đã lưu lúc 14:32',
};

/** Mọi hành động là một hàm rỗng: story vẽ, không lái gì. */
const ACTIONS: ScaleCalibrationActions = {
  onChangeMethod: NO_OP,
  onSelectDimensionRow: NO_OP,
  onHoverDimensionRow: NO_OP,
  onStartDrag: NO_OP,
  onMoveDrag: NO_OP,
  onEndDrag: NO_OP,
  onCancelDrag: NO_OP,
  onNudgeEndpoint: NO_OP,
  onChangeRealLength: NO_OP,
  onConfirmRealLength: NO_OP,
  onRemeasure: NO_OP,
  onPan: NO_OP,
  onZoom: NO_OP,
  onMoveCursor: NO_OP,
  onCanvasSizeChange: NO_OP,
  onApply: NO_OP,
  onChangeApplyScope: NO_OP,
  onToggleCollapsed: NO_OP,
  onGoToPreprocessing: NO_OP,
  onRetry: NO_OP,
};

/* -------------------------------------------------------------------------- */
/* Canvas và panel theo từng trạng thái.                                       */
/* -------------------------------------------------------------------------- */

const SAMPLE_IMAGE_URL = 'sample-floor-plan.png';

function canvasFor(state: ScaleCalibrationState): ScaleCanvasViewModel {
  const rows = state === 'empty' ? [] : sampleRows(state === 'partial' ? 2 : 0);

  return {
    imageUrl: state === 'loading' ? null : SAMPLE_IMAGE_URL,
    altText: 'Bản vẽ đã nắn của tầng 1',
    viewport: { x: 0, y: 0, zoom: 1 },
    dimensionRows: rows,
    highlightedRowId: null,
    selectedRowId: state === 'success' ? (rows[0]?.id ?? null) : null,
    focusBox: state === 'success' ? boxAt(0) : null,
    referenceLine: null,
    liveLengthLabel: null,
    isInteractive: state !== 'forbidden',
    isImageLoading: state === 'loading',
    warpingNotice:
      state === 'error'
        ? 'Nắn ảnh thất bại nên bản vẽ có thể méo. Tỷ lệ đo trên một bản vẽ méo sẽ sai theo.'
        : null,
  };
}

function panelFor(state: ScaleCalibrationState): ScalePanelViewModel {
  const isEmpty = state === 'empty';
  const isPartial = state === 'partial';
  const rows = isEmpty ? [] : sampleRows(isPartial ? 2 : 0);
  const hasScale = !isEmpty && state !== 'loading';

  return {
    currentScaleLabel: hasScale ? SAMPLE_SCALE_DENSITY : '—',
    derivedLine: hasScale
      ? `1 pixel = ${formatLength(REFERENCE_SCALE.pixelsToMillimetres(pixels(1)))} · bản vẽ ở tỷ lệ khoảng ${SAMPLE_SCALE_RATIO}`
      : 'chưa đủ dữ liệu để suy ra tỷ lệ nguyên đồ',
    method: isEmpty ? 'referenceLine' : 'dimensionString',
    methodOptions: isEmpty ? METHOD_OPTIONS_WITHOUT_DIMENSIONS : METHOD_OPTIONS,
    methodNotice: isEmpty
      ? 'Không đọc được chuỗi kích thước nào trên bản vẽ này, nên chỉ còn cách vẽ đường tham chiếu.'
      : null,
    dimension: {
      rows,
      selectedRowId: state === 'success' ? (rows[0]?.id ?? null) : null,
      emptyNotice: isEmpty
        ? 'OCR không tìm thấy chuỗi kích thước nào trên bản vẽ này. Vẽ một đường tham chiếu dọc cạnh đã biết để đặt tỷ lệ bằng tay.'
        : null,
      lowConfidenceNotice: isPartial
        ? 'Có 2 chuỗi đọc được với độ tin cậy thấp, đã đánh dấu mức cần chú ý.'
        : null,
      manualCalibrationReason: isEmpty ? 'tooFewSamples' : null,
    },
    reference: {
      draft: null,
      activeStep: 'draw',
      livePixelLengthLabel: null,
      realLengthText: '',
      realLengthPlaceholder: '4800',
      realLengthHint: isEmpty
        ? 'Không có chuỗi kích thước nào gần đoạn này để gợi ý.'
        : `OCR đọc được ${formatNumber(REFERENCE_REAL_LENGTH)} ngay cạnh đoạn này.`,
      resultLabel: null,
      inlineWarning: null,
      canRemeasure: false,
    },
    computation: isEmpty || isPartial ? INCOMPLETE_COMPUTATION : COMPLETE_COMPUTATION,
    crossChecks: crossChecks(hasScale),
    warnings: isPartial ? [IMPLAUSIBLE_WARNING] : [],
    applyScope: 'thisFloor',
    applyScopeOptions: APPLY_SCOPE_OPTIONS,
    canApply: hasScale,
    isApplying: false,
    areActionsHidden: state === 'forbidden',
    recalculationCaption: 'Đổi tỷ lệ sẽ tính lại mọi kích thước dẫn xuất của bản vẽ này.',
    statusCode: state === 'success' ? 'verified' : 'neutral',
    shortcutHints: SHORTCUT_HINTS,
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Props đầy đủ của một trạng thái.
 *
 * Bảy nhánh, và `SevenState` là một union đóng — nên bỏ sót một trạng thái là
 * lỗi biên dịch ở đây, và `expectSevenStates` bắt lại lần nữa lúc chạy.
 */
export function scenarioFor(state: SevenState): ScaleCalibrationProps {
  return {
    actions: ACTIONS,
    model: {
      state,
      canvas: canvasFor(state),
      panel: panelFor(state),
      statusBar:
        state === 'loading' ? { ...STATUS_BAR, saveText: 'đang tải bản vẽ…' } : STATUS_BAR,
      isCompact: false,
      isPanelCollapsed: state === 'collapsed',
      prefersReducedMotion: false,
      errorMessage:
        state === 'error'
          ? 'Tỷ lệ đo trên một bản vẽ méo sẽ sai theo. Quay lại bước tiền xử lý để nắn lại ảnh, rồi hiệu chỉnh tỷ lệ.'
          : null,
      errorCode: state === 'error' ? 'FRAME_NOT_FOUND' : null,
      emptyNotice:
        state === 'empty'
          ? 'Bản vẽ này không có chuỗi kích thước nào OCR đọc được. Vẽ một đường tham chiếu dọc cạnh đã biết, rồi nhập chiều dài thật của nó.'
          : null,
      partialNotice:
        state === 'partial'
          ? 'Đã có đoạn tham chiếu nhưng chưa có chiều dài thật, hoặc một số chuỗi kích thước đọc được với độ tin cậy thấp.'
          : null,
      forbiddenNotice:
        state === 'forbidden'
          ? 'Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp.'
          : null,
      successNotice:
        state === 'success' ? 'Mọi kích thước dẫn xuất đã được tính lại theo tỷ lệ mới.' : null,
    },
  };
}

/** Bảy kịch bản, dựng sẵn — test dùng chính bộ này, không dựng bộ thứ hai (R-70). */
export const SEVEN_SCENARIOS: readonly ScaleCalibrationProps[] = SEVEN_STATES.map(scenarioFor);

/** Khung hẹp: panel phải thành tấm trượt đáy. */
export function compactScenario(): ScaleCalibrationProps {
  const base = scenarioFor('partial');

  return { ...base, model: { ...base.model, isCompact: true } };
}

/** Giảm chuyển động: không chạy số, không bay khung nhìn (mục B). */
export function reducedMotionScenario(): ScaleCalibrationProps {
  const base = scenarioFor('success');

  return { ...base, model: { ...base.model, prefersReducedMotion: true } };
}

/* -------------------------------------------------------------------------- */
/* Storybook.                                                                  */
/* -------------------------------------------------------------------------- */

const meta = {
  title: 'Màn hình/Hiệu chỉnh tỷ lệ',
  component: ScaleCalibration,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ScaleCalibration>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: scenarioFor('empty') };

export const DangTai: Story = { args: scenarioFor('loading') };

export const MotPhan: Story = { args: scenarioFor('partial') };

export const Loi: Story = { args: scenarioFor('error') };

export const Xong: Story = { args: scenarioFor('success') };

export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

export const ThuGon: Story = { args: scenarioFor('collapsed') };

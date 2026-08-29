/**
 * Nửa "suy nghĩ" của màn Hiệu chỉnh tỷ lệ — mọi thứ ba file view cần, đã xong.
 *
 * `types.ts` là hợp đồng props DUY NHẤT của màn; hook này trả về đúng
 * {@link UseScaleCalibrationResult}, không hơn không kém. Mọi chuỗi người đọc
 * được ghép và định dạng ở đây (A15), nên view không còn con số thô nào phải làm
 * tròn, chia, hay đổi đơn vị.
 *
 * ## Không một phép chia nào trong file này
 *
 * Tỷ lệ là thứ màn này tồn tại để tìm, nên nó là thứ màn này TUYỆT ĐỐI không
 * được tự tính. `4800` và `400` đi vào `createScale` của `src/domain/units/scale`
 * (M-02), `12 mm/px` đi ra. Cùng lý lẽ đó áp cho mọi phép chia khác: quy một
 * toạ độ pixel về tỉ lệ `0..1` của khung ảnh cũng là một phép đổi đơn vị, và nó
 * đi qua {@link frameScaleOf} — một `Scale` thật, dựng bằng chính `createScale`,
 * trong đó "một khung ảnh" đóng vai đơn vị lớn và "một pixel ảnh" đóng vai đơn
 * vị nhỏ. Không có ký tự `/` làm phép chia ở bất kỳ đâu trong file này.
 *
 * ## Bắt điểm: `snapToTargets`, và chỉ nó
 *
 * M-03 có ba cửa vào; cửa đúng cho một con trỏ là `snapToTargets`, vì chính nó
 * giữ bảng ưu tiên `SNAP_PRIORITY` (đỉnh tường → giao điểm → trung điểm → chân
 * vuông góc → **lưới**). Gọi thêm `snapToGrid` bên cạnh nó là dựng lại nhánh
 * cuối của bảng đó ở ngoài, tức mở đường cho hai câu trả lời khác nhau cho cùng
 * một con trỏ. Lưới 50 mm, bán kính bắt 120 mm là **mặc định của chính hàm**
 * (`SNAP_THRESHOLDS`), nên không con số nào được viết ở đây (R-71).
 *
 * `snapAngle` thì gọi thẳng: nó là thứ khoá đoạn theo trục khi giữ Shift, và
 * bước khoá lấy từ `ORTHOGONAL_LOCK_STEP_DEG` của `src/domain/measure`. Góc là
 * đại lượng không đơn vị nên nhánh này chạy được cả khi bản vẽ chưa có tỷ lệ —
 * còn bắt điểm vào lưới mi-li-mét thì không, và hook nói ra điều đó bằng cách
 * đơn giản là không bắt: một lưới 50 mm trên bản vẽ chưa biết tỷ lệ là một con
 * số không có nghĩa.
 *
 * ## Chạy số: 260 ms ở đây, 120 ms ở view
 *
 * `useCountUp` chạy đúng một tốc độ — `standard`, 260 ms — và chính chú thích
 * của nó (`lib/motion/useCountUp.ts:28-34`) giải thích vì sao 240 ms của đặc tả
 * không tồn tại. Đó đúng là quyết định C2, nên nhãn tỷ lệ sau khi áp chạy số
 * qua hook. Con số pixel lúc ĐANG KÉO thì không: nó phải bám con trỏ, và một
 * lượt chạy 260 ms sẽ hiện một con số không phải chỗ con trỏ đang đứng. Slot
 * 120 ms của nó là một chuyển tiếp CSS ở canvas (`cssDurationMs('instant')`),
 * đúng như bảng 1.2 của hợp đồng props phân công.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không một ô trạng thái tự viết nào cho việc đang tải, cũng không cho lỗi đọc:
 * cả hai thuộc về tầng query. `useState` ở đây chỉ giữ trạng thái của riêng giao diện: cách xác định đang chọn, hàng
 * đang chọn/đang rê, đoạn đang vẽ, nội dung ô nhập, phạm vi áp, panel thu gọn,
 * kích thước canvas, toạ độ con trỏ.
 *
 * ## Thứ tự bảy trạng thái
 *
 * `types.ts` viết bảy bất biến dưới dạng "⟺". Hai trong số đó không thể cùng
 * đúng theo nghĩa hai chiều tuyệt đối: khi chưa đọc được chuỗi kích thước nào
 * mà người dùng đã kéo một đoạn, màn vừa "rỗng" (bất biến 3) vừa "dở dang"
 * (bất biến 4). Thứ tự ở đây chọn nghĩa dùng được: `loading` → `error` →
 * `forbidden` → `collapsed` → `success` → `partial` (đã bắt tay vào làm) →
 * `empty`. Mọi cờ mà bất biến nhắc tới (`canvas.isImageLoading`,
 * `canvas.isInteractive`, `panel.areActionsHidden`, `isPanelCollapsed`,
 * `panel.statusCode`, `errorMessage`) được suy NGƯỢC từ trạng thái đã chọn, nên
 * chiều còn lại của mỗi "⟺" luôn đúng theo cấu trúc.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { isEntityOfKind } from '@/domain/spatial/normalize';
import { ORTHOGONAL_LOCK_STEP_DEG } from '@/domain/measure/constraints';
import {
  MAX_WALL_THICKNESS_MM,
  MIN_DOOR_WIDTH_MM,
  MIN_ROOM_AREA_M2,
  MIN_WALL_THICKNESS_MM,
} from '@/domain/rules/registry';
import { parseLength } from '@/domain/units/parse';
import {
  classifyScaleRange,
  compareScaleToAiEstimate,
  createScale,
  inferScale,
  inferWallThicknessFromScale,
  pixels,
  scaleFromRatio,
  type MillimetresPerPixel,
  type Pixels,
  type Scale,
  type ScaleInference,
  type ScaleMeasurement,
} from '@/domain/units/scale';
import { snapAngle, snapToTargets, type SnapTarget } from '@/domain/units/snap';
import type { PointMm } from '@/domain/units/compare';
import {
  degrees,
  degreesToRadians,
  millimetres,
  radians,
  radiansToDegrees,
  rectangleArea,
  type Millimetres,
} from '@/domain/units/types';
import { useAutosave } from '@/hooks/useAutosave';
import { useCanvasViewport } from '@/hooks/useCanvasViewport';
import { useCountUp } from '@/hooks/useCountUp';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import { formatArea, formatDrawingScaleRatio, formatLength, formatScaleDensity } from '@/lib/format/measure';
import { formatNumber, formatPercent, MISSING_VALUE } from '@/lib/format/number';
import { CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';
import { formatCombo, parseCombo } from '@/lib/input/shortcutRegistry';
import { MODIFIER_SHORTCUTS } from '@/lib/tools/shortcuts';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import { commit } from '@/store/commit';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import {
  createAppScaleCalibrationGateway,
  type ScaleCalibrationGateway,
  type ScaleDrawingSnapshot,
  type ScaleRawDimensionString,
  type ScaleRawSnapTarget,
  type ScaleRoomBoxPx,
} from './scaleCalibrationGateway';
import type {
  DimensionStringRow,
  ImageRatioPoint,
  NudgeDirection,
  NudgeStep,
  ReferenceLineDraft,
  ReferenceLineEndpoint,
  ScaleApplyScope,
  ScaleApplyScopeOption,
  ScaleCalibrationActions,
  ScaleCalibrationMethod,
  ScaleCalibrationState,
  ScaleCalibrationViewModel,
  ScaleComputationViewModel,
  ScaleCrossCheckRow,
  ScaleMethodOption,
  ScalePointerModifiers,
  ScaleReferenceStep,
  ScaleShortcutHint,
  ScaleWarning,
  ScaleWarningNotice,
  UseScaleCalibrationOptions,
  UseScaleCalibrationResult,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của riêng hook.                                            */
/* Bản sao khai báo nằm ở notes/scale-calibration/i18n-keys.fragment.json.      */
/* -------------------------------------------------------------------------- */

const COPY = {
  canvasAltPrefix: 'Bản vẽ đã nắn của ',
  canvasAltEmpty: 'Chưa có bản vẽ nào để hiệu chỉnh.',
  currentScaleUnknown: 'chưa có',
  derivedLineUnknown: 'chưa đủ dữ liệu để suy ra tỷ lệ nguyên đồ',
  methodDimensionString: 'Từ chuỗi kích thước',
  methodReferenceLine: 'Vẽ đường tham chiếu',
  methodDimensionDisabled:
    'Không đọc được chuỗi kích thước nào trên bản vẽ này, nên chỉ còn cách vẽ đường tham chiếu.',
  dimensionEmpty:
    'OCR không tìm thấy chuỗi kích thước nào trên bản vẽ này. Vẽ một đường tham chiếu dọc cạnh đã biết để đặt tỷ lệ bằng tay.',
  tooFewSamples: 'Chưa đủ chuỗi kích thước để suy ra tỷ lệ, nên phải đặt bằng tay.',
  lowConfidenceInference: 'Độ tin cậy chung còn thấp, nên tỷ lệ phải được xác nhận bằng tay.',
  realLengthPlaceholder: '4800',
  realLengthNoHint: 'Không có chuỗi kích thước nào gần đoạn này để gợi ý.',
  crossCheckWallThickness: 'độ dày tường điển hình',
  crossCheckDoorWidth: 'bề rộng cửa đi điển hình',
  crossCheckLargestRoomArea: 'diện tích phòng lớn nhất',
  recalculationCaption: 'Đổi tỷ lệ sẽ tính lại mọi kích thước dẫn xuất của bản vẽ này.',
  scopeAllFloors: 'Áp cho mọi tầng',
  scopeThisFloor: 'Chỉ áp cho tầng này',
  shortcutCancelDrag: 'huỷ đoạn đang kéo',
  shortcutRemeasure: 'đo lại',
  shortcutConfirm: 'xác nhận',
  shortcutNudgeFine: 'nhích đầu đoạn một pixel',
  shortcutNudgeCoarse: 'nhích đầu đoạn mười pixel',
  shortcutAxisLock: 'khoá đoạn theo trục',
  warpingNotice:
    'Nắn ảnh thất bại nên bản vẽ có thể méo. Tỷ lệ đo trên một bản vẽ méo sẽ sai theo.',
  emptyNotice:
    'Bản vẽ này không có chuỗi kích thước nào OCR đọc được. Vẽ một đường tham chiếu dọc cạnh đã biết, rồi nhập chiều dài thật của nó.',
  partialNotice:
    'Đã có đoạn tham chiếu nhưng chưa có chiều dài thật, hoặc một số chuỗi kích thước đọc được với độ tin cậy thấp.',
  forbiddenNotice:
    'Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp.',
  successNotice: 'Mọi kích thước dẫn xuất đã được tính lại theo tỷ lệ mới.',
  applyCommitLabel: 'Áp dụng tỷ lệ',
} as const;

/** Ví dụ `"1 pixel = 12 mm · bản vẽ ở tỷ lệ khoảng 1:100"`. */
const derivedLine = (millimetresLabel: string, ratioLabel: string): string =>
  `1 pixel = ${millimetresLabel} · bản vẽ ở tỷ lệ khoảng ${ratioLabel}`;

/** Ví dụ `"Có 2 chuỗi đọc được với độ tin cậy thấp, đã đánh dấu mức cần chú ý."`. */
const lowConfidenceNotice = (count: string): string =>
  `Có ${count} chuỗi đọc được với độ tin cậy thấp, đã đánh dấu mức cần chú ý.`;

/** Ví dụ `"OCR đọc được 4.800 ngay cạnh đoạn này."`. */
const realLengthHint = (value: string): string => `OCR đọc được ${value} ngay cạnh đoạn này.`;

/** Ví dụ `"khoảng hợp lý 60 mm – 400 mm"`. */
const expectedRange = (min: string, max: string): string => `khoảng hợp lý ${min} – ${max}`;

/** Ví dụ `"khoảng hợp lý từ 700 mm trở lên"` — khoảng chỉ có một đầu, và nói thật là vậy. */
const expectedRangeFrom = (min: string): string => `khoảng hợp lý từ ${min} trở lên`;

/** Ví dụ `"Giá trị này cho ra bức tường dày 3 m. Kiểm tra lại đơn vị hoặc chiều dài tham chiếu."`. */
const implausibleMessage = (thickness: string): string =>
  `Giá trị này cho ra bức tường dày ${thickness}. Kiểm tra lại đơn vị hoặc chiều dài tham chiếu.`;

/** Ví dụ `"Tỷ lệ này lệch +25% so với ước tính 12 mm/px của AI. …"`. */
const deviationMessage = (percent: string, estimated: string): string =>
  `Tỷ lệ này lệch ${percent} so với ước tính ${estimated} của AI. ` +
  'Bạn vẫn áp được, nhưng nên kiểm lại chiều dài tham chiếu.';

/* -------------------------------------------------------------------------- */
/* Hằng của riêng màn.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Bước nhích một đầu đoạn bằng phím mũi tên, tính bằng pixel ảnh.
 *
 * Hai con số này viết ở đây theo đúng chỉ dẫn của `types.ts` (`NudgeStep`):
 * view không được viết hằng số, nên chúng nằm ở hook, một chỗ duy nhất.
 */
const NUDGE_PX: Readonly<Record<NudgeStep, number>> = { fine: 1, coarse: 10 };

/** `< 1024px` — cùng mốc `InputQualityGate`, `FloorUploadScreen`, `ProcessingScreen`. */
const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

/** Một khung ảnh, đơn vị lớn của {@link frameScaleOf}. */
const ONE_IMAGE_FRAME = 1;

/** Đơn vị của con số pixel khi in ra. */
const PIXEL_SUFFIX = ' px';

const EMPTY_ROWS: readonly ScaleRawDimensionString[] = [];
const EMPTY_SNAP_TARGETS: readonly ScaleRawSnapTarget[] = [];

/* -------------------------------------------------------------------------- */
/* Quy đổi toạ độ — chỗ DUY NHẤT một phép chia xảy ra, và nó xảy ra ở domain.   */
/* -------------------------------------------------------------------------- */

/**
 * Khung ảnh, coi như một phép đo.
 *
 * Ảnh rộng `widthPx` pixel và rộng đúng một khung. Đó chính là hình dạng
 * `createScale` nhận: một chiều dài pixel cùng chiều dài thật nó ứng với. Nên
 * `pixelsToMillimetres` ở đây đọc là "pixel ảnh → tỉ lệ `0..1` của khung", và
 * `millimetresToPixels` đọc là chiều ngược lại. Phép chia nằm trong M-02, không
 * nằm ở màn — đúng luật màn này tồn tại để giữ.
 */
function frameScaleOf(edgePx: Pixels): Scale {
  return createScale({ pixelLength: edgePx, realLength: millimetres(ONE_IMAGE_FRAME) });
}

/** Hai cạnh ảnh, đã thành hai phép đổi. `null` khi tầng chưa được đo. */
interface ImageFrame {
  readonly widthPx: Pixels;
  readonly heightPx: Pixels;
  readonly acrossScale: Scale;
  readonly upScale: Scale;
}

function imageFrameOf(drawing: ScaleDrawingSnapshot | null): ImageFrame | null {
  if (drawing === null || drawing.widthPx === null || drawing.heightPx === null) {
    return null;
  }

  return {
    widthPx: drawing.widthPx,
    heightPx: drawing.heightPx,
    acrossScale: frameScaleOf(drawing.widthPx),
    upScale: frameScaleOf(drawing.heightPx),
  };
}

/** Một điểm trên ảnh, tính bằng pixel ảnh. */
interface PixelPoint {
  readonly x: Pixels;
  readonly y: Pixels;
}

/** Tỉ lệ `0..1` của khung → pixel ảnh. Chỉ có phép nhân. */
function toPixelPoint(frame: ImageFrame, point: ImageRatioPoint): PixelPoint {
  return {
    x: frame.acrossScale.millimetresToPixels(millimetres(point.x)),
    y: frame.upScale.millimetresToPixels(millimetres(point.y)),
  };
}

/** Pixel ảnh → tỉ lệ `0..1` của khung. Phép chia do M-02 làm. */
function toRatioPoint(frame: ImageFrame, point: PixelPoint): ImageRatioPoint {
  return {
    x: frame.acrossScale.pixelsToMillimetres(point.x),
    y: frame.upScale.pixelsToMillimetres(point.y),
  };
}

/** Chiều dài một đoạn trên ảnh, tính bằng pixel. */
function segmentPixelLength(start: PixelPoint, end: PixelPoint): Pixels {
  return pixels(Math.hypot(end.x - start.x, end.y - start.y));
}

/* -------------------------------------------------------------------------- */
/* Định dạng — mọi con số thành chữ ở đây (A15).                                */
/* -------------------------------------------------------------------------- */

/** Ví dụ `"400 px"`. Số do `formatNumber` viết, hook không chọn số chữ số. */
function pixelLabel(value: Pixels | null): string {
  return value === null ? MISSING_VALUE : `${formatNumber(value)}${PIXEL_SUFFIX}`;
}

/** Ví dụ `"4.800 mm"`. */
function millimetreLabel(value: Millimetres | null): string {
  return value === null ? MISSING_VALUE : formatLength(value, { unit: 'mm' });
}

/** Ví dụ `"+25%"` / `"-4,5%"`. Dấu cộng phải ghép tay: `formatPercent` chỉ tự thêm dấu trừ. */
function signedPercentLabel(value: number): string {
  const written = formatPercent(value);
  return value > 0 ? `+${written}` : written;
}

/* -------------------------------------------------------------------------- */
/* Ngưỡng "khoảng hợp lý" của ba dòng kiểm chứng.                               */
/* -------------------------------------------------------------------------- */

/**
 * Diện tích phòng nhỏ nhất mà sổ luật còn coi là dùng được.
 *
 * `MIN_ROOM_AREA_M2` là một bảng theo công năng, không phải một con số, và số
 * `0` trong bảng nghĩa là "công năng này không có mức tối thiểu nào" chứ không
 * phải "không mét vuông nào cũng được". Nên mức nền chung là giá trị dương nhỏ
 * nhất trong bảng, tính ra chứ không chép lại.
 */
const SMALLEST_ROOM_MINIMUM_M2 = Math.min(
  ...Object.values(MIN_ROOM_AREA_M2).filter((value) => value > 0),
);

/* -------------------------------------------------------------------------- */
/* Trạng thái của phiên kéo.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Đoạn tham chiếu, giữ theo PIXEL ẢNH.
 *
 * Pixel là đơn vị đoạn này được đo bằng, nên nó là đơn vị đúng để giữ; tỉ lệ
 * `0..1` mà view cần chỉ được dựng ra ở bước cuối, một lần, cho một khung ảnh
 * đã biết. Giữ theo tỉ lệ thì mỗi lần đo lại phải nhân ngược, và một tầng chưa
 * đo được độ phân giải sẽ khiến cả phiên kéo mất nghĩa giữa chừng.
 */
interface DragSession {
  readonly start: PixelPoint;
  readonly end: PixelPoint;
  readonly isDragging: boolean;
  readonly isAxisLocked: boolean;
  readonly snappedKind: ReferenceLineDraft['snappedKind'];
  readonly snappedEndpoint: ReferenceLineEndpoint | null;
}

/** Đầu đoạn phím mũi tên đang nhích. */
type NudgeTarget = ReferenceLineEndpoint;

/* -------------------------------------------------------------------------- */
/* Bản ghi một lượt đọc.                                                        */
/* -------------------------------------------------------------------------- */

interface ScaleCalibrationRecord {
  readonly drawing: ScaleDrawingSnapshot;
  readonly dimensionStrings: readonly ScaleRawDimensionString[];
  readonly referenceWallWidthPx: Pixels | null;
  readonly typicalDoorWidthPx: Pixels | null;
  readonly largestRoomBoxPx: ScaleRoomBoxPx | null;
  readonly snapTargets: readonly ScaleRawSnapTarget[];
}

/* -------------------------------------------------------------------------- */
/* Tham số vào.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Tham số thật của hook.
 *
 * `types.ts` đóng băng trước khi `scaleCalibrationGateway.ts` tồn tại, nên cổng
 * dữ liệu được thêm bằng cách MỞ RỘNG ở đây — đúng cách hợp lệ duy nhất mà
 * chính `types.ts` chỉ ra.
 */
export interface UseScaleCalibrationHookOptions extends UseScaleCalibrationOptions {
  /** Cổng dữ liệu. Có mặc định thật bên trong; test và story cắm bản giả vào. */
  readonly gateway?: ScaleCalibrationGateway;
}

/* -------------------------------------------------------------------------- */
/* Hai hook phụ.                                                                */
/* -------------------------------------------------------------------------- */

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };
    media.addEventListener('change', listener);
    return () => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

/** Cổng đã tiêm, hoặc bản thật dựng đúng một lần và chỉ khi cần. */
function useResolvedGateway(injected?: ScaleCalibrationGateway): ScaleCalibrationGateway {
  const fallbackRef = useRef<ScaleCalibrationGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createAppScaleCalibrationGateway();
  return fallbackRef.current;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                        */
/* -------------------------------------------------------------------------- */

/** `(options) => UseScaleCalibrationResult` cho `ScaleCalibration.container.tsx`. */
export function useScaleCalibration(
  options: UseScaleCalibrationHookOptions,
): UseScaleCalibrationResult {
  const { floorId, projectId } = options;
  const roles = options.roles ?? DEFAULT_ROLES;
  const gateway = useResolvedGateway(options.gateway);

  const prefersReducedMotion = useReducedMotion();
  const detectedNarrow = useNarrowViewport();

  /* ---------------------------------------------------------------------- */
  /* Trạng thái máy chủ (R-64) — một khoá đệm cho bản vẽ của tầng.           */
  /* ---------------------------------------------------------------------- */

  const query = useQuery({
    queryKey: queryKeys.drawing.byFloor(floorId),
    queryFn: async (): Promise<ScaleCalibrationRecord> => {
      const drawing = await gateway.readFloorDrawing({ floorId, projectId });

      if (!drawing.ok) {
        throw drawing.error;
      }

      const [strings, wallWidth, doorWidth, roomBox, targets] = await Promise.all([
        gateway.readDimensionStrings({ floorId, projectId }),
        gateway.readReferenceWallWidth({ floorId, projectId }),
        gateway.readTypicalDoorWidth({ floorId, projectId }),
        gateway.readLargestRoomBox({ floorId, projectId }),
        gateway.readSnapTargets({ floorId, projectId }),
      ]);

      return {
        drawing: drawing.data,
        dimensionStrings: strings.supported ? strings.value : EMPTY_ROWS,
        referenceWallWidthPx: wallWidth.supported ? wallWidth.value : null,
        typicalDoorWidthPx: doorWidth.supported ? doorWidth.value : null,
        largestRoomBoxPx: roomBox.supported ? roomBox.value : null,
        snapTargets: targets.supported ? targets.value : EMPTY_SNAP_TARGETS,
      };
    },
  });

  const record = query.data ?? null;
  const drawing = record?.drawing ?? null;
  const frame = useMemo(() => imageFrameOf(drawing), [drawing]);

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [method, setMethod] = useState<ScaleCalibrationMethod>('dimensionString');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [nudgeTarget, setNudgeTarget] = useState<NudgeTarget>('end');
  const [realLengthText, setRealLengthText] = useState('');
  const [applyScope, setApplyScope] = useState<ScaleApplyScope>('thisFloor');
  const [isCollapsedByUser, setIsCollapsedByUser] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ readonly width: number; readonly height: number }>({
    width: 0,
    height: 0,
  });
  const [cursorPoint, setCursorPoint] = useState<ImageRatioPoint | null>(null);
  const [hasApplied, setHasApplied] = useState(false);

  const { viewport, pan, zoomTo, flyToBounds } = useCanvasViewport();

  /* ---------------------------------------------------------------------- */
  /* Tỷ lệ đã áp — nguồn sự thật là store, không phải một bản sao ở đây.      */
  /* ---------------------------------------------------------------------- */

  const storedRatio = useStore((state) => {
    const entity = state.spatial?.byId[floorId];

    if (entity === undefined || !isEntityOfKind('level', entity)) {
      return null;
    }

    return entity.scaleMillimetresPerPixel ?? null;
  });

  const appliedScale = useMemo<Scale | null>(
    () => (storedRatio === null ? null : scaleFromRatio(storedRatio)),
    [storedRatio],
  );

  /* ---------------------------------------------------------------------- */
  /* Ước tính của AI.                                                        */
  /* ---------------------------------------------------------------------- */

  const rawRows = record?.dimensionStrings ?? EMPTY_ROWS;

  const aiInference = useMemo<ScaleInference | null>(() => {
    if (rawRows.length === 0) {
      return null;
    }

    const measurements: readonly ScaleMeasurement[] = rawRows.map((row) => ({
      id: row.id,
      pixelLength: row.pixelLength,
      realLength: row.realLength,
    }));

    return inferScale(measurements);
  }, [rawRows]);

  const aiSuggestion = aiInference?.suggestedMillimetresPerPixel ?? null;

  /* ---------------------------------------------------------------------- */
  /* Hai vế của phép tính.                                                   */
  /* ---------------------------------------------------------------------- */

  const selectedRow = rawRows.find((row) => row.id === selectedRowId) ?? null;

  const draftPixelLength = useMemo<Pixels | null>(
    () => (drag === null ? null : segmentPixelLength(drag.start, drag.end)),
    [drag],
  );

  const typedLength = useMemo<Millimetres | null>(() => {
    const parsed = parseLength(realLengthText, { defaultUnit: 'mm' });
    return parsed.ok ? parsed.value : null;
  }, [realLengthText]);

  /**
   * Hai vế đang xét: hàng đã chọn thắng, vì chọn một chuỗi kích thước là một
   * câu trả lời dứt khoát; đoạn vẽ tay chỉ nói lên điều gì khi đã có chiều dài.
   */
  const numerator: Millimetres | null =
    method === 'dimensionString' ? (selectedRow?.realLength ?? null) : typedLength;
  const denominator: Pixels | null =
    method === 'dimensionString' ? (selectedRow?.pixelLength ?? null) : draftPixelLength;

  /** Tỷ lệ đang đề nghị — do M-02 tính, không do màn chia. */
  const proposedScale = useMemo<Scale | null>(() => {
    if (numerator === null || denominator === null || numerator <= 0 || denominator <= 0) {
      return null;
    }

    return createScale({ pixelLength: denominator, realLength: numerator });
  }, [denominator, numerator]);

  const proposedRatio = proposedScale?.millimetresPerPixel ?? null;

  /** Tỷ lệ dùng để bắt điểm và để suy ra ba dòng kiểm chứng, theo thứ tự tin cậy. */
  const workingRatio: MillimetresPerPixel | null = proposedRatio ?? storedRatio ?? aiSuggestion;

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (D-07 / A7) — 800 ms là mặc định của chính `useAutosave`.         */
  /* ---------------------------------------------------------------------- */

  const persistRef = useRef({ floorId, gateway, projectId, appliesToEveryFloor: false });
  persistRef.current = {
    floorId,
    gateway,
    projectId,
    appliesToEveryFloor: applyScope === 'allFloors',
  };

  const handleSave = useCallback(async (): Promise<void> => {
    const current = persistRef.current;
    const entity = useStore.getState().spatial?.byId[current.floorId];

    if (entity === undefined || !isEntityOfKind('level', entity)) {
      return;
    }

    const ratio = entity.scaleMillimetresPerPixel;

    if (ratio === undefined) {
      return;
    }

    await current.gateway.persistScale({
      floorId: current.floorId,
      projectId: current.projectId,
      millimetresPerPixel: ratio,
      appliesToEveryFloor: current.appliesToEveryFloor,
    });
  }, []);

  const saveLabel = useAutosave(handleSave);

  /* ---------------------------------------------------------------------- */
  /* Bắt điểm (M-03).                                                        */
  /* ---------------------------------------------------------------------- */

  const snapTargetsMm = useMemo<readonly SnapTarget[]>(() => {
    const raw = record?.snapTargets ?? EMPTY_SNAP_TARGETS;

    if (workingRatio === null || raw.length === 0) {
      return [];
    }

    const scale = scaleFromRatio(workingRatio);

    return raw.map((target) => ({
      kind: target.kind,
      id: target.id,
      position: { x: scale.pixelsToMillimetres(target.xPx), y: scale.pixelsToMillimetres(target.yPx) },
    }));
  }, [record?.snapTargets, workingRatio]);

  /**
   * Một đầu đoạn sau khi đã khoá trục và đã bắt điểm.
   *
   * Khoá trục chạy trước và chạy được cả khi bản vẽ chưa có tỷ lệ, vì góc không
   * có đơn vị. Bắt điểm chạy sau và chỉ chạy khi đã có một tỷ lệ để quy đổi:
   * lưới 50 mm trên một bản vẽ chưa biết tỷ lệ không nói lên điều gì.
   */
  const resolveEndpoint = useCallback(
    (
      anchor: PixelPoint,
      moving: PixelPoint,
      isAxisLocked: boolean,
    ): { readonly point: PixelPoint; readonly kind: ReferenceLineDraft['snappedKind'] } => {
      let point = moving;

      if (isAxisLocked) {
        const across = point.x - anchor.x;
        const up = point.y - anchor.y;
        const heading = radiansToDegrees(radians(Math.atan2(up, across)));
        const locked = snapAngle(heading, ORTHOGONAL_LOCK_STEP_DEG);
        const alongRadians = degreesToRadians(degrees(locked));
        const length = Math.hypot(across, up);
        point = {
          x: pixels(anchor.x + Math.cos(alongRadians) * length),
          y: pixels(anchor.y + Math.sin(alongRadians) * length),
        };
      }

      if (workingRatio === null) {
        return { point, kind: null };
      }

      const scale = scaleFromRatio(workingRatio);
      const asMm: PointMm = {
        x: scale.pixelsToMillimetres(point.x),
        y: scale.pixelsToMillimetres(point.y),
      };
      const snapped = snapToTargets(asMm, snapTargetsMm);

      return {
        point: {
          x: scale.millimetresToPixels(snapped.point.x),
          y: scale.millimetresToPixels(snapped.point.y),
        },
        kind: snapped.snapped ? snapped.kind : null,
      };
    },
    [snapTargetsMm, workingRatio],
  );

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                              */
  /* ---------------------------------------------------------------------- */

  const onNavigateRef = useRef(options.onNavigate);
  onNavigateRef.current = options.onNavigate;

  const navigate = useCallback((path: string) => {
    onNavigateRef.current?.(path);
  }, []);

  const frameRef = useRef(frame);
  frameRef.current = frame;

  const onChangeMethod = useCallback((next: ScaleCalibrationMethod) => {
    setMethod(next);
  }, []);

  const onHoverDimensionRow = useCallback((rowId: string | null) => {
    setHighlightedRowId(rowId);
  }, []);

  const rowsRef = useRef(rawRows);
  rowsRef.current = rawRows;
  const canvasSizeRef = useRef(canvasSize);
  canvasSizeRef.current = canvasSize;

  /**
   * Chọn một chuỗi kích thước: tính ngay, rồi bay khung nhìn tới hộp bao của nó
   * trong 340 ms (R-07). `flyToBounds` tự đọc mức "giảm chuyển động" của hệ
   * điều hành, nên khung nhìn nhảy thẳng tới đích khi người dùng đã tắt hiệu ứng.
   */
  const onSelectDimensionRow = useCallback(
    (rowId: string) => {
      setSelectedRowId(rowId);
      setMethod('dimensionString');

      const row = rowsRef.current.find((entry) => entry.id === rowId);
      const currentFrame = frameRef.current;
      const size = canvasSizeRef.current;

      if (row === undefined || currentFrame === null || size.width <= 0 || size.height <= 0) {
        return;
      }

      const min = toPixelPoint(currentFrame, row.boundingBox.min);
      const max = toPixelPoint(currentFrame, row.boundingBox.max);

      flyToBounds(
        { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y },
        size.width,
        size.height,
      );
    },
    [flyToBounds],
  );

  const onStartDrag = useCallback((point: ImageRatioPoint) => {
    const currentFrame = frameRef.current;

    if (currentFrame === null) {
      return;
    }

    const at = toPixelPoint(currentFrame, point);
    setMethod('referenceLine');
    setNudgeTarget('end');
    setDrag({
      start: at,
      end: at,
      isDragging: true,
      isAxisLocked: false,
      snappedKind: null,
      snappedEndpoint: null,
    });
  }, []);

  const onMoveDrag = useCallback(
    (point: ImageRatioPoint, modifiers: ScalePointerModifiers) => {
      const currentFrame = frameRef.current;

      if (currentFrame === null) {
        return;
      }

      const moving = toPixelPoint(currentFrame, point);

      setDrag((session) => {
        if (session === null) {
          return session;
        }

        const resolved = resolveEndpoint(session.start, moving, modifiers.isAxisLocked);

        return {
          ...session,
          end: resolved.point,
          isDragging: true,
          isAxisLocked: modifiers.isAxisLocked,
          snappedKind: resolved.kind,
          snappedEndpoint: resolved.kind === null ? null : 'end',
        };
      });
    },
    [resolveEndpoint],
  );

  const onEndDrag = useCallback(
    (point: ImageRatioPoint) => {
      const currentFrame = frameRef.current;

      if (currentFrame === null) {
        return;
      }

      const moving = toPixelPoint(currentFrame, point);

      setDrag((session) => {
        if (session === null) {
          return session;
        }

        const resolved = resolveEndpoint(session.start, moving, session.isAxisLocked);

        return {
          ...session,
          end: resolved.point,
          isDragging: false,
          snappedKind: resolved.kind,
          snappedEndpoint: resolved.kind === null ? null : 'end',
        };
      });
    },
    [resolveEndpoint],
  );

  const onCancelDrag = useCallback(() => {
    setDrag((session) => (session === null || !session.isDragging ? session : null));
  }, []);

  const onNudgeEndpoint = useCallback(
    (endpoint: ReferenceLineEndpoint, direction: NudgeDirection, step: NudgeStep) => {
      const distance = NUDGE_PX[step];
      const acrossStep = direction === 'left' ? -distance : direction === 'right' ? distance : 0;
      const upStep = direction === 'up' ? -distance : direction === 'down' ? distance : 0;

      setNudgeTarget(endpoint);
      setDrag((session) => {
        if (session === null) {
          return session;
        }

        const moved: PixelPoint = {
          x: pixels(session[endpoint].x + acrossStep),
          y: pixels(session[endpoint].y + upStep),
        };

        return { ...session, [endpoint]: moved, isDragging: false };
      });
    },
    [],
  );

  const onChangeRealLength = useCallback((text: string) => {
    setRealLengthText(text);
  }, []);

  const onConfirmRealLength = useCallback(() => {
    setDrag((session) => (session === null ? session : { ...session, isDragging: false }));
  }, []);

  const onRemeasure = useCallback(() => {
    setDrag(null);
    setRealLengthText('');
    setNudgeTarget('end');
  }, []);

  const onPan = useCallback(
    (dx: number, dy: number) => {
      pan(dx, dy);
    },
    [pan],
  );

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const onZoom = useCallback(
    (nextZoom: number, focus: ImageRatioPoint | null) => {
      const currentFrame = frameRef.current;

      if (focus === null || currentFrame === null) {
        zoomTo(nextZoom);
        return;
      }

      // Con trỏ nằm ở đâu trên canvas: gốc khung nhìn cộng vị trí trên ảnh đã
      // phóng. Chỉ có phép nhân, và nó là phép biến đổi ngược của chính cách
      // canvas vẽ ảnh.
      const at = toPixelPoint(currentFrame, focus);
      const current = viewportRef.current;
      zoomTo(nextZoom, current.x + at.x * current.zoom, current.y + at.y * current.zoom);
    },
    [zoomTo],
  );

  const onMoveCursor = useCallback((point: ImageRatioPoint | null) => {
    // `null` giữ nguyên điểm cuối cùng biết được: thanh trạng thái nói toạ độ
    // con trỏ vừa rời khỏi, không nháy về gốc toạ độ.
    setCursorPoint((previous) => point ?? previous);
  }, []);

  const onChangeApplyScope = useCallback((scope: ScaleApplyScope) => {
    setApplyScope(scope);
  }, []);

  const onToggleCollapsed = useCallback(() => {
    setIsCollapsedByUser((collapsed) => !collapsed);
  }, []);

  const onGoToPreprocessing = useCallback(() => {
    navigate(ROUTES.project.quality(projectId));
  }, [navigate, projectId]);

  const onRetry = useCallback(() => {
    void query.refetch();
  }, [query]);

  const onCanvasSizeChange = useCallback((widthPx: number, heightPx: number) => {
    setCanvasSize((size) =>
      size.width === widthPx && size.height === heightPx
        ? size
        : { width: widthPx, height: heightPx },
    );
  }, []);

  /**
   * Áp tỷ lệ.
   *
   * Một dòng `commit`, đúng như điều phối viên đã chốt: `Level` đã có trường
   * `scaleMillimetresPerPixel`, `applyPatch` đã nhận `update` cho `kind: 'level'`,
   * và zundo theo dõi đúng slice `spatial` — nên hoàn tác chạy thật và toast
   * Hoàn tác của A8 tự hiện qua `lastCommitLabel`. Không hộp thoại, không lệnh
   * tự chế, không ngăn xếp hoàn tác thứ hai.
   */
  const proposedRatioRef = useRef(proposedRatio);
  proposedRatioRef.current = proposedRatio;

  const onApply = useCallback(() => {
    const ratio = proposedRatioRef.current;

    if (ratio === null) {
      return;
    }

    // Mã tầng đến từ đường dẫn nên nó chỉ là `string`; `LevelId` là mã đã qua
    // kiểm. Lấy nó ra khỏi chính đồ thị bằng `isEntityOfKind` thay vì ép kiểu:
    // không có tầng đó trong dữ liệu đang mở thì cũng không có gì để vá.
    const entity = useStore.getState().spatial?.byId[floorId];

    if (entity === undefined || !isEntityOfKind('level', entity)) {
      return;
    }

    commit(
      {
        op: 'update',
        kind: 'level',
        id: entity.id,
        changes: { scaleMillimetresPerPixel: ratio },
      },
      COPY.applyCommitLabel,
    );

    setHasApplied(true);
  }, [floorId]);

  /* ---------------------------------------------------------------------- */
  /* Phím tắt (I-01) — không một `addEventListener` nào ở đây (R-72).        */
  /* ---------------------------------------------------------------------- */

  const nudgeTargetRef = useRef(nudgeTarget);
  nudgeTargetRef.current = nudgeTarget;

  const nudge = useCallback(
    (direction: NudgeDirection, step: NudgeStep) => {
      onNudgeEndpoint(nudgeTargetRef.current, direction, step);
    },
    [onNudgeEndpoint],
  );

  useShortcut({
    id: 'scaleCalibration.cancelDrag',
    combo: 'Escape',
    scope: 'canvas',
    description: COPY.shortcutCancelDrag,
    onTrigger: onCancelDrag,
  });
  useShortcut({
    id: 'scaleCalibration.remeasure',
    combo: 'R',
    scope: 'canvas',
    description: COPY.shortcutRemeasure,
    onTrigger: onRemeasure,
  });
  useShortcut({
    id: 'scaleCalibration.confirm',
    combo: 'Enter',
    scope: 'canvas',
    description: COPY.shortcutConfirm,
    onTrigger: onConfirmRealLength,
  });
  useShortcut({
    id: 'scaleCalibration.nudgeUp',
    combo: 'ArrowUp',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeFine,
    onTrigger: () => {
      nudge('up', 'fine');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeDown',
    combo: 'ArrowDown',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeFine,
    onTrigger: () => {
      nudge('down', 'fine');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeLeft',
    combo: 'ArrowLeft',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeFine,
    onTrigger: () => {
      nudge('left', 'fine');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeRight',
    combo: 'ArrowRight',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeFine,
    onTrigger: () => {
      nudge('right', 'fine');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeUpCoarse',
    combo: 'Shift+ArrowUp',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeCoarse,
    onTrigger: () => {
      nudge('up', 'coarse');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeDownCoarse',
    combo: 'Shift+ArrowDown',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeCoarse,
    onTrigger: () => {
      nudge('down', 'coarse');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeLeftCoarse',
    combo: 'Shift+ArrowLeft',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeCoarse,
    onTrigger: () => {
      nudge('left', 'coarse');
    },
  });
  useShortcut({
    id: 'scaleCalibration.nudgeRightCoarse',
    combo: 'Shift+ArrowRight',
    scope: 'canvas',
    allowRepeat: true,
    description: COPY.shortcutNudgeCoarse,
    onTrigger: () => {
      nudge('right', 'coarse');
    },
  });

  /* ---------------------------------------------------------------------- */
  /* Hàng chuỗi kích thước.                                                  */
  /* ---------------------------------------------------------------------- */

  const rows = useMemo<readonly DimensionStringRow[]>(
    () =>
      rawRows.map((row) => {
        const isLowConfidence = row.confidence < CONFIDENCE_SUGGESTED_THRESHOLD;

        return {
          id: row.id,
          pixelLength: row.pixelLength,
          realLength: row.realLength,
          confidence: row.confidence,
          isLowConfidence,
          boundingBox: row.boundingBox,
          valueLabel: formatNumber(row.realLength),
          pixelLengthLabel: pixelLabel(row.pixelLength),
          // A5: đây là đầu ra của AI, nên không bao giờ mang màu "đã xác minh".
          statusCode: isLowConfidence ? 'attention' : 'neutral',
        };
      }),
    [rawRows],
  );

  const lowConfidenceCount = rows.filter((row) => row.isLowConfidence).length;

  /* ---------------------------------------------------------------------- */
  /* Cảnh báo — cả hai CHỈ cảnh báo, không hạ `canApply`.                    */
  /* ---------------------------------------------------------------------- */

  const warnings = useMemo<readonly ScaleWarningNotice[]>(() => {
    if (proposedRatio === null) {
      return [];
    }

    const notices: ScaleWarningNotice[] = [];
    const referenceWallWidthPx = record?.referenceWallWidthPx ?? null;

    if (referenceWallWidthPx !== null) {
      const implied = inferWallThicknessFromScale(proposedRatio, referenceWallWidthPx);
      const rangeStatus = classifyScaleRange(proposedRatio);

      if (implied.implausible || rangeStatus !== 'inRange') {
        const warning: ScaleWarning = {
          kind: 'implausible',
          proposed: proposedRatio,
          impliedWallThickness: implied.thicknessMm,
        };
        notices.push({
          warning,
          message: implausibleMessage(formatLength(implied.thicknessMm)),
          statusCode: 'attention',
        });
      }
    }

    if (aiSuggestion !== null) {
      const deviation = compareScaleToAiEstimate(proposedRatio, aiSuggestion);

      if (deviation.exceedsLimit) {
        const warning: ScaleWarning = {
          kind: 'deviatesFromEstimate',
          proposed: proposedRatio,
          estimated: aiSuggestion,
          // Bất biến của `types.ts`: `0..1`. Dấu của lệch nằm trong CÂU, chỗ nó
          // nói được điều gì, chứ không nằm trong con số đo độ lớn.
          relativeDifference: Math.abs(deviation.relativeDeviation),
        };
        notices.push({
          warning,
          message: deviationMessage(
            signedPercentLabel(deviation.relativeDeviation),
            formatScaleDensity(aiSuggestion),
          ),
          statusCode: 'attention',
        });
      }
    }

    return notices;
  }, [aiSuggestion, proposedRatio, record?.referenceWallWidthPx]);

  /* ---------------------------------------------------------------------- */
  /* Ba dòng kiểm chứng — luôn đủ ba.                                        */
  /* ---------------------------------------------------------------------- */

  const crossChecks = useMemo<readonly ScaleCrossCheckRow[]>(() => {
    const ratio = workingRatio;
    const scale = ratio === null ? null : scaleFromRatio(ratio);
    const wallWidthPx = record?.referenceWallWidthPx ?? null;
    const doorWidthPx = record?.typicalDoorWidthPx ?? null;
    const roomBoxPx = record?.largestRoomBoxPx ?? null;

    const wallThickness =
      ratio === null || wallWidthPx === null
        ? null
        : inferWallThicknessFromScale(ratio, wallWidthPx).thicknessMm;
    const doorWidth = scale === null || doorWidthPx === null ? null : scale.pixelsToMillimetres(doorWidthPx);
    const roomArea =
      scale === null || roomBoxPx === null
        ? null
        : rectangleArea(
            scale.pixelsToMillimetres(roomBoxPx.widthPx),
            scale.pixelsToMillimetres(roomBoxPx.heightPx),
          );

    return [
      {
        id: 'wallThickness',
        label: COPY.crossCheckWallThickness,
        valueLabel: millimetreLabel(wallThickness),
        expectedRangeLabel: expectedRange(
          formatLength(MIN_WALL_THICKNESS_MM, { unit: 'mm' }),
          formatLength(MAX_WALL_THICKNESS_MM, { unit: 'mm' }),
        ),
        statusCode:
          wallThickness !== null &&
          (wallThickness < MIN_WALL_THICKNESS_MM || wallThickness > MAX_WALL_THICKNESS_MM)
            ? 'attention'
            : 'neutral',
      },
      {
        id: 'doorWidth',
        label: COPY.crossCheckDoorWidth,
        valueLabel: millimetreLabel(doorWidth),
        // Sổ luật chỉ có mức tối thiểu cho cửa đi, nên khoảng chỉ có một đầu và
        // câu chữ nói đúng như vậy — không bịa một biên trên không tồn tại.
        expectedRangeLabel: expectedRangeFrom(formatLength(MIN_DOOR_WIDTH_MM, { unit: 'mm' })),
        statusCode: doorWidth !== null && doorWidth < MIN_DOOR_WIDTH_MM ? 'attention' : 'neutral',
      },
      {
        id: 'largestRoomArea',
        label: COPY.crossCheckLargestRoomArea,
        valueLabel: roomArea === null ? MISSING_VALUE : formatArea(roomArea),
        expectedRangeLabel: expectedRangeFrom(formatArea(SMALLEST_ROOM_MINIMUM_M2)),
        statusCode:
          roomArea !== null && roomArea < SMALLEST_ROOM_MINIMUM_M2 ? 'attention' : 'neutral',
      },
    ];
  }, [
    record?.largestRoomBoxPx,
    record?.referenceWallWidthPx,
    record?.typicalDoorWidthPx,
    workingRatio,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái.                                                         */
  /* ---------------------------------------------------------------------- */

  const canEdit = can('edit', 'layer', { roles });
  const isCompact = detectedNarrow;
  const isPanelCollapsed = options.forceCollapsed ?? isCollapsedByUser;
  const isComputationComplete = numerator !== null && denominator !== null;
  const hasStartedWork = drag !== null || selectedRowId !== null;

  const state = useMemo<ScaleCalibrationState>(() => {
    if (query.isPending) {
      return 'loading';
    }

    if (query.isError || drawing?.isWarped === true) {
      return 'error';
    }

    if (!canEdit) {
      return 'forbidden';
    }

    if (isPanelCollapsed) {
      return 'collapsed';
    }

    if (hasApplied) {
      return 'success';
    }

    if (hasStartedWork || lowConfidenceCount > 0) {
      return 'partial';
    }

    if (rows.length === 0) {
      return 'empty';
    }

    return 'partial';
  }, [
    canEdit,
    drawing?.isWarped,
    hasApplied,
    hasStartedWork,
    isPanelCollapsed,
    lowConfidenceCount,
    query.isError,
    query.isPending,
    rows.length,
  ]);

  const errorDescription = useMemo(() => {
    if (state !== 'error') {
      return null;
    }

    if (query.isError) {
      return describeError(toAppError(query.error));
    }

    // Nắn ảnh hỏng không phải lỗi mạng: câu chữ đã có sẵn ở COPY, còn mã máy
    // đọc lấy từ chính bảng lỗi chứ không gõ tay (A6 cho phép chữ hoa ở mã lỗi).
    const appError = toAppError(new Error(COPY.warpingNotice));
    return { ...describeError(appError), description: COPY.warpingNotice, code: appError.code };
  }, [query.error, query.isError, state]);

  const errorCode = useMemo(() => {
    if (state !== 'error') {
      return null;
    }

    return toAppError(query.isError ? query.error : new Error(COPY.warpingNotice)).code;
  }, [query.error, query.isError, state]);

  /* ---------------------------------------------------------------------- */
  /* Chạy số 260 ms cho nhãn tỷ lệ sau khi áp (C2).                          */
  /* ---------------------------------------------------------------------- */

  const displayRatio = storedRatio ?? proposedRatio;
  const countedScale = useCountUp(displayRatio ?? 0, { reducedMotion: prefersReducedMotion });
  const currentScaleLabel =
    displayRatio === null
      ? COPY.currentScaleUnknown
      : formatScaleDensity(countedScale.done ? displayRatio : countedScale.value);

  /* ---------------------------------------------------------------------- */
  /* Viewmodel.                                                              */
  /* ---------------------------------------------------------------------- */

  const shortEdgePx =
    frame === null ? null : Math.min(frame.widthPx, frame.heightPx);

  const scaleRatioLabel =
    displayRatio === null || shortEdgePx === null
      ? MISSING_VALUE
      : formatDrawingScaleRatio(displayRatio, shortEdgePx);

  const scaleDensityLabel =
    displayRatio === null ? MISSING_VALUE : formatScaleDensity(displayRatio);

  const draftForView = useMemo<ReferenceLineDraft | null>(() => {
    if (drag === null || frame === null) {
      return null;
    }

    return {
      start: toRatioPoint(frame, drag.start),
      end: toRatioPoint(frame, drag.end),
      pixelLength: segmentPixelLength(drag.start, drag.end),
      snappedKind: drag.snappedKind,
      snappedEndpoint: drag.snappedEndpoint,
      isDragging: drag.isDragging,
      isAxisLocked: drag.isAxisLocked,
    };
  }, [drag, frame]);

  const computation = useMemo<ScaleComputationViewModel>(
    () => ({
      numeratorLabel: millimetreLabel(numerator),
      denominatorLabel: pixelLabel(denominator),
      resultLabel: proposedRatio === null ? MISSING_VALUE : formatScaleDensity(proposedRatio),
      isComplete: isComputationComplete,
    }),
    [denominator, isComputationComplete, numerator, proposedRatio],
  );

  const methodOptions = useMemo<readonly ScaleMethodOption[]>(
    () => [
      {
        value: 'dimensionString',
        label: COPY.methodDimensionString,
        isDisabled: rows.length === 0,
      },
      { value: 'referenceLine', label: COPY.methodReferenceLine, isDisabled: false },
    ],
    [rows.length],
  );

  const applyScopeOptions = useMemo<readonly ScaleApplyScopeOption[]>(
    () => [
      { value: 'allFloors', label: COPY.scopeAllFloors },
      { value: 'thisFloor', label: COPY.scopeThisFloor },
    ],
    [],
  );

  const shortcutHints = useMemo<readonly ScaleShortcutHint[]>(() => {
    const pressed = (
      [
        ['scaleCalibration.cancelDrag', 'Escape', COPY.shortcutCancelDrag],
        ['scaleCalibration.remeasure', 'R', COPY.shortcutRemeasure],
        ['scaleCalibration.confirm', 'Enter', COPY.shortcutConfirm],
        ['scaleCalibration.nudgeFine', 'ArrowLeft', COPY.shortcutNudgeFine],
        ['scaleCalibration.nudgeCoarse', 'Shift+ArrowLeft', COPY.shortcutNudgeCoarse],
      ] as const
    ).map(([id, combo, description]) => ({
      id,
      comboLabel: formatCombo(parseCombo(combo)),
      description,
    }));

    // Shift khoá theo trục là một phím GIỮ, không phải một tổ hợp: `parseCombo`
    // từ chối nó vì nó không có phím chính, và `shortcutRegistry` không bao giờ
    // gọi một binding như vậy. Nhãn của nó lấy từ bảng `MODIFIER_SHORTCUTS` —
    // nơi repo đã đặt tên cho đúng phím ấy — chứ không gõ lại.
    const axisLock = MODIFIER_SHORTCUTS.find((entry) => entry.modifier === 'lockAxis');

    return axisLock === undefined
      ? pressed
      : [
          ...pressed,
          {
            id: 'scaleCalibration.axisLock',
            comboLabel: axisLock.keyLabel,
            description: COPY.shortcutAxisLock,
          },
        ];
  }, []);

  const activeStep: ScaleReferenceStep =
    draftForView === null ? 'draw' : isComputationComplete ? 'result' : 'enterLength';

  const nearestOcrValue = rawRows[0]?.realLength ?? null;

  const isEmptyState = state === 'empty';
  const effectiveMethod: ScaleCalibrationMethod = rows.length === 0 ? 'referenceLine' : method;

  const cursorPixels = useMemo<PixelPoint>(() => {
    if (frame === null || cursorPoint === null) {
      return { x: pixels(0), y: pixels(0) };
    }

    return toPixelPoint(frame, cursorPoint);
  }, [cursorPoint, frame]);

  const model = useMemo<ScaleCalibrationViewModel>(() => {
    const canApply = proposedRatio !== null;

    return {
      state,
      canvas: {
        imageUrl: state === 'loading' ? null : (drawing?.imageUrl ?? null),
        altText:
          drawing === null ? COPY.canvasAltEmpty : `${COPY.canvasAltPrefix}${drawing.floorName}`,
        viewport,
        dimensionRows: rows,
        highlightedRowId,
        selectedRowId,
        focusBox: rows.find((row) => row.id === selectedRowId)?.boundingBox ?? null,
        referenceLine: draftForView,
        liveLengthLabel:
          draftForView === null || !draftForView.isDragging
            ? null
            : pixelLabel(draftForView.pixelLength),
        isInteractive: state !== 'forbidden',
        isImageLoading: state === 'loading',
        warpingNotice: state === 'error' ? COPY.warpingNotice : null,
      },
      panel: {
        currentScaleLabel,
        derivedLine:
          displayRatio === null
            ? COPY.derivedLineUnknown
            : derivedLine(
                formatLength(millimetres(displayRatio), { unit: 'mm' }),
                scaleRatioLabel,
              ),
        method: effectiveMethod,
        methodOptions,
        methodNotice: rows.length === 0 ? COPY.methodDimensionDisabled : null,
        dimension: {
          rows,
          selectedRowId,
          emptyNotice: rows.length === 0 ? COPY.dimensionEmpty : null,
          lowConfidenceNotice:
            lowConfidenceCount === 0 ? null : lowConfidenceNotice(formatNumber(lowConfidenceCount)),
          manualCalibrationReason:
            aiInference !== null && aiInference.status === 'needsManualCalibration'
              ? aiInference.reason
              : null,
        },
        reference: {
          draft: draftForView,
          activeStep,
          livePixelLengthLabel:
            draftForView === null ? null : pixelLabel(draftForView.pixelLength),
          realLengthText,
          realLengthPlaceholder: COPY.realLengthPlaceholder,
          realLengthHint:
            nearestOcrValue === null
              ? COPY.realLengthNoHint
              : realLengthHint(formatNumber(nearestOcrValue)),
          resultLabel: proposedRatio === null ? null : formatScaleDensity(proposedRatio),
          // Cùng một cảnh báo với khối dưới, đặt cạnh ô nhập: nó hiện NGAY KHI
          // GÕ vì `realLengthText` là thứ nuôi `proposedRatio`, không đợi rời ô.
          inlineWarning: warnings[0] ?? null,
          canRemeasure: draftForView !== null,
        },
        computation,
        crossChecks,
        warnings,
        applyScope,
        applyScopeOptions,
        canApply,
        isApplying: saveLabel === null && hasApplied,
        areActionsHidden: state === 'forbidden',
        recalculationCaption: COPY.recalculationCaption,
        statusCode: state === 'success' ? 'verified' : 'neutral',
        shortcutHints,
      },
      statusBar: {
        x: cursorPixels.x,
        y: cursorPixels.y,
        scaleRatio: scaleRatioLabel,
        scaleDensity: scaleDensityLabel,
        saveText: saveLabel ?? '',
      },
      isCompact,
      isPanelCollapsed: state === 'collapsed',
      prefersReducedMotion,
      errorMessage: errorDescription?.description ?? null,
      errorCode,
      emptyNotice: isEmptyState ? COPY.emptyNotice : null,
      partialNotice: state === 'partial' ? COPY.partialNotice : null,
      forbiddenNotice: state === 'forbidden' ? COPY.forbiddenNotice : null,
      successNotice: state === 'success' ? COPY.successNotice : null,
    };
  }, [
    activeStep,
    aiInference,
    applyScope,
    applyScopeOptions,
    computation,
    crossChecks,
    currentScaleLabel,
    cursorPixels,
    displayRatio,
    draftForView,
    drawing,
    effectiveMethod,
    errorCode,
    errorDescription,
    hasApplied,
    highlightedRowId,
    isCompact,
    isEmptyState,
    lowConfidenceCount,
    methodOptions,
    nearestOcrValue,
    prefersReducedMotion,
    proposedRatio,
    realLengthText,
    rows,
    saveLabel,
    scaleDensityLabel,
    scaleRatioLabel,
    selectedRowId,
    shortcutHints,
    state,
    viewport,
    warnings,
  ]);

  const actions = useMemo<ScaleCalibrationActions>(
    () => ({
      onChangeMethod,
      onSelectDimensionRow,
      onHoverDimensionRow,
      onStartDrag,
      onMoveDrag,
      onEndDrag,
      onCancelDrag,
      onNudgeEndpoint,
      onChangeRealLength,
      onConfirmRealLength,
      onRemeasure,
      onPan,
      onZoom,
      onMoveCursor,
      onCanvasSizeChange,
      onApply,
      onChangeApplyScope,
      onToggleCollapsed,
      onGoToPreprocessing,
      onRetry,
    }),
    [
      onApply,
      onCancelDrag,
      onCanvasSizeChange,
      onChangeApplyScope,
      onChangeMethod,
      onChangeRealLength,
      onConfirmRealLength,
      onEndDrag,
      onGoToPreprocessing,
      onHoverDimensionRow,
      onMoveCursor,
      onMoveDrag,
      onNudgeEndpoint,
      onPan,
      onRemeasure,
      onRetry,
      onSelectDimensionRow,
      onStartDrag,
      onToggleCollapsed,
      onZoom,
    ],
  );

  return { model, actions, appliedScale, aiInference };
}

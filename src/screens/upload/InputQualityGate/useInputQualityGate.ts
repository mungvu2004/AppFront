/**
 * Toàn bộ phần suy nghĩ của màn Cổng chất lượng đầu vào: đọc phép đo, xếp ba
 * mức, ghép câu phát hiện, nối phím mũi tên, và quyết định khi nào người dùng
 * đi tiếp được.
 *
 * Mục D chia đôi: file này giữ trạng thái và làm mọi phép quyết định; view chỉ
 * vẽ những gì `types.ts` mô tả. Mọi con số người dùng đọc — độ phân giải, độ
 * nghiêng, tương phản, nhiễu, độ tin cậy — đã thành chuỗi ở đây (A15), nên view
 * không còn gì để làm tròn hay ghép.
 *
 * ## Những thứ file này NỐI LẠI chứ không dựng lại (R-61, R-64, R-69)
 *
 * - **Kết quả đo** — `useQuery` với `queryKeys.quality.assessment(floorId)`.
 *   Không một ô `useState` nào cho "đang tải" hay "lỗi đọc": cả hai thuộc về
 *   tầng query. `hooks/useShareLinks.ts` tự viết hai thứ đó và CLAUDE.md gọi
 *   tên nó là ngoại lệ đi trước, **không phải khuôn mẫu để chép**.
 * - **Ba mức** — `classifyResolution` / `classifySkew` / `classifyContrast` /
 *   `classifyNoise` / `worstLevel` của `src/domain/quality`. Không một phép so
 *   sánh ngưỡng nào viết trong file này, và không một hằng số ngưỡng nào ở đây:
 *   ngưỡng nằm trong `thresholds.ts` cùng lý lẽ vật lý của nó.
 * - **Hai lượt ghi** — `createOptimisticMutation` (`src/lib/mutations`) cộng
 *   `applyInvalidation` (`src/lib/query`). Cả hai lệnh ghi trả về chính kết quả
 *   đo đã chạy lại, nên `setQueryData` gieo thẳng câu trả lời mới rồi mới làm
 *   mất hiệu lực — không chờ thêm một lượt gọi trả về đúng thứ vừa cầm.
 * - **Không có hoàn tác** — nắn thẳng và gửi bốn góc là hai lượt ghi mà máy chủ
 *   không đảo được, nên không vé, không toast (A8 giả bị cấm); thay vào đó cả
 *   hai hỏi trước bằng hộp thoại (A9) và gửi kèm khoá idempotency của cổng.
 * - **Định dạng số** — `formatNumber` / `formatAngle` của `src/lib/format`, và
 *   `describeConfidence` cho nhãn độ tin cậy. `formatAngle` chỉ ra ký hiệu `°`,
 *   nên mọi câu nói về độ nghiêng viết theo ký hiệu đó.
 * - **Phím tắt** — `useShortcut` (`src/hooks`), bọc `shortcutRegistry`. Không
 *   một `addEventListener('keydown')` nào trong màn (A12, R-72).
 * - **Đọc màn hình** — `getAppAnnouncer()` của `src/lib/input/announcer`.
 *
 * ## Vì sao mức "Tốt" không bao giờ là `'verified'` (A5)
 *
 * Ba mức ở đây là phán quyết của một phép đo tự động. Xanh `'verified'` chỉ
 * đánh dấu việc người duyệt đã làm, nên bảng {@link STATUS_CODE_BY_LEVEL} ánh
 * xạ `'good'` sang `'neutral'` — sự vắng mặt của một trạng thái — chứ không
 * sang màu xanh. `'attention'` sang `'attention'`, `'poor'` sang `'violation'`.
 *
 * ## Bậc thang bảy trạng thái, và chỗ hai bất biến của `types.ts` gặp nhau
 *
 * Thứ tự: `loading` → `error` → `empty` (dự án chưa có bản vẽ, 404 `upload`) →
 * `forbidden` → `collapsed` → `empty` (đạt) → `partial` → `ready`.
 *
 * - `loading`/`error` đứng đầu vì `InputQualityGate.tsx` chỉ dựng hai cột ở
 *   ngoài hai nhánh đó; đẩy bất cứ thứ gì lên trước chúng là vẽ hai cột rỗng —
 *   đúng cái màn trắng mà A11 tồn tại để chặn.
 * - `forbidden` đứng trên `collapsed` vì ẩn hai nút hành động là câu trả lời về
 *   **quyền**, còn tấm trượt đáy là câu trả lời về **bề rộng**. Một khung hẹp
 *   không được trả lại hai cái nút mà vai người dùng không có.
 * - Bất biến 3 (`empty` ⟺ `findings` rỗng) và bất biến 4 (`partial` ⟺
 *   `metrics.length < 4` hoặc còn tầng đang đo) chồng nhau ở đúng một chỗ: tầng
 *   đang xem **chưa đo**, nên nó vừa không có phát hiện nào vừa không đủ bốn
 *   phép kiểm. Ở chỗ đó `partial` thắng, vì `empty` sẽ in ra "Bản vẽ đạt yêu
 *   cầu" cho một bản vẽ chưa ai đo — E.10 cấm đúng loại câu đó. Ngược lại, khi
 *   đủ bốn phép kiểm mà không phát hiện nào thì `empty` thắng `partial`, cùng
 *   thứ tự `useFloorUploadScreen.ts` đã chọn.
 *
 * ## Vì sao vẫn phải đọc danh sách tầng trước, và tầng nào được xem
 *
 * Route chỉ mang mã dự án; `ENDPOINTS.quality.assess` cần một mã tầng. Tầng có
 * `order` nhỏ nhất là mồi cho lượt đọc đầu, và lượt đọc đó trả về mọi tầng —
 * nên danh sách để đổi qua lại nằm sẵn trong chính câu trả lời. Nếu tầng đầu
 * chưa có bản vẽ thì máy chủ trả tầng đầu **có** bản vẽ: `floorId` của câu trả
 * lời đầu được ghi nhớ một lần (`assessedFloorId`) làm tầng đang xem, và chính
 * câu trả lời đó được gieo vào khoá của tầng ấy trước khi khoá đổi — không gửi
 * lượt đọc thứ hai. Sau đó màn **không** tự nhảy sang tầng khác: nhảy lặng lẽ
 * thì thanh tầng nói một đằng còn ảnh vẽ một nẻo.
 *
 * ## Lỗi ghi hiện ra, không nuốt
 *
 * Lỗi được phân loại trong `callServer` (trước khi `createOptimisticMutation`
 * bọc nó thành `AppError`, vốn mất mã dây) rồi `onError` đọc kết quả đó. Câu
 * lỗi hiện ở dải `writeError`; lỗi mà máy chủ có thể đã nhận (mạng, timeout,
 * bản vẽ vừa đổi) còn kéo theo một lượt đọc lại, và hai nút ghi khoá tới khi
 * lượt đọc đó xong.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DrawingCornersInput,
  Floor,
  FloorImageQuality,
  ImageQualityAssessment,
  ImageQualityFinding,
  QualityPoint,
} from '@/api/client';
import {
  classifyContrast,
  classifyNoise,
  classifyResolution,
  classifySkew,
  RESOLUTION_GOOD_SHORT_EDGE_PX,
  worstLevel,
} from '@/domain/quality';
import type { ImageQualityLevel } from '@/domain/quality';
import { degrees, degreesToRadians } from '@/domain/units/types';
import { useShortcut } from '@/hooks/useShortcut';
import { can } from '@/lib/auth/permissions';
import { readWireError } from '@/lib/errors/wireError';
import { formatAngle } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { describeConfidence } from '@/lib/format/semantic';
import { getAppAnnouncer } from '@/lib/input/announcer';
import { createOptimisticMutation } from '@/lib/mutations/createOptimisticMutation';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { createAppInputQualityGateway, type InputQualityGateway } from './inputQualityGateway';
import type { WriteFailureSentence } from './inputQualityWriteErrors';
import type {
  InputQualityConfirmModel,
  InputQualityCorner,
  InputQualityFindingModel,
  InputQualityFloorRow,
  InputQualityFooterModel,
  InputQualityGateActions,
  InputQualityGateModel,
  InputQualityGateStatus,
  InputQualityGateViewProps,
  InputQualityImageModel,
  InputQualityMetricModel,
  InputQualityRegion,
  InputQualitySkewLine,
  QualityLevel,
  QualityMetricId,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi hiển thị — khoá `vi.json` đi kèm ở `i18n-hook.fragment.json`.          */
/* -------------------------------------------------------------------------- */

const COPY = Object.freeze({
  altTextPrefix: 'Bản vẽ tầng',
  altTextSuffix: 'đang xem để kiểm tra chất lượng đầu vào',
  acknowledgement: 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này',
  primary: 'Tiếp tục xử lý',
  secondary: 'Tải bản vẽ khác',
  forecastMissing: 'Chưa dự kiến được độ tin cậy vì bản vẽ chưa đo xong.',
  forecastPrefix: 'Dự kiến độ tin cậy trung bình',
  loadFailureFallback: 'Không đọc được kết quả kiểm tra chất lượng của bản vẽ này.',
  noDrawingNotice: 'Dự án chưa có bản vẽ nào được tải lên, nên chưa có gì để đo.',
  writeFailureFallback: 'Chưa xử lý được bản vẽ; hãy thử lại.',
  confirmCancel: 'Huỷ',
  straightenConfirmTitlePrefix: 'Nắn thẳng bản vẽ tầng',
  straightenConfirmBody:
    'Máy chủ sẽ thay ảnh gốc bằng ảnh đã nắn và xử lý lại tầng này; việc này không hoàn tác được.',
  straightenConfirmLabel: 'Nắn thẳng',
  cornersConfirmTitlePrefix: 'Cắt và nắn bản vẽ tầng',
  cornersConfirmTitleSuffix: 'theo bốn góc',
  cornersConfirmBody:
    'Máy chủ sẽ cắt, nắn lại bản vẽ theo bốn góc và xử lý lại tầng này; việc này không hoàn tác được.',
  cornersConfirmLabel: 'Cắt và nắn',
  notMeasured: 'chưa đo',
  noFinding: 'không có phát hiện',
  straightenAction: 'Tự động nắn',
  pickCornersAction: 'Chọn góc thủ công',
  sendCornersAction: 'Gửi bốn góc đã chọn',
  straightenedAnnouncement: 'Đã nắn thẳng bản vẽ',
  cornersAnnouncement: 'Đã gửi bốn góc khung bản vẽ',
  regionLabelPrefix: 'Vùng ảnh có vấn đề:',
});

/** Nhãn bốn phép kiểm — tiếng Việt, viết thường kiểu câu (A6). */
const METRIC_LABELS: Readonly<Record<QualityMetricId, string>> = {
  contrast: 'độ tương phản',
  noise: 'nhiễu',
  resolution: 'độ phân giải',
  skew: 'độ nghiêng',
};

/**
 * Ba mức sang bốn mã trạng thái của `src/lib/viewmodel`.
 *
 * `'good'` sang `'neutral'`, không bao giờ sang `'verified'` — xem A5 ở đầu
 * file. `'poor'` sang `'violation'` vì đó là mức mà kết quả dò sẽ sai đủ nhiều
 * để phải làm lại đầu vào, không phải một lời nhắc.
 */
const STATUS_CODE_BY_LEVEL: Readonly<Record<QualityLevel, ViewStatusCode>> = {
  attention: 'attention',
  good: 'neutral',
  poor: 'violation',
};

/** Phát hiện nào nói về phép kiểm nào — dùng để neo thẻ chỉ số vào vùng ảnh. */
const METRIC_BY_FINDING_CODE: Readonly<Record<string, QualityMetricId>> = {
  HIGH_NOISE: 'noise',
  LOW_CONTRAST: 'contrast',
  RESOLUTION_TOO_LOW: 'resolution',
  SKEW_DETECTED: 'skew',
};

/** Bốn góc khung bản vẽ, theo chiều kim đồng hồ từ trên-trái — thứ tự của API. */
const CORNER_IDS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const;

/** Khung mặc định lúc mời người dùng tự chọn góc, thụt vào một phần mười khung. */
const CORNER_INSET_RATIO = 0.1;

/** Nửa chiều dài đường vẽ độ nghiêng, theo tỉ lệ khung ảnh. */
const SKEW_LINE_HALF_LENGTH_RATIO = 0.4;

/** Tâm khung ảnh — đường nghiêng xoay quanh đúng điểm này. */
const IMAGE_CENTRE_RATIO = 0.5;

/** Bốn phép kiểm; đủ bốn nghĩa là tầng đang xem đã đo xong. */
const METRIC_COUNT = 4;

/** Vị trí ban đầu của thanh so sánh trước/sau — chia đôi khung. */
const INITIAL_REVEAL_RATIO = 0.5;

/** Tiền tố mã vùng ảnh, để mã vùng không lẫn với mã phát hiện. */
const REGION_ID_PREFIX = 'region-';

/** Vai mặc định khi nơi gọi không nói gì. Mảng rỗng vẫn là "không có quyền". */
const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

/* -------------------------------------------------------------------------- */
/* Cách xếp thu gọn — cùng mốc `FloorUploadScreen` và `ProjectSettings` dùng.   */
/* -------------------------------------------------------------------------- */

const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

function useNarrowViewport(): boolean {
  const [isNarrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_VIEWPORT_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* Định dạng — A15: mọi con số thành chuỗi ở đây, không ở view.                 */
/* -------------------------------------------------------------------------- */

const formatPixels = (value: number): string => formatNumber(value, { fractionDigits: 0 });

/** `"1.240 × 900 px"` — ghép tay vì `src/lib/format` không có hàm cho cặp cạnh. */
const formatResolution = (widthPx: number, heightPx: number): string =>
  `${formatPixels(widthPx)} × ${formatPixels(heightPx)} px`;

/** `"0,82"` — điểm 0..1 đọc bằng hai chữ số thập phân, KHÔNG phải phần trăm. */
const formatScore = (value: number): string => formatNumber(value, { fractionDigits: 2 });

/** `"3 phát hiện"` — số đếm không cần dấu nhóm nghìn. */
const formatCount = (value: number): string => formatNumber(value, { grouping: false });

const shortEdgeOf = (measurement: { widthPx: number; heightPx: number }): number =>
  Math.min(measurement.widthPx, measurement.heightPx);

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value));

/* -------------------------------------------------------------------------- */
/* Câu phát hiện — mã máy đọc thành câu nói rõ hậu quả vật lý.                  */
/* -------------------------------------------------------------------------- */

interface FindingCopy {
  readonly title: string;
  readonly consequence: string;
  readonly actionKind: 'straighten' | 'pickCorners' | null;
}

/**
 * Ba câu của đặc tả, cộng hai câu cho hai mã còn lại và một câu dự phòng.
 *
 * Mỗi câu nói ra **hậu quả vật lý** của con số, không chỉ nói lại con số: một
 * mã lỗi đứng một mình là thứ mục [CẤM TUYỆT ĐỐI] cấm, và một câu chỉ nhắc lại
 * "3,4°" thì cũng không cho người đọc biết vì sao phải quan tâm. Số lấy từ dữ
 * liệu; mốc "từ 2.000 px trở lên" lấy từ `RESOLUTION_GOOD_SHORT_EDGE_PX` của
 * `src/domain/quality`, không viết tay.
 */
function describeFinding(finding: ImageQualityFinding, floor: FloorImageQuality): FindingCopy {
  const measurement = floor.measurement;

  switch (finding.code) {
    case 'RESOLUTION_TOO_LOW': {
      const size =
        measurement === undefined
          ? ''
          : ` — ${formatResolution(measurement.widthPx, measurement.heightPx)}`;
      const shortEdge =
        measurement === undefined
          ? ' Ở mức này,'
          : ` Cạnh ngắn chỉ ${formatPixels(shortEdgeOf(measurement))} px, nên`;

      return {
        title: 'Độ phân giải thấp',
        consequence:
          `Độ phân giải thấp${size}.${shortEdge} tường ngăn mỏng nhất chỉ còn vài pixel bề dày ` +
          'và bước dò có thể bỏ sót nó. ' +
          `Nên dùng ảnh có cạnh ngắn từ ${formatPixels(RESOLUTION_GOOD_SHORT_EDGE_PX)} px trở lên.`,
        actionKind: null,
      };
    }

    case 'SKEW_DETECTED': {
      const angle = measurement === undefined ? '' : ` ${formatAngle(measurement.skewDeg)}`;

      return {
        title: 'Ảnh bị nghiêng',
        consequence:
          `Ảnh bị nghiêng${angle}. Ở góc này hai đầu một bức tường dài lệch nhau đủ để bước bắt ` +
          'trục vuông góc đọc chúng thành hai bức khác nhau. Hệ thống có thể tự nắn.',
        actionKind: 'straighten',
      };
    }

    case 'FRAME_NOT_FOUND':
      return {
        title: 'Không tìm thấy khung bản vẽ',
        consequence:
          'Không tìm thấy khung bản vẽ. Không có khung thì hệ thống không biết đâu là mép bản ' +
          'vẽ, nên tỉ lệ quy đổi ra kích thước thật lệch theo và mọi kích thước đọc được đều ' +
          'sai. Bạn có thể tự chọn 4 góc.',
        actionKind: 'pickCorners',
      };

    case 'LOW_CONTRAST': {
      const score = measurement === undefined ? '' : ` — ${formatScore(measurement.contrastScore)}`;

      return {
        title: 'Độ tương phản thấp',
        consequence:
          `Độ tương phản thấp${score}. Ở mức này nét mảnh nhất của bản vẽ rụng khỏi ảnh ngay ở ` +
          'bước nhị phân hoá, nên đường ghi kích thước đứt quãng và ô mở mất nét đứt của nó. ' +
          'Nên quét lại với nền sáng đều hơn.',
        actionKind: null,
      };
    }

    case 'HIGH_NOISE': {
      const score = measurement === undefined ? '' : ` — ${formatScore(measurement.noiseScore)}`;

      return {
        title: 'Nhiễu cao',
        consequence:
          `Nhiễu cao${score}. Ở mức này đốm nhiễu dính lại thành vệt dài ngang vạch thật, nên ` +
          'bước dò đọc chúng thành tường không tồn tại. Nên quét lại ở chế độ ảnh nét, không ' +
          'nén mạnh.',
        actionKind: null,
      };
    }

    default:
      return {
        title: 'Phát hiện chưa có mô tả',
        consequence:
          `Hệ thống báo mã ${finding.code} nhưng chưa có câu giải thích cho mã này. Hãy xem ` +
          'vùng được đánh dấu trên ảnh và kiểm tra lại bản vẽ trước khi chạy bước dò.',
        actionKind: null,
      };
  }
}

/** Bốn góc đang chọn thành thân lượt gửi; `null` khi chưa đủ bốn. */
function toCornersBody(corners: readonly InputQualityCorner[] | null): DrawingCornersInput | null {
  const [first, second, third, fourth] = corners ?? [];

  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    return null;
  }

  const toPoint = (corner: InputQualityCorner): QualityPoint => ({
    xRatio: corner.xRatio,
    yRatio: corner.yRatio,
  });

  return { corners: [toPoint(first), toPoint(second), toPoint(third), toPoint(fourth)] };
}

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn của hook.                                                          */
/* -------------------------------------------------------------------------- */

export interface InputQualityToast {
  readonly message: string;
  readonly onUndo: () => void;
  /** Cửa sổ hoàn tác của A8, để nơi vẽ toast đếm ngược đúng bằng vé. */
  readonly undoWindowMs: number;
}

export interface UseInputQualityGateOptions {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng sau khi bấm tiếp tục hoặc tải bản vẽ khác. */
  readonly onNavigate?: (path: string) => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Cổng dữ liệu. Có mặc định chứ không phải hằng bên trong: test và story cắm
   * `createInputQualityGateway(createMockApiClient())` vào đúng phép ánh xạ mà
   * bản sản phẩm dùng (R-70).
   */
  readonly gateway?: InputQualityGateway;
  /** Đồng hồ tiêm được (R-29). Không còn vé hoàn tác nào đọc nó; giữ để nơi gọi cũ không vỡ. */
  readonly now?: () => number;
  /**
   * Không bao giờ được gọi: nắn thẳng và gửi bốn góc không hoàn tác được nên
   * không có toast hoàn tác. Giữ chữ ký để container cũ không vỡ.
   */
  readonly onToast?: (toast: InputQualityToast) => void;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** `{ model, actions }` cho `InputQualityGate.tsx` — xem ghi chú đầu file. */
export function useInputQualityGate(
  options: UseInputQualityGateOptions,
): InputQualityGateViewProps {
  const { projectId } = options;
  const roles = options.roles ?? DEFAULT_ROLES;
  const queryClient = useQueryClient();

  const fallbackGateway = useMemo(() => createAppInputQualityGateway(), []);
  const gateway = options.gateway ?? fallbackGateway;

  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [highlightedRegionId, setHighlightedRegionId] = useState<string | null>(null);
  const [isPickingCorners, setPickingCorners] = useState(false);
  const [draftCorners, setDraftCorners] = useState<readonly InputQualityCorner[] | null>(null);
  const [revealRatio, setRevealRatio] = useState(INITIAL_REVEAL_RATIO);
  const [hasComparison, setComparison] = useState(false);
  const [isAcknowledged, setAcknowledged] = useState(false);
  const [resolvedFindingIds, setResolvedFindingIds] = useState<readonly string[]>([]);
  const [assessed, setAssessed] = useState<{ projectId: string; floorId: string } | null>(null);
  const [pendingWrite, setPendingWrite] = useState<'straighten' | 'corners' | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [isRereading, setRereading] = useState(false);
  const writeFailureRef = useRef<WriteFailureSentence | null>(null);

  const detectedNarrow = useNarrowViewport();
  const isCollapsed = options.forceCollapsed ?? detectedNarrow;
  const canEdit = can('upload', 'floor', { roles });

  /* ---------------------------------------------------------------------- */
  /* Danh sách tầng — chỉ để có một mã tầng làm mồi (R-64).                   */
  /* ---------------------------------------------------------------------- */

  const floorsQuery = useQuery({
    queryKey: queryKeys.floor.list(projectId),
    queryFn: async ({ signal }): Promise<readonly Floor[]> => {
      const result = await gateway.readFloors({ projectId, signal });

      if (!result.ok) {
        throw result.error;
      }

      return result.data;
    },
  });

  const projectFloors = useMemo<readonly Floor[]>(
    () => [...(floorsQuery.data ?? [])].sort((first, second) => first.order - second.order),
    [floorsQuery.data],
  );

  const seedFloorId = projectFloors[0]?.id ?? null;
  const assessedFloorId = assessed?.projectId === projectId ? assessed.floorId : null;
  const activeFloorId = selectedFloorId ?? assessedFloorId ?? seedFloorId;

  /* ---------------------------------------------------------------------- */
  /* Kết quả đo (R-64).                                                      */
  /* ---------------------------------------------------------------------- */

  const assessmentQuery = useQuery({
    queryKey: queryKeys.quality.assessment(activeFloorId ?? ''),
    enabled: activeFloorId !== null,
    queryFn: async ({ signal }): Promise<ImageQualityAssessment | null> => {
      if (activeFloorId === null) {
        throw new Error(COPY.loadFailureFallback);
      }

      const result = await gateway.assess({ floorId: activeFloorId, projectId, signal });

      if (!result.ok) {
        const wire = readWireError(result.error);

        // Dự án chưa có bản vẽ nào: trạng thái rỗng, không phải lỗi.
        if (wire?.status === 404 && wire.resource === 'upload') {
          return null;
        }

        throw result.error;
      }

      // Máy chủ trả tầng khác tầng đã gửi: gieo câu trả lời vào khoá của tầng ấy
      // trước khi khoá đổi, để không phải gửi lượt đọc thứ hai.
      if (result.data.floorId !== activeFloorId) {
        queryClient.setQueryData(queryKeys.quality.assessment(result.data.floorId), result.data);
      }

      return result.data;
    },
  });

  const firstAssessedFloorId = assessmentQuery.data?.floorId;

  if (assessed?.projectId !== projectId && firstAssessedFloorId !== undefined) {
    setAssessed({ projectId, floorId: firstAssessedFloorId });
  }

  const qualityFloors = useMemo<readonly FloorImageQuality[]>(
    () => assessmentQuery.data?.floors ?? [],
    [assessmentQuery.data],
  );

  const activeFloor = useMemo<FloorImageQuality | null>(
    () => qualityFloors.find((floor) => floor.floorId === activeFloorId) ?? null,
    [qualityFloors, activeFloorId],
  );

  const pendingFloors = useMemo<readonly FloorImageQuality[]>(
    () => qualityFloors.filter((floor) => !floor.isMeasured),
    [qualityFloors],
  );

  /* ---------------------------------------------------------------------- */
  /* Hai lượt ghi — tối ưu trước, làm mất hiệu lực sau (R-64).                */
  /* ---------------------------------------------------------------------- */

  const markResolved = useCallback((ids: readonly string[]) => {
    setResolvedFindingIds((previous) => [...new Set([...previous, ...ids])]);
  }, []);

  const unmarkResolved = useCallback((ids: readonly string[]) => {
    setResolvedFindingIds((previous) => previous.filter((id) => !ids.includes(id)));
  }, []);

  const findingIdsForCodes = useCallback(
    (codes: readonly string[]): readonly string[] =>
      (activeFloor?.findings ?? [])
        .filter((finding) => codes.includes(finding.code))
        .map((finding) => finding.id),
    [activeFloor],
  );

  const straightenMutation = useMutation(
    createOptimisticMutation<
      { floorId: string; findingIds: readonly string[] },
      ImageQualityAssessment
    >(queryClient, {
      affectedKeys: ({ floorId }) => [queryKeys.quality.assessment(floorId)],
      applyOptimistic: ({ findingIds }) => markResolved(findingIds),
      callServer: async ({ floorId }) => {
        const result = await gateway.straighten({ floorId, projectId });

        if (!result.ok) {
          writeFailureRef.current = gateway.describeWriteFailure(result.error);
          throw result.error;
        }

        return result.data;
      },
      afterSuccess: (fresh, { floorId }) => {
        queryClient.setQueryData(queryKeys.quality.assessment(floorId), fresh);
        applyInvalidation(queryClient, 'straightenDrawing', { floorId, projectId });
      },
      entityId: ({ floorId }) => floorId,
      rollback: ({ findingIds }) => unmarkResolved(findingIds),
    }),
  );

  const cornersMutation = useMutation(
    createOptimisticMutation<
      { floorId: string; body: DrawingCornersInput; findingIds: readonly string[] },
      ImageQualityAssessment
    >(queryClient, {
      affectedKeys: ({ floorId }) => [queryKeys.quality.assessment(floorId)],
      applyOptimistic: ({ findingIds }) => markResolved(findingIds),
      callServer: async ({ body, floorId }) => {
        const result = await gateway.setCorners({ body, floorId, projectId });

        if (!result.ok) {
          writeFailureRef.current = gateway.describeWriteFailure(result.error);
          throw result.error;
        }

        return result.data;
      },
      afterSuccess: (fresh, { floorId }) => {
        queryClient.setQueryData(queryKeys.quality.assessment(floorId), fresh);
        applyInvalidation(queryClient, 'setDrawingCorners', { floorId, projectId });
      },
      entityId: ({ floorId }) => floorId,
      rollback: ({ findingIds }) => unmarkResolved(findingIds),
    }),
  );

  const isWriting = straightenMutation.isPending || cornersMutation.isPending;
  const isWriteLocked = isWriting || isRereading;

  /** Một lượt ghi đã xong: đóng hộp thoại, mở thanh so sánh, nói cho trình đọc. Không vé. */
  const finishWrite = useCallback((message: string) => {
    setPendingWrite(null);
    setComparison(true);
    getAppAnnouncer().announce(message);
  }, []);

  /** Một lượt ghi hỏng: hiện câu lỗi đã phân loại ở `callServer`, đọc lại nếu cần. */
  const failWrite = useCallback(
    (floorId: string) => {
      const failure = writeFailureRef.current ?? {
        sentence: COPY.writeFailureFallback,
        reread: false,
      };

      writeFailureRef.current = null;
      setPendingWrite(null);
      setWriteError(failure.sentence);
      getAppAnnouncer().announce(failure.sentence);

      if (failure.reread) {
        setRereading(true);
        void queryClient
          .invalidateQueries({ queryKey: queryKeys.quality.assessment(floorId) })
          .finally(() => setRereading(false));
      }
    },
    [queryClient],
  );

  /* ---------------------------------------------------------------------- */
  /* Vùng ảnh — một nguồn sự thật duy nhất cho vùng đang sáng (mục 2.5).      */
  /* ---------------------------------------------------------------------- */

  const regions = useMemo<readonly InputQualityRegion[]>(
    () =>
      activeFloor === null
        ? []
        : activeFloor.findings.map((finding) => ({
            id: `${REGION_ID_PREFIX}${finding.id}`,
            xRatio: finding.region.xRatio,
            yRatio: finding.region.yRatio,
            widthRatio: finding.region.widthRatio,
            heightRatio: finding.region.heightRatio,
            level: finding.severity,
            label: `${COPY.regionLabelPrefix} ${describeFinding(finding, activeFloor).title.toLowerCase()}`,
          })),
    [activeFloor],
  );

  const regionIdByFinding = useMemo<ReadonlyMap<string, string>>(
    () =>
      new Map(
        (activeFloor?.findings ?? []).map((finding) => [
          finding.id,
          `${REGION_ID_PREFIX}${finding.id}`,
        ]),
      ),
    [activeFloor],
  );

  const regionIdByMetric = useMemo<ReadonlyMap<QualityMetricId, string>>(() => {
    const table = new Map<QualityMetricId, string>();

    for (const finding of activeFloor?.findings ?? []) {
      const metricId = METRIC_BY_FINDING_CODE[finding.code];

      if (metricId !== undefined && !table.has(metricId)) {
        table.set(metricId, `${REGION_ID_PREFIX}${finding.id}`);
      }
    }

    return table;
  }, [activeFloor]);

  /* ---------------------------------------------------------------------- */
  /* Bốn phép kiểm — mức lấy từ `src/domain/quality`, không so ngưỡng ở đây.  */
  /* ---------------------------------------------------------------------- */

  const measurement = activeFloor?.measurement;

  const metrics = useMemo<readonly InputQualityMetricModel[]>(() => {
    if (measurement === undefined) {
      return [];
    }

    const levels: Readonly<Record<QualityMetricId, ImageQualityLevel>> = {
      contrast: classifyContrast(measurement.contrastScore),
      noise: classifyNoise(measurement.noiseScore),
      resolution: classifyResolution(shortEdgeOf(measurement)),
      skew: classifySkew(measurement.skewDeg),
    };

    const valueTexts: Readonly<Record<QualityMetricId, string>> = {
      contrast: formatScore(measurement.contrastScore),
      noise: formatScore(measurement.noiseScore),
      resolution: formatResolution(measurement.widthPx, measurement.heightPx),
      skew: formatAngle(measurement.skewDeg),
    };

    const recommendations: Readonly<Record<QualityMetricId, string>> = {
      contrast: 'Quét lại với nền sáng đều hơn để nét mảnh không rụng khỏi ảnh.',
      noise: 'Quét lại ở chế độ ảnh nét và không nén mạnh để bớt đốm giả.',
      resolution: `Nên dùng ảnh có cạnh ngắn từ ${formatPixels(RESOLUTION_GOOD_SHORT_EDGE_PX)} px trở lên.`,
      skew: 'Bấm "Tự động nắn" để hệ thống xoay ảnh về phương ngang.',
    };

    const metricIds: readonly QualityMetricId[] = ['resolution', 'skew', 'contrast', 'noise'];

    return metricIds.map((id) => {
      const level = levels[id];

      return {
        id,
        label: METRIC_LABELS[id],
        valueText: valueTexts[id],
        level,
        statusCode: STATUS_CODE_BY_LEVEL[level],
        recommendation: level === 'good' ? null : recommendations[id],
        regionId: regionIdByMetric.get(id) ?? null,
      };
    });
  }, [measurement, regionIdByMetric]);

  /* ---------------------------------------------------------------------- */
  /* Phát hiện — mỗi câu nêu hậu quả, mỗi phát hiện neo vào một vùng ảnh.     */
  /* ---------------------------------------------------------------------- */

  const findings = useMemo<readonly InputQualityFindingModel[]>(() => {
    if (activeFloor === null) {
      return [];
    }

    return activeFloor.findings.map((finding) => {
      const copy = describeFinding(finding, activeFloor);
      const cornerLabel = isPickingCorners ? COPY.sendCornersAction : COPY.pickCornersAction;

      return {
        id: finding.id,
        level: finding.severity,
        statusCode: STATUS_CODE_BY_LEVEL[finding.severity],
        title: copy.title,
        consequence: copy.consequence,
        action:
          copy.actionKind === null || !canEdit || isWriteLocked
            ? null
            : {
                kind: copy.actionKind,
                label: copy.actionKind === 'straighten' ? COPY.straightenAction : cornerLabel,
              },
        regionId: regionIdByFinding.get(finding.id) ?? `${REGION_ID_PREFIX}${finding.id}`,
        isResolved: resolvedFindingIds.includes(finding.id),
      };
    });
  }, [
    activeFloor,
    canEdit,
    isPickingCorners,
    isWriteLocked,
    regionIdByFinding,
    resolvedFindingIds,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Danh sách tầng của báo cáo.                                             */
  /* ---------------------------------------------------------------------- */

  const floors = useMemo<readonly InputQualityFloorRow[]>(
    () =>
      qualityFloors.map((floor) => {
        const floorMeasurement = floor.measurement;

        const level =
          !floor.isMeasured || floorMeasurement === undefined
            ? null
            : worstLevel([
                classifyResolution(shortEdgeOf(floorMeasurement)),
                classifySkew(floorMeasurement.skewDeg),
                classifyContrast(floorMeasurement.contrastScore),
                classifyNoise(floorMeasurement.noiseScore),
              ]);

        const summaryText = !floor.isMeasured
          ? COPY.notMeasured
          : floor.findings.length === 0
            ? COPY.noFinding
            : `${formatCount(floor.findings.length)} phát hiện cần chú ý`;

        return {
          id: floor.floorId,
          label: floor.floorName,
          isActive: floor.floorId === activeFloorId,
          isMeasured: floor.isMeasured,
          level,
          summaryText,
        };
      }),
    [qualityFloors, activeFloorId],
  );

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11) — bậc thang giải thích ở đầu file.                  */
  /* ---------------------------------------------------------------------- */

  const failedRead = floorsQuery.error ?? assessmentQuery.error;
  const failureSentence =
    failedRead === null
      ? COPY.loadFailureFallback
      : gateway.describeApiFailure(failedRead).sentence || COPY.loadFailureFallback;

  // 404 `upload` (đọc trả `null`), hoặc dự án không có tầng nào để làm mồi.
  const hasNoDrawing =
    assessmentQuery.data === null || (floorsQuery.isSuccess && seedFloorId === null);

  const isReading = floorsQuery.isPending || (activeFloorId !== null && assessmentQuery.isPending);

  const status = useMemo<InputQualityGateStatus>(() => {
    if (isReading) {
      return 'loading';
    }

    if (failedRead !== null) {
      return 'error';
    }

    if (hasNoDrawing) {
      return 'empty';
    }

    if (!canEdit) {
      return 'forbidden';
    }

    if (isCollapsed) {
      return 'collapsed';
    }

    if (findings.length === 0 && metrics.length === METRIC_COUNT) {
      return 'empty';
    }

    if (metrics.length < METRIC_COUNT || pendingFloors.length > 0) {
      return 'partial';
    }

    return 'ready';
  }, [
    canEdit,
    failedRead,
    findings.length,
    hasNoDrawing,
    isCollapsed,
    isReading,
    metrics.length,
    pendingFloors.length,
  ]);

  const visibleMetrics = status === 'loading' ? [] : metrics;
  const visibleFindings = status === 'loading' ? [] : findings;
  const visibleFloors = status === 'loading' ? [] : floors;
  const remainingFindingCount = visibleFindings.filter((finding) => !finding.isResolved).length;

  /* ---------------------------------------------------------------------- */
  /* Hai câu chỉ dành cho đúng một trạng thái (bất biến 6).                   */
  /* ---------------------------------------------------------------------- */

  const passNotice =
    status === 'empty' && measurement !== undefined
      ? `Bản vẽ đạt yêu cầu. Độ phân giải ${formatResolution(measurement.widthPx, measurement.heightPx)}, ` +
        `độ nghiêng ${formatAngle(measurement.skewDeg)}.`
      : null;

  const partialNotice = useMemo<string | null>(() => {
    if (status !== 'partial') {
      return null;
    }

    const measuredCount = qualityFloors.length - pendingFloors.length;
    const counted = `Mới có ${formatCount(measuredCount)}/${formatCount(qualityFloors.length)} tầng đo xong.`;

    const activeLine =
      metrics.length < METRIC_COUNT
        ? ` Bản vẽ tầng ${activeFloor?.floorName ?? ''} chưa chạy đủ bốn phép kiểm nên chưa có mức để nói.`
        : '';

    const pendingLine =
      pendingFloors.length === 0
        ? ''
        : ` Còn chờ: ${pendingFloors.map((floor) => floor.floorName).join(', ')}.`;

    return `${counted}${activeLine}${pendingLine}`;
  }, [status, qualityFloors.length, pendingFloors, metrics.length, activeFloor]);

  /* ---------------------------------------------------------------------- */
  /* Dự báo độ tin cậy — số qua `formatNumber`, nhãn qua `describeConfidence`. */
  /* ---------------------------------------------------------------------- */

  const forecastText = useMemo<string>(() => {
    const confidence = activeFloor?.expectedConfidence;

    if (confidence === undefined) {
      return COPY.forecastMissing;
    }

    return `${COPY.forecastPrefix} ${formatScore(confidence)} — ${describeConfidence(confidence).label}`;
  }, [activeFloor]);

  /* ---------------------------------------------------------------------- */
  /* Khung ảnh.                                                              */
  /* ---------------------------------------------------------------------- */

  const skewLine = useMemo<InputQualitySkewLine | null>(() => {
    if (measurement === undefined) {
      return null;
    }

    const angle = degreesToRadians(degrees(measurement.skewDeg));
    const halfWidth = Math.cos(angle) * SKEW_LINE_HALF_LENGTH_RATIO;
    const halfHeight = Math.sin(angle) * SKEW_LINE_HALF_LENGTH_RATIO;

    return {
      startXRatio: IMAGE_CENTRE_RATIO - halfWidth,
      startYRatio: IMAGE_CENTRE_RATIO - halfHeight,
      endXRatio: IMAGE_CENTRE_RATIO + halfWidth,
      endYRatio: IMAGE_CENTRE_RATIO + halfHeight,
      angleLabel: formatAngle(measurement.skewDeg),
    };
  }, [measurement]);

  const isStraightening = straightenMutation.isPending;
  const noDrawingNotice = status === 'empty' && hasNoDrawing ? COPY.noDrawingNotice : null;

  const image = useMemo<InputQualityImageModel>(
    () => ({
      src: activeFloor?.sourceUrl ?? '',
      altText:
        activeFloor === null
          ? ''
          : `${COPY.altTextPrefix} ${activeFloor.floorName}, ${COPY.altTextSuffix}`,
      skewLine: status === 'loading' ? null : skewLine,
      regions: status === 'loading' ? [] : regions,
      highlightedRegionId,
      // Màn không tự xoay ảnh nguồn: nắn thẳng là một lượt ghi, và ảnh đã nắn
      // quay về qua `sourceUrl`. Con số này chỉ khác 0 trong lúc lượt ghi còn
      // bay, để người dùng thấy trước hệ thống sắp xoay bao nhiêu.
      rotationDeg: isStraightening && measurement !== undefined ? -measurement.skewDeg : 0,
      corners: draftCorners,
      comparison: hasComparison ? { isVisible: true, revealRatio } : null,
    }),
    [
      activeFloor,
      draftCorners,
      hasComparison,
      highlightedRegionId,
      isStraightening,
      measurement,
      regions,
      revealRatio,
      skewLine,
      status,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Chân trang — cảnh báo có ý thức, KHÔNG chặn cứng.                        */
  /* ---------------------------------------------------------------------- */

  const requiresAcknowledgement = visibleMetrics.some((metric) => metric.level === 'poor');

  const footer: InputQualityFooterModel = {
    canContinue: !(requiresAcknowledgement && !isAcknowledged),
    requiresAcknowledgement,
    isAcknowledged,
    acknowledgementLabel: COPY.acknowledgement,
    primaryLabel: COPY.primary,
    secondaryLabel: COPY.secondary,
    areActionsHidden: status === 'forbidden',
  };

  /* ---------------------------------------------------------------------- */
  /* Đổi tầng — cùng một lối cho chuột và cho ArrowLeft/ArrowRight (I-01).    */
  /* ---------------------------------------------------------------------- */

  const selectFloor = useCallback(
    (floorId: string) => {
      const target = qualityFloors.find((floor) => floor.floorId === floorId);

      if (target === undefined || floorId === activeFloorId) {
        return;
      }

      setSelectedFloorId(floorId);
      setWriteError(null);
      setPendingWrite(null);
      setHighlightedRegionId(null);
      setPickingCorners(false);
      setDraftCorners(null);
      getAppAnnouncer().announce(`Đang xem bản vẽ tầng ${target.floorName}`);
    },
    [qualityFloors, activeFloorId],
  );

  const stepFloor = useCallback(
    (offset: number) => {
      const index = qualityFloors.findIndex((floor) => floor.floorId === activeFloorId);

      if (index < 0) {
        return;
      }

      const next = qualityFloors[index + offset];

      if (next !== undefined) {
        selectFloor(next.floorId);
      }
    },
    [qualityFloors, activeFloorId, selectFloor],
  );

  const stepBack = useCallback(() => stepFloor(-1), [stepFloor]);
  const stepForward = useCallback(() => stepFloor(1), [stepFloor]);
  const exitCornerMode = useCallback(() => {
    setPickingCorners(false);
    setDraftCorners(null);
  }, []);

  useShortcut({
    id: 'inputQualityGate.previousFloor',
    combo: 'ArrowLeft',
    scope: 'canvas',
    description: 'xem bản vẽ của tầng liền trước',
    onTrigger: stepBack,
  });

  useShortcut({
    id: 'inputQualityGate.nextFloor',
    combo: 'ArrowRight',
    scope: 'canvas',
    description: 'xem bản vẽ của tầng liền sau',
    onTrigger: stepForward,
  });

  // A12: Esc đóng lớp trên cùng. Lớp duy nhất màn này mở là chế độ chọn bốn
  // góc, nên phím chỉ được đăng ký khi lớp đó đang mở — đóng rồi thì Esc lại
  // thuộc về `closeTopLayer` toàn cục.
  useShortcut(
    {
      id: 'inputQualityGate.exitCornerMode',
      combo: 'Escape',
      scope: 'canvas',
      description: 'thoát chế độ chọn bốn góc khung bản vẽ',
      onTrigger: exitCornerMode,
    },
    { enabled: isPickingCorners && pendingWrite === null },
  );

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Nắn thẳng chỉ MỞ hộp thoại (A9); lượt gửi nằm ở `onConfirmWrite`. Máy chủ
   * không đảo được lượt này nên không có vé hoàn tác.
   */
  const onStraighten = useCallback(() => {
    if (activeFloorId === null || !canEdit || isWriteLocked) {
      return;
    }

    setPendingWrite('straighten');
  }, [activeFloorId, canEdit, isWriteLocked]);

  /**
   * Một nút, hai nghĩa — vào chế độ chọn góc, rồi MỞ hộp thoại gửi bốn góc đã
   * chọn. Nhãn của nút đổi theo chế độ (`COPY.pickCornersAction` →
   * `COPY.sendCornersAction`); Esc thoát chế độ mà không gửi gì.
   */
  const onPickCorners = useCallback(() => {
    if (!canEdit || isWriteLocked) {
      return;
    }

    if (isPickingCorners) {
      if (draftCorners !== null) {
        setPendingWrite('corners');
      }

      return;
    }

    const fallback: readonly QualityPoint[] = [
      { xRatio: CORNER_INSET_RATIO, yRatio: CORNER_INSET_RATIO },
      { xRatio: 1 - CORNER_INSET_RATIO, yRatio: CORNER_INSET_RATIO },
      { xRatio: 1 - CORNER_INSET_RATIO, yRatio: 1 - CORNER_INSET_RATIO },
      { xRatio: CORNER_INSET_RATIO, yRatio: 1 - CORNER_INSET_RATIO },
    ];

    const seed: readonly QualityPoint[] = activeFloor?.frame?.corners ?? fallback;

    setPickingCorners(true);
    setDraftCorners(
      CORNER_IDS.map((id, index) => ({
        id,
        xRatio: seed[index]?.xRatio ?? CORNER_INSET_RATIO,
        yRatio: seed[index]?.yRatio ?? CORNER_INSET_RATIO,
      })),
    );
  }, [canEdit, isWriteLocked, isPickingCorners, draftCorners, activeFloor]);

  /** Xác nhận trong hộp thoại: gửi đúng một lượt ghi, kèm khoá của cổng. */
  const onConfirmWrite = useCallback(() => {
    if (activeFloorId === null || !canEdit || pendingWrite === null || isWriteLocked) {
      return;
    }

    const floorId = activeFloorId;

    setWriteError(null);
    writeFailureRef.current = null;

    if (pendingWrite === 'straighten') {
      straightenMutation.mutate(
        { floorId, findingIds: findingIdsForCodes(['SKEW_DETECTED']) },
        {
          onSuccess: () => finishWrite(COPY.straightenedAnnouncement),
          onError: () => failWrite(floorId),
        },
      );

      return;
    }

    const body = toCornersBody(draftCorners);

    if (body === null) {
      return;
    }

    cornersMutation.mutate(
      { floorId, body, findingIds: findingIdsForCodes(['FRAME_NOT_FOUND']) },
      {
        onSuccess: () => {
          setPickingCorners(false);
          setDraftCorners(null);
          finishWrite(COPY.cornersAnnouncement);
        },
        onError: () => failWrite(floorId),
      },
    );
  }, [
    activeFloorId,
    canEdit,
    cornersMutation,
    draftCorners,
    failWrite,
    findingIdsForCodes,
    finishWrite,
    isWriteLocked,
    pendingWrite,
    straightenMutation,
  ]);

  /** Huỷ hoặc Esc: đóng hộp thoại, không gửi gì. Đang gửi thì để lượt gửi chạy xong. */
  const onCancelWrite = useCallback(() => {
    if (!isWriting) {
      setPendingWrite(null);
    }
  }, [isWriting]);

  const actions: InputQualityGateActions = {
    onHoverRegion: (regionId) => setHighlightedRegionId(regionId),
    onHoverFinding: (findingId) =>
      setHighlightedRegionId(
        findingId === null ? null : (regionIdByFinding.get(findingId) ?? null),
      ),
    onSelectFloor: selectFloor,
    onStraighten,
    onPickCorners,
    onDragCorner: (cornerId, xRatio, yRatio) => {
      setDraftCorners((previous) =>
        previous === null
          ? previous
          : previous.map((corner) =>
              corner.id === cornerId
                ? { id: corner.id, xRatio: clampRatio(xRatio), yRatio: clampRatio(yRatio) }
                : corner,
            ),
      );
    },
    onChangeReveal: (ratio) => setRevealRatio(clampRatio(ratio)),
    onToggleAcknowledgement: (next) => setAcknowledged(next),
    // Nút bấm được ở mọi trạng thái (không chặn cứng), nhưng chưa tích ô thì lượt
    // bấm dừng ở đây: lời "Đánh dấu ô xác nhận bên trên rồi thử lại." đã hiện cạnh
    // nút — đi tiếp là làm trái chính câu đó. Cùng khuôn `submit` của màn tải lên.
    onContinue: () => {
      if (!footer.canContinue) {
        return;
      }

      options.onNavigate?.(ROUTES.project.pipeline(projectId));
    },
    onUploadAnother: () => options.onNavigate?.(ROUTES.project.upload(projectId)),
    onConfirmWrite,
    onCancelWrite,
  };

  const confirm: InputQualityConfirmModel | null =
    pendingWrite === null
      ? null
      : {
          title:
            pendingWrite === 'straighten'
              ? `${COPY.straightenConfirmTitlePrefix} ${activeFloor?.floorName ?? ''}?`
              : `${COPY.cornersConfirmTitlePrefix} ${activeFloor?.floorName ?? ''} ${COPY.cornersConfirmTitleSuffix}?`,
          body: pendingWrite === 'straighten' ? COPY.straightenConfirmBody : COPY.cornersConfirmBody,
          confirmLabel:
            pendingWrite === 'straighten' ? COPY.straightenConfirmLabel : COPY.cornersConfirmLabel,
          cancelLabel: COPY.confirmCancel,
          isBusy: isWriting,
        };

  const model: InputQualityGateModel = {
    status,
    image,
    metrics: visibleMetrics,
    forecast: { text: forecastText },
    findings: visibleFindings,
    floors: visibleFloors,
    footer,
    errorMessage: status === 'error' ? failureSentence : null,
    partialNotice,
    remainingFindingCount,
    passNotice,
    noDrawingNotice,
    writeError,
    confirm,
  };

  return { model, actions };
}

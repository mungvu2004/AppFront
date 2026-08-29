/**
 * Nửa "suy nghĩ" của màn Xử lý — mọi thứ `ProcessingScreen.tsx` cần, đã xong.
 *
 * `types.ts` là hợp đồng props DUY NHẤT của màn; hook này trả về đúng
 * {@link ProcessingScreenProps}, không hơn không kém. Mọi chuỗi người đọc được
 * ghép và định dạng ở đây (A15) — view không còn con số thô nào phải làm tròn.
 *
 * ## Không có công thức nào tự chế (R-61)
 *
 * - Tổng phần trăm: `calculateTotalProgress` của `src/lib/realtime/pipeline`.
 *   Trọng số sáu bước nằm trong `PIPELINE_STAGES`; thư mục màn này không chứa
 *   một con số trọng số nào.
 * - Thời gian còn lại: `estimateRemainingSeconds` của cùng module.
 * - Tên sáu bước: `getPipelineStages()` (nó đọc `src/i18n/vi.json` khoá
 *   `pipeline`). Không gõ tay, không viết tắt, không dịch lại.
 * - Dòng sự kiện: `createProgressStream`. Nó TỰ chuyển SSE sang quay vòng sau
 *   `SSE_FAILURE_LIMIT` lần mất kết nối liên tiếp, tự thử lại SSE định kỳ, và
 *   tự ngừng nghe khi tab ẩn. Hook chỉ gọi nó qua cổng: không có giãn cách thử
 *   lại, không `EventSource`, không vòng lặp quay vòng nào ở đây.
 *
 * ## Tiến độ không nhảy lùi
 *
 * `calculateTotalProgress` là hàm THUẦN: nó kẹp kết quả bằng
 * `highestProgressReached` nhưng **không tự giữ** con số đó — nơi gọi phải lưu
 * và truyền lại qua mỗi lần gọi. Chỗ lưu ở đây là `FloorProgressRecord.totalPercent`
 * nằm trong bộ nhớ đệm của react-query dưới `queryKeys.progress.byFloor(floorId)`.
 * Nhờ vậy hai điều cùng đúng: SSE chết giữa chừng rồi quay vòng đọc lại một số
 * thấp hơn cũng không kéo thanh tiến độ lùi, và rời màn rồi quay lại thì tiến độ
 * vẫn ở chỗ cũ (tier `aiProgress`, `gcTime` mười phút).
 *
 * ## Một tầng lỗi không dừng các tầng khác
 *
 * Mỗi tầng là MỘT đăng ký độc lập (`gateway.subscribeProgress` cho đúng
 * `uploadId` của tầng đó) ghi vào MỘT khoá đệm riêng. Không có chỗ nào gộp
 * chúng thành một lời hứa chung, nên một tầng hỏng chỉ làm hỏng bản ghi của
 * chính nó; `state` của cả màn thành `partial`, `partialNoticeLine` nói rõ xử lý
 * vẫn tiếp tục, và các tầng còn lại chạy tiếp.
 *
 * ## Chạy nền — cái nút "Để chạy nền và thông báo cho tôi" thật sự làm gì
 *
 * Nút đó từng gọi `gateway.runInBackground()`, nhận `supported: false`, và
 * không có gì xảy ra. Nay nó làm đúng hai việc, và không hơn:
 *
 * 1. trao hàm huỷ đăng ký của TỪNG dòng sự kiện đang chạy cho sổ theo dõi nền,
 *    nên lúc màn tháo, `useEffect` dưới đây KHÔNG đóng chúng nữa;
 * 2. đẩy một thông báo qua `notificationBus` (bọc bởi `useNotifications`), và
 *    đẩy thông báo thứ hai khi nhịp cuối của một lượt về — kể cả khi lúc đó màn
 *    đã tháo từ lâu, vì hàm báo là một bao đóng nằm trong sổ, không phải state
 *    của React.
 *
 * Ranh giới nói thẳng trong chính câu tiếng Việt người dùng đọc: repo không có
 * kênh đẩy từ máy chủ, nên **đóng thẻ trình duyệt là hết**. "Chạy nền" ở đây là
 * rời MÀN NÀY trong cùng một phiên.
 *
 * ## Trạng thái máy chủ (R-64)
 *
 * Không `useState` nào giữ `isLoading` hay `error` — `useQueries` giữ. Hai thứ
 * duy nhất `useState` ở đây giữ là trạng thái của riêng giao diện (tab đang mở,
 * bước nào đang bung chi tiết, khoá cuộn nhật ký, hộp xác nhận huỷ).
 * `useShareLinks.ts` tự viết tay hai cờ đó — đó là ngoại lệ đi trước, không phải
 * khuôn mẫu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';

import type { Progress } from '@/api/schemas';
import { useNotifications } from '@/hooks/useNotifications';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { can } from '@/lib/auth/permissions';
import { APP_ERROR_KIND_CONFIG } from '@/lib/errors';
import { formatClockTime, formatDuration } from '@/lib/format/datetime';
import { formatArea } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import { CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';
import { MILLISECONDS_PER_SECOND } from '@/lib/motion/tokens';
import type { NotificationBus, NotificationInput } from '@/lib/mutations/notificationBus';
import { queryKeys } from '@/lib/query/queryKeys';
import type {
  BackgroundWatchEntry,
  BackgroundWatchOutcome,
} from '@/lib/realtime/backgroundWatch';
import type { ChannelStatus } from '@/lib/realtime/eventChannel';
import {
  calculateTotalProgress,
  estimateRemainingSeconds,
  getPipelineStages,
} from '@/lib/realtime/pipeline';
import type { PipelineStageState } from '@/lib/realtime/pipeline';
import type { ProgressStreamSource } from '@/lib/realtime/progressStream';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';

import { createAppProcessingGateway, toStageBreakdown } from './processingGateway';
import type {
  ProcessingExtractionSummary,
  ProcessingFailure,
  ProcessingGateway,
  ProcessingRawLogLine,
  ProcessingRawStepProgress,
} from './processingGateway';
import type {
  ProcessingErrorAlertViewModel,
  ProcessingFloorChipViewModel,
  ProcessingLogLineViewModel,
  ProcessingPanelTab,
  ProcessingPreviewViewModel,
  ProcessingScreenProps,
  ProcessingScreenState,
  ProcessingStageStatus,
  ProcessingStepViewModel,
  ProcessingSummaryViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của riêng hook. Bản sao khai báo nằm ở h7.i18n.fragment.json.*/
/* -------------------------------------------------------------------------- */

const COPY = {
  statusQueued: 'đang chờ',
  statusRunning: 'đang xử lý',
  statusDone: 'đã xong',
  statusFailed: 'lỗi',
  stepErrorFallback: 'Bước này gặp lỗi nên không hoàn tất được.',
  previewAltPrefix: 'Bản vẽ đang được xử lý — ',
  previewAltEmpty: 'Chưa có bản vẽ nào để xem trước.',
  noFloorRunning: 'Chưa có tầng nào đang được xử lý.',
  backgroundStartedTitle: 'Sẽ báo cho bạn khi xử lý xong',
  backgroundStartedDescription:
    'Xử lý vẫn chạy khi bạn rời màn này. Đóng thẻ trình duyệt thì không báo được nữa.',
  backgroundDoneDescription: 'Mở lại màn xử lý để xem kết quả.',
  backgroundFailedDescription: 'Mở lại màn xử lý để xem chi tiết lỗi.',
} as const;

/** Ví dụ `"Tầng 1 đã xử lý xong"`. */
const backgroundDoneTitle = (floor: string): string => `${floor} đã xử lý xong`;

/** Ví dụ `"Tầng 1 gặp lỗi khi xử lý"`. */
const backgroundFailedTitle = (floor: string): string => `${floor} gặp lỗi khi xử lý`;

const UNIT = {
  floor: 'tầng',
  wall: 'tường',
  object: 'đối tượng',
  dimensionChain: 'chuỗi kích thước',
  room: 'phòng',
} as const;

/** Ví dụ `"còn khoảng 2 phút"`. */
const remainingSentence = (duration: string): string => `còn khoảng ${duration}`;

/** Ví dụ `"Đã xong 2/4 tầng"`. */
const doneFloorsSentence = (done: string, total: string): string =>
  `Đã xong ${done}/${total} ${UNIT.floor}`;

/** Ví dụ `"Đã xong 2/4 tầng · Còn lại khoảng 4 phút 20 giây"`. */
const overallSentence = (doneClause: string, duration: string | null): string =>
  duration === null ? doneClause : `${doneClause} · Còn lại khoảng ${duration}`;

/** Ví dụ `"Đang chờ hàng đợi — vị trí 2"`. */
const queueSentence = (position: string): string => `Đang chờ hàng đợi — vị trí ${position}`;

/** Câu bắt buộc nói rõ xử lý VẪN TIẾP TỤC khi một tầng lỗi. */
const partialSentence = (failedNames: string): string =>
  `${failedNames} gặp lỗi. Các tầng còn lại vẫn đang được xử lý.`;

/** Ví dụ `"Có 9 mức độ tin cậy dưới 0,70 cần bạn xem lại."`. */
const lowConfidenceSentence = (count: string, threshold: string): string =>
  `Có ${count} mức độ tin cậy dưới ${threshold} cần bạn xem lại.`;

const noLowConfidenceSentence = (threshold: string): string =>
  `Không có mức độ tin cậy nào dưới ${threshold}.`;

/* -------------------------------------------------------------------------- */
/* Hằng lấy từ thư viện, không viết tay (R-71).                                 */
/* -------------------------------------------------------------------------- */

/** Nhãn tiếng Việt của sáu bước, đọc một lần từ `src/i18n/vi.json` khoá `pipeline`. */
const STAGE_LABEL_BY_ID = new Map(getPipelineStages().map((stage) => [stage.id, stage.label]));

/** Mã máy đọc của lỗi xử lý — lấy từ bảng của L-03, không gõ tay (A6 cho phép chữ hoa ở mã lỗi). */
const PROCESSING_ERROR_CODE = APP_ERROR_KIND_CONFIG.processing.code;

/** `< 1024px` — cùng mốc `InputQualityGate`, `FloorUploadScreen` và `ProjectSettings`. */
const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

/** Danh tính một lượt trong sổ theo dõi nền — một dự án có thể có nhiều lượt. */
const watchIdOf = (projectId: string, uploadId: string): string => `${projectId}:${uploadId}`;

/**
 * Loại của thông báo — và vì sao loại "xong" mang theo mã lượt.
 *
 * `notificationBus` GỘP các thông báo cùng `type` rơi vào cùng một cửa sổ thời
 * gian, và nhãn nó dán lên bản gộp là `common.undo_group` — "Hoàn tác N thay
 * đổi". Câu đó đúng cho một chuỗi sửa hoàn tác được, và sai hoàn toàn cho hai
 * tầng xử lý xong cách nhau ba giây. Nên mỗi lượt có `type` riêng: hai lượt
 * không bao giờ gộp, và không câu nào bị viết lại thành câu của chuyện khác.
 */
const BACKGROUND_STARTED_TYPE = 'processing-background-started';
const backgroundSettledType = (watchId: string): string => `processing-background-done:${watchId}`;

/** Nhịp cuối theo cách máy chủ báo — chỉ hai giá trị này kết thúc một lượt. */
function outcomeOf(status: Progress['status'] | undefined): BackgroundWatchOutcome | undefined {
  if (status === 'completed') {
    return 'done';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return undefined;
}

/** Câu báo một lượt chạy nền đã kết thúc. Mức độ nằm trong CÂU, không trong màu (A5). */
function settledNotice(watchId: string, label: string, outcome: BackgroundWatchOutcome): NotificationInput {
  return {
    type: backgroundSettledType(watchId),
    title: outcome === 'done' ? backgroundDoneTitle(label) : backgroundFailedTitle(label),
    description:
      outcome === 'done' ? COPY.backgroundDoneDescription : COPY.backgroundFailedDescription,
  };
}

/** Ổn định qua các lượt render, để `useQueries` không dựng lại danh sách rỗng mỗi lần. */
const EMPTY_UPLOADS: readonly ProcessingFloorUpload[] = [];
const EMPTY_GEOMETRY: readonly string[] = [];

/* -------------------------------------------------------------------------- */
/* Tham số vào.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Một lượt xử lý đang chạy: một bản vẽ của một tầng.
 *
 * Màn nhận danh sách này qua props chứ không tự đi tìm: `ENDPOINTS.drawings.progress`
 * cần `(projectId, uploadId)` còn route chỉ mang `:id`, và KHÔNG endpoint nào
 * liệt kê được các `uploadId` đang chạy của một dự án. Nơi biết `uploadId` là màn
 * tải bản vẽ — nó truyền sang (R-73).
 */
export interface ProcessingFloorUpload {
  readonly floorId: string;
  /** Tên tầng, tiếng Việt — ví dụ `"Tầng 1"`. */
  readonly floorName: string;
  readonly uploadId: string;
  /** `Drawing.url` của bản vẽ đang xử lý, để panel xem trước có ảnh nền. */
  readonly sourceImageUrl?: string;
}

export interface UseProcessingScreenOptions {
  readonly projectId: string;
  /** Rỗng (hoặc bỏ trống) là câu trả lời hợp lệ: màn ở trạng thái `empty`. */
  readonly floorUploads?: readonly ProcessingFloorUpload[];
  readonly roles?: readonly ProjectRole[];
  /** Cổng dữ liệu. Có mặc định thật bên trong; test và story cắm bản giả vào. */
  readonly gateway?: ProcessingGateway;
  readonly onNavigate?: (path: string) => void;
  /**
   * Nơi nút "liên hệ hỗ trợ" dẫn tới.
   *
   * Không có mặc định lấy từ `ROUTE_PATTERNS` được: repo KHÔNG có route hỗ trợ
   * nào (đã soát toàn bộ `src/routes/paths.ts`). Không truyền thì nút dẫn về
   * màn tài khoản — nơi duy nhất có thông tin liên hệ — chứ không im lặng.
   */
  readonly onGoToSupport?: () => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /**
   * Bus thông báo. Bỏ trống là bus của cả phiên (`appNotificationBus`) — thứ
   * `NotificationHost` ở `main.tsx` đang vẽ. Test và story tiêm bus riêng để hai
   * lượt kiểm không thấy thông báo của nhau.
   */
  readonly notifications?: NotificationBus;
}

/* -------------------------------------------------------------------------- */
/* Bản ghi một tầng — thứ nằm trong bộ nhớ đệm của react-query.                 */
/* -------------------------------------------------------------------------- */

interface FloorProgressRecord {
  readonly floorId: string;
  readonly uploadId: string;
  readonly stages: readonly PipelineStageState[];
  /**
   * Vừa là phần trăm đang hiển thị, vừa là `highestProgressReached` của lần gọi
   * `calculateTotalProgress` kế tiếp — hàm đó trả về `max` của hai thứ, nên giữ
   * đúng một con số là đủ để tiến độ không bao giờ nhảy lùi.
   */
  readonly totalPercent: number;
  readonly remainingSeconds: number | null;
  readonly progress?: Partial<Progress>;
  readonly logLines: readonly ProcessingRawLogLine[];
  readonly source: ProgressStreamSource;
  readonly connectionStatus: ChannelStatus;
  /** `Progress.step` mà `toStageBreakdown` không tra được. Không đoán bừa. */
  readonly unmappedStep?: string;
  /** Lỗi mạng / lỗi hợp đồng của RIÊNG tầng này. */
  readonly failure?: ProcessingFailure;
  readonly queuePosition?: number;
  readonly stepDetails?: readonly ProcessingRawStepProgress[];
  readonly detectedGeometryPaths?: readonly string[];
  readonly extraction?: ProcessingExtractionSummary;
}

function emptyRecord(upload: ProcessingFloorUpload): FloorProgressRecord {
  return {
    floorId: upload.floorId,
    uploadId: upload.uploadId,
    stages: getPipelineStages().map((stage) => ({ id: stage.id, status: 'queued' })),
    totalPercent: 0,
    remainingSeconds: null,
    logLines: [],
    source: 'sse',
    connectionStatus: 'dang-noi',
  };
}

/** Câu một dòng nhật ký: tên bước tiếng Việt, kèm phần trăm máy chủ tự báo. */
function logTextOf(progress: Partial<Progress>): string {
  const label = progress.step === undefined ? undefined : stageLabelOfStep(progress.step);
  const name = label ?? progress.step;

  if (name === undefined) {
    return COPY.noFloorRunning;
  }

  if (progress.progressPercent === undefined) {
    return name;
  }

  return `${name} — ${formatPercent(progress.progressPercent, { source: 'percent', fractionDigits: 0 })}`;
}

/** Nhãn tiếng Việt của bước mà một `Progress.step` nói tới, hoặc `undefined`. */
function stageLabelOfStep(step: string): string | undefined {
  const wanted = step.trim().toLowerCase();

  for (const stage of getPipelineStages()) {
    if (stage.id.toLowerCase() === wanted || stage.label.toLowerCase() === wanted) {
      return stage.label;
    }
  }

  return undefined;
}

/**
 * Gộp một nhịp mới vào bản ghi của một tầng.
 *
 * Đây là chỗ duy nhất `totalPercent` được cập nhật, và nó luôn đi qua
 * `calculateTotalProgress` với `highestProgressReached` là con số trước đó — nên
 * một nhịp báo số thấp hơn (quay vòng đọc lại sau khi SSE chết) không kéo được
 * thanh tiến độ lùi.
 */
function applySnapshot(
  record: FloorProgressRecord,
  progress: Partial<Progress>,
  observedAtMs: number,
  source: ProgressStreamSource,
  eventId: string,
): FloorProgressRecord {
  const breakdown = toStageBreakdown(progress, record.stages, observedAtMs);
  const stages = breakdown.supported ? breakdown.value : record.stages;
  const totalPercent = calculateTotalProgress({
    stages,
    highestProgressReached: record.totalPercent,
  });

  const logLine: ProcessingRawLogLine = {
    id: eventId,
    atIso: new Date(observedAtMs).toISOString(),
    text: logTextOf(progress),
  };

  return {
    ...record,
    stages,
    totalPercent,
    remainingSeconds: estimateRemainingSeconds({ stages, highestProgressReached: totalPercent }),
    progress,
    source,
    logLines: [...record.logLines, logLine],
    ...(breakdown.supported ? {} : { unmappedStep: progress.step ?? '' }),
  };
}

/** Trạng thái chung của một tầng, suy từ sáu bước của nó. */
function floorStatusOf(record: FloorProgressRecord): ProcessingStageStatus {
  if (record.failure !== undefined || record.stages.some((stage) => stage.status === 'failed')) {
    return 'failed';
  }

  if (record.stages.every((stage) => stage.status === 'done')) {
    return 'done';
  }

  if (record.stages.some((stage) => stage.status === 'running')) {
    return 'running';
  }

  return 'queued';
}

const STATUS_LABELS: Readonly<Record<ProcessingStageStatus, string>> = {
  queued: COPY.statusQueued,
  running: COPY.statusRunning,
  done: COPY.statusDone,
  failed: COPY.statusFailed,
};

/** Phần trăm của MỘT bước. Không tự tăng: chưa biết thì `0`, xong thì `100`. */
function stepPercentOf(stage: PipelineStageState): number {
  if (stage.status === 'done') {
    return 100;
  }

  return stage.internalPercent ?? 0;
}

const countLabel = (value: number, unit: string): string =>
  `${formatNumber(value, { fractionDigits: 0 })} ${unit}`;

/** Giây → câu tiếng Việt, qua `formatDuration` (nó nhận mili giây). */
const durationLabelOf = (seconds: number | null): string | null =>
  seconds === null ? null : formatDuration(seconds * MILLISECONDS_PER_SECOND);

/* -------------------------------------------------------------------------- */
/* Cách xếp thu gọn — cùng khuôn `useProjectSettings.ts`.                       */
/* -------------------------------------------------------------------------- */

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/**
 * Cổng đã tiêm, hoặc bản thật dựng ĐÚNG MỘT LẦN và chỉ khi cần.
 *
 * `ProcessingScreen.container.tsx` bình thường tiêm sẵn bản thật; nhánh dự phòng
 * ở đây dành cho story hoặc test dựng thẳng hook. Dựng lười vì
 * `createAppProcessingGateway` mở một bộ gửi đo đạc — không nên tạo ra một bộ
 * nữa cho mỗi lượt gắn hook đã có cổng riêng.
 */
function useResolvedGateway(injected: ProcessingGateway | undefined): ProcessingGateway {
  const fallbackRef = useRef<ProcessingGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createAppProcessingGateway();
  return fallbackRef.current;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** `(options) => ProcessingScreenProps` cho `ProcessingScreen.tsx`. */
export function useProcessingScreen(options: UseProcessingScreenOptions): ProcessingScreenProps {
  const { projectId } = options;
  const roles = options.roles ?? DEFAULT_ROLES;
  const queryClient = useQueryClient();

  const gateway = useResolvedGateway(options.gateway);
  const { publish } = useNotifications(options.notifications);

  // Hàm huỷ đăng ký của TỪNG dòng sự kiện đang mở, khoá theo `uploadId`. Đây là
  // thứ duy nhất `onRunInBackground` cần mà không lấy được từ chỗ nào khác: nó
  // sinh ra trong `useEffect` dưới, và phải trao được sang sổ theo dõi nền.
  const stopsRef = useRef<ReadonlyMap<string, () => void>>(new Map());

  const floorUploads = options.floorUploads ?? EMPTY_UPLOADS;
  // Danh tính của danh sách tầng dưới dạng một chuỗi: nơi gọi truyền một mảng
  // mới mỗi lượt render vẫn không làm các đăng ký bị mở lại.
  const floorsKey = floorUploads.map((upload) => `${upload.floorId}:${upload.uploadId}`).join('|');
  const uploadsRef = useRef(floorUploads);
  uploadsRef.current = floorUploads;

  const prefersReducedMotion = useReducedMotion();
  const detectedNarrow = useNarrowViewport();
  const isCompact = options.forceCollapsed ?? detectedNarrow;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [activeTab, setActiveTab] = useState<ProcessingPanelTab>('preview');
  const [openStepIds, setOpenStepIds] = useState<readonly string[]>([]);
  const [isLogAutoScrollLocked, setIsLogAutoScrollLocked] = useState(false);
  const [isCancelConfirming, setIsCancelConfirming] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Trạng thái máy chủ — một khoá đệm cho mỗi tầng (R-64).                   */
  /* ---------------------------------------------------------------------- */

  const floorQueries = useQueries({
    queries: floorUploads.map((upload) => ({
      queryKey: queryKeys.progress.byFloor(upload.floorId),
      queryFn: async (): Promise<FloorProgressRecord> => {
        // Nền là bản ghi ĐANG có trong đệm, không phải bản rỗng: lượt đọc mồi
        // của một lần quay lại màn không được xoá tiến độ đã tích được.
        const cached = queryClient.getQueryData<FloorProgressRecord>(
          queryKeys.progress.byFloor(upload.floorId),
        );
        const base = cached ?? emptyRecord(upload);

        const [progress, queuePosition, stepDetails, geometry, extraction] = await Promise.all([
          gateway.readProgressOnce({ projectId, uploadId: upload.uploadId }),
          gateway.readQueuePosition({ projectId, uploadId: upload.uploadId }),
          gateway.readStepDetails({ projectId, uploadId: upload.uploadId }),
          gateway.readDetectedGeometry({ projectId, floorId: upload.floorId }),
          gateway.readExtractionSummary({ projectId, floorId: upload.floorId }),
        ]);

        if (!progress.ok) {
          throw progress.error;
        }

        const withProgress = applySnapshot(
          base,
          progress.data,
          gateway.now(),
          base.source,
          `${upload.uploadId}:seed:${progress.data.progressPercent}`,
        );

        return {
          ...withProgress,
          ...(queuePosition.supported ? { queuePosition: queuePosition.value } : {}),
          ...(stepDetails.supported ? { stepDetails: stepDetails.value } : {}),
          ...(geometry.supported ? { detectedGeometryPaths: geometry.value } : {}),
          ...(extraction.supported ? { extraction: extraction.value } : {}),
        };
      },
    })),
  });

  /* ---------------------------------------------------------------------- */
  /* Dòng sự kiện — MỘT đăng ký độc lập cho mỗi tầng.                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const uploads = uploadsRef.current;

    const write = (
      upload: ProcessingFloorUpload,
      change: (record: FloorProgressRecord) => FloorProgressRecord,
    ): void => {
      queryClient.setQueryData<FloorProgressRecord>(
        queryKeys.progress.byFloor(upload.floorId),
        (existing) => change(existing ?? emptyRecord(upload)),
      );
    };

    const stops = uploads.map((upload) =>
      gateway.subscribeProgress(
        { floorId: upload.floorId, projectId, uploadId: upload.uploadId },
        {
          onSnapshot: (snapshot) => {
            write(upload, (record) =>
              applySnapshot(
                record,
                snapshot.progress,
                snapshot.observedAtMs,
                snapshot.source,
                snapshot.eventId,
              ),
            );

            // Nhịp cuối. `settle` tự trả `false` cho một lượt KHÔNG chạy nền,
            // nên đây không phải một nhánh điều kiện thứ hai của màn: lượt bình
            // thường đi qua đây và không có gì xảy ra.
            const outcome = outcomeOf(snapshot.progress.status);

            if (outcome !== undefined) {
              gateway.backgroundWatches.settle(
                watchIdOf(projectId, upload.uploadId),
                outcome,
              );
            }
          },
          onConnectionChange: (state) => {
            write(upload, (record) => ({
              ...record,
              connectionStatus: state.status,
              source: state.source,
            }));
          },
          onFailure: (failure) => {
            write(upload, (record) => ({ ...record, failure }));
          },
        },
      ),
    );

    stopsRef.current = new Map(
      uploads.flatMap((upload, index) => {
        const stop = stops[index];
        return stop === undefined ? [] : [[upload.uploadId, stop] as const];
      }),
    );

    return () => {
      stops.forEach((stop, index) => {
        const upload = uploads[index];

        // Lượt đã đăng ký chạy nền: sổ đang GIỮ chính hàm `stop` này và sẽ gọi
        // nó lúc lượt kết thúc. Rời màn không đóng dòng sự kiện — đó là toàn bộ
        // nội dung của lời hứa "chạy nền".
        if (
          upload !== undefined &&
          gateway.backgroundWatches.has(watchIdOf(projectId, upload.uploadId))
        ) {
          return;
        }

        stop();
      });
    };
  }, [floorsKey, gateway, projectId, queryClient]);

  /* ---------------------------------------------------------------------- */
  /* O-01, nửa đầu: ai.started một lần cho mỗi lượt xử lý.                    */
  /* ---------------------------------------------------------------------- */

  const startedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const uploads = uploadsRef.current;

    if (uploads.length === 0) {
      return;
    }

    const key = `${projectId}|${floorsKey}`;

    if (startedKeyRef.current === key) {
      return;
    }

    startedKeyRef.current = key;
    gateway.trackAiStarted({
      levelCount: new Set(uploads.map((upload) => upload.floorId)).size,
      pageCount: uploads.length,
    });
  }, [floorsKey, gateway, projectId]);

  /* ---------------------------------------------------------------------- */
  /* Từ bản ghi sang viewmodel.                                              */
  /* ---------------------------------------------------------------------- */

  // Không bọc `useMemo`: `floorQueries` là một mảng mới mỗi lượt render nên một
  // bộ nhớ đệm khoá theo nó không bao giờ trúng, và phép `map` này rẻ.
  const records = floorUploads.map(
    (upload, index) => floorQueries[index]?.data ?? emptyRecord(upload),
  );

  const isLoading = floorQueries.some((query) => query.isPending);
  const hasEveryReadFailed =
    floorQueries.length > 0 && floorQueries.every((query) => query.isError);
  const firstReadError = floorQueries.find((query) => query.isError)?.error;

  const canEdit = can('upload', 'floor', { roles });

  const floorStatuses = records.map((record) => floorStatusOf(record));
  const failedIndexes = floorStatuses
    .map((status, index) => (status === 'failed' ? index : -1))
    .filter((index) => index >= 0);
  const doneCount = floorStatuses.filter((status) => status === 'done').length;
  const activeIndex = floorStatuses.findIndex((status) => status === 'running');

  const state = useMemo<ProcessingScreenState>(() => {
    if (isLoading) return 'loading';
    if (hasEveryReadFailed) return 'error';
    if (!canEdit) return 'forbidden';
    if (isCompact) return 'collapsed';
    if (records.length === 0) return 'empty';
    if (doneCount < records.length) return 'partial';
    return 'success';
  }, [canEdit, doneCount, hasEveryReadFailed, isCompact, isLoading, records.length]);

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                              */
  /* ---------------------------------------------------------------------- */

  // Khuôn "ref mới nhất": nơi gọi truyền hàm mới mỗi lượt render vẫn không làm
  // các `useCallback` dưới đây đổi danh tính.
  const onNavigateRef = useRef(options.onNavigate);
  onNavigateRef.current = options.onNavigate;
  const onGoToSupportRef = useRef(options.onGoToSupport);
  onGoToSupportRef.current = options.onGoToSupport;

  const navigate = useCallback((path: string) => {
    onNavigateRef.current?.(path);
  }, []);

  const onTabChange = useCallback((tab: ProcessingPanelTab) => {
    setActiveTab(tab);
  }, []);

  const onToggleLogAutoScroll = useCallback(() => {
    setIsLogAutoScrollLocked((locked) => !locked);
  }, []);

  const logLines = useMemo<readonly ProcessingLogLineViewModel[]>(
    () =>
      records
        .flatMap((record) => record.logLines)
        .map((line) => ({
          id: line.id,
          timeLabel: formatClockTime(new Date(line.atIso)),
          text: line.text,
        })),
    [records],
  );

  const onCopyLog = useCallback(() => {
    void gateway.copyText(logLines.map((line) => `${line.timeLabel} ${line.text}`).join('\n'));
  }, [gateway, logLines]);

  const onRetry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.progress.byFloor.root() });
  }, [queryClient]);

  const onGoToSupport = useCallback(() => {
    const given = onGoToSupportRef.current;

    if (given !== undefined) {
      given();
      return;
    }

    navigate(ROUTES.account);
  }, [navigate]);

  const canCancel = gateway.supports.cancelProcessing && canEdit;

  const onRequestCancel = useCallback(() => {
    if (!canCancel) {
      return;
    }

    setIsCancelConfirming(true);
  }, [canCancel]);

  const onDismissCancel = useCallback(() => {
    setIsCancelConfirming(false);
  }, []);

  const onConfirmCancel = useCallback(() => {
    const uploads = uploadsRef.current;
    setIsCancelConfirming(false);

    uploads.forEach((upload) => {
      void gateway.requestCancel({ projectId, uploadId: upload.uploadId });
    });
  }, [gateway, projectId]);

  /**
   * "Để chạy nền và thông báo cho tôi".
   *
   * Không có lượt nào đang chạy thì KHÔNG hứa gì: đẩy một câu "sẽ báo cho bạn"
   * lúc màn ở trạng thái `empty` là hứa một thông báo không bao giờ tới.
   */
  const onRunInBackground = useCallback(() => {
    const uploads = uploadsRef.current;

    const watches = uploads.flatMap((upload): readonly BackgroundWatchEntry[] => {
      const release = stopsRef.current.get(upload.uploadId);

      if (release === undefined) {
        return [];
      }

      const id = watchIdOf(projectId, upload.uploadId);

      return [
        {
          id,
          label: upload.floorName,
          release,
          // Bao đóng, không phải state: nó chạy được sau khi màn đã tháo, vì cả
          // sổ lẫn bus đều sống ngoài cây React.
          onSettled: (outcome) => {
            publish(settledNotice(id, upload.floorName, outcome));
          },
        },
      ];
    });

    if (watches.length === 0) {
      return;
    }

    void gateway.runInBackground({ projectId, watches }).then((result) => {
      if (!result.supported) {
        return;
      }

      publish({
        type: BACKGROUND_STARTED_TYPE,
        title: COPY.backgroundStartedTitle,
        description: COPY.backgroundStartedDescription,
      });
    });
  }, [gateway, projectId, publish]);

  const onToggleDetail = useCallback((stepId: string) => {
    setOpenStepIds((open) =>
      open.includes(stepId) ? open.filter((id) => id !== stepId) : [...open, stepId],
    );
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Viewmodel.                                                              */
  /* ---------------------------------------------------------------------- */

  const floors = useMemo<readonly ProcessingFloorChipViewModel[]>(
    () =>
      floorUploads.map((upload, index) => {
        const record = records[index];
        const status = floorStatuses[index] ?? 'queued';
        const objectCount = record?.extraction;

        return {
          id: upload.floorId,
          label: upload.floorName,
          status,
          statusLabel: STATUS_LABELS[status],
          isActive: index === activeIndex,
          ...(objectCount !== undefined
            ? {
                objectCountLabel: countLabel(
                  objectCount.wallCount + objectCount.openingCount + objectCount.roomCount,
                  UNIT.object,
                ),
              }
            : {}),
        };
      }),
    [activeIndex, floorStatuses, floorUploads, records],
  );

  /**
   * Sáu bước của TẦNG ĐANG CHẠY. Danh sách bước là một cây của một lượt xử lý,
   * và `types.ts` không có chỗ cho sáu bước nhân N tầng — dãy chip tầng ở trên
   * mới là nơi đọc tiến độ theo tầng.
   */
  const focusIndex = activeIndex >= 0 ? activeIndex : 0;
  const focusRecord = records[focusIndex];

  const steps = useMemo<readonly ProcessingStepViewModel[]>(() => {
    if (focusRecord === undefined) {
      return [];
    }

    const detailById = new Map(
      (focusRecord.stepDetails ?? []).map((detail) => [detail.stepId, detail]),
    );
    const remainingLabel = durationLabelOf(focusRecord.remainingSeconds);

    return focusRecord.stages.map((stage) => {
      const detail = detailById.get(stage.id);
      const isRunning = stage.status === 'running';
      const children = detail?.children?.map((child) => ({
        id: `${stage.id}.${child.stepId}`,
        name: STAGE_LABEL_BY_ID.get(child.stepId) ?? child.stepId,
        status: child.status,
        percent: child.percent,
        isScanning: child.status === 'running',
        detailLabels: child.detailLines,
        isDetailOpen: openStepIds.includes(`${stage.id}.${child.stepId}`),
        onToggleDetail: () => onToggleDetail(`${stage.id}.${child.stepId}`),
        ...(child.errorCode !== undefined
          ? { errorCode: child.errorCode, errorMessage: COPY.stepErrorFallback }
          : {}),
      }));

      return {
        id: stage.id,
        name: STAGE_LABEL_BY_ID.get(stage.id) ?? stage.id,
        status: stage.status,
        percent: stepPercentOf(stage),
        isScanning: isRunning,
        detailLabels: detail?.detailLines ?? [],
        isDetailOpen: openStepIds.includes(stage.id),
        onToggleDetail: () => onToggleDetail(stage.id),
        ...(isRunning && remainingLabel !== null
          ? { remainingLabel: remainingSentence(remainingLabel) }
          : {}),
        ...(stage.status === 'failed'
          ? {
              errorCode: detail?.errorCode ?? PROCESSING_ERROR_CODE,
              errorMessage: focusRecord.progress?.error ?? COPY.stepErrorFallback,
            }
          : {}),
        ...(children !== undefined ? { children } : {}),
      };
    });
  }, [focusRecord, onToggleDetail, openStepIds]);

  const previewPanel = useMemo<ProcessingPreviewViewModel>(() => {
    const upload = floorUploads[focusIndex];

    if (upload === undefined || focusRecord === undefined) {
      return {
        altText: COPY.previewAltEmpty,
        isScanning: false,
        detectedGeometryPaths: EMPTY_GEOMETRY,
        activeFloorId: null,
      };
    }

    return {
      ...(upload.sourceImageUrl !== undefined ? { sourceImageUrl: upload.sourceImageUrl } : {}),
      altText: `${COPY.previewAltPrefix}${upload.floorName}`,
      isScanning: floorStatuses[focusIndex] === 'running',
      detectedGeometryPaths: focusRecord.detectedGeometryPaths ?? EMPTY_GEOMETRY,
      activeFloorId: upload.floorId,
    };
  }, [floorStatuses, floorUploads, focusIndex, focusRecord]);

  const summary = useMemo<ProcessingSummaryViewModel | undefined>(() => {
    const parts = records
      .map((record) => record.extraction)
      .filter((extraction): extraction is ProcessingExtractionSummary => extraction !== undefined);

    if (parts.length === 0) {
      return undefined;
    }

    const total = parts.reduce(
      (accumulated, part) => ({
        wallCount: accumulated.wallCount + part.wallCount,
        openingCount: accumulated.openingCount + part.openingCount,
        dimensionCount: accumulated.dimensionCount + part.dimensionCount,
        roomCount: accumulated.roomCount + part.roomCount,
        areaM2: accumulated.areaM2 + part.areaM2,
        lowConfidenceCount: accumulated.lowConfidenceCount + part.lowConfidenceCount,
      }),
      {
        wallCount: 0,
        openingCount: 0,
        dimensionCount: 0,
        roomCount: 0,
        areaM2: 0,
        lowConfidenceCount: 0,
      },
    );

    const threshold = formatNumber(CONFIDENCE_SUGGESTED_THRESHOLD, { fractionDigits: 2 });

    return {
      wallCountLabel: countLabel(total.wallCount, UNIT.wall),
      objectCountLabel: countLabel(total.wallCount + total.openingCount, UNIT.object),
      dimensionCountLabel: countLabel(total.dimensionCount, UNIT.dimensionChain),
      roomCountLabel: countLabel(total.roomCount, UNIT.room),
      areaLabel: formatArea(total.areaM2),
      lowConfidenceSentence:
        total.lowConfidenceCount === 0
          ? noLowConfidenceSentence(threshold)
          : lowConfidenceSentence(
              formatNumber(total.lowConfidenceCount, { fractionDigits: 0 }),
              threshold,
            ),
      onReviewWalls: () => {
        const upload = uploadsRef.current[focusIndex];

        if (upload !== undefined) {
          navigate(ROUTES.project.walls(projectId, upload.floorId));
        }
      },
      onCalibrateScale: () => {
        navigate(ROUTES.project.scale(projectId));
      },
    };
  }, [focusIndex, navigate, projectId, records]);

  const overallSummaryLine = useMemo(() => {
    const doneClause = doneFloorsSentence(
      formatNumber(doneCount, { fractionDigits: 0 }),
      formatNumber(records.length, { fractionDigits: 0 }),
    );
    const slowest = records
      .map((record) => record.remainingSeconds)
      .filter((seconds): seconds is number => seconds !== null);

    return overallSentence(
      doneClause,
      slowest.length === 0 ? null : durationLabelOf(Math.max(...slowest)),
    );
  }, [doneCount, records]);

  const queuePosition = records.find((record) => record.queuePosition !== undefined)?.queuePosition;

  const partialNoticeLine =
    failedIndexes.length > 0 && failedIndexes.length < records.length
      ? partialSentence(
          failedIndexes
            .map((index) => floorUploads[index]?.floorName ?? '')
            .filter((name) => name.length > 0)
            .join(', '),
        )
      : undefined;

  const errorAlert = useMemo<ProcessingErrorAlertViewModel | undefined>(() => {
    if (state !== 'error') {
      return undefined;
    }

    const failure =
      records.find((record) => record.failure !== undefined)?.failure ??
      gateway.describeApiFailure(firstReadError);

    return {
      title: failure.title,
      message: failure.sentence,
      technicalCode: failure.technicalCode,
      onRetry,
      onGoToSupport,
    };
  }, [firstReadError, gateway, onGoToSupport, onRetry, records, state]);

  return {
    state,
    floors,
    steps,
    previewPanel,
    logLines,
    ...(summary !== undefined ? { summary } : {}),
    overallSummaryLine,
    ...(queuePosition !== undefined
      ? { queueLine: queueSentence(formatNumber(queuePosition, { fractionDigits: 0 })) }
      : {}),
    ...(partialNoticeLine !== undefined ? { partialNoticeLine } : {}),
    ...(errorAlert !== undefined ? { errorAlert } : {}),
    activeTab,
    onTabChange,
    isLogAutoScrollLocked,
    onToggleLogAutoScroll,
    onCopyLog,
    canCancel,
    isCancelConfirming,
    onRequestCancel,
    onConfirmCancel,
    onDismissCancel,
    onRunInBackground,
    isCompact,
    prefersReducedMotion,
  };
}

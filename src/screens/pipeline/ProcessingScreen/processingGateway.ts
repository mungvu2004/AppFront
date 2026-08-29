/**
 * Cổng dữ liệu của màn Xử lý (`ProcessingScreen`) — mọi lời gọi ra khỏi màn đi
 * qua đây.
 *
 * Cùng khuôn `floorUploadGateway.ts` / `inputQualityGateway.ts`: một `interface`
 * cho hình dạng, một factory nhận `ApiClient` để test cắm `createMockApiClient()`
 * vào đúng phép ánh xạ bản sản phẩm dùng (R-70), và một factory thứ hai dựng
 * client thật cho container.
 *
 * ## Phần NỐI ĐƯỢC THẬT
 *
 * Đúng một việc có endpoint hôm nay: đọc tiến độ của MỘT lượt xử lý
 * (`ENDPOINTS.drawings.progress(projectId, uploadId)`), và theo dõi nó bằng
 * `createProgressStream` của `src/lib/realtime`. Dòng sự kiện đó tự chuyển SSE →
 * quay vòng sau `SSE_FAILURE_LIMIT` lần mất kết nối liên tiếp, tự thử lại SSE
 * định kỳ, và tự ngừng nghe khi tab ẩn qua `visibilityTarget`. File này CHỈ GỌI
 * nó: không có giãn cách thử lại, không có `EventSource`, không có vòng lặp quay
 * vòng nào viết tay ở đây.
 *
 * ## Phần KHÔNG CÓ — và vì sao vẫn khai
 *
 * Chín việc màn cần mà tầng dữ liệu chưa có. Mỗi việc vẫn nằm trong
 * {@link ProcessingGateway} (giao diện là thứ nơi gọi lập trình theo, xoá đi thì
 * lần sau phải dựng lại; test và story cắm bản giả "có dữ liệu" vào đúng chỗ đó
 * để phần giao diện tương ứng vẫn kiểm được — R-73), nhưng **bản cài đặt thật
 * trả về nhánh `supported: false` có kiểu rõ ràng** ({@link ProcessingUnsupported}),
 * kèm tên endpoint / trường dữ liệu còn thiếu. Không giá trị bịa, không `0`,
 * không mảng rỗng giả vờ là dữ liệu thật. Hook đọc nhánh đó và phản ánh trung
 * thực ra props: không huỷ được thì `canCancel` bằng `false`, không có vị trí
 * hàng đợi thì `queueLine` bằng `undefined`.
 *
 * Đây KHÔNG phải stub bị R-69 cấm: R-69 cấm bịa dữ liệu và cấm TODO im lặng.
 * Ở đây một khả năng chưa tồn tại được khai báo rõ ràng và sự thật đó được
 * truyền lên giao diện.
 *
 * ## GIẢ ĐỊNH — đọc trước khi tin `toStageBreakdown`
 *
 * `Progress` mang đúng MỘT luồng: `progressPercent` tổng, `step` là chuỗi tự do,
 * `status` bốn giá trị. Nó KHÔNG mang trạng thái của từng bước trong sáu bước
 * của `PIPELINE_STAGES`. Không có hàm nào trong repo chuyển `Progress` sang
 * `PipelineProgressState` (đã soát `src/lib/realtime` toàn bộ).
 *
 * {@link toStageBreakdown} lấp khoảng đó bằng **tra cứu**, không bằng công thức:
 * `Progress.step` đối chiếu với `getPipelineStages()` theo cả `id` lẫn nhãn
 * tiếng Việt. Nhưng nó phải thêm MỘT GIẢ ĐỊNH, và giả định đó viết ra đây để
 * người đọc sau không tưởng là sự thật quan sát được:
 *
 * > **Giả định C3:** mọi bước đứng TRƯỚC bước đang chạy trong `PIPELINE_STAGES`
 * > đều đã xong.
 *
 * Đó là thứ duy nhất một `Progress` một luồng có thể mang. Nó **sai** khi máy
 * chủ chạy các bước không theo thứ tự khai báo, khi một bước bị bỏ qua mà vẫn
 * còn dở, hoặc khi máy chủ quay lại một bước cũ để chạy lại. Khi lượt đọc báo
 * hỏng thì giả định này KHÔNG được áp: không bước nào được nâng lên "xong" từ
 * một lần đọc báo hỏng.
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult } from '@/api/client';
import { API_BASE_PATH, ENDPOINTS } from '@/api/endpoints';
import type { Progress } from '@/api/schemas';
import { describeError, toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import { createUuid } from '@/lib/http/ids';
import type { ChannelEvent } from '@/lib/realtime/eventChannel';
import type { ProgressPatchEvent } from '@/lib/realtime/mergeEvents';
import { getPipelineStages } from '@/lib/realtime/pipeline';
import type { PipelineStageId, PipelineStageState } from '@/lib/realtime/pipeline';
import type { PollingVisibilityTarget } from '@/lib/realtime/pollingChannel';
import { createProgressStream } from '@/lib/realtime/progressStream';
import type { ProgressStreamSource, ProgressStreamState } from '@/lib/realtime/progressStream';
import { createBeaconTransport, createTelemetrySender } from '@/lib/telemetry/sender';
import type { TelemetrySender } from '@/lib/telemetry/sender';

/* -------------------------------------------------------------------------- */
/* Khả năng chưa tồn tại — kết quả CÓ KIỂU, không phải giá trị bịa.             */
/* -------------------------------------------------------------------------- */

/**
 * Tên máy đọc của từng việc màn cần mà tầng dữ liệu chưa có. Danh sách này là
 * bản kê nợ của màn Xử lý; mỗi tên có đúng một dòng trong
 * {@link PROCESSING_MISSING_ENDPOINTS}.
 */
export const PROCESSING_CAPABILITIES = [
  'cancelProcessing',
  'queuePosition',
  'parallelFloorPipeline',
  'runInBackground',
  'completionNotice',
  'extractionSummary',
  'stepDetails',
  'detectedGeometry',
  'stageBreakdown',
] as const;

export type ProcessingCapability = (typeof PROCESSING_CAPABILITIES)[number];

/**
 * Endpoint / trường dữ liệu còn thiếu của từng khả năng, viết nguyên văn để
 * người nối dây sau biết chính xác phải thêm gì vào `src/api` trước khi bản cài
 * đặt thật đổi được sang nhánh `supported: true`.
 */
export const PROCESSING_MISSING_ENDPOINTS: Readonly<Record<ProcessingCapability, string>> = {
  cancelProcessing: 'ENDPOINTS.drawings.cancel + DrawingsApi.cancel — chưa có',
  queuePosition:
    'ENDPOINTS.drawings.queue + trường vị trí hàng đợi trong ProgressSchema (.strict(), 7 trường) — chưa có',
  parallelFloorPipeline:
    'endpoint trả trạng thái xử lý của MỌI tầng trong một lượt đọc — chưa có; màn tự ghép N lượt đọc drawings.progress độc lập',
  runInBackground: 'endpoint/luồng "chạy nền, xử lý vẫn tiếp tục sau khi rời màn" — chưa có',
  completionNotice: 'kênh thông báo khi xử lý xong (chuông thông báo) — chưa có',
  extractionSummary:
    'endpoint tổng kết trích xuất: wallCount, openingCount, dimensionCount, roomCount, confidencePercent — chưa có (areaM2 đã có qua spatial.readFloor)',
  stepDetails:
    'endpoint chi tiết từng bước (số đối tượng tìm được, mã lỗi của riêng bước) — chưa có',
  detectedGeometry: 'endpoint trả hình học dò được GIỮA CHỪNG lúc đang xử lý — chưa có',
  stageBreakdown:
    'ánh xạ Progress.step (chuỗi tự do) sang PipelineStageId — chưa có; toStageBreakdown tra cứu theo id/nhãn và chịu giả định C3',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface ProcessingUnsupported {
  readonly supported: false;
  readonly capability: ProcessingCapability;
  /** Lấy nguyên từ {@link PROCESSING_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface ProcessingSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type ProcessingCapabilityResult<TValue> =
  | ProcessingSupported<TValue>
  | ProcessingUnsupported;

/** Dựng nhánh "không hỗ trợ" — một chỗ duy nhất ghép tên việc với endpoint thiếu. */
export function unsupported(capability: ProcessingCapability): ProcessingUnsupported {
  return { supported: false, capability, missing: PROCESSING_MISSING_ENDPOINTS[capability] };
}

/* -------------------------------------------------------------------------- */
/* Dữ liệu thô — chưa định dạng, chưa xếp bảy trạng thái.                       */
/* -------------------------------------------------------------------------- */

export type ProcessingRawStageStatus = 'queued' | 'running' | 'done' | 'failed';

/** Một tầng trong mô hình nhiều-tầng-song-song. Xem `parallelFloorPipeline`. */
export interface ProcessingRawFloorProgress {
  readonly floorId: string;
  readonly floorName: string;
  readonly status: ProcessingRawStageStatus;
  readonly objectCount?: number;
}

/** Chi tiết một bước. Xem `stepDetails`. */
export interface ProcessingRawStepProgress {
  readonly stepId: PipelineStageId;
  readonly status: ProcessingRawStageStatus;
  /** 0..100, chưa làm tròn. */
  readonly percent: number;
  readonly remainingSeconds?: number;
  readonly detailLines: readonly string[];
  readonly errorCode?: string;
  readonly children?: readonly ProcessingRawStepProgress[];
}

export interface ProcessingRawLogLine {
  readonly id: string;
  /** Mốc giờ ISO 8601 — hook định dạng bằng `src/lib/format`, không phải cổng. */
  readonly atIso: string;
  readonly text: string;
}

/** Tổng kết trích xuất. Xem `extractionSummary`. */
export interface ProcessingExtractionSummary {
  readonly wallCount: number;
  readonly openingCount: number;
  readonly dimensionCount: number;
  readonly roomCount: number;
  readonly areaM2: number;
  /** Số đối tượng có độ tin cậy dưới ngưỡng "gợi ý" của `src/lib/format/semantic`. */
  readonly lowConfidenceCount: number;
}

/** Một nhịp của dòng sự kiện: bản ghép mới nhất, kèm nguồn và mốc quan sát. */
export interface ProcessingProgressSnapshot {
  readonly eventId: string;
  readonly floorId: string;
  readonly uploadId: string;
  readonly observedAtMs: number;
  /** `Partial` vì `mergeEvents` ghép từng mảnh vá; trường chưa tới thì chưa có. */
  readonly progress: Partial<Progress>;
  readonly source: ProgressStreamSource;
}

/** Một thất bại, đã thành câu người đọc được (L-03). */
export interface ProcessingFailure {
  /** Tiêu đề tiếng Việt, lấy nguyên từ `describeError` — không viết lại. */
  readonly title: string;
  /** Câu tiếng Việt, lấy nguyên từ `describeError`. */
  readonly sentence: string;
  /** Mã máy đọc của `APP_ERROR_KIND_CONFIG` — ví dụ `NETWORK`. */
  readonly technicalCode: string;
  readonly kind: AppError['kind'];
  readonly isRetryable: boolean;
}

/* -------------------------------------------------------------------------- */
/* Tham số vào.                                                                */
/* -------------------------------------------------------------------------- */

export interface ReadProgressInput {
  readonly projectId: string;
  readonly uploadId: string;
  readonly signal?: AbortSignal;
}

export interface SubscribeProgressInput {
  readonly projectId: string;
  readonly uploadId: string;
  readonly floorId: string;
}

export interface SubscribeProgressHandlers {
  readonly onSnapshot: (snapshot: ProcessingProgressSnapshot) => void;
  readonly onConnectionChange?: (state: ProgressStreamState) => void;
  readonly onFailure?: (failure: ProcessingFailure) => void;
}

export interface RequestCancelInput {
  readonly projectId: string;
  readonly uploadId: string;
}

export interface RunInBackgroundInput {
  readonly projectId: string;
}

export interface ReadQueuePositionInput {
  readonly projectId: string;
  readonly uploadId: string;
}

export interface ReadParallelFloorPipelineInput {
  readonly projectId: string;
}

/**
 * Theo TỪNG TẦNG, không theo dự án: số tường / ô mở / phòng là của một mặt bằng,
 * và `Floor.areaM2` — mảnh duy nhất của tổng kết này đã tồn tại — cũng vậy. Màn
 * cộng lại thành báo cáo của cả dự án.
 */
export interface ReadExtractionSummaryInput {
  readonly projectId: string;
  readonly floorId: string;
}

export interface ReadStepDetailsInput {
  readonly projectId: string;
  readonly uploadId: string;
}

export interface ReadDetectedGeometryInput {
  readonly projectId: string;
  readonly floorId: string;
}

export interface SubscribeCompletionNoticeInput {
  readonly projectId: string;
}

/** Đúng hai số biết được TRƯỚC khi trích xuất chạy (O-01, `ai.started`). */
export interface TrackAiStartedInput {
  readonly levelCount: number;
  readonly pageCount: number;
}

/* -------------------------------------------------------------------------- */
/* Cái seam.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Mỗi phương thức là một việc màn cần từ thế giới bên ngoài, và không có việc
 * nào khác. Hook không nhập `src/api` trực tiếp.
 */
export interface ProcessingGateway {
  /**
   * Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ.
   *
   * Cần đồng bộ vì có câu hỏi màn phải trả lời trước khi vẽ khung: `canCancel`
   * quyết định nút huỷ có tồn tại hay không (ẩn hẳn, không khoá mờ — cùng lý lẽ
   * A9), và một lời hứa chưa xong thì không trả lời được câu đó. Bản cài đặt
   * thật đặt `false` cho mọi việc chưa có endpoint; test và story cắm bản giả
   * bật `true` để nhánh "có hỗ trợ" vẫn được kiểm.
   */
  readonly supports: Readonly<Record<ProcessingCapability, boolean>>;
  /** Lượt đọc mồi cho `useQuery` — một lần, không phải dòng sự kiện. */
  readonly readProgressOnce: (input: ReadProgressInput) => Promise<ApiResult<Progress>>;
  /**
   * Theo dõi tiến độ của MỘT lượt xử lý. Trả hàm huỷ đăng ký.
   *
   * Một lượt = một `uploadId` = một tầng. Nơi gọi mở N đăng ký độc lập cho N
   * tầng; đó chính là cơ chế bảo đảm một tầng lỗi không dừng các tầng khác.
   */
  readonly subscribeProgress: (
    input: SubscribeProgressInput,
    handlers: SubscribeProgressHandlers,
  ) => () => void;

  /** NOT FOUND — `cancelProcessing`. */
  readonly requestCancel: (input: RequestCancelInput) => Promise<ProcessingCapabilityResult<void>>;
  /** NOT FOUND — `runInBackground`. */
  readonly runInBackground: (
    input: RunInBackgroundInput,
  ) => Promise<ProcessingCapabilityResult<void>>;
  /** NOT FOUND — `queuePosition`. */
  readonly readQueuePosition: (
    input: ReadQueuePositionInput,
  ) => Promise<ProcessingCapabilityResult<number>>;
  /** NOT FOUND — `parallelFloorPipeline`. */
  readonly readParallelFloorPipeline: (
    input: ReadParallelFloorPipelineInput,
  ) => Promise<ProcessingCapabilityResult<readonly ProcessingRawFloorProgress[]>>;
  /** NOT FOUND — `extractionSummary`. Chặn luôn nửa sau của O-01, xem `trackAiStarted`. */
  readonly readExtractionSummary: (
    input: ReadExtractionSummaryInput,
  ) => Promise<ProcessingCapabilityResult<ProcessingExtractionSummary>>;
  /** NOT FOUND — `stepDetails`. */
  readonly readStepDetails: (
    input: ReadStepDetailsInput,
  ) => Promise<ProcessingCapabilityResult<readonly ProcessingRawStepProgress[]>>;
  /** NOT FOUND — `detectedGeometry`. */
  readonly readDetectedGeometry: (
    input: ReadDetectedGeometryInput,
  ) => Promise<ProcessingCapabilityResult<readonly string[]>>;
  /** NOT FOUND — `completionNotice`. Trả hàm huỷ đăng ký khi nào có kênh thật. */
  readonly subscribeCompletionNotice: (
    input: SubscribeCompletionNoticeInput,
    onNotice: () => void,
  ) => ProcessingCapabilityResult<() => void>;

  /** Một câu cho lỗi đến từ `src/api` (L-03). */
  readonly describeApiFailure: (error: unknown) => ProcessingFailure;
  /**
   * O-01, nửa ĐẦU. `ai.finished` KHÔNG có mặt ở đây: schema của nó bắt buộc
   * `wallCount`, `openingCount`, `dimensionCount`, `roomCount` và
   * `confidencePercent`, mà `extractionSummary` chưa tồn tại — bắn nó hôm nay
   * chỉ điền được số bịa.
   */
  readonly trackAiStarted: (input: TrackAiStartedInput) => void;
  /** Chép nhật ký. `false` khi trình duyệt từ chối — không phải lỗi màn hình. */
  readonly copyText: (text: string) => Promise<boolean>;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

/* -------------------------------------------------------------------------- */
/* Ánh xạ Progress → sáu bước. Xem GIẢ ĐỊNH C3 ở đầu file.                      */
/* -------------------------------------------------------------------------- */

/** Trạng thái `Progress.status` nói cả lượt đã kết thúc thành công. */
const COMPLETED_STATUS: Progress['status'] = 'completed';
/** Trạng thái `Progress.status` nói lượt đọc này báo hỏng. */
const FAILED_STATUS: Progress['status'] = 'failed';

const normalise = (text: string): string => text.trim().toLowerCase();

/** Chỉ số của bước mà `Progress.step` nói tới, hoặc `-1` khi không tra được. */
function matchStageIndex(step: string | undefined): number {
  if (step === undefined) {
    return -1;
  }

  const wanted = normalise(step);

  if (wanted.length === 0) {
    return -1;
  }

  return getPipelineStages().findIndex(
    (stage) => normalise(stage.id) === wanted || normalise(stage.label) === wanted,
  );
}

/**
 * Một bước ĐÃ quan sát thấy xong thì không bị hạ xuống lại, trừ khi lượt đọc
 * mới báo chính nó hỏng.
 *
 * Đây là mặt "từng bước" của chính lời hứa mà `highestProgressReached` giữ cho
 * con số tổng: khi SSE chết và lượt quay vòng đọc lại một nhịp cũ hơn, thanh
 * tiến độ của các bước đã xong không được rơi về rỗng. Chỉ chặn việc HẠ xuống —
 * bước nào đang chạy vẫn đi theo lượt đọc mới nhất, vì máy chủ mới là nơi biết
 * hiện giờ nó đang làm gì.
 */
function keepObservedDone(
  next: PipelineStageState['status'],
  previous: PipelineStageState | undefined,
): PipelineStageState['status'] {
  if (previous?.status === 'done' && next !== 'failed') {
    return 'done';
  }

  return next;
}

/** Giữ mốc giờ đã quan sát được của một bước; không có thì không bịa. */
function carryTimestamps(
  base: { id: PipelineStageId; status: PipelineStageState['status'] },
  previous: PipelineStageState | undefined,
  observedAtMs: number,
): PipelineStageState {
  const startedAtMs =
    previous?.startedAtMs ??
    (base.status === 'running' || base.status === 'done' ? observedAtMs : undefined);
  const finishedAtMs = base.status === 'done' ? (previous?.finishedAtMs ?? observedAtMs) : undefined;

  return {
    id: base.id,
    status: base.status,
    ...(startedAtMs !== undefined ? { startedAtMs } : {}),
    ...(finishedAtMs !== undefined ? { finishedAtMs } : {}),
  };
}

/**
 * `Progress` → sáu `PipelineStageState`, bằng TRA CỨU cộng giả định C3.
 *
 * Ba chốt chặn:
 *
 * - Lượt đọc báo hỏng (`status === 'failed'`): bước tra được đặt `failed`, các
 *   bước sau giữ `queued`, và **không bước nào được nâng lên `done`** — chỉ giữ
 *   nguyên thứ đã quan sát được từ trước.
 * - Cả lượt đã xong (`status === 'completed'`, hoặc `endedAt` có giá trị): cả
 *   sáu bước thành `done`. Thiếu chốt này thì `calculateTotalProgress` kẹp vĩnh
 *   viễn ở 99 (nó chỉ trả số đầy đủ khi mọi bước xong) và màn không bao giờ đến
 *   `success`.
 * - `step` không tra được: trả `supported: false` — không đoán bước nào đang
 *   chạy, và nơi gọi giữ nguyên mức tiến độ cao nhất đã đạt.
 * - Bước đã quan sát thấy `done` không bị hạ xuống lại ({@link keepObservedDone}) —
 *   mặt "từng bước" của lời hứa tiến độ không nhảy lùi.
 *
 * `internalPercent` cố ý KHÔNG đặt: `Progress` không mang phần trăm của riêng
 * một bước, và bịa ra một con số là đúng thứ [CẤM TUYỆT ĐỐI] gọi là tiến độ giả.
 * Tổng phần trăm do `calculateTotalProgress` tự tính theo trọng số có sẵn.
 */
export function toStageBreakdown(
  progress: Partial<Progress>,
  previous: readonly PipelineStageState[],
  observedAtMs: number,
): ProcessingCapabilityResult<readonly PipelineStageState[]> {
  const stages = getPipelineStages();
  const previousById = new Map(previous.map((stage) => [stage.id, stage]));
  const isFinished = progress.status === COMPLETED_STATUS || progress.endedAt !== undefined;

  if (isFinished) {
    return {
      supported: true,
      value: stages.map((stage) =>
        carryTimestamps({ id: stage.id, status: 'done' }, previousById.get(stage.id), observedAtMs),
      ),
    };
  }

  const matchedIndex = matchStageIndex(progress.step);

  if (matchedIndex < 0) {
    return unsupported('stageBreakdown');
  }

  const isFailing = progress.status === FAILED_STATUS;

  return {
    supported: true,
    value: stages.map((stage, index) => {
      const before = previousById.get(stage.id);

      if (index < matchedIndex) {
        // Giả định C3 — và chốt C1: một lượt đọc báo hỏng không nâng bước nào
        // lên "xong", nó chỉ giữ nguyên thứ đã quan sát được.
        const status = isFailing ? (before?.status ?? 'queued') : 'done';
        return carryTimestamps({ id: stage.id, status }, before, observedAtMs);
      }

      if (index === matchedIndex) {
        return carryTimestamps(
          {
            id: stage.id,
            status: keepObservedDone(isFailing ? 'failed' : 'running', before),
          },
          before,
          observedAtMs,
        );
      }

      return carryTimestamps(
        { id: stage.id, status: keepObservedDone('queued', before) },
        before,
        observedAtMs,
      );
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Địa chỉ nhận đo đạc O-01, ghép từ `API_BASE_PATH` của `@/api/endpoints`.
 *
 * Ghép chứ không viết thẳng: R-65 cấm chuỗi bắt đầu bằng dấu gạch chéo trong
 * thư mục màn, và đường dẫn gốc của API chỉ có một chủ sở hữu. Cả dấu phân cách
 * cũng lấy lại từ chính `API_BASE_PATH` thay vì khai một dấu gạch chéo thứ hai
 * ở đây — thư mục màn không viết đường dẫn, nó chỉ nối tiếp cái đã có.
 *
 * Bản thân đoạn `telemetry` là chỗ DUY NHẤT của file này không đến từ
 * `ENDPOINTS`: bảng đó không có mục đo đạc nào (đã soát toàn văn). Đây là tiền
 * lệ có sẵn của `useProjectDashboard.ts` — cùng địa chỉ, khác cách viết.
 */
const PATH_SEPARATOR = API_BASE_PATH.slice(0, 1);
const TELEMETRY_PATH = `${API_BASE_PATH}${PATH_SEPARATOR}telemetry`;

export interface CreateProcessingGatewayOptions {
  /** Bộ gửi đo đạc tiêm được — test cắm bản đếm, không đẩy gì lên mạng. */
  readonly telemetry?: TelemetrySender;
  /** `EventSource` tiêm được — jsdom không có bản thật. */
  readonly EventSourceImpl?: typeof EventSource;
  /** Nguồn "tab đang ẩn hay không" tiêm được; mặc định là `document`. */
  readonly visibilityTarget?: PollingVisibilityTarget;
  /** Bộ chép tiêm được — jsdom không có `navigator.clipboard`. */
  readonly writeClipboardText?: (text: string) => Promise<void>;
  /** Đồng hồ tiêm được. */
  readonly now?: () => number;
}

/** Một chuỗi đại diện cho nội dung một lượt đọc, để bỏ qua lượt không đổi gì. */
function contentKeyOf(progress: Progress): string {
  return [
    progress.id,
    progress.progressPercent,
    progress.status,
    progress.step,
    progress.startedAt ?? '',
    progress.endedAt ?? '',
    progress.error ?? '',
  ].join('|');
}

function toFailure(error: unknown): ProcessingFailure {
  const appError = toAppError(error);
  const described = describeError(appError);

  return {
    title: described.title,
    sentence: described.description,
    technicalCode: appError.code,
    kind: appError.kind,
    isRetryable: appError.retryable,
  };
}

export function createProcessingGateway(
  client: ApiClient,
  options: CreateProcessingGatewayOptions = {},
): ProcessingGateway {
  const now = options.now ?? ((): number => Date.now());

  return {
    // Đúng một việc làm được hôm nay, và nó chỉ làm được một nửa: xem giả định
    // C3 ở đầu file. Tám việc còn lại `false` cho tới khi có endpoint thật.
    supports: {
      cancelProcessing: false,
      queuePosition: false,
      parallelFloorPipeline: false,
      runInBackground: false,
      completionNotice: false,
      extractionSummary: false,
      stepDetails: false,
      detectedGeometry: false,
      stageBreakdown: true,
    },

    readProgressOnce: ({ projectId, signal, uploadId }) =>
      client.drawings.progress({
        projectId,
        uploadId,
        ...(signal !== undefined ? { signal } : {}),
      }),

    subscribeProgress: ({ floorId, projectId, uploadId }, handlers) => {
      // Số thứ tự do CHÍNH cổng phát, tăng nghiêm ngặt, dùng chung cho cả hai
      // kênh. `mergeEvents` bỏ mọi sự kiện có `sequence <= lastAppliedSequence`;
      // nếu lấy `progressPercent` làm số thứ tự (mặc định của `toSseEvent`) thì
      // nhịp cuối — phần trăm đã 100, trạng thái mới đổi sang "xong" — bị lọc
      // mất, và màn không bao giờ đến `success`.
      let sequence = 0;
      let lastContentKey = '';

      const toPatchEvent = (progress: Progress): ProgressPatchEvent<Progress> => {
        sequence += 1;
        return { eventId: `${uploadId}:${sequence}`, patch: progress, sequence };
      };

      const stream = createProgressStream({
        url: ENDPOINTS.drawings.progress(projectId, uploadId),
        fetchEvents: async ({ signal }) => {
          const result = await client.drawings.progress({ projectId, uploadId, signal });

          if (!result.ok) {
            handlers.onFailure?.(toFailure(result.error));
            return [];
          }

          const contentKey = contentKeyOf(result.data);

          if (contentKey === lastContentKey) {
            return [];
          }

          lastContentKey = contentKey;
          return [toPatchEvent(result.data)];
        },
        onEvent: (event) => {
          handlers.onSnapshot({
            eventId: event.eventId,
            floorId,
            uploadId,
            observedAtMs: now(),
            progress: event.data,
            source: event.source,
          });
        },
        ...(handlers.onConnectionChange !== undefined
          ? { onStateChange: handlers.onConnectionChange }
          : {}),
        toSseEvent: (event: ChannelEvent) => {
          lastContentKey = contentKeyOf(event.data);
          return toPatchEvent(event.data);
        },
        ...(options.EventSourceImpl !== undefined
          ? { EventSourceImpl: options.EventSourceImpl }
          : {}),
        ...(options.visibilityTarget !== undefined
          ? { visibilityTarget: options.visibilityTarget }
          : {}),
      });

      return () => stream.close();
    },

    requestCancel: () => Promise.resolve(unsupported('cancelProcessing')),
    runInBackground: () => Promise.resolve(unsupported('runInBackground')),
    readQueuePosition: () => Promise.resolve(unsupported('queuePosition')),
    readParallelFloorPipeline: () => Promise.resolve(unsupported('parallelFloorPipeline')),
    readExtractionSummary: () => Promise.resolve(unsupported('extractionSummary')),
    readStepDetails: () => Promise.resolve(unsupported('stepDetails')),
    readDetectedGeometry: () => Promise.resolve(unsupported('detectedGeometry')),
    subscribeCompletionNotice: () => unsupported('completionNotice'),

    describeApiFailure: (error) => toFailure(error),

    trackAiStarted: ({ levelCount, pageCount }) => {
      options.telemetry?.track({ name: 'ai.started', levelCount, pageCount });
    },

    copyText: async (text) => {
      const clipboard = globalThis.navigator?.clipboard;
      const write = options.writeClipboardText ?? clipboard?.writeText.bind(clipboard);

      if (typeof write !== 'function') {
        return false;
      }

      try {
        await write(text);
        return true;
      } catch {
        // Một khay nhớ tạm bị trình duyệt từ chối không đáng một màn lỗi.
        return false;
      }
    },

    now,
  };
}

/** Cổng dựng trên client thật của ứng dụng — thứ container gọi. */
export function createAppProcessingGateway(): ProcessingGateway {
  return createProcessingGateway(createAppApiClient(), {
    telemetry: createTelemetrySender({
      transport: createBeaconTransport({ url: TELEMETRY_PATH }),
      sessionId: createUuid(),
    }),
  });
}

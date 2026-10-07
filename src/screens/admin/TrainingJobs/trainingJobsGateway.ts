/**
 * Cổng thuần của màn huấn luyện: quyền, các lượt gọi N28–N37, khoá idempotency, toast, và
 * lỗi dây → câu người đọc (F-12 khối [2]).
 *
 * Lượt gọi bọc `AdminMlJobsClient` và NÉM lỗi ra (cách `useQuery`/`useMutation` thấy thất
 * bại); lỗi đi nguyên hình `HttpError` để đọc `code` bằng `readWireError`. Mã không bao giờ
 * được in ra.
 *
 * ## Khoá N33
 *
 * Một thân một khoá. {@link nextCreateAttempt} giữ khoá khi thân KHÔNG đổi, sinh khoá mới khi
 * thân đổi; hook giữ lượt chờ gửi lại (sống qua đóng/mở biểu mẫu) và xoá nó sau 202 hoặc 4xx
 * (BE lưu phản hồi 4xx theo khoá), giữ nó sau mạng/timeout/5xx — gửi lại cùng thân thì cùng
 * khoá, BE trả lại đúng 202 cũ.
 */

import type {
  AdminMlJobsClient,
  CancelTrainingJobInput,
  CreateTrainingJob,
  CreateTrainingJobInput,
  CursorList,
  Dataset,
  DatasetVersion,
  ListDatasetVersionsInput,
  ListDatasetsInput,
  ListJobStreamInput,
  ListTrainingJobsInput,
  TrainingJob,
  TrainingLogLine,
  TrainingMetricPoint,
} from '@/api/adminMlJobsClient';
import type { ApiResult } from '@/api/client';
import { readWireError } from '@/lib/errors/wireError';
import { createUuid } from '@/lib/http/ids';
import type { NotificationBus, NotificationInput } from '@/lib/mutations/notificationBus';

/** Chỉ quản trị viên hệ thống; không lùi về vai dự án. */
export function canManageTraining(roles: readonly string[]): boolean {
  return roles.includes('admin');
}

export interface TrainingJobsGateway {
  listDatasets(input: ListDatasetsInput): Promise<CursorList<Dataset>>;
  listDatasetVersions(input: ListDatasetVersionsInput): Promise<CursorList<DatasetVersion>>;
  listJobs(input: ListTrainingJobsInput): Promise<CursorList<TrainingJob>>;
  createJob(input: CreateTrainingJobInput): Promise<TrainingJob>;
  getJob(jobId: string, signal?: AbortSignal): Promise<TrainingJob>;
  cancelJob(input: CancelTrainingJobInput): Promise<TrainingJob>;
  listJobMetrics(input: ListJobStreamInput): Promise<CursorList<TrainingMetricPoint>>;
  listJobLogs(input: ListJobStreamInput): Promise<CursorList<TrainingLogLine>>;
  /** Khoá idempotency mới (R3). */
  createKey(): string;
  notify(input: NotificationInput): void;
  now(): number;
}

export interface CreateTrainingJobsGatewayOptions {
  readonly client: AdminMlJobsClient;
  readonly notifications: NotificationBus;
  readonly now?: () => number;
  readonly createKey?: () => string;
}

async function unwrap<T>(pending: Promise<ApiResult<T>>): Promise<T> {
  const result = await pending;

  if (!result.ok) throw result.error;

  return result.data;
}

export function createTrainingJobsGateway({
  client,
  createKey = createUuid,
  notifications,
  now = Date.now,
}: CreateTrainingJobsGatewayOptions): TrainingJobsGateway {
  return {
    cancelJob: (input) => unwrap(client.cancelJob(input)),
    createJob: (input) => unwrap(client.createJob(input)),
    createKey,
    getJob: (jobId, signal) => unwrap(client.getJob(jobId, signal)),
    listDatasetVersions: (input) => unwrap(client.listDatasetVersions(input)),
    listDatasets: (input) => unwrap(client.listDatasets(input)),
    listJobLogs: (input) => unwrap(client.listJobLogs(input)),
    listJobMetrics: (input) => unwrap(client.listJobMetrics(input)),
    listJobs: (input) => unwrap(client.listJobs(input)),
    notify: (input) => {
      notifications.publish(input);
    },
    now,
  };
}

/* -------------------------------------------------------------------------- */
/* Khoá N33.                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateAttempt {
  readonly signature: string;
  readonly key: string;
}

const signatureOf = (body: CreateTrainingJob): string =>
  JSON.stringify([body.family, body.datasetVersionId, body.baseModel, body.epochs]);

/** Cùng thân với lượt đang chờ gửi lại → cùng khoá; thân khác (hoặc chưa có) → khoá mới. */
export function nextCreateAttempt(
  pending: CreateAttempt | null,
  body: CreateTrainingJob,
  createKey: () => string,
): CreateAttempt {
  const signature = signatureOf(body);

  return pending?.signature === signature ? pending : { key: createKey(), signature };
}

/* -------------------------------------------------------------------------- */
/* Lỗi dây → câu.                                                              */
/* -------------------------------------------------------------------------- */

export const TRAINING_ERROR_TEXT = {
  versionNotReady: 'Phiên bản này chưa sẵn sàng.',
  versionFamilyMismatch: 'Phiên bản này không cùng họ model.',
  versionNotFound: 'Không tìm thấy phiên bản này.',
  baseModelMismatch: 'Model nền không thuộc họ đã chọn.',
  epochsInvalid: 'Số vòng phải từ 1 đến 300.',
  formInvalid: 'Biểu mẫu chưa hợp lệ.',
  notCancellable: 'Lượt này vừa kết thúc nên không huỷ được nữa.',
  jobNotFound: 'Không tìm thấy lượt huấn luyện này.',
  datasetNotFound: 'Không tìm thấy bộ dữ liệu này.',
  busy: 'Máy chủ đang bận. Thử lại sau ít phút.',
  readFallback: 'Không đọc được dữ liệu huấn luyện.',
  writeFallback: 'Chưa gửi được yêu cầu. Thử lại sau.',
} as const;

const BUSY_STATUSES = new Set([429, 503]);
const LOST_KINDS = new Set(['network', 'timeout']);
const STOP_STATUSES = new Set([401, 403, 404]);

const kindOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'kind' in error ? String(error.kind) : '';

const statusOf = (error: unknown): number | undefined => readWireError(error)?.status;

export const isForbiddenError = (error: unknown): boolean => statusOf(error) === 403;

export const isCursorInvalidError = (error: unknown): boolean => readWireError(error)?.code === 'CURSOR_INVALID';

export const isNotCancellableError = (error: unknown): boolean =>
  statusOf(error) === 409 && readWireError(error)?.code === 'TRAINING_JOB_NOT_CANCELLABLE';

/** Luồng N36/N37 dừng hỏi ở 401, 403, 404; lỗi khác thử lại ở nhịp sau. */
export const shouldStopStream = (error: unknown): boolean => STOP_STATUSES.has(statusOf(error) ?? 0);

/** Mất phản hồi N33: không biết máy chủ đã nhận hay chưa — giữ khoá, gửi lại cùng khoá. */
export function isResponseLost(error: unknown): boolean {
  const status = statusOf(error);

  return LOST_KINDS.has(kindOf(error)) || (status !== undefined && status >= 500);
}

function busyText(error: unknown): string | null {
  const status = statusOf(error);

  return (status !== undefined && BUSY_STATUSES.has(status)) || LOST_KINDS.has(kindOf(error))
    ? TRAINING_ERROR_TEXT.busy
    : null;
}

export function describeReadError(error: unknown): string {
  const wire = readWireError(error);
  const notFound =
    wire?.status === 404
      ? wire.resource === 'trainingJob'
        ? TRAINING_ERROR_TEXT.jobNotFound
        : wire.resource === 'dataset'
          ? TRAINING_ERROR_TEXT.datasetNotFound
          : null
      : null;

  return busyText(error) ?? notFound ?? TRAINING_ERROR_TEXT.readFallback;
}

export function describeWriteError(error: unknown): string {
  const wire = readWireError(error);

  if (wire?.status === 404 && wire.resource === 'trainingJob') return TRAINING_ERROR_TEXT.jobNotFound;

  return busyText(error) ?? TRAINING_ERROR_TEXT.writeFallback;
}

export interface CreateFieldErrors {
  readonly version: string | null;
  readonly baseModel: string | null;
  readonly epochs: string | null;
  readonly form: string | null;
}

const VERSION_BY_CODE: Readonly<Record<string, string>> = {
  DATASET_VERSION_NOT_READY: TRAINING_ERROR_TEXT.versionNotReady,
  DATASET_FAMILY_MISMATCH: TRAINING_ERROR_TEXT.versionFamilyMismatch,
};

/** Lỗi N33 → đúng ô của biểu mẫu (403 do hook xử lý trước). */
export function describeCreateError(error: unknown): CreateFieldErrors {
  const wire = readWireError(error);
  const none: CreateFieldErrors = { baseModel: null, epochs: null, form: null, version: null };
  const code = wire?.code ?? '';

  if (wire?.status === 422 && code in VERSION_BY_CODE) return { ...none, version: VERSION_BY_CODE[code] ?? null };
  if (wire?.status === 404 && wire.resource === 'datasetVersion') {
    return { ...none, version: TRAINING_ERROR_TEXT.versionNotFound };
  }
  if (wire?.status === 422 && code === 'TRAINING_BASE_MODEL_MISMATCH') {
    return { ...none, baseModel: TRAINING_ERROR_TEXT.baseModelMismatch };
  }
  if (wire?.status === 422 && code === 'VALIDATION') {
    return wire.field === 'epochs'
      ? { ...none, epochs: TRAINING_ERROR_TEXT.epochsInvalid }
      : { ...none, form: TRAINING_ERROR_TEXT.formInvalid };
  }

  return { ...none, form: describeWriteError(error) };
}

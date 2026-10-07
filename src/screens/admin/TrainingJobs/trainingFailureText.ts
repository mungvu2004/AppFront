/**
 * `failureCode` của lượt huấn luyện và của phiên bản bộ dữ liệu → câu người đọc (F-12 khối [2]).
 *
 * Thuần. Mã không bao giờ được in ra: mã lạ rơi về câu dự phòng.
 */

const JOB_TEXT = {
  busy: 'Máy huấn luyện bận hoặc mất liên lạc. Tạo lại lượt sau.',
  timeout: 'Chạy quá thời gian cho phép. Thử ít vòng hơn.',
  lossNotFinite: 'Mất mát không hội tụ. Thử model nền khác hoặc ít vòng hơn.',
  datasetBroken: 'Bộ dữ liệu thiếu mẫu hoặc có mẫu hỏng. Chọn phiên bản khác.',
  trainerMissing: 'Máy huấn luyện chưa cài bộ huấn luyện.',
  diskFull: 'Máy huấn luyện hết dung lượng đĩa.',
  mismatch: 'Máy huấn luyện lỗi cấu hình hoặc dữ liệu không khớp.',
  unknown: 'Lượt không thành công vì một lỗi chưa có mô tả.',
} as const;

const DATASET_TEXT = {
  empty: 'Không có mẫu nào đạt.',
  tooLarge: 'Vượt giới hạn số mẫu hoặc dung lượng.',
  familyUnsupported: 'Họ này chưa dựng được bộ dữ liệu.',
  interrupted: 'Dựng bị gián đoạn. Dựng lại bằng công cụ dòng lệnh.',
  unknown: 'Dựng không thành công vì một lỗi chưa có mô tả.',
} as const;

export const TRAINING_FAILURE_TEXT = { dataset: DATASET_TEXT, job: JOB_TEXT } as const;

const group = (text: string, codes: readonly string[]): ReadonlyArray<readonly [string, string]> =>
  codes.map((code) => [code, text] as const);

const JOB_BY_CODE: ReadonlyMap<string, string> = new Map([
  ...group(JOB_TEXT.busy, [
    'TRAINING_HEARTBEAT_LOST',
    'TRAINING_DISPATCH_STALLED',
    'TRAINING_LAUNCH_FAILED',
    'TRAINING_SLOT_BUSY',
    'TRAINING_GPU_BUSY',
    'TRAINING_SLOT_LOST',
    'GPU_LOCK_LOST',
    'RETRY_EXHAUSTED',
    'TASK_TIMEOUT',
    'WORKER_LOST',
  ]),
  ...group(JOB_TEXT.timeout, ['TRAINING_TIMEOUT']),
  ...group(JOB_TEXT.lossNotFinite, ['TRAINING_LOSS_NOT_FINITE']),
  ...group(JOB_TEXT.datasetBroken, ['DATASET_SPLIT_EMPTY', 'DATASET_SAMPLE_INVALID']),
  ...group(JOB_TEXT.trainerMissing, ['TRAINING_TRAINER_MISSING']),
  ...group(JOB_TEXT.diskFull, ['TRAINING_DISK_FULL']),
  ...group(JOB_TEXT.mismatch, [
    'DATASET_MANIFEST_MISMATCH',
    'DATASET_OBJECT_MISMATCH',
    'MODEL_EXPORT_MISMATCH',
    'TRAINING_BASE_MODEL_MISMATCH',
    'MODEL_CHECKSUM_MISMATCH',
    'TRAINING_METRICS_MISSING',
    'MODEL_FORMAT_UNSUPPORTED',
    'ML_DEVICE_UNAVAILABLE',
    'INTERNAL',
  ]),
]);

const DATASET_BY_CODE: ReadonlyMap<string, string> = new Map([
  ...group(DATASET_TEXT.empty, ['DATASET_EMPTY']),
  ...group(DATASET_TEXT.tooLarge, ['DATASET_TOO_LARGE']),
  ...group(DATASET_TEXT.familyUnsupported, ['DATASET_FAMILY_UNSUPPORTED']),
  ...group(DATASET_TEXT.interrupted, [
    'DATASET_BUILD_TIMEOUT',
    'SOURCE_READ_FAILED',
    'DEPENDENCY_UNAVAILABLE',
    'RETRY_EXHAUSTED',
    'TASK_TIMEOUT',
    'WORKER_LOST',
  ]),
]);

export function jobFailureText(code: string): string {
  return JOB_BY_CODE.get(code) ?? JOB_TEXT.unknown;
}

export function datasetVersionFailureText(code: string): string {
  return DATASET_BY_CODE.get(code) ?? DATASET_TEXT.unknown;
}

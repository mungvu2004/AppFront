/**
 * Bộ dữ liệu và lượt huấn luyện giả cho `VITE_USE_MOCK_API` — F-12.
 *
 * Hạt giống: hai bộ dữ liệu (tường, cửa và đồ đạc) với phiên bản `ready`, `building`,
 * `failed`; bốn lượt `running`, `succeeded`, `failed` (`TRAINING_TRAINER_MISSING` — đúng
 * điều BE trả trước khi B6-04a/b hợp nhất) và `cancelled`. Lượt `running` có số đo và
 * nhật ký nhiều trang theo `since`, cắt trang theo `limit`; `nextCursor` của nó không bao
 * giờ vắng. Lượt đã kết thúc đọc hết thì vắng `nextCursor` (coi như đã quá cửa sổ 600 s).
 *
 * Chỉ chạy dưới `import.meta.env.DEV`; bản dựng sản phẩm bỏ file này như mock F-11.
 */

import type {
  CreateTrainingJob,
  Dataset,
  DatasetVersion,
  TrainingJob,
  TrainingLogLine,
  TrainingMetricPoint,
} from '@/api/schemas/adminMl';
import type { HttpError, Result } from '@/lib/http';

import type { AdminMlJobsClient, CursorList } from '../adminMlJobsClient';

const ADMIN_USER_ID = 'usr_01JA6M0RG00000000000000A01';

export const MOCK_TRAINING_IDS = {
  datasets: {
    wall: 'dst_01JA6M0RG00000000000000T01',
    opening: 'dst_01JA6M0RG00000000000000T02',
  },
  datasetVersions: {
    wallReady: 'dsv_01JA6M0RG00000000000000S03',
    wallFailed: 'dsv_01JA6M0RG00000000000000S04',
    openingBuilding: 'dsv_01JA6M0RG00000000000000S02',
    openingReady: 'dsv_01JA6M0RG00000000000000S01',
  },
  jobs: {
    running: 'job_01JA6M0RG00000000000000J05',
    succeeded: 'job_01JA6M0RG00000000000000J03',
    failed: 'job_01JA6M0RG00000000000000J06',
    cancelled: 'job_01JA6M0RG00000000000000J07',
  },
  /** `resultModelVersionId` của lượt `succeeded` — chính bản `doorTrained` của mock F-11. */
  resultModelVersion: 'mdl_01JA6M0RG00000000000000D02',
} as const;

const IDS = MOCK_TRAINING_IDS;

export const MOCK_DATASETS: readonly Dataset[] = [
  { createdAt: '2026-08-20T02:00:00.000Z', family: 'wallSegmentation', id: IDS.datasets.wall, name: 'Mặt bằng đã duyệt' },
  {
    createdAt: '2026-08-10T02:00:00.000Z',
    family: 'openingAndFurnitureDetection',
    id: IDS.datasets.opening,
    name: 'CubiCasa5k cửa và đồ đạc',
  },
];

/** `sequence` giảm dần trong mỗi bộ, như N30. */
export const MOCK_DATASET_VERSIONS: readonly DatasetVersion[] = [
  {
    createdAt: '2026-09-02T03:00:00.000Z',
    datasetId: IDS.datasets.wall,
    id: IDS.datasetVersions.wallReady,
    manifestSha256: '1'.repeat(64),
    sequence: 2,
    source: 'approvedFloors',
    splitCounts: { test: 40, train: 320, validation: 40 },
    status: 'ready',
  },
  {
    createdAt: '2026-08-21T03:00:00.000Z',
    datasetId: IDS.datasets.wall,
    failureCode: 'DATASET_EMPTY',
    id: IDS.datasetVersions.wallFailed,
    sequence: 1,
    source: 'approvedFloors',
    status: 'failed',
  },
  {
    createdAt: '2026-10-01T03:00:00.000Z',
    datasetId: IDS.datasets.opening,
    id: IDS.datasetVersions.openingBuilding,
    sequence: 2,
    source: 'cubicasa5k',
    status: 'building',
  },
  {
    createdAt: '2026-08-11T03:00:00.000Z',
    datasetId: IDS.datasets.opening,
    id: IDS.datasetVersions.openingReady,
    manifestSha256: '2'.repeat(64),
    sequence: 1,
    source: 'cubicasa5k',
    splitCounts: { test: 500, train: 4000, validation: 500 },
    status: 'ready',
  },
];

/** Mới nhất trước, như N32. */
export const MOCK_TRAINING_JOBS: readonly TrainingJob[] = [
  {
    baseModel: 'mitB0',
    createdAt: '2026-10-05T01:00:00.000Z',
    creatorId: ADMIN_USER_ID,
    currentEpoch: 12,
    datasetVersionId: IDS.datasetVersions.wallReady,
    epochs: 50,
    family: 'wallSegmentation',
    id: IDS.jobs.running,
    startedAt: '2026-10-05T01:00:05.000Z',
    status: 'running',
  },
  {
    baseModel: 'mitB1',
    createdAt: '2026-10-03T08:00:00.000Z',
    creatorId: ADMIN_USER_ID,
    currentEpoch: 0,
    datasetVersionId: IDS.datasetVersions.wallReady,
    endedAt: '2026-10-03T08:00:09.000Z',
    epochs: 30,
    failureCode: 'TRAINING_TRAINER_MISSING',
    family: 'wallSegmentation',
    id: IDS.jobs.failed,
    startedAt: '2026-10-03T08:00:04.000Z',
    status: 'failed',
  },
  {
    baseModel: 'yolov8s',
    createdAt: '2026-09-28T06:00:00.000Z',
    creatorId: ADMIN_USER_ID,
    currentEpoch: 4,
    datasetVersionId: IDS.datasetVersions.openingReady,
    endedAt: '2026-09-28T06:40:00.000Z',
    epochs: 20,
    family: 'openingAndFurnitureDetection',
    id: IDS.jobs.cancelled,
    startedAt: '2026-09-28T06:00:03.000Z',
    status: 'cancelled',
  },
  {
    baseModel: 'yolov8n',
    createdAt: '2026-09-19T22:00:00.000Z',
    creatorId: ADMIN_USER_ID,
    currentEpoch: 6,
    datasetVersionId: IDS.datasetVersions.openingReady,
    endedAt: '2026-09-20T03:30:00.000Z',
    epochs: 6,
    family: 'openingAndFurnitureDetection',
    id: IDS.jobs.succeeded,
    resultModelVersionId: IDS.resultModelVersion,
    startedAt: '2026-09-19T22:00:04.000Z',
    status: 'succeeded',
  },
];

const at = (base: string, offsetSeconds: number): string =>
  new Date(Date.parse(base) + offsetSeconds * 1000).toISOString();

/** Hai điểm mỗi vòng: loss của tập huấn luyện, số đo của tập kiểm định. */
function seedMetrics(job: TrainingJob, metricKey: 'iou' | 'map50'): TrainingMetricPoint[] {
  const points: TrainingMetricPoint[] = [];
  const epochs = job.currentEpoch ?? 0;

  for (let epoch = 1; epoch <= epochs; epoch += 1) {
    const recordedAt = at(job.startedAt ?? job.createdAt, epoch * 60);
    const score = Math.round((0.5 + epoch / (epochs * 3)) * 1000) / 1000;

    points.push({ epoch, loss: Math.round(10_000 / (epoch + 1)) / 10_000, recordedAt, split: 'train', step: epoch * 100 });
    points.push({
      epoch,
      ...(metricKey === 'iou' ? { iou: score } : { map50: score }),
      recordedAt,
      split: 'validation',
      step: epoch * 100,
    });
  }

  return points;
}

function seedLogs(job: TrainingJob, count: number, last?: Pick<TrainingLogLine, 'level' | 'message'>): TrainingLogLine[] {
  const lines: TrainingLogLine[] = Array.from({ length: count }, (_, seq) => ({
    at: at(job.startedAt ?? job.createdAt, seq * 30),
    level: 'info' as const,
    message: `Vòng ${Math.floor(seq / 2) + 1}: đã xử lý lô ${seq + 1}.`,
    seq,
  }));

  if (last !== undefined) {
    lines.push({ at: at(job.startedAt ?? job.createdAt, count * 30), ...last, seq: count });
  }

  return lines;
}

const ENDED: readonly string[] = ['succeeded', 'failed', 'cancelled'];

const ok = <T>(data: T): Result<T, never> => ({ data, ok: true });

/** Lỗi dây cùng hình `HttpError` thật, như mock F-11. */
const wireError = (status: number, code: string, resource?: string): Result<never, HttpError> => ({
  error: {
    code,
    kind: 'http',
    raw: { code, ...(resource !== undefined ? { resource } : {}) },
    requestId: 'mock-admin-ml-jobs',
    retryable: false,
    status,
  },
  ok: false,
});

const CURSOR_PREFIX = 'cur_';

/**
 * Một trang N36/N37 từ vị trí `since`. Lượt chưa kết thúc luôn trả `nextCursor` (kể cả
 * trang rỗng); lượt đã kết thúc vắng nó khi đã đọc tới cuối.
 */
function streamPage<T>(
  all: readonly T[],
  job: TrainingJob,
  since: string | undefined,
  limit: number,
): Result<CursorList<T>, HttpError> {
  const start = since === undefined ? 0 : Number(since.slice(CURSOR_PREFIX.length));

  if (since !== undefined && (!since.startsWith(CURSOR_PREFIX) || !Number.isInteger(start) || start < 0)) {
    return wireError(422, 'CURSOR_INVALID');
  }

  const items = all.slice(start, start + limit);
  const end = start + items.length;
  const finished = ENDED.includes(job.status) && end >= all.length;

  return ok({ items, ...(finished ? {} : { nextCursor: `${CURSOR_PREFIX}${end}` }) });
}

let createdJobCount = 0;

/** Mỗi client giả giữ bản sao riêng, nên hai story không giẫm lên nhau. */
export function createMockAdminMlJobsClient(): AdminMlJobsClient {
  let jobs = MOCK_TRAINING_JOBS.map((job) => ({ ...job }));
  const byKey = new Map<string, TrainingJob>();
  const runningJob = MOCK_TRAINING_JOBS[0] as TrainingJob;
  const succeededJob = MOCK_TRAINING_JOBS[3] as TrainingJob;
  const metrics = new Map<string, readonly TrainingMetricPoint[]>([
    [IDS.jobs.running, seedMetrics(runningJob, 'iou')],
    [IDS.jobs.succeeded, seedMetrics(succeededJob, 'map50')],
  ]);
  const logs = new Map<string, readonly TrainingLogLine[]>([
    [IDS.jobs.running, seedLogs(runningJob, 30)],
    [IDS.jobs.succeeded, seedLogs(succeededJob, 12)],
    [
      IDS.jobs.failed,
      seedLogs(MOCK_TRAINING_JOBS[1] as TrainingJob, 1, { level: 'error', message: 'Máy huấn luyện chưa cài bộ huấn luyện.' }),
    ],
    [
      IDS.jobs.cancelled,
      seedLogs(MOCK_TRAINING_JOBS[2] as TrainingJob, 8, { level: 'warning', message: 'Lượt đã bị huỷ theo yêu cầu.' }),
    ],
  ]);

  const findJob = (jobId: string): TrainingJob | undefined => jobs.find((job) => job.id === jobId);

  function validateCreate(body: CreateTrainingJob): Result<never, HttpError> | null {
    const version = MOCK_DATASET_VERSIONS.find((candidate) => candidate.id === body.datasetVersionId);

    if (version === undefined) return wireError(404, 'NOT_FOUND', 'datasetVersion');

    const dataset = MOCK_DATASETS.find((candidate) => candidate.id === version.datasetId);

    if (dataset?.family !== body.family) return wireError(422, 'DATASET_FAMILY_MISMATCH');
    if (version.status !== 'ready') return wireError(422, 'DATASET_VERSION_NOT_READY');

    return null;
  }

  return {
    listDatasets: async ({ family }) =>
      ok({ items: MOCK_DATASETS.filter((dataset) => family === undefined || dataset.family === family) }),

    listDatasetVersions: async ({ datasetId }) =>
      MOCK_DATASETS.some((dataset) => dataset.id === datasetId)
        ? ok({ items: MOCK_DATASET_VERSIONS.filter((version) => version.datasetId === datasetId) })
        : wireError(404, 'NOT_FOUND', 'dataset'),

    listJobs: async ({ family, status }) =>
      ok({
        items: jobs
          .filter((job) => (family === undefined || job.family === family) && (status === undefined || job.status === status))
          .map((job) => ({ ...job })),
      }),

    createJob: async ({ body, idempotencyKey }) => {
      const replay = byKey.get(idempotencyKey);

      if (replay !== undefined) return ok({ ...replay });

      const invalid = validateCreate(body);

      if (invalid !== null) return invalid;

      createdJobCount += 1;
      const job: TrainingJob = {
        baseModel: body.baseModel,
        createdAt: new Date().toISOString(),
        creatorId: ADMIN_USER_ID,
        datasetVersionId: body.datasetVersionId,
        epochs: body.epochs,
        family: body.family,
        id: `job_01JA6M0RG0000000N${String(createdJobCount).padStart(9, '0')}`,
        status: 'queued',
      };

      jobs = [job, ...jobs];
      byKey.set(idempotencyKey, job);

      return ok({ ...job });
    },

    getJob: async (jobId) => {
      const job = findJob(jobId);

      return job === undefined ? wireError(404, 'NOT_FOUND', 'trainingJob') : ok({ ...job });
    },

    cancelJob: async ({ jobId }) => {
      const job = findJob(jobId);

      if (job === undefined) return wireError(404, 'NOT_FOUND', 'trainingJob');
      if (job.status !== 'queued' && job.status !== 'running') return wireError(409, 'TRAINING_JOB_NOT_CANCELLABLE');

      const next: TrainingJob = { ...job, status: 'cancelling' };

      jobs = jobs.map((candidate) => (candidate.id === jobId ? next : candidate));

      return ok({ ...next });
    },

    listJobMetrics: async ({ jobId, limit, since }) => {
      const job = findJob(jobId);

      return job === undefined
        ? wireError(404, 'NOT_FOUND', 'trainingJob')
        : streamPage(metrics.get(jobId) ?? [], job, since, limit);
    },

    listJobLogs: async ({ jobId, limit, since }) => {
      const job = findJob(jobId);

      return job === undefined
        ? wireError(404, 'NOT_FOUND', 'trainingJob')
        : streamPage(logs.get(jobId) ?? [], job, since, limit);
    },
  };
}

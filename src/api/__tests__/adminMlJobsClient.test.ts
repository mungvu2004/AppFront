/**
 * Client bộ dữ liệu và lượt huấn luyện (N28, N30, N32–N37) — F-12.
 *
 * Thân phản hồi giả là **dữ liệu dây** viết literal; `.parse` của schema F-00b chỉ để
 * khẳng định thân giả ấy hợp lệ (R12), không dùng để dựng nó.
 */

import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, HttpRequestOptions, Result } from '@/lib/http';

import {
  createAdminMlJobsClient,
  createAppAdminMlJobsClient,
  TRAINABLE_MODEL_FAMILIES,
  type AdminMlJobsClient,
} from '../adminMlJobsClient';
import type { ApiResult } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  CreateTrainingJobSchema,
  DatasetPageSchema,
  DatasetSchema,
  DatasetVersionPageSchema,
  DatasetVersionSchema,
  TrainingJobPageSchema,
  TrainingJobSchema,
  TrainingLogLineSchema,
  TrainingLogPageSchema,
  TrainingMetricPageSchema,
  TrainingMetricPointSchema,
} from '../schemas/adminMl';
import {
  MOCK_DATASETS,
  MOCK_DATASET_VERSIONS,
  MOCK_TRAINING_IDS,
  MOCK_TRAINING_JOBS,
} from '../__mocks__/adminMlJobsClient';

const DATASET_ID = 'dst_01JA6M0RG00000000000000T09';
const DATASET_VERSION_ID = 'dsv_01JA6M0RG00000000000000S09';
const JOB_ID = 'job_01JA6M0RG00000000000000J09';
const IDEMPOTENCY_KEY = '6f1d2c3b-4a59-4e68-9a7b-8c9d0e1f2a3b';

const WIRE_DATASET = {
  createdAt: '2026-08-20T02:00:00.000Z',
  family: 'wallSegmentation',
  id: DATASET_ID,
  name: 'Mặt bằng đã duyệt',
};

const WIRE_DATASET_VERSION = {
  createdAt: '2026-09-02T03:00:00.000Z',
  datasetId: DATASET_ID,
  id: DATASET_VERSION_ID,
  manifestSha256: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  sequence: 3,
  source: 'approvedFloors',
  splitCounts: { test: 10, train: 80, validation: 10 },
  status: 'ready',
};

const WIRE_QUEUED_JOB = {
  baseModel: 'mitB0',
  createdAt: '2026-10-05T01:00:00.000Z',
  creatorId: 'usr_01JA6M0RG00000000000000A01',
  datasetVersionId: DATASET_VERSION_ID,
  epochs: 50,
  family: 'wallSegmentation',
  id: JOB_ID,
  status: 'queued',
};

const WIRE_CANCELLING_JOB = {
  ...WIRE_QUEUED_JOB,
  currentEpoch: 3,
  startedAt: '2026-10-05T01:00:04.000Z',
  status: 'cancelling',
};

const WIRE_METRIC_PAGE = {
  items: [
    { epoch: 1, loss: 0.4321, recordedAt: '2026-10-05T01:01:00.000Z', split: 'train', step: 100 },
    { epoch: 1, iou: 0.612, recordedAt: '2026-10-05T01:01:00.000Z', split: 'validation', step: 100 },
  ],
  nextCursor: 'm-cursor-2',
};

const WIRE_LOG_PAGE = {
  items: [
    { at: '2026-10-05T01:00:05.000Z', level: 'info', message: 'Bắt đầu vòng 1.', seq: 0 },
    { at: '2026-10-05T01:00:06.000Z', level: 'warning', message: 'Lô 3 có mẫu rỗng.', seq: 1 },
  ],
  nextCursor: 'l-cursor-2',
};

const CREATE_BODY = {
  baseModel: 'mitB0',
  datasetVersionId: DATASET_VERSION_ID,
  epochs: 50,
  family: 'wallSegmentation',
} as const;

interface HttpCall {
  readonly method: string;
  readonly path: string;
  readonly options: HttpRequestOptions<unknown> | undefined;
}

const httpError: HttpError = {
  code: 'TRAINING_JOB_NOT_CANCELLABLE',
  kind: 'http',
  raw: { code: 'TRAINING_JOB_NOT_CANCELLABLE' },
  requestId: 'req-admin-ml-jobs-1',
  retryable: false,
  status: 409,
};

/** `HttpClient` giả ghi lại từng lượt gọi; `reply` quyết định thân trả về. */
function createHttpMock(reply: (call: HttpCall) => Result<unknown, HttpError>): {
  calls: HttpCall[];
  http: HttpClient;
} {
  const calls: HttpCall[] = [];
  const send =
    (method: string) =>
    async <T>(path: string, options?: HttpRequestOptions<unknown>): Promise<Result<T, HttpError>> => {
      const call = { method, options, path };
      calls.push(call);

      return reply(call) as Result<T, HttpError>;
    };

  const http: HttpClient = {
    delete: send('DELETE'),
    events: { emit: () => undefined, on: () => () => undefined },
    get: send('GET'),
    getRecentRequests: () => [],
    patch: send('PATCH'),
    post: send('POST'),
    put: send('PUT'),
  };

  return { calls, http };
}

const codeOf = (result: ApiResult<unknown>): string | undefined => (result.ok ? undefined : result.error.code);

describe('thân giả là dữ liệu dây hợp lệ (R12)', () => {
  it('khớp schema F-00b', () => {
    expect(() => DatasetPageSchema.parse({ items: [WIRE_DATASET] })).not.toThrow();
    expect(() => DatasetVersionPageSchema.parse({ items: [WIRE_DATASET_VERSION] })).not.toThrow();
    expect(() => TrainingJobPageSchema.parse({ items: [WIRE_QUEUED_JOB, WIRE_CANCELLING_JOB] })).not.toThrow();
    expect(() => TrainingMetricPageSchema.parse(WIRE_METRIC_PAGE)).not.toThrow();
    expect(() => TrainingLogPageSchema.parse(WIRE_LOG_PAGE)).not.toThrow();
    expect(() => CreateTrainingJobSchema.parse(CREATE_BODY)).not.toThrow();
  });

  it('bộ mẫu của mock hợp lệ và đủ trạng thái', () => {
    for (const dataset of MOCK_DATASETS) expect(() => DatasetSchema.parse(dataset), dataset.id).not.toThrow();
    for (const version of MOCK_DATASET_VERSIONS) expect(() => DatasetVersionSchema.parse(version), version.id).not.toThrow();
    for (const job of MOCK_TRAINING_JOBS) expect(() => TrainingJobSchema.parse(job), job.id).not.toThrow();

    expect(new Set(MOCK_DATASET_VERSIONS.map((version) => version.status))).toEqual(new Set(['ready', 'building', 'failed']));
    expect(MOCK_TRAINING_JOBS.map((job) => job.status).sort()).toEqual(['cancelled', 'failed', 'running', 'succeeded']);
    expect(MOCK_TRAINING_JOBS.find((job) => job.status === 'failed')?.failureCode).toBe('TRAINING_TRAINER_MISSING');
  });

  it('tái xuất có tên các hằng của schema', () => {
    expect(TRAINABLE_MODEL_FAMILIES).toEqual(['wallSegmentation', 'openingAndFurnitureDetection']);
  });
});

describe('createAdminMlJobsClient — method, đường, query, thân', () => {
  it('N28: GET datasets, family và cursor bằng query; vắng thì không gửi', async () => {
    const { calls, http } = createHttpMock(() => ({ data: { items: [WIRE_DATASET], nextCursor: 'd2' }, ok: true }));
    const client = createAdminMlJobsClient(http);
    const result = await client.listDatasets({ cursor: 'd1', family: 'wallSegmentation' });
    await client.listDatasets({});

    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.path).toBe('/admin/ml/datasets');
    expect(calls[0]?.options?.query).toEqual({ cursor: 'd1', family: 'wallSegmentation' });
    expect(calls[1]?.options?.query).toEqual({});
    expect(result).toEqual({ data: { items: [DatasetSchema.parse(WIRE_DATASET)], nextCursor: 'd2' }, ok: true });
  });

  it('N30: GET datasets/{id}/versions; trang cuối vắng nextCursor', async () => {
    const { calls, http } = createHttpMock(() => ({ data: { items: [WIRE_DATASET_VERSION] }, ok: true }));
    const result = await createAdminMlJobsClient(http).listDatasetVersions({ datasetId: DATASET_ID });

    expect(calls[0]?.path).toBe(`/admin/ml/datasets/${DATASET_ID}/versions`);
    expect(calls[0]?.options?.query).toEqual({});
    expect(result).toEqual({ data: { items: [DatasetVersionSchema.parse(WIRE_DATASET_VERSION)] }, ok: true });
    expect(result.ok && 'nextCursor' in result.data).toBe(false);
  });

  it('N32: GET training-jobs với family, status, cursor', async () => {
    const { calls, http } = createHttpMock(() => ({ data: { items: [WIRE_QUEUED_JOB] }, ok: true }));
    const result = await createAdminMlJobsClient(http).listJobs({ cursor: 'j1', family: 'wallSegmentation', status: 'queued' });

    expect(calls[0]?.path).toBe('/admin/ml/training-jobs');
    expect(calls[0]?.options?.query).toEqual({ cursor: 'j1', family: 'wallSegmentation', status: 'queued' });
    expect(result).toEqual({ data: { items: [TrainingJobSchema.parse(WIRE_QUEUED_JOB)] }, ok: true });
  });

  it('N33: POST training-jobs với thân CreateTrainingJob và Idempotency-Key', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_QUEUED_JOB, ok: true }));
    const result = await createAdminMlJobsClient(http).createJob({ body: CREATE_BODY, idempotencyKey: IDEMPOTENCY_KEY });

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.path).toBe('/admin/ml/training-jobs');
    expect(calls[0]?.options?.body).toEqual(CREATE_BODY);
    expect(calls[0]?.options?.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(result).toEqual({ data: TrainingJobSchema.parse(WIRE_QUEUED_JOB), ok: true });
  });

  it('N34: GET training-jobs/{id}', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_QUEUED_JOB, ok: true }));
    const result = await createAdminMlJobsClient(http).getJob(JOB_ID);

    expect(calls[0]).toEqual({ method: 'GET', options: {}, path: `/admin/ml/training-jobs/${JOB_ID}` });
    expect(result.ok && result.data.status).toBe('queued');
  });

  it('N35: POST training-jobs/{id}/cancel với thân {} và Idempotency-Key', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_CANCELLING_JOB, ok: true }));
    const result = await createAdminMlJobsClient(http).cancelJob({ idempotencyKey: IDEMPOTENCY_KEY, jobId: JOB_ID });

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.path).toBe(`/admin/ml/training-jobs/${JOB_ID}/cancel`);
    expect(calls[0]?.options?.body).toEqual({});
    expect(calls[0]?.options?.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(result.ok && result.data.status).toBe('cancelling');
  });

  it('N36: lượt đầu gửi limit, không gửi since=; lượt sau gửi since', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_METRIC_PAGE, ok: true }));
    const client = createAdminMlJobsClient(http);
    const result = await client.listJobMetrics({ jobId: JOB_ID, limit: 200 });
    await client.listJobMetrics({ jobId: JOB_ID, limit: 200, since: 'm-cursor-2' });

    expect(calls[0]?.path).toBe(`/admin/ml/training-jobs/${JOB_ID}/metrics`);
    expect(calls[0]?.options?.query).toEqual({ limit: 200 });
    expect(calls[0]?.options?.query && 'since' in calls[0].options.query).toBe(false);
    expect(calls[1]?.options?.query).toEqual({ limit: 200, since: 'm-cursor-2' });
    expect(result).toEqual({
      data: { items: WIRE_METRIC_PAGE.items.map((point) => TrainingMetricPointSchema.parse(point)), nextCursor: 'm-cursor-2' },
      ok: true,
    });
  });

  it('N37: GET logs luôn gửi limit, since từ nextCursor', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_LOG_PAGE, ok: true }));
    const client = createAdminMlJobsClient(http);
    const result = await client.listJobLogs({ jobId: JOB_ID, limit: 200 });
    await client.listJobLogs({ jobId: JOB_ID, limit: 200, since: 'l-cursor-2' });

    expect(calls[0]?.path).toBe(`/admin/ml/training-jobs/${JOB_ID}/logs`);
    expect(calls[0]?.options?.query).toEqual({ limit: 200 });
    expect(calls[1]?.options?.query).toEqual({ limit: 200, since: 'l-cursor-2' });
    expect(result).toEqual({
      data: { items: WIRE_LOG_PAGE.items.map((line) => TrainingLogLineSchema.parse(line)), nextCursor: 'l-cursor-2' },
      ok: true,
    });
  });

  it('phong bì sai hợp đồng thành lỗi, không lọt qua', async () => {
    const { http } = createHttpMock(() => ({ data: { items: [], nextCursor: '' }, ok: true }));
    const client = createAdminMlJobsClient(http);

    expect((await client.listJobs({})).ok).toBe(false);
    expect((await createAdminMlJobsClient(createHttpMock(() => ({ data: { id: 'x' }, ok: true })).http).getJob(JOB_ID)).ok).toBe(false);
  });

  it('một mục hỏng bị bỏ, không làm rỗng cả trang', async () => {
    const broken = { ...WIRE_LOG_PAGE.items[0], seq: -1 };
    const items = [...WIRE_LOG_PAGE.items, ...WIRE_LOG_PAGE.items, WIRE_LOG_PAGE.items[0], broken];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { http } = createHttpMock(() => ({ data: { items, nextCursor: 'n' }, ok: true }));
    const result = await createAdminMlJobsClient(http).listJobLogs({ jobId: JOB_ID, limit: 200 });

    expect(result.ok && result.data.items).toHaveLength(5);
    warn.mockRestore();
  });

  it('mọi mục hỏng thì trả lỗi', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { http } = createHttpMock(() => ({ data: { items: [{ seq: -1 }] }, ok: true }));
    const result = await createAdminMlJobsClient(http).listJobLogs({ jobId: JOB_ID, limit: 200 });

    expect(result.ok).toBe(false);
    warn.mockRestore();
  });

  it('lỗi dây đi nguyên, không bọc lại; signal được chuyển xuống', async () => {
    const { calls, http } = createHttpMock(() => ({ error: httpError, ok: false }));
    const client: AdminMlJobsClient = createAdminMlJobsClient(http);
    const signal = new AbortController().signal;
    const failed = { error: httpError, ok: false };

    expect(await client.listDatasets({ signal })).toEqual(failed);
    expect(await client.listDatasetVersions({ datasetId: DATASET_ID, signal })).toEqual(failed);
    expect(await client.listJobs({ signal })).toEqual(failed);
    expect(await client.createJob({ body: CREATE_BODY, idempotencyKey: IDEMPOTENCY_KEY, signal })).toEqual(failed);
    expect(await client.getJob(JOB_ID, signal)).toEqual(failed);
    expect(await client.cancelJob({ idempotencyKey: IDEMPOTENCY_KEY, jobId: JOB_ID, signal })).toEqual(failed);
    expect(await client.listJobMetrics({ jobId: JOB_ID, limit: 200, signal })).toEqual(failed);
    expect(await client.listJobLogs({ jobId: JOB_ID, limit: 200, signal })).toEqual(failed);
    expect(calls.every((call) => call.options?.signal === signal)).toBe(true);
  });

  it('ENDPOINTS.adminMl có đủ bảy đường mới', () => {
    expect(ENDPOINTS.adminMl.datasets).toBe('/admin/ml/datasets');
    expect(ENDPOINTS.adminMl.jobs).toBe('/admin/ml/training-jobs');
    expect(ENDPOINTS.adminMl.job('j')).toBe('/admin/ml/training-jobs/j');
    expect(ENDPOINTS.adminMl.jobCancel('j')).toBe('/admin/ml/training-jobs/j/cancel');
    expect(ENDPOINTS.adminMl.jobMetrics('j')).toBe('/admin/ml/training-jobs/j/metrics');
    expect(ENDPOINTS.adminMl.jobLogs('j')).toBe('/admin/ml/training-jobs/j/logs');
    expect(ENDPOINTS.adminMl.datasetVersions('d')).toBe('/admin/ml/datasets/d/versions');
  });
});

describe('createAppAdminMlJobsClient — client thật và nhánh mock', () => {
  it('useMock = false: N33 ra mạng với header Idempotency-Key, nhận 202', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        new Response(JSON.stringify(WIRE_QUEUED_JOB), { headers: { 'Content-Type': 'application/json' }, status: 202 }),
      );
    const result = await createAppAdminMlJobsClient(false).createJob({ body: CREATE_BODY, idempotencyKey: IDEMPOTENCY_KEY });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);

    expect(String(url)).toContain('/admin/ml/training-jobs');
    expect(init?.method).toBe('POST');
    expect(headers.get('Idempotency-Key')).toBe(IDEMPOTENCY_KEY);
    expect(JSON.parse(String(init?.body))).toEqual(CREATE_BODY);
    expect(result).toEqual({ data: TrainingJobSchema.parse(WIRE_QUEUED_JOB), ok: true });
    fetchSpy.mockRestore();
  });

  it('useMock = true: trả bộ mẫu, không ra mạng', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = createAppAdminMlJobsClient(true);

    const jobs = await client.listJobs({});
    const running = await client.listJobs({ family: 'wallSegmentation', status: 'running' });
    const datasets = await client.listDatasets({ family: 'openingAndFurnitureDetection' });
    const allDatasets = await client.listDatasets({});
    const versions = await client.listDatasetVersions({ datasetId: MOCK_TRAINING_IDS.datasets.wall });

    expect(jobs).toEqual({ data: { items: MOCK_TRAINING_JOBS }, ok: true });
    expect(running.ok && running.data.items.map((job) => job.id)).toEqual([MOCK_TRAINING_IDS.jobs.running]);
    expect(datasets.ok && datasets.data.items.map((dataset) => dataset.id)).toEqual([MOCK_TRAINING_IDS.datasets.opening]);
    expect(allDatasets.ok && allDatasets.data.items).toHaveLength(2);
    expect(versions.ok && versions.data.items.map((version) => version.status)).toEqual(['ready', 'failed']);
    expect(codeOf(await client.listDatasetVersions({ datasetId: DATASET_ID }))).toBe('NOT_FOUND');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('mock N33: trả queued; cùng khoá trả lại đúng lượt cũ; lỗi phiên bản và họ', async () => {
    const client = createAppAdminMlJobsClient(true);
    const body = { ...CREATE_BODY, datasetVersionId: MOCK_TRAINING_IDS.datasetVersions.wallReady };

    const created = await client.createJob({ body, idempotencyKey: 'k1' });
    const replay = await client.createJob({ body, idempotencyKey: 'k1' });
    const other = await client.createJob({ body, idempotencyKey: 'k2' });

    expect(created.ok && created.data.status).toBe('queued');
    expect(created.ok && TrainingJobSchema.parse(created.data)).toBeTruthy();
    expect(replay).toEqual(created);
    expect(other.ok && created.ok && other.data.id !== created.data.id).toBe(true);
    expect((await client.listJobs({ status: 'queued' })).ok).toBe(true);
    expect(
      codeOf(await client.createJob({ body: { ...body, datasetVersionId: MOCK_TRAINING_IDS.datasetVersions.wallFailed }, idempotencyKey: 'k3' })),
    ).toBe('DATASET_VERSION_NOT_READY');
    expect(
      codeOf(
        await client.createJob({
          body: { baseModel: 'yolov8n', datasetVersionId: MOCK_TRAINING_IDS.datasetVersions.wallReady, epochs: 5, family: 'openingAndFurnitureDetection' },
          idempotencyKey: 'k4',
        }),
      ),
    ).toBe('DATASET_FAMILY_MISMATCH');
    expect(codeOf(await client.createJob({ body, idempotencyKey: 'k5' }))).toBeUndefined();
    expect(codeOf(await client.createJob({ body: CREATE_BODY, idempotencyKey: 'k6' }))).toBe('NOT_FOUND');
  });

  it('mock N34, N35: queued|running → cancelling; khác → 409 TRAINING_JOB_NOT_CANCELLABLE; vắng → 404', async () => {
    const client = createAppAdminMlJobsClient(true);

    const cancelled = await client.cancelJob({ idempotencyKey: 'c1', jobId: MOCK_TRAINING_IDS.jobs.running });
    expect(cancelled.ok && cancelled.data.status).toBe('cancelling');
    expect(cancelled.ok && TrainingJobSchema.parse(cancelled.data).status).toBe('cancelling');

    const read = await client.getJob(MOCK_TRAINING_IDS.jobs.running);
    expect(read.ok && read.data.status).toBe('cancelling');

    const conflict = await client.cancelJob({ idempotencyKey: 'c2', jobId: MOCK_TRAINING_IDS.jobs.succeeded });
    expect(conflict.ok ? undefined : conflict.error).toMatchObject({ code: 'TRAINING_JOB_NOT_CANCELLABLE', kind: 'http', status: 409 });

    expect(codeOf(await client.cancelJob({ idempotencyKey: 'c3', jobId: JOB_ID }))).toBe('NOT_FOUND');
    expect(codeOf(await client.getJob(JOB_ID))).toBe('NOT_FOUND');
  });

  it('mock N36/N37 lượt running: nhiều trang theo since, cắt theo limit, nextCursor không bao giờ vắng', async () => {
    const client = createAppAdminMlJobsClient(true);
    const jobId = MOCK_TRAINING_IDS.jobs.running;

    const first = await client.listJobLogs({ jobId, limit: 20 });
    expect(first.ok && first.data.items).toHaveLength(20);
    const second = await client.listJobLogs({ jobId, limit: 20, since: first.ok ? first.data.nextCursor : undefined });
    expect(second.ok && second.data.items.map((line) => line.seq)).toEqual(Array.from({ length: 10 }, (_, index) => 20 + index));
    const tail = await client.listJobLogs({ jobId, limit: 20, since: second.ok ? second.data.nextCursor : undefined });
    expect(tail.ok && tail.data).toEqual({ items: [], nextCursor: second.ok ? second.data.nextCursor : undefined });

    const metrics = await client.listJobMetrics({ jobId, limit: 200 });
    expect(metrics.ok && metrics.data.items).toHaveLength(24);
    expect(metrics.ok && typeof metrics.data.nextCursor).toBe('string');
    for (const point of metrics.ok ? metrics.data.items : []) expect(() => TrainingMetricPointSchema.parse(point)).not.toThrow();
    for (const line of first.ok ? first.data.items : []) expect(() => TrainingLogLineSchema.parse(line)).not.toThrow();
  });

  it('mock N36/N37 lượt đã kết thúc: đọc hết thì vắng nextCursor; cursor lạ → 422; lượt vắng → 404', async () => {
    const client = createAppAdminMlJobsClient(true);

    const metrics = await client.listJobMetrics({ jobId: MOCK_TRAINING_IDS.jobs.succeeded, limit: 200 });
    expect(metrics.ok && metrics.data.items.every((point) => point.split === 'train' || point.map50 !== undefined)).toBe(true);
    expect(metrics.ok && 'nextCursor' in metrics.data).toBe(false);

    const failedLogs = await client.listJobLogs({ jobId: MOCK_TRAINING_IDS.jobs.failed, limit: 200 });
    expect(failedLogs.ok && failedLogs.data.items.at(-1)?.level).toBe('error');
    expect(failedLogs.ok && 'nextCursor' in failedLogs.data).toBe(false);

    const noMetrics = await client.listJobMetrics({ jobId: MOCK_TRAINING_IDS.jobs.cancelled, limit: 200 });
    expect(noMetrics).toEqual({ data: { items: [] }, ok: true });

    expect(codeOf(await client.listJobLogs({ jobId: MOCK_TRAINING_IDS.jobs.running, limit: 200, since: 'rác' }))).toBe('CURSOR_INVALID');
    expect(codeOf(await client.listJobLogs({ jobId: MOCK_TRAINING_IDS.jobs.running, limit: 200, since: 'cur_-1' }))).toBe('CURSOR_INVALID');
    expect(codeOf(await client.listJobMetrics({ jobId: JOB_ID, limit: 200 }))).toBe('NOT_FOUND');
    expect(codeOf(await client.listJobLogs({ jobId: JOB_ID, limit: 200 }))).toBe('NOT_FOUND');
  });

  it('mock: lượt mới tạo chưa có số đo; nextCursor vẫn có vì chưa kết thúc', async () => {
    const client = createAppAdminMlJobsClient(true);
    const created = await client.createJob({
      body: { ...CREATE_BODY, datasetVersionId: MOCK_TRAINING_IDS.datasetVersions.wallReady },
      idempotencyKey: 'new',
    });
    const jobId = created.ok ? created.data.id : '';

    expect(await client.listJobMetrics({ jobId, limit: 200 })).toEqual({ data: { items: [], nextCursor: 'cur_0' }, ok: true });
  });
});

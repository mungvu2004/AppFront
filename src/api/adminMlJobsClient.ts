/**
 * Client bộ dữ liệu và lượt huấn luyện (N28, N30, N32–N37) — F-12, `/admin/training/jobs`.
 *
 * Cùng khuôn `./adminMlClient.ts` (F-11): đứng riêng, không vào `ApiClient`, để schema
 * `adminMl` nằm trong chunk lười của màn. Mỗi phương thức trả `ApiResult<…>` đã giải mã;
 * lỗi dây (`HttpError`) đi nguyên để màn đọc `code` bằng `readWireError`.
 *
 * N36/N37 **luôn** gửi `limit`: thiếu nó BE trả 50 mục và một trang không bao giờ "đầy"
 * theo `pageSize` của `cursorPolling`, nên polling chậm lại một nhịp mỗi trang.
 */

import { createAppHttpClient, resolveUseMockApi } from '@/api/appClient';
import { ENDPOINTS } from '@/api/endpoints';
import { createMockAdminMlJobsClient } from '@/api/__mocks__/adminMlJobsClient';
import {
  DatasetSchema,
  DatasetVersionSchema,
  TrainingJobSchema,
  TrainingLogLineSchema,
  TrainingMetricPointSchema,
  type CreateTrainingJob,
  type Dataset,
  type DatasetVersion,
  type TrainingJob,
  type TrainingLogLine,
  type TrainingMetricPoint,
} from '@/api/schemas/adminMl';
import { CursorEnvelopeSchema } from '@/api/schemas/common';
import { decode, safeParseList } from '@/api/schemas/decode';
import type { HttpClient, HttpError, QueryParamValue, Result } from '@/lib/http';
import type { z } from 'zod';

import type { ApiResult } from './client';

export { ML_MODEL_FAMILIES, TRAINABLE_MODEL_FAMILIES, TRAINING_BASE_MODELS } from '@/api/schemas/adminMl';
export type {
  CreateTrainingJob,
  Dataset,
  DatasetVersion,
  TrainingJob,
  TrainingLogLine,
  TrainingMetricPoint,
} from '@/api/schemas/adminMl';

/** Một trang có con trỏ; `nextCursor` vắng = hết (N28/N30/N32) hoặc lượt đã kết thúc và đọc hết (N36/N37). */
export interface CursorList<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

export interface ListDatasetsInput {
  readonly family?: string | undefined;
  readonly cursor?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ListDatasetVersionsInput {
  readonly datasetId: string;
  readonly cursor?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ListTrainingJobsInput {
  readonly family?: string | undefined;
  readonly status?: string | undefined;
  readonly cursor?: string | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface CreateTrainingJobInput {
  readonly body: CreateTrainingJob;
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal | undefined;
}

export interface CancelTrainingJobInput {
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal | undefined;
}

export interface ListJobStreamInput {
  readonly jobId: string;
  readonly since?: string | undefined;
  readonly limit: number;
  readonly signal?: AbortSignal | undefined;
}

export interface AdminMlJobsClient {
  /** N28. */
  listDatasets(input: ListDatasetsInput): Promise<ApiResult<CursorList<Dataset>>>;
  /** N30. */
  listDatasetVersions(input: ListDatasetVersionsInput): Promise<ApiResult<CursorList<DatasetVersion>>>;
  /** N32. */
  listJobs(input: ListTrainingJobsInput): Promise<ApiResult<CursorList<TrainingJob>>>;
  /** N33, 202 `queued`. */
  createJob(input: CreateTrainingJobInput): Promise<ApiResult<TrainingJob>>;
  /** N34. */
  getJob(jobId: string, signal?: AbortSignal): Promise<ApiResult<TrainingJob>>;
  /** N35, thân `{}`. */
  cancelJob(input: CancelTrainingJobInput): Promise<ApiResult<TrainingJob>>;
  /** N36, luôn gửi `limit`. */
  listJobMetrics(input: ListJobStreamInput): Promise<ApiResult<CursorList<TrainingMetricPoint>>>;
  /** N37, luôn gửi `limit`. */
  listJobLogs(input: ListJobStreamInput): Promise<ApiResult<CursorList<TrainingLogLine>>>;
}

const withSignal = (signal: AbortSignal | undefined): { signal?: AbortSignal } =>
  signal === undefined ? {} : { signal };

/** Bỏ khoá `undefined` khỏi query: không gửi `since=` hay `family=` rỗng. */
function definedQuery(query: Record<string, QueryParamValue>): Record<string, QueryParamValue> {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
}

/** Lỗi dây đi nguyên; thân thành công qua schema. */
function decodeBody<T>(
  result: Result<unknown, HttpError>,
  read: (data: unknown) => ApiResult<T>,
): ApiResult<T> {
  return result.ok ? read(result.data) : result;
}

/** Phong bì kiểm chặt, từng mục qua `safeParseList` — khuôn N25 của F-11. */
function decodePage<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  label: string,
): (data: unknown) => ApiResult<CursorList<z.output<TSchema>>> {
  return (data) => {
    const page = decode(CursorEnvelopeSchema, data, label);

    if (!page.ok) {
      return page;
    }

    const items = safeParseList(schema, page.data.items, label);

    if (!items.ok) {
      return items;
    }

    return {
      data: {
        items: items.data,
        ...(page.data.nextCursor !== undefined ? { nextCursor: page.data.nextCursor } : {}),
      },
      ok: true,
    };
  };
}

export function createAdminMlJobsClient(http: HttpClient): AdminMlJobsClient {
  const listPage = async <TSchema extends z.ZodTypeAny>(
    path: string,
    query: Record<string, QueryParamValue>,
    signal: AbortSignal | undefined,
    schema: TSchema,
    label: string,
  ): Promise<ApiResult<CursorList<z.output<TSchema>>>> =>
    decodeBody(
      await http.get<unknown>(path, { query: definedQuery(query), ...withSignal(signal) }),
      decodePage(schema, label),
    );

  return {
    listDatasets: ({ cursor, family, signal }) =>
      listPage(ENDPOINTS.adminMl.datasets, { cursor, family }, signal, DatasetSchema, 'adminMl.datasets'),

    listDatasetVersions: ({ cursor, datasetId, signal }) =>
      listPage(
        ENDPOINTS.adminMl.datasetVersions(datasetId),
        { cursor },
        signal,
        DatasetVersionSchema,
        'adminMl.datasetVersions',
      ),

    listJobs: ({ cursor, family, signal, status }) =>
      listPage(ENDPOINTS.adminMl.jobs, { cursor, family, status }, signal, TrainingJobSchema, 'adminMl.jobs'),

    createJob: async ({ body, idempotencyKey, signal }) =>
      decodeBody(
        await http.post<unknown, CreateTrainingJob>(ENDPOINTS.adminMl.jobs, {
          body,
          idempotencyKey,
          ...withSignal(signal),
        }),
        (data) => decode(TrainingJobSchema, data, 'adminMl.createJob'),
      ),

    getJob: async (jobId, signal) =>
      decodeBody(
        await http.get<unknown>(ENDPOINTS.adminMl.job(jobId), withSignal(signal)),
        (data) => decode(TrainingJobSchema, data, 'adminMl.job'),
      ),

    cancelJob: async ({ idempotencyKey, jobId, signal }) =>
      decodeBody(
        await http.post<unknown, Record<string, never>>(ENDPOINTS.adminMl.jobCancel(jobId), {
          body: {},
          idempotencyKey,
          ...withSignal(signal),
        }),
        (data) => decode(TrainingJobSchema, data, 'adminMl.jobCancel'),
      ),

    listJobMetrics: ({ jobId, limit, signal, since }) =>
      listPage(
        ENDPOINTS.adminMl.jobMetrics(jobId),
        { limit, since },
        signal,
        TrainingMetricPointSchema,
        'adminMl.jobMetrics',
      ),

    listJobLogs: ({ jobId, limit, signal, since }) =>
      listPage(ENDPOINTS.adminMl.jobLogs(jobId), { limit, since }, signal, TrainingLogLineSchema, 'adminMl.jobLogs'),
  };
}

/**
 * Client của ứng dụng: bộ mẫu dưới `VITE_USE_MOCK_API`, còn lại client thật trên
 * `createAppHttpClient()`. `import.meta.env.DEV` viết thẳng tại chỗ gọi như F-11, để bản
 * dựng sản phẩm bỏ nhánh mock.
 */
export function createAppAdminMlJobsClient(useMock: boolean = resolveUseMockApi()): AdminMlJobsClient {
  return import.meta.env.DEV && useMock
    ? createMockAdminMlJobsClient()
    : createAdminMlJobsClient(createAppHttpClient());
}

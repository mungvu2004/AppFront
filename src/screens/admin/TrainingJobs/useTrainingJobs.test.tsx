/**
 * Nửa logic của màn huấn luyện: `useTrainingJobs` chạy thật (qua `renderHook` hoặc trong
 * container), client tiêm tường minh với dữ liệu dây literal (R5), phiên đăng nhập là thứ duy
 * nhất bị thay. Nhịp hỏi đo bằng đồng hồ giả.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminMlJobsClient, CursorList } from '@/api/adminMlJobsClient';
import type { Dataset, DatasetVersion, TrainingJob, TrainingLogLine, TrainingMetricPoint } from '@/api/schemas/adminMl';
import type { SessionSnapshot } from '@/lib/auth/types';
import type { HttpError, Result } from '@/lib/http';
import { createNotificationBus, type NotificationInput } from '@/lib/mutations/notificationBus';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';
import { resolveConflict } from '@/lib/versioning/conflict';

import { TrainingJobsContainer } from './TrainingJobs.container';
import { datasetVersionFailureText, jobFailureText, TRAINING_FAILURE_TEXT } from './trainingFailureText';
import {
  createTrainingJobsGateway,
  describeCreateError,
  describeReadError,
  isResponseLost,
  nextCreateAttempt,
  TRAINING_ERROR_TEXT,
} from './trainingJobsGateway';
import { emptyJobStream, jobStreamReducer, METRIC_POINTS_KEPT } from './trainingMetricsModel';
import {
  buildCreateBody,
  JOB_LIST_POLL_MS,
  JOB_STATUS_POLL_MS,
  readAllPages,
  STREAM_PAGE_SIZE,
  STREAM_POLL_ENDED_MS,
  STREAM_POLL_RUNNING_MS,
  useTrainingJobs,
} from './useTrainingJobs';

vi.mock('@/lib/versioning/conflict', () => ({ resolveConflict: vi.fn() }));

const auth = vi.hoisted(() => ({
  session: { roles: ['admin'], status: 'authenticated', user: { id: 'u-quan-tri', name: 'Quân' } } as SessionSnapshot,
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: (): SessionSnapshot => auth.session,
}));

function signInAs(roles: SessionSnapshot['roles'], status: SessionSnapshot['status'] = 'authenticated'): void {
  auth.session = { roles, status, user: status === 'unknown' ? null : { id: 'u-quan-tri', name: 'Quân' } };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }),
    writable: true,
  });
});

beforeEach(() => {
  signInAs(['admin']);
  vi.mocked(resolveConflict).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* -------------------------------------------------------------------------- */
/* Dữ liệu dây literal.                                                        */
/* -------------------------------------------------------------------------- */

const NOW = Date.parse('2026-10-05T03:00:00.000Z');
const USER = 'usr_01JA6M0RG00000000000000A01';
const DATASET_ID = 'dst_01JA6M0RG00000000000000T01';
const VERSION_ID = 'dsv_01JA6M0RG00000000000000S01';
const JOB_A = 'job_01JA6M0RG00000000000000J0A';
const JOB_B = 'job_01JA6M0RG00000000000000J0B';
const JOB_NEW = 'job_01JA6M0RG00000000000000J0N';

const DATASET: Dataset = { createdAt: '2026-09-01T00:00:00.000Z', family: 'wallSegmentation', id: DATASET_ID, name: 'Mặt bằng đã duyệt' };

const VERSION: DatasetVersion = {
  createdAt: '2026-09-02T00:00:00.000Z',
  datasetId: DATASET_ID,
  id: VERSION_ID,
  manifestSha256: '1'.repeat(64),
  sequence: 3,
  source: 'approvedFloors',
  splitCounts: { test: 10, train: 80, validation: 10 },
  status: 'ready',
};

const BUILDING_VERSION: DatasetVersion = {
  createdAt: '2026-09-03T00:00:00.000Z',
  datasetId: DATASET_ID,
  id: 'dsv_01JA6M0RG00000000000000S02',
  sequence: 4,
  source: 'approvedFloors',
  status: 'building',
};

const running = (id: string): TrainingJob => ({
  baseModel: 'mitB0',
  createdAt: '2026-10-05T01:00:00.000Z',
  creatorId: USER,
  currentEpoch: 12,
  datasetVersionId: VERSION_ID,
  epochs: 50,
  family: 'wallSegmentation',
  id,
  startedAt: '2026-10-05T01:00:05.000Z',
  status: 'running',
});

const succeeded = (id: string): TrainingJob => ({
  ...running(id),
  currentEpoch: 50,
  endedAt: '2026-10-05T02:00:00.000Z',
  resultModelVersionId: 'mdl_01JA6M0RG00000000000000D02',
  status: 'succeeded',
});

const failed = (id: string, failureCode: string): TrainingJob => ({
  ...running(id),
  endedAt: '2026-10-05T02:00:00.000Z',
  failureCode,
  status: 'failed',
});

const queued = (id: string): TrainingJob => ({
  baseModel: 'mitB0',
  createdAt: '2026-10-05T02:59:00.000Z',
  creatorId: USER,
  datasetVersionId: VERSION_ID,
  epochs: 50,
  family: 'wallSegmentation',
  id,
  status: 'queued',
});

const ok = <T,>(data: T): Result<T, never> => ({ data, ok: true });

const page = <T,>(items: readonly T[], nextCursor?: string): Result<CursorList<T>, never> =>
  ok({ items, ...(nextCursor === undefined ? {} : { nextCursor }) });

const httpError = (status: number, code?: string, extra: { resource?: string; field?: string } = {}): HttpError => ({
  ...(code !== undefined ? { code } : {}),
  kind: 'http',
  raw: { ...(code !== undefined ? { code } : {}), ...extra },
  requestId: 'req-test',
  retryable: false,
  status,
});

const wireError = (status: number, code?: string, extra: { resource?: string; field?: string } = {}): Result<never, HttpError> => ({
  error: httpError(status, code, extra),
  ok: false,
});

const lost = (kind: 'timeout' | 'network'): Result<never, HttpError> => ({
  error: { kind, raw: null, requestId: 'req-test', retryable: true } as HttpError,
  ok: false,
});

const logLines = (count: number): TrainingLogLine[] =>
  Array.from({ length: count }, (_unused, seq) => ({ at: '2026-10-05T01:00:00.000Z', level: 'info' as const, message: `Dòng ${String(seq)}.`, seq }));

type SpiedClient = { [K in keyof AdminMlJobsClient]: ReturnType<typeof vi.fn<AdminMlJobsClient[K]>> };

function makeClient(overrides: Partial<AdminMlJobsClient> = {}): SpiedClient {
  return {
    cancelJob: vi.fn(overrides.cancelJob ?? (async ({ jobId }) => ok({ ...running(jobId), status: 'cancelling' as const }))),
    createJob: vi.fn(overrides.createJob ?? (async () => ok(queued(JOB_NEW)))),
    getJob: vi.fn(overrides.getJob ?? (async (jobId) => ok(running(jobId)))),
    listDatasetVersions: vi.fn(overrides.listDatasetVersions ?? (async () => page([VERSION]))),
    listDatasets: vi.fn(overrides.listDatasets ?? (async () => page([DATASET]))),
    listJobLogs: vi.fn(overrides.listJobLogs ?? (async () => page<TrainingLogLine>([], 'c1'))),
    listJobMetrics: vi.fn(overrides.listJobMetrics ?? (async () => page<TrainingMetricPoint>([], 'c1'))),
    listJobs: vi.fn(overrides.listJobs ?? (async () => page([running(JOB_A)]))),
  };
}

function keyCounter(): () => string {
  let count = 0;

  return () => {
    count += 1;
    return `khoa-${String(count)}`;
  };
}

function renderTrainingHook(client: SpiedClient) {
  const queryClient = createTestQueryClient();
  const published: NotificationInput[] = [];
  const bus = createNotificationBus();
  bus.publish = (input) => {
    published.push(input);
  };
  const gateway = createTrainingJobsGateway({ client, createKey: keyCounter(), notifications: bus, now: () => NOW });
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const renders: ReturnType<typeof useTrainingJobs>['model'][] = [];
  const hook = renderHook(
    () => {
      const value = useTrainingJobs({ gateway });
      renders.push(value.model);
      return value;
    },
    { wrapper },
  );

  return { ...hook, published, queryClient, renders };
}

function renderScreen(client: SpiedClient) {
  return renderWithProviders(<TrainingJobsContainer client={client} createKey={keyCounter()} now={() => NOW} />);
}

type HookResult = ReturnType<typeof renderTrainingHook>['result'];

async function openReadyForm(result: HookResult): Promise<void> {
  act(() => {
    result.current.actions.onOpenForm();
  });
  await waitFor(() => {
    expect(result.current.model.form?.canSubmit).toBe(true);
  });
}

const keyOf = (spy: SpiedClient['createJob'] | SpiedClient['cancelJob'], call: number): string | undefined =>
  spy.mock.calls[call]?.[0].idempotencyKey;

/* -------------------------------------------------------------------------- */
/* Quyền và bảy trạng thái qua container.                                      */
/* -------------------------------------------------------------------------- */

describe('Quyền — không gọi mạng khi không có quyền', () => {
  it('phiên unknown → loading, client chưa bị gọi', () => {
    signInAs([], 'unknown');
    const client = makeClient();
    const { container } = renderScreen(client);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(client.listJobs).not.toHaveBeenCalled();
  });

  it('engineer → forbidden, client không bị gọi', () => {
    signInAs(['engineer']);
    const client = makeClient();
    renderScreen(client);

    expect(screen.getByText('Chỉ quản trị viên hệ thống xem được trang huấn luyện.')).toBeInTheDocument();
    for (const spy of Object.values(client)) expect(spy).not.toHaveBeenCalled();
  });

  it('403 từ máy chủ → forbidden', async () => {
    renderScreen(makeClient({ listJobs: async () => wireError(403, 'FORBIDDEN') }));

    expect(await screen.findByText('Chỉ quản trị viên hệ thống xem được trang huấn luyện.')).toBeInTheDocument();
  });

  it('0 lượt (empty) → vẫn có Tabs và nút "Tạo lượt huấn luyện"', async () => {
    renderScreen(makeClient({ listJobs: async () => page<TrainingJob>([]) }));

    expect(await screen.findByText('Chưa có lượt huấn luyện nào. Tạo lượt đầu tiên từ bộ dữ liệu sẵn sàng.')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Phần của trang huấn luyện' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo lượt huấn luyện' })).toBeInTheDocument();
  });

  it('503 khi đọc → lỗi "Máy chủ đang bận…", mã lạ khi đọc → câu dự phòng', async () => {
    const { result } = renderTrainingHook(makeClient({ listJobs: async () => wireError(503, 'SERVICE_UNAVAILABLE') }));

    await waitFor(() => {
      expect(result.current.model.state).toBe('error');
    });
    expect(result.current.model.errorMessage).toBe(TRAINING_ERROR_TEXT.busy);
    expect(describeReadError(httpError(500, 'WHATEVER'))).toBe(TRAINING_ERROR_TEXT.readFallback);
    expect(describeReadError(httpError(404, 'NOT_FOUND', { resource: 'dataset' }))).toBe(TRAINING_ERROR_TEXT.datasetNotFound);
  });

  it('có lượt running → partial; đổi lọc → đọc lại N32 với bộ lọc mới', async () => {
    const client = makeClient();
    const { result } = renderTrainingHook(client);

    await waitFor(() => {
      expect(result.current.model.state).toBe('partial');
    });
    act(() => {
      result.current.actions.onFilterStatus('failed');
    });
    await waitFor(() => {
      expect(client.listJobs).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: undefined, status: 'failed' }));
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Khoá N33 · N35.                                                             */
/* -------------------------------------------------------------------------- */

describe('Khoá idempotency', () => {
  it('N33 timeout rồi bấm lại cùng thân → cùng khoá', async () => {
    const client = makeClient();
    client.createJob.mockResolvedValueOnce(lost('timeout'));
    const { result } = renderTrainingHook(client);

    await openReadyForm(result);
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(result.current.model.form?.formError).toBe(TRAINING_ERROR_TEXT.busy);
    });
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.createJob).toHaveBeenCalledTimes(2);
    });

    expect(keyOf(client.createJob, 1)).toBe(keyOf(client.createJob, 0));
    expect(client.createJob.mock.calls[0]?.[0].body).toEqual({
      baseModel: 'mitB0',
      datasetVersionId: VERSION_ID,
      epochs: 50,
      family: 'wallSegmentation',
    });
  });

  it('N33 timeout → đóng, mở lại biểu mẫu cùng thân → cùng khoá, N32 được đọc lại', async () => {
    const client = makeClient();
    client.createJob.mockResolvedValueOnce(lost('timeout'));
    const { result } = renderTrainingHook(client);

    await openReadyForm(result);
    const listCallsBefore = client.listJobs.mock.calls.length;
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.listJobs.mock.calls.length).toBeGreaterThan(listCallsBefore);
    });

    act(() => result.current.actions.onCloseForm());
    expect(result.current.model.form).toBeNull();
    await openReadyForm(result);
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.createJob).toHaveBeenCalledTimes(2);
    });

    expect(keyOf(client.createJob, 1)).toBe(keyOf(client.createJob, 0));
  });

  it('đổi số vòng → khoá mới', async () => {
    const client = makeClient();
    client.createJob.mockResolvedValueOnce(lost('network'));
    const { result } = renderTrainingHook(client);

    await openReadyForm(result);
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(result.current.model.form?.formError).not.toBeNull();
    });
    act(() => result.current.actions.onFormEpochs(60));
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.createJob).toHaveBeenCalledTimes(2);
    });

    expect(client.createJob.mock.calls[1]?.[0].body.epochs).toBe(60);
    expect(keyOf(client.createJob, 1)).not.toBe(keyOf(client.createJob, 0));
  });

  it('422 rồi gửi lại cùng thân → khoá mới; lỗi vào đúng ô số vòng', async () => {
    const client = makeClient();
    client.createJob.mockResolvedValueOnce(wireError(422, 'VALIDATION', { field: 'epochs' }));
    const { result } = renderTrainingHook(client);

    await openReadyForm(result);
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(result.current.model.form?.epochsError).toBe('Số vòng phải từ 1 đến 300.');
    });
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.createJob).toHaveBeenCalledTimes(2);
    });

    expect(keyOf(client.createJob, 1)).not.toBe(keyOf(client.createJob, 0));
  });

  it('202 → đóng biểu mẫu, chọn lượt mới, toast "Đã xếp hàng lượt huấn luyện" không hoàn tác', async () => {
    const client = makeClient();
    const { published, result } = renderTrainingHook(client);

    await openReadyForm(result);
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(result.current.model.form).toBeNull();
    });

    expect(result.current.model.detail?.statusLabel).toBe('Chờ chạy');
    expect(published).toEqual([expect.objectContaining({ title: 'Đã xếp hàng lượt huấn luyện', type: 'trainingJobs.created' })]);
    expect(published[0]?.undoTicket).toBeUndefined();
  });

  it('N35 hai lượt bấm → hai khoá', async () => {
    const client = makeClient();
    client.cancelJob.mockResolvedValueOnce(wireError(503, 'SERVICE_UNAVAILABLE'));
    const { result } = renderTrainingHook(client);

    await waitFor(() => {
      expect(result.current.model.rows).toHaveLength(1);
    });
    act(() => result.current.actions.onSelectJob(JOB_A));
    act(() => result.current.actions.onRequestCancel());
    act(() => result.current.actions.onConfirmCancel());
    await waitFor(() => {
      expect(result.current.model.cancelDialog?.errorMessage).toBe(TRAINING_ERROR_TEXT.busy);
    });
    act(() => result.current.actions.onConfirmCancel());
    await waitFor(() => {
      expect(result.current.model.cancelDialog).toBeNull();
    });

    expect(client.cancelJob).toHaveBeenCalledTimes(2);
    expect(keyOf(client.cancelJob, 1)).not.toBe(keyOf(client.cancelJob, 0));
  });

  it('nextCreateAttempt: một thân một khoá', () => {
    const body = { baseModel: 'mitB0', datasetVersionId: VERSION_ID, epochs: 50, family: 'wallSegmentation' } as const;
    const createKey = keyCounter();
    const first = nextCreateAttempt(null, body, createKey);

    expect(nextCreateAttempt(first, body, createKey)).toBe(first);
    expect(nextCreateAttempt(first, { ...body, epochs: 51 }, createKey).key).not.toBe(first.key);
    expect(isResponseLost(httpError(502))).toBe(true);
    expect(isResponseLost(httpError(429))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Lỗi N33 vào đúng ô.                                                         */
/* -------------------------------------------------------------------------- */

describe('Lỗi N33 → đúng ô', () => {
  it.each([
    ['DATASET_VERSION_NOT_READY', 422, {}, 'version', 'Phiên bản này chưa sẵn sàng.'],
    ['DATASET_FAMILY_MISMATCH', 422, {}, 'version', 'Phiên bản này không cùng họ model.'],
    ['NOT_FOUND', 404, { resource: 'datasetVersion' }, 'version', 'Không tìm thấy phiên bản này.'],
    ['TRAINING_BASE_MODEL_MISMATCH', 422, {}, 'baseModel', 'Model nền không thuộc họ đã chọn.'],
    ['VALIDATION', 422, { field: 'epochs' }, 'epochs', 'Số vòng phải từ 1 đến 300.'],
    ['VALIDATION', 422, { field: 'family' }, 'form', 'Biểu mẫu chưa hợp lệ.'],
    ['RATE_LIMITED', 429, {}, 'form', 'Máy chủ đang bận. Thử lại sau ít phút.'],
    ['SOMETHING_NEW', 400, {}, 'form', 'Chưa gửi được yêu cầu. Thử lại sau.'],
  ] as const)('%s (%i) → ô %s', (code, status, extra, field, text) => {
    expect(describeCreateError(httpError(status, code, extra))[field]).toBe(text);
  });

  it('lỗi ô phiên bản → đọc lại N30', async () => {
    const client = makeClient();
    client.createJob.mockResolvedValueOnce(wireError(422, 'DATASET_VERSION_NOT_READY'));
    const { result } = renderTrainingHook(client);

    await openReadyForm(result);
    const before = client.listDatasetVersions.mock.calls.length;
    act(() => result.current.actions.onSubmitForm());
    await waitFor(() => {
      expect(client.listDatasetVersions.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('bộ dữ liệu không có phiên bản ready → câu ở ô phiên bản, không gửi được', async () => {
    const { result } = renderTrainingHook(
      makeClient({ listDatasetVersions: async () => page([BUILDING_VERSION]) }),
    );

    act(() => result.current.actions.onOpenForm());
    await waitFor(() => {
      expect(result.current.model.form?.versionError).toBe('Bộ dữ liệu này chưa có phiên bản sẵn sàng.');
    });
    expect(result.current.model.form?.canSubmit).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Luồng N36/N37, reducer.                                                     */
/* -------------------------------------------------------------------------- */

describe('Số đo và nhật ký', () => {
  it('lượt A có seq 0–9, sang lượt B có seq 0–4 → bảng đúng 5 dòng của B', async () => {
    const client = makeClient({
      listJobLogs: async ({ jobId }) => page(jobId === JOB_A ? logLines(10) : logLines(5), 'c1'),
      listJobs: async () => page([running(JOB_A), running(JOB_B)]),
    });
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(result.current.model.detail?.logRows).toHaveLength(10);
    });
    act(() => result.current.actions.onSelectJob(JOB_B));
    await waitFor(() => {
      expect(result.current.model.detail?.logRows).toHaveLength(5);
    });

    expect(result.current.model.detail?.logRows.map((row) => row.message)).toEqual(logLines(5).map((line) => line.message));
    expect(client.listJobLogs).toHaveBeenCalledWith(expect.objectContaining({ jobId: JOB_B, limit: STREAM_PAGE_SIZE, since: undefined }));
  });

  it('nhịp luồng: 5 s khi chạy, 15 s khi đã kết thúc; rời màn → stop()', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status: TrainingJob['status'] = 'running';
    const callTimes: number[] = [];
    const client = makeClient({
      getJob: async (jobId) => ok(status === 'running' ? running(jobId) : succeeded(jobId)),
      listJobMetrics: async () => {
        callTimes.push(Date.now());
        return page<TrainingMetricPoint>([], 'c1');
      },
    });
    const { result, unmount } = renderTrainingHook(client);
    const gaps = (): number[] => callTimes.slice(1).map((time, index) => time - (callTimes[index] ?? time));
    /** `shouldAdvanceTime` thêm vài ms thật vào đồng hồ giả. */
    const near = (gap: number, expected: number): boolean => gap >= expected && gap < expected + 1_000;

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(result.current.model.detail?.statusLabel).toBe('Đang chạy');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STREAM_POLL_RUNNING_MS * 2);
    });
    expect(near(gaps().at(-1) ?? 0, STREAM_POLL_RUNNING_MS)).toBe(true);

    status = 'succeeded';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    });
    await waitFor(() => {
      expect(result.current.model.detail?.statusLabel).toBe('Xong');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STREAM_POLL_ENDED_MS * 3);
    });
    expect(near(gaps().at(-1) ?? 0, STREAM_POLL_ENDED_MS)).toBe(true);

    const calls = callTimes.length;
    unmount();
    await vi.advanceTimersByTimeAsync(STREAM_POLL_ENDED_MS * 4);
    expect(callTimes).toHaveLength(calls);
  });

  it('luồng 404 → dừng hỏi, câu "Không tìm thấy lượt huấn luyện này."', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeClient({ listJobMetrics: async () => wireError(404, 'NOT_FOUND', { resource: 'trainingJob' }) });
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(result.current.model.detail?.notice).toBe('Không tìm thấy lượt huấn luyện này.');
    });
    const calls = client.listJobMetrics.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STREAM_POLL_ENDED_MS * 2);
    });
    expect(client.listJobMetrics.mock.calls.length).toBe(calls);
  });

  it('reducer: bỏ trùng (split, step) và seq, bỏ hành động của lượt khác', () => {
    const point = (split: 'train' | 'validation', step: number, iou?: number): TrainingMetricPoint => ({
      epoch: 1,
      ...(iou === undefined ? { loss: 0.5 } : { iou }),
      recordedAt: '2026-10-05T01:00:00.000Z',
      split,
      step,
    });
    let state = emptyJobStream(JOB_A);
    state = jobStreamReducer(state, { items: [point('train', 1), point('validation', 1, 0.5)], jobId: JOB_A, type: 'metrics' });
    state = jobStreamReducer(state, { items: [point('train', 1), point('validation', 1, 0.5), point('train', 2)], jobId: JOB_A, type: 'metrics' });
    state = jobStreamReducer(state, { items: [point('train', 3)], jobId: JOB_B, type: 'metrics' });
    state = jobStreamReducer(state, { items: logLines(3), jobId: JOB_A, type: 'logs' });
    state = jobStreamReducer(state, { items: logLines(4), jobId: JOB_A, type: 'logs' });

    expect(state.metrics).toHaveLength(3);
    expect(state.logs.map((line) => line.seq)).toEqual([0, 1, 2, 3]);
    expect(jobStreamReducer(state, { jobId: JOB_B, type: 'reset' })).toEqual(emptyJobStream(JOB_B));
  });

  it(`reducer: giữ ≤ ${String(METRIC_POINTS_KEPT)} điểm mới nhất, "tốt nhất" trên mọi điểm đã nhận`, () => {
    const points: TrainingMetricPoint[] = Array.from({ length: METRIC_POINTS_KEPT + 500 }, (_unused, index) => ({
      epoch: 1,
      iou: index === 3 ? 0.99 : 0.1,
      recordedAt: '2026-10-05T01:00:00.000Z',
      split: 'validation',
      step: index,
    }));
    const state = jobStreamReducer(emptyJobStream(JOB_A), { items: points, jobId: JOB_A, type: 'metrics' });

    expect(state.metrics).toHaveLength(METRIC_POINTS_KEPT);
    expect(state.metrics[0]?.step).toBe(500);
    expect(state.best?.step).toBe(3);
  });
});

/* -------------------------------------------------------------------------- */
/* N34 · N32 nhịp, 409 N35.                                                    */
/* -------------------------------------------------------------------------- */

describe('Nhịp N34 · N32', () => {
  it('N34 hỏi mỗi 5 s khi running, ngừng khi succeeded, rồi làm mới N32 một lần', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeClient();
    client.getJob.mockResolvedValueOnce(ok(running(JOB_A))).mockResolvedValue(ok(succeeded(JOB_A)));
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(client.getJob).toHaveBeenCalledTimes(1);
    });
    const listCalls = client.listJobs.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    });
    await waitFor(() => {
      expect(result.current.model.detail?.statusLabel).toBe('Xong');
    });
    expect(client.getJob).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(client.listJobs.mock.calls.length).toBe(listCalls + 1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS * 4);
    });
    expect(client.getJob).toHaveBeenCalledTimes(2);
  });

  it('lượt trong danh sách đổi running → succeeded → bảng đổi sau một nhịp N32', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeClient();
    client.listJobs.mockResolvedValueOnce(page([running(JOB_A)])).mockResolvedValue(page([succeeded(JOB_A)]));
    const { result } = renderTrainingHook(client);

    await waitFor(() => {
      expect(result.current.model.rows[0]?.statusLabel).toBe('Đang chạy');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_LIST_POLL_MS);
    });
    await waitFor(() => {
      expect(result.current.model.rows[0]?.statusLabel).toBe('Xong');
    });
    expect(result.current.model.state).toBe('success');

    const calls = client.listJobs.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_LIST_POLL_MS * 3);
    });
    expect(client.listJobs.mock.calls.length).toBe(calls);
  });

  it('409 N35 → đọc lại N34, đúng câu, không dải tải lại, resolveConflict 0 lần; tiêu điểm về tiêu đề', async () => {
    const client = makeClient({ cancelJob: async () => wireError(409, 'TRAINING_JOB_NOT_CANCELLABLE') });
    renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Tách lớp tường' , pressed: false }));
    const panel = await screen.findByRole('complementary', { name: 'Chi tiết lượt huấn luyện' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Huỷ lượt' }));
    const dialog = await screen.findByRole('dialog', { name: 'Huỷ lượt huấn luyện này?' });
    const getJobCalls = client.getJob.mock.calls.length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Huỷ lượt' }));

    expect(await screen.findByText('Lượt này vừa kết thúc nên không huỷ được nữa.')).toBeInTheDocument();
    await waitFor(() => {
      expect(client.getJob.mock.calls.length).toBeGreaterThan(getJobCalls);
    });
    expect(screen.queryByRole('button', { name: 'Tải lại' })).toBeNull();
    expect(resolveConflict).not.toHaveBeenCalled();
    expect(document.activeElement?.tagName).toBe('H2');
  });

  it('huỷ thành công → ghi kết quả vào N34, tiêu điểm về tiêu đề chi tiết (nút "Huỷ lượt" biến mất)', async () => {
    let status: TrainingJob['status'] = 'running';
    const client = makeClient({
      cancelJob: async ({ jobId }) => {
        status = 'cancelling';
        return ok({ ...running(jobId), status });
      },
      getJob: async (jobId) => ok({ ...running(jobId), status }),
    });
    renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Tách lớp tường', pressed: false }));
    const panel = await screen.findByRole('complementary', { name: 'Chi tiết lượt huấn luyện' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Huỷ lượt' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Huỷ lượt' }));

    expect(await within(panel).findByText('Đang huỷ')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Huỷ lượt' })).toBeNull();
    expect(document.activeElement?.tagName).toBe('H2');
  });
});

describe('Review 1 — dừng hỏi, lượt đổi', () => {
  it('N34 404 sau khi đã có dữ liệu → không gọi thêm sau 5 s/15 s giả', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeClient();
    client.getJob
      .mockResolvedValueOnce(ok(running(JOB_A)))
      .mockResolvedValue(wireError(404, 'NOT_FOUND', { resource: 'trainingJob' }));
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(client.getJob).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    });
    await waitFor(() => {
      expect(result.current.model.detail?.notice).toBe('Không tìm thấy lượt huấn luyện này.');
    });
    const calls = client.getJob.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS + JOB_LIST_POLL_MS);
    });
    expect(client.getJob.mock.calls.length).toBe(calls);
  });

  it('N34 403 → forbidden, N32 và N34 không gọi thêm', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = makeClient();
    client.getJob.mockResolvedValueOnce(ok(running(JOB_A))).mockResolvedValue(wireError(403, 'FORBIDDEN'));
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(client.getJob).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_STATUS_POLL_MS);
    });
    await waitFor(() => {
      expect(result.current.model.state).toBe('forbidden');
    });
    const jobCalls = client.getJob.mock.calls.length;
    const listCalls = client.listJobs.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(JOB_LIST_POLL_MS * 3);
    });
    expect(client.getJob.mock.calls.length).toBe(jobCalls);
    expect(client.listJobs.mock.calls.length).toBe(listCalls);
    expect(result.current.model.state).toBe('forbidden');
  });

  it('đổi từ lượt đang chạy sang lượt đã xong không làm mới N32', async () => {
    const client = makeClient({
      getJob: async (jobId) => ok(jobId === JOB_A ? running(jobId) : succeeded(jobId)),
      listJobs: async () => page([running(JOB_A), succeeded(JOB_B)]),
    });
    const { result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(result.current.model.detail?.statusLabel).toBe('Đang chạy');
    });
    const listCalls = client.listJobs.mock.calls.length;
    act(() => result.current.actions.onSelectJob(JOB_B));
    await waitFor(() => {
      expect(result.current.model.detail?.statusLabel).toBe('Xong');
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(client.listJobs.mock.calls.length).toBe(listCalls);
  });

  it('không lượt vẽ nào ghép chi tiết lượt mới với nhật ký lượt cũ', async () => {
    const client = makeClient({
      listJobLogs: async ({ jobId }) => page(jobId === JOB_A ? logLines(10) : [], 'c1'),
      listJobs: async () => page([running(JOB_A), running(JOB_B)]),
    });
    const { renders, result } = renderTrainingHook(client);

    act(() => result.current.actions.onSelectJob(JOB_A));
    await waitFor(() => {
      expect(result.current.model.detail?.logRows).toHaveLength(10);
    });
    act(() => result.current.actions.onSelectJob(JOB_B));
    await waitFor(() => {
      expect(client.listJobLogs).toHaveBeenCalledWith(expect.objectContaining({ jobId: JOB_B }));
    });

    const showingB = renders.filter((model) => model.rows.find((row) => row.isSelected)?.id === JOB_B);
    expect(showingB.length).toBeGreaterThan(0);
    for (const model of showingB) expect(model.detail?.logRows ?? []).toHaveLength(0);
  });

  it('buildCreateBody: model nền không thuộc họ → null (không ép kiểu)', () => {
    expect(buildCreateBody('wallSegmentation', 'yolov8n', VERSION_ID, 50)).toBeNull();
    expect(buildCreateBody('openingAndFurnitureDetection', 'yolov8n', VERSION_ID, 50)).toEqual({
      baseModel: 'yolov8n',
      datasetVersionId: VERSION_ID,
      epochs: 50,
      family: 'openingAndFurnitureDetection',
    });
  });
});

/* -------------------------------------------------------------------------- */
/* failureCode → câu.                                                          */
/* -------------------------------------------------------------------------- */

describe('failureCode → câu', () => {
  const JOB = TRAINING_FAILURE_TEXT.job;
  const DATASET_TEXT = TRAINING_FAILURE_TEXT.dataset;

  it.each<readonly [string, string]>([
    ...['TRAINING_HEARTBEAT_LOST', 'TRAINING_DISPATCH_STALLED', 'TRAINING_LAUNCH_FAILED', 'TRAINING_SLOT_BUSY', 'TRAINING_GPU_BUSY', 'TRAINING_SLOT_LOST', 'GPU_LOCK_LOST', 'RETRY_EXHAUSTED', 'TASK_TIMEOUT', 'WORKER_LOST'].map((code) => [code, JOB.busy] as const),
    ['TRAINING_TIMEOUT', JOB.timeout],
    ['TRAINING_LOSS_NOT_FINITE', JOB.lossNotFinite],
    ['DATASET_SPLIT_EMPTY', JOB.datasetBroken],
    ['DATASET_SAMPLE_INVALID', JOB.datasetBroken],
    ['TRAINING_TRAINER_MISSING', JOB.trainerMissing],
    ['TRAINING_DISK_FULL', JOB.diskFull],
    ...['DATASET_MANIFEST_MISMATCH', 'DATASET_OBJECT_MISMATCH', 'MODEL_EXPORT_MISMATCH', 'TRAINING_BASE_MODEL_MISMATCH', 'MODEL_CHECKSUM_MISMATCH', 'TRAINING_METRICS_MISSING', 'MODEL_FORMAT_UNSUPPORTED', 'ML_DEVICE_UNAVAILABLE', 'INTERNAL'].map((code) => [code, JOB.mismatch] as const),
    ['SOMETHING_UNHEARD_OF', JOB.unknown],
  ])('lượt %s → câu', (code, text) => {
    expect(jobFailureText(code)).toBe(text);
  });

  it.each<readonly [string, string]>([
    ['DATASET_EMPTY', DATASET_TEXT.empty],
    ['DATASET_TOO_LARGE', DATASET_TEXT.tooLarge],
    ['DATASET_FAMILY_UNSUPPORTED', DATASET_TEXT.familyUnsupported],
    ...['DATASET_BUILD_TIMEOUT', 'SOURCE_READ_FAILED', 'DEPENDENCY_UNAVAILABLE', 'RETRY_EXHAUSTED', 'TASK_TIMEOUT', 'WORKER_LOST'].map((code) => [code, DATASET_TEXT.interrupted] as const),
    ['INTERNAL', DATASET_TEXT.unknown],
    ['SOMETHING_UNHEARD_OF', DATASET_TEXT.unknown],
  ])('phiên bản bộ dữ liệu %s → câu', (code, text) => {
    expect(datasetVersionFailureText(code)).toBe(text);
  });

  it('mã lạ → câu dự phòng trên màn, DOM không chứa mã', async () => {
    const client = makeClient({
      getJob: async (jobId) => ok(failed(jobId, 'BRAND_NEW_FAILURE')),
      listJobs: async () => page([failed(JOB_A, 'BRAND_NEW_FAILURE')]),
    });
    const { container } = renderScreen(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Tách lớp tường', pressed: false }));

    expect(await screen.findByText('Lượt không thành công vì một lỗi chưa có mô tả.')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('BRAND_NEW_FAILURE');
  });
});

describe('readAllPages', () => {
  it('đọc hết nextCursor; CURSOR_INVALID → đọc lại từ đầu đúng một lần', async () => {
    const invalid = httpError(422, 'CURSOR_INVALID');
    const read = vi
      .fn<(cursor: string | undefined) => Promise<CursorList<number>>>()
      .mockResolvedValueOnce({ items: [1], nextCursor: 'a' })
      .mockRejectedValueOnce(invalid)
      .mockResolvedValueOnce({ items: [1], nextCursor: 'a' })
      .mockResolvedValueOnce({ items: [2] });

    await expect(readAllPages(read)).resolves.toEqual([1, 2]);
    expect(read.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, 'a', undefined, 'a']);

    const alwaysInvalid = vi.fn<(cursor: string | undefined) => Promise<CursorList<number>>>().mockRejectedValue(invalid);
    await expect(readAllPages(alwaysInvalid)).rejects.toBe(invalid);
    expect(alwaysInvalid).toHaveBeenCalledTimes(2);
  });
});

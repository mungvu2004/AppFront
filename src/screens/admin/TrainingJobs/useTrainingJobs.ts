/**
 * Hook của màn huấn luyện (`/admin/training/jobs`, F-12).
 *
 * View thuần chỉ nhận `model` + `actions` (mục D); mọi thứ còn lại ở đây. Trạng thái máy chủ
 * đọc thẳng từ `useQuery`/`useInfiniteQuery`/`useMutation`; `useState` giữ lựa chọn của người
 * dùng, `useReducer` giữ số đo và nhật ký của lượt đang xem.
 *
 * ## Nhịp hỏi
 *
 * - N32: {@link JOB_LIST_POLL_MS} khi trang đã nạp còn lượt `queued|running|cancelling` VÀ đã
 *   nạp ≤ {@link JOB_LIST_POLL_MAX_PAGES} trang (mỗi nhịp đọc lại mọi trang).
 * - N34: {@link JOB_STATUS_POLL_MS} khi lượt đang xem chưa kết thúc; kết thúc thì làm mới N32
 *   một lần.
 * - N36/N37: `startCursorPolling` (không phải `pollingChannel`: con trỏ phải là đúng
 *   `nextCursor` máy chủ trả). {@link STREAM_POLL_RUNNING_MS} khi chạy,
 *   {@link STREAM_POLL_ENDED_MS} khi đã kết thúc; dừng chỉ khi máy chủ thôi trả `nextCursor`,
 *   khi 401/403/404, hoặc khi rời lượt/rời màn.
 *
 * ## Bậc thang bảy trạng thái
 *
 * `loading` (phiên chưa rõ) → `forbidden` → `loading` → `error` → `collapsed` → `empty` (tab
 * đang mở rỗng, không lọc) → `partial` (có lượt chưa kết thúc) → `success`.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  TRAINABLE_MODEL_FAMILIES,
  TRAINING_BASE_MODELS,
  type CreateTrainingJob,
  type CursorList,
  type Dataset,
  type DatasetVersion,
  type TrainingJob,
  type TrainingLogLine,
  type TrainingMetricPoint,
} from '@/api/adminMlJobsClient';
import { useSession } from '@/hooks/useSession';
import { formatTimestamp } from '@/lib/format/datetime';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ChannelClock } from '@/lib/realtime/eventChannel';
import { startCursorPolling, type PollingVisibilityTarget } from '@/lib/realtime/cursorPolling';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { datasetVersionFailureText, jobFailureText } from './trainingFailureText';
import {
  canManageTraining,
  describeCreateError,
  describeReadError,
  describeWriteError,
  isCursorInvalidError,
  isForbiddenError,
  isNotCancellableError,
  isResponseLost,
  nextCreateAttempt,
  shouldStopStream,
  TRAINING_ERROR_TEXT,
  type CreateAttempt,
  type CreateFieldErrors,
  type TrainingJobsGateway,
} from './trainingJobsGateway';
import {
  buildLogRow,
  buildMetricRow,
  emptyJobStream,
  jobStreamReducer,
  metricsSummary,
} from './trainingMetricsModel';
import {
  FILTER_ALL,
  type DatasetFamilyId,
  type DatasetVersionRowModel,
  type FormModel,
  type JobDetailModel,
  type JobRowModel,
  type LinkModel,
  type Option,
  type StatusBadgeVariant,
  type TrainableFamilyId,
  type TrainingJobsActions,
  type TrainingJobsViewModel,
  type TrainingTabId,
} from './types';

export const JOB_LIST_POLL_MS = 15_000;
export const JOB_LIST_POLL_MAX_PAGES = 3;
export const JOB_STATUS_POLL_MS = 5_000;
export const STREAM_POLL_RUNNING_MS = 5_000;
export const STREAM_POLL_ENDED_MS = 15_000;
export const STREAM_PAGE_SIZE = 200;
export const DEFAULT_TRAINING_EPOCHS = 50;
export const TRAINING_EPOCHS_MIN = 1;
export const TRAINING_EPOCHS_MAX = 300;
export const COLLAPSE_BREAKPOINT_PX = 1024;
export const SKELETON_ROW_COUNT = 8;

const SHORT_CODE_LENGTH = 6;

type JobStatus = TrainingJob['status'];

const ACTIVE_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>(['queued', 'running', 'cancelling']);
export const isActiveJob = (status: JobStatus | undefined): boolean =>
  status !== undefined && ACTIVE_STATUSES.has(status);

export const FAMILY_LABELS: Readonly<Record<DatasetFamilyId, string>> = {
  wallSegmentation: 'Tách lớp tường',
  openingAndFurnitureDetection: 'Nhận diện cửa và đồ đạc',
  dimensionReading: 'Đọc kích thước',
};

const SCORE_NAME: Readonly<Record<TrainableFamilyId, string>> = {
  wallSegmentation: 'IoU',
  openingAndFurnitureDetection: 'mAP50',
};

const JOB_STATUS: Readonly<Record<JobStatus, { readonly label: string; readonly variant: StatusBadgeVariant }>> = {
  queued: { label: 'Chờ chạy', variant: 'neutral' },
  running: { label: 'Đang chạy', variant: 'attention' },
  succeeded: { label: 'Xong', variant: 'neutral' },
  failed: { label: 'Hỏng', variant: 'violation' },
  cancelling: { label: 'Đang huỷ', variant: 'attention' },
  cancelled: { label: 'Đã huỷ', variant: 'neutral' },
};

const VERSION_STATUS: Readonly<
  Record<DatasetVersion['status'], { readonly label: string; readonly variant: StatusBadgeVariant }>
> = {
  ready: { label: 'Sẵn sàng', variant: 'neutral' },
  building: { label: 'Đang dựng', variant: 'attention' },
  failed: { label: 'Hỏng', variant: 'violation' },
};

const SOURCE_LABEL: Readonly<Record<DatasetVersion['source'], string>> = {
  approvedFloors: 'Tầng đã duyệt',
  cubicasa5k: 'Bộ dữ liệu công khai',
};

export const TRAINING_JOBS_TEXT = {
  all: 'Tất cả',
  createdTitle: 'Đã xếp hàng lượt huấn luyện',
  createdDescription: 'Lượt mới chạy khi máy huấn luyện rảnh.',
  emptyJobs: 'Chưa có lượt huấn luyện nào. Tạo lượt đầu tiên từ bộ dữ liệu sẵn sàng.',
  emptyFiltered: 'Không có lượt nào khớp bộ lọc.',
  emptyDatasets: 'Chưa có bộ dữ liệu nào. Dựng bằng công cụ dòng lệnh.',
  noReadyVersion: 'Bộ dữ liệu này chưa có phiên bản sẵn sàng.',
  resultLink: 'Xem model AI đã tạo',
  relatedLink: 'Model AI của chuỗi xử lý',
  fieldFamily: 'Họ',
  fieldBaseModel: 'Model nền',
  fieldDatasetVersion: 'Phiên bản bộ dữ liệu',
  fieldEpoch: 'Vòng',
  fieldCreatedAt: 'Tạo lúc',
  fieldStartedAt: 'Bắt đầu',
  fieldEndedAt: 'Kết thúc',
} as const;

export const RELATED_LINK: LinkModel = { href: ROUTES.adminTrainingModels, label: TRAINING_JOBS_TEXT.relatedLink };

export const FAMILY_FILTERS: readonly Option[] = [
  { label: TRAINING_JOBS_TEXT.all, value: FILTER_ALL },
  ...TRAINABLE_MODEL_FAMILIES.map((family) => ({ label: FAMILY_LABELS[family], value: family })),
];

export const STATUS_FILTERS: readonly Option[] = [
  { label: TRAINING_JOBS_TEXT.all, value: FILTER_ALL },
  ...(['queued', 'running', 'succeeded', 'failed', 'cancelling', 'cancelled'] as const).map((status) => ({
    label: JOB_STATUS[status].label,
    value: status,
  })),
];

export const TRAINABLE_FAMILY_OPTIONS: readonly Option<TrainableFamilyId>[] = TRAINABLE_MODEL_FAMILIES.map((family) => ({
  label: FAMILY_LABELS[family],
  value: family,
}));

export const DATASET_FAMILY_OPTIONS: readonly Option<DatasetFamilyId>[] = (
  ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'] as const
).map((family) => ({ label: FAMILY_LABELS[family], value: family }));

/* -------------------------------------------------------------------------- */
/* Hàm dựng — định dạng ở đây, không ở view (A15).                             */
/* -------------------------------------------------------------------------- */

export const shortCode = (id: string): string => `…${id.slice(-SHORT_CODE_LENGTH)}`;

const timeLabel = (iso: string | undefined, nowMs: number): string =>
  iso === undefined ? MISSING_VALUE : formatTimestamp(Date.parse(iso), nowMs);

const epochLabel = (job: TrainingJob): string =>
  `${formatNumber(job.currentEpoch ?? 0)}/${formatNumber(job.epochs)}`;

export function partialNotice(count: number): string {
  return `${formatNumber(count)} lượt đang chờ hoặc chạy; số liệu tự cập nhật.`;
}

export function buildJobRow(job: TrainingJob, nowMs: number, selectedId: string | null): JobRowModel {
  return {
    baseModelLabel: job.baseModel,
    datasetVersionLabel: shortCode(job.datasetVersionId),
    endedLabel: timeLabel(job.endedAt, nowMs),
    epochLabel: epochLabel(job),
    familyLabel: FAMILY_LABELS[job.family],
    id: job.id,
    isSelected: job.id === selectedId,
    startedLabel: timeLabel(job.startedAt, nowMs),
    statusLabel: JOB_STATUS[job.status].label,
    statusVariant: JOB_STATUS[job.status].variant,
  };
}

export interface JobStreamView {
  readonly summary: string | null;
  readonly metrics: readonly TrainingMetricPoint[];
  readonly logs: readonly TrainingLogLine[];
}

export function buildJobDetail(input: {
  readonly job: TrainingJob | undefined;
  readonly nowMs: number;
  readonly stream: JobStreamView;
  readonly notice: string | null;
  readonly isLoading: boolean;
  readonly focusKey: number;
}): JobDetailModel {
  const { job, nowMs } = input;

  if (job === undefined) {
    // N34 chưa về hoặc hỏng: khung chi tiết rỗng, câu lỗi (nếu có) ở `notice`.
    return {
      canCancel: false,
      failureText: null,
      fields: [],
      focusKey: input.focusKey,
      isLoading: input.isLoading,
      logRows: [],
      metricRows: [],
      metricsSummary: null,
      notice: input.notice,
      resultLink: null,
      scoreName: MISSING_VALUE,
      statusLabel: MISSING_VALUE,
      statusVariant: 'neutral',
      title: MISSING_VALUE,
    };
  }

  const field = (label: string, value: string, isCode = false) => ({ isCode, label, value });

  return {
    canCancel: job.status === 'queued' || job.status === 'running',
    failureText: job.failureCode === undefined ? null : jobFailureText(job.failureCode),
    fields: [
      field(TRAINING_JOBS_TEXT.fieldFamily, FAMILY_LABELS[job.family]),
      field(TRAINING_JOBS_TEXT.fieldBaseModel, job.baseModel),
      field(TRAINING_JOBS_TEXT.fieldDatasetVersion, job.datasetVersionId, true),
      field(TRAINING_JOBS_TEXT.fieldEpoch, epochLabel(job)),
      field(TRAINING_JOBS_TEXT.fieldCreatedAt, timeLabel(job.createdAt, nowMs)),
      field(TRAINING_JOBS_TEXT.fieldStartedAt, timeLabel(job.startedAt, nowMs)),
      field(TRAINING_JOBS_TEXT.fieldEndedAt, timeLabel(job.endedAt, nowMs)),
    ],
    focusKey: input.focusKey,
    isLoading: input.isLoading,
    logRows: input.stream.logs.map((line) => buildLogRow(line, nowMs)),
    metricRows: input.stream.metrics.map((point) => buildMetricRow(point, nowMs)),
    metricsSummary: input.stream.summary,
    notice: input.notice,
    resultLink:
      job.resultModelVersionId === undefined
        ? null
        : { href: ROUTES.adminTrainingModels, label: TRAINING_JOBS_TEXT.resultLink },
    scoreName: SCORE_NAME[job.family],
    statusLabel: JOB_STATUS[job.status].label,
    statusVariant: JOB_STATUS[job.status].variant,
    title: `${FAMILY_LABELS[job.family]} · ${job.baseModel}`,
  };
}

export function buildDatasetVersionRow(version: DatasetVersion, nowMs: number): DatasetVersionRowModel {
  const counts = version.splitCounts;

  return {
    createdLabel: timeLabel(version.createdAt, nowMs),
    failureText: version.failureCode === undefined ? null : datasetVersionFailureText(version.failureCode),
    id: version.id,
    sequenceLabel: formatNumber(version.sequence),
    sourceLabel: SOURCE_LABEL[version.source],
    splitLabel:
      counts === undefined
        ? MISSING_VALUE
        : [counts.train, counts.validation, counts.test].map((count) => formatNumber(count)).join(' / '),
    statusLabel: VERSION_STATUS[version.status].label,
    statusVariant: VERSION_STATUS[version.status].variant,
  };
}

/** Đọc hết mọi trang (N28, N30); `CURSOR_INVALID` thì đọc lại từ trang đầu đúng một lần. */
export async function readAllPages<T>(read: (cursor: string | undefined) => Promise<CursorList<T>>): Promise<readonly T[]> {
  let items: T[] = [];
  let cursor: string | undefined;
  let retried = false;

  for (;;) {
    try {
      const page = await read(cursor);
      items = [...items, ...page.items];
      if (page.nextCursor === undefined) return items;
      cursor = page.nextCursor;
    } catch (error) {
      if (!isCursorInvalidError(error) || retried) throw error;
      retried = true;
      items = [];
      cursor = undefined;
    }
  }
}

const NO_FIELD_ERRORS: CreateFieldErrors = { baseModel: null, epochs: null, form: null, version: null };

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export interface UseTrainingJobsOptions {
  readonly gateway: TrainingJobsGateway;
  /** Khung hẹp hơn {@link COLLAPSE_BREAKPOINT_PX}; nơi ráp đo. */
  readonly isNarrow?: boolean;
  /** Đồng hồ và đích hiển thị của luồng số đo/nhật ký — bài kiểm tiêm. */
  readonly clock?: ChannelClock;
  readonly visibilityTarget?: PollingVisibilityTarget;
}

export interface TrainingJobsResult {
  readonly model: TrainingJobsViewModel;
  readonly actions: TrainingJobsActions;
}

interface CreateVariables {
  readonly body: CreateTrainingJob;
  readonly key: string;
  /** Bộ dữ liệu của phiên bản đã gửi — làm mới N30 khi ô phiên bản lỗi. */
  readonly datasetId: string;
}

const NO_DATASETS: readonly Dataset[] = [];

const versionsOf = (data: readonly DatasetVersion[] | undefined): readonly DatasetVersion[] => data ?? [];

export function useTrainingJobs({
  clock,
  gateway,
  isNarrow = false,
  visibilityTarget,
}: UseTrainingJobsOptions): TrainingJobsResult {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TrainingTabId>('jobs');
  const [familyFilter, setFamilyFilter] = useState<string>(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<string>(FILTER_ALL);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [writeForbidden, setWriteForbidden] = useState(false);
  const [cursorRetried, setCursorRetried] = useState(false);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [detailFocusKey, setDetailFocusKey] = useState(0);
  const [isCancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [isFormOpen, setFormOpen] = useState(false);
  const [formFamily, setFormFamily] = useState<TrainableFamilyId>('wallSegmentation');
  const [formDatasetId, setFormDatasetId] = useState<string | null>(null);
  const [formVersionId, setFormVersionId] = useState<string | null>(null);
  const [formBaseModel, setFormBaseModel] = useState<string | null>(null);
  const [formEpochs, setFormEpochs] = useState<number | undefined>(DEFAULT_TRAINING_EPOCHS);
  const [formErrors, setFormErrors] = useState<CreateFieldErrors>(NO_FIELD_ERRORS);
  /** Khoá N33 + thân chờ gửi lại: ở hook, không ở biểu mẫu, để sống qua đóng/mở. */
  const pendingCreateRef = useRef<CreateAttempt | null>(null);

  const [datasetFamily, setDatasetFamily] = useState<DatasetFamilyId>('wallSegmentation');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);

  const isSessionUnknown = session.status === 'unknown';
  const isAdmin = canManageTraining(session.roles);
  const enabled = !isSessionUnknown && isAdmin && !writeForbidden;

  /* ---- N32 -------------------------------------------------------------- */

  const jobFilter = useMemo(
    () => ({
      ...(familyFilter === FILTER_ALL ? {} : { family: familyFilter }),
      ...(statusFilter === FILTER_ALL ? {} : { status: statusFilter }),
    }),
    [familyFilter, statusFilter],
  );
  const isFiltered = familyFilter !== FILTER_ALL || statusFilter !== FILTER_ALL;

  const jobsQuery = useInfiniteQuery({
    enabled,
    getNextPageParam: (lastPage: CursorList<TrainingJob>) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => gateway.listJobs({ ...jobFilter, cursor: pageParam, signal }),
    queryKey: queryKeys.adminMl.jobs(jobFilter),
    refetchInterval: (query) => {
      const pages = query.state.data?.pages ?? [];
      const hasActive = pages.some((page) => page.items.some((job) => isActiveJob(job.status)));

      return hasActive && pages.length <= JOB_LIST_POLL_MAX_PAGES ? JOB_LIST_POLL_MS : false;
    },
  });

  const jobs = useMemo(
    (): readonly TrainingJob[] => jobsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [jobsQuery.data],
  );

  /* ---- N34 -------------------------------------------------------------- */

  const jobQuery = useQuery({
    enabled: enabled && selectedJobId !== null,
    queryFn: ({ signal }) => gateway.getJob(selectedJobId ?? '', signal),
    queryKey: queryKeys.adminMl.job(selectedJobId ?? ''),
    refetchInterval: (query) => (isActiveJob(query.state.data?.status) ? JOB_STATUS_POLL_MS : false),
  });

  const selectedJob = jobQuery.data ?? jobs.find((job) => job.id === selectedJobId);
  const selectedStatus = selectedJob?.status;
  const previousStatusRef = useRef<JobStatus | undefined>(undefined);

  // Lượt đang xem vừa kết thúc: làm mới danh sách một lần.
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = selectedStatus;

    if (isActiveJob(previous) && selectedStatus !== undefined && !isActiveJob(selectedStatus)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminMl.jobs.root() });
    }
  }, [selectedStatus, queryClient]);

  /* ---- N36 · N37 -------------------------------------------------------- */

  const [stream, dispatch] = useReducer(jobStreamReducer, null, () => emptyJobStream(null));
  const endedRef = useRef(false);
  endedRef.current = selectedStatus !== undefined && !isActiveJob(selectedStatus);

  useEffect(() => {
    // Đổi lượt: xoá sạch TRƯỚC khi hỏi lượt mới; dọn dẹp của lượt cũ đã `stop()`.
    dispatch({ jobId: selectedJobId, type: 'reset' });
    setStreamError(null);

    if (!enabled || selectedJobId === null) return undefined;

    const jobId = selectedJobId;
    const intervalMs = (): number => (endedRef.current ? STREAM_POLL_ENDED_MS : STREAM_POLL_RUNNING_MS);
    const onError = (error: unknown): 'stop' | 'retry' => {
      if (!shouldStopStream(error)) return 'retry';
      setStreamError(describeReadError(error));

      return 'stop';
    };
    const shared = {
      intervalMs,
      onError,
      pageSize: STREAM_PAGE_SIZE,
      ...(clock === undefined ? {} : { clock }),
      ...(visibilityTarget === undefined ? {} : { visibilityTarget }),
    };

    const metrics = startCursorPolling<TrainingMetricPoint>({
      ...shared,
      fetchPage: ({ since, signal }) => gateway.listJobMetrics({ jobId, limit: STREAM_PAGE_SIZE, since, signal }),
      onItems: (items) => dispatch({ items, jobId, type: 'metrics' }),
    });
    const logs = startCursorPolling<TrainingLogLine>({
      ...shared,
      fetchPage: ({ since, signal }) => gateway.listJobLogs({ jobId, limit: STREAM_PAGE_SIZE, since, signal }),
      onItems: (items) => dispatch({ items, jobId, type: 'logs' }),
    });

    return () => {
      metrics.stop();
      logs.stop();
    };
  }, [selectedJobId, enabled, gateway, clock, visibilityTarget]);

  /* ---- N28 · N30 -------------------------------------------------------- */

  const formDatasetsQuery = useQuery({
    enabled: enabled && isFormOpen,
    queryFn: ({ signal }) => readAllPages((cursor) => gateway.listDatasets({ cursor, family: formFamily, signal })),
    queryKey: queryKeys.adminMl.datasets(formFamily),
  });
  const formDatasets = formDatasetsQuery.data ?? NO_DATASETS;
  const effectiveDatasetId = formDatasets.some((dataset) => dataset.id === formDatasetId)
    ? formDatasetId
    : (formDatasets[0]?.id ?? null);

  const formVersionsQuery = useQuery({
    enabled: enabled && isFormOpen && effectiveDatasetId !== null,
    queryFn: ({ signal }) =>
      readAllPages((cursor) => gateway.listDatasetVersions({ cursor, datasetId: effectiveDatasetId ?? '', signal })),
    queryKey: queryKeys.adminMl.datasetVersions(effectiveDatasetId ?? ''),
  });
  const readyVersions = useMemo(
    () => versionsOf(formVersionsQuery.data).filter((version) => version.status === 'ready'),
    [formVersionsQuery.data],
  );
  const effectiveVersionId = readyVersions.some((version) => version.id === formVersionId)
    ? formVersionId
    : (readyVersions[0]?.id ?? null);
  const baseModels: readonly string[] = TRAINING_BASE_MODELS[formFamily];
  const effectiveBaseModel =
    formBaseModel !== null && baseModels.includes(formBaseModel) ? formBaseModel : (baseModels[0] ?? null);

  const tabDatasetsQuery = useQuery({
    enabled: enabled && activeTab === 'datasets',
    queryFn: ({ signal }) => readAllPages((cursor) => gateway.listDatasets({ cursor, family: datasetFamily, signal })),
    queryKey: queryKeys.adminMl.datasets(datasetFamily),
  });
  const tabDatasets = tabDatasetsQuery.data ?? NO_DATASETS;
  const tabDatasetId = tabDatasets.some((dataset) => dataset.id === selectedDatasetId)
    ? selectedDatasetId
    : (tabDatasets[0]?.id ?? null);

  const tabVersionsQuery = useQuery({
    enabled: enabled && activeTab === 'datasets' && tabDatasetId !== null,
    queryFn: ({ signal }) =>
      readAllPages((cursor) => gateway.listDatasetVersions({ cursor, datasetId: tabDatasetId ?? '', signal })),
    queryKey: queryKeys.adminMl.datasetVersions(tabDatasetId ?? ''),
  });

  /* ---- Bảy trạng thái --------------------------------------------------- */

  const isSilentCursorRetry = isCursorInvalidError(jobsQuery.error) && !cursorRetried;
  const jobsReadError = jobsQuery.data === undefined ? jobsQuery.error : null;
  const loadMoreError = jobsQuery.isFetchNextPageError && !isSilentCursorRetry ? jobsQuery.error : null;
  const tabReadError = activeTab === 'jobs' ? jobsReadError : tabDatasetsQuery.error;
  const isForbiddenByServer = [jobsQuery.error, jobQuery.error, tabDatasetsQuery.error].some(isForbiddenError);
  const activeCount = jobs.filter((job) => isActiveJob(job.status)).length;
  const isTabLoading = activeTab === 'jobs' ? jobsQuery.isLoading : tabDatasetsQuery.isLoading;
  const isTabEmpty = activeTab === 'jobs' ? jobs.length === 0 && !isFiltered : tabDatasets.length === 0;

  const state = useMemo((): SevenState => {
    if (isSessionUnknown) return 'loading';
    if (!isAdmin || writeForbidden || isForbiddenByServer) return 'forbidden';
    if (isTabLoading) return 'loading';
    if (tabReadError !== null) return 'error';
    if (isNarrow) return 'collapsed';
    if (isTabEmpty) return 'empty';

    return activeTab === 'jobs' && activeCount > 0 ? 'partial' : 'success';
  }, [
    isSessionUnknown,
    isAdmin,
    writeForbidden,
    isForbiddenByServer,
    isTabLoading,
    tabReadError,
    isNarrow,
    isTabEmpty,
    activeTab,
    activeCount,
  ]);

  /* ---- Tạo -------------------------------------------------------------- */

  const createMutation = useMutation({
    mutationFn: (variables: CreateVariables) =>
      gateway.createJob({ body: variables.body, idempotencyKey: variables.key }),
    onError: (error, variables) => {
      if (isResponseLost(error)) {
        // Không biết máy chủ đã nhận chưa: giữ khoá, và đọc lại danh sách ngay.
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminMl.jobs.root() });
        setFormErrors({ ...NO_FIELD_ERRORS, form: describeWriteError(error) });
        return;
      }

      pendingCreateRef.current = null;

      if (isForbiddenError(error)) {
        setFormOpen(false);
        setWriteForbidden(true);
        return;
      }

      const errors = describeCreateError(error);
      setFormErrors(errors);

      if (errors.version !== null) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminMl.datasetVersions(variables.datasetId) });
      }
    },
    onSuccess: (job) => {
      pendingCreateRef.current = null;
      queryClient.setQueryData(queryKeys.adminMl.job(job.id), job);
      applyInvalidation(queryClient, 'createTrainingJob', {});
      setFormOpen(false);
      setFormErrors(NO_FIELD_ERRORS);
      setFormEpochs(DEFAULT_TRAINING_EPOCHS);
      setActiveTab('jobs');
      setSelectedJobId(job.id);
      setDetailNotice(null);
      gateway.notify({
        description: TRAINING_JOBS_TEXT.createdDescription,
        title: TRAINING_JOBS_TEXT.createdTitle,
        type: 'trainingJobs.created',
      });
    },
  });

  const epochsValid =
    formEpochs !== undefined &&
    Number.isInteger(formEpochs) &&
    formEpochs >= TRAINING_EPOCHS_MIN &&
    formEpochs <= TRAINING_EPOCHS_MAX;
  const canSubmit =
    effectiveVersionId !== null && effectiveBaseModel !== null && epochsValid && !createMutation.isPending;

  const onSubmitForm = useCallback((): void => {
    if (!canSubmit || effectiveVersionId === null || effectiveBaseModel === null || formEpochs === undefined) return;
    if (effectiveDatasetId === null) return;

    const body = {
      baseModel: effectiveBaseModel,
      datasetVersionId: effectiveVersionId,
      epochs: formEpochs,
      family: formFamily,
    } as CreateTrainingJob;
    const attempt = nextCreateAttempt(pendingCreateRef.current, body, gateway.createKey);

    pendingCreateRef.current = attempt;
    setFormErrors(NO_FIELD_ERRORS);
    createMutation.mutate({ body, datasetId: effectiveDatasetId, key: attempt.key });
  }, [
    canSubmit,
    effectiveVersionId,
    effectiveBaseModel,
    effectiveDatasetId,
    formEpochs,
    formFamily,
    gateway,
    createMutation,
  ]);

  /* ---- Huỷ -------------------------------------------------------------- */

  const cancelMutation = useMutation({
    // Mỗi lượt bấm một khoá: khoá sinh trong chính lượt gọi.
    mutationFn: (jobId: string) => gateway.cancelJob({ idempotencyKey: gateway.createKey(), jobId }),
    onError: (error, jobId) => {
      if (isForbiddenError(error)) {
        setCancelOpen(false);
        setWriteForbidden(true);
        return;
      }

      if (isNotCancellableError(error)) {
        setCancelOpen(false);
        setDetailNotice(TRAINING_ERROR_TEXT.notCancellable);
        setDetailFocusKey((key) => key + 1);
        void queryClient.invalidateQueries({ queryKey: queryKeys.adminMl.job(jobId) });
        return;
      }

      setCancelError(describeWriteError(error));
    },
    onSuccess: (job) => {
      queryClient.setQueryData(queryKeys.adminMl.job(job.id), job);
      applyInvalidation(queryClient, 'cancelTrainingJob', { jobId: job.id });
      setCancelOpen(false);
      setCancelError(null);
      setDetailFocusKey((key) => key + 1);
    },
  });

  const onConfirmCancel = useCallback((): void => {
    if (selectedJobId === null || cancelMutation.isPending) return;
    setCancelError(null);
    cancelMutation.mutate(selectedJobId);
  }, [selectedJobId, cancelMutation]);

  /* ---- Việc làm được ---------------------------------------------------- */

  const onSelectJob = useCallback((jobId: string | null): void => {
    setSelectedJobId(jobId);
    setDetailNotice(null);
  }, []);

  const onLoadMore = useCallback((): void => {
    void jobsQuery.fetchNextPage().then(async (result) => {
      if (!isCursorInvalidError(result.error) || cursorRetried) return;
      setCursorRetried(true);
      await queryClient.resetQueries({ exact: true, queryKey: queryKeys.adminMl.jobs(jobFilter) });
    });
  }, [jobsQuery, queryClient, jobFilter, cursorRetried]);

  const onRetry = useCallback((): void => {
    setCursorRetried(false);
    void (activeTab === 'jobs' ? jobsQuery.refetch() : tabDatasetsQuery.refetch());
  }, [activeTab, jobsQuery, tabDatasetsQuery]);

  const onFormFamily = useCallback((family: TrainableFamilyId): void => {
    // Đổi họ xoá mọi lựa chọn sau nó.
    setFormFamily(family);
    setFormDatasetId(null);
    setFormVersionId(null);
    setFormBaseModel(null);
    setFormErrors(NO_FIELD_ERRORS);
  }, []);

  const onFormDataset = useCallback((datasetId: string): void => {
    setFormDatasetId(datasetId);
    setFormVersionId(null);
    setFormErrors(NO_FIELD_ERRORS);
  }, []);

  /* ---- View model ------------------------------------------------------- */

  const model = useMemo((): TrainingJobsViewModel => {
    const nowMs = gateway.now();
    const optionsError = formDatasetsQuery.error ?? formVersionsQuery.error;
    const form: FormModel | null = !isFormOpen
      ? null
      : {
          baseModel: effectiveBaseModel,
          baseModelError: formErrors.baseModel,
          baseModels: baseModels.map((value) => ({ label: value, value })),
          canSubmit,
          datasetId: effectiveDatasetId,
          datasets: formDatasets.map((dataset) => ({ label: dataset.name, value: dataset.id })),
          epochs: formEpochs,
          epochsError: formErrors.epochs ?? (epochsValid ? null : TRAINING_ERROR_TEXT.epochsInvalid),
          epochsMax: TRAINING_EPOCHS_MAX,
          epochsMin: TRAINING_EPOCHS_MIN,
          families: TRAINABLE_FAMILY_OPTIONS,
          family: formFamily,
          formError: formErrors.form ?? (optionsError === null ? null : describeReadError(optionsError)),
          isLoadingOptions: formDatasetsQuery.isLoading || formVersionsQuery.isLoading,
          isSubmitting: createMutation.isPending,
          versionError:
            formErrors.version ??
            (formVersionsQuery.data !== undefined && readyVersions.length === 0 ? TRAINING_JOBS_TEXT.noReadyVersion : null),
          versionId: effectiveVersionId,
          versions: readyVersions.map((version) => ({
            label: `${TRAINING_JOBS_TEXT.fieldDatasetVersion} ${formatNumber(version.sequence)}`,
            value: version.id,
          })),
        };

    const tabVersions = versionsOf(tabVersionsQuery.data);

    return {
      activeTab,
      cancelDialog: isCancelOpen ? { errorMessage: cancelError, isSubmitting: cancelMutation.isPending } : null,
      datasets: {
        datasets: tabDatasets.map((dataset) => ({
          isSelected: dataset.id === tabDatasetId,
          label: dataset.name,
          value: dataset.id,
        })),
        families: DATASET_FAMILY_OPTIONS,
        family: datasetFamily,
        isLoadingVersions: tabVersionsQuery.isLoading,
        versionRows: tabVersions.map((version) => buildDatasetVersionRow(version, nowMs)),
        versionsError: tabVersionsQuery.error === null ? null : describeReadError(tabVersionsQuery.error),
      },
      detail:
        selectedJobId === null
          ? null
          : buildJobDetail({
              focusKey: detailFocusKey,
              isLoading: jobQuery.isLoading,
              job: selectedJob,
              notice: detailNotice ?? streamError ?? (jobQuery.error === null ? null : describeReadError(jobQuery.error)),
              nowMs,
              stream: {
                logs: stream.logs,
                metrics: stream.metrics,
                summary: selectedJob === undefined ? null : metricsSummary(stream, SCORE_NAME[selectedJob.family]),
              },
            }),
      emptyMessage:
        activeTab === 'datasets'
          ? TRAINING_JOBS_TEXT.emptyDatasets
          : isFiltered
            ? TRAINING_JOBS_TEXT.emptyFiltered
            : TRAINING_JOBS_TEXT.emptyJobs,
      errorMessage: tabReadError === null ? null : describeReadError(tabReadError),
      familyFilter,
      familyFilters: FAMILY_FILTERS,
      form,
      hasMore: jobsQuery.hasNextPage,
      isCollapsed: isNarrow,
      isLoadingMore: jobsQuery.isFetchingNextPage,
      loadMoreError: loadMoreError === null ? null : describeReadError(loadMoreError),
      partialNotice: activeCount > 0 ? partialNotice(activeCount) : null,
      relatedLink: RELATED_LINK,
      rows: jobs.map((job) => buildJobRow(job, nowMs, selectedJobId)),
      skeletonRowCount: SKELETON_ROW_COUNT,
      state,
      statusFilter,
      statusFilters: STATUS_FILTERS,
    };
  }, [
    gateway,
    isFormOpen,
    effectiveBaseModel,
    formErrors,
    baseModels,
    canSubmit,
    effectiveDatasetId,
    formDatasets,
    formEpochs,
    epochsValid,
    formFamily,
    formDatasetsQuery.error,
    formDatasetsQuery.isLoading,
    formVersionsQuery.error,
    formVersionsQuery.isLoading,
    formVersionsQuery.data,
    createMutation.isPending,
    readyVersions,
    effectiveVersionId,
    tabVersionsQuery.data,
    tabVersionsQuery.isLoading,
    tabVersionsQuery.error,
    activeTab,
    isCancelOpen,
    cancelError,
    cancelMutation.isPending,
    tabDatasets,
    tabDatasetId,
    datasetFamily,
    selectedJob,
    selectedJobId,
    detailFocusKey,
    detailNotice,
    streamError,
    jobQuery.error,
    jobQuery.isLoading,
    stream,
    isFiltered,
    tabReadError,
    familyFilter,
    jobsQuery.hasNextPage,
    jobsQuery.isFetchingNextPage,
    isNarrow,
    loadMoreError,
    activeCount,
    jobs,
    state,
    statusFilter,
  ]);

  const actions = useMemo(
    (): TrainingJobsActions => ({
      onCloseCancel: () => {
        setCancelOpen(false);
        setCancelError(null);
      },
      onCloseForm: () => setFormOpen(false),
      onConfirmCancel,
      onFilterFamily: (value) => {
        setCursorRetried(false);
        setFamilyFilter(value);
      },
      onFilterStatus: (value) => {
        setCursorRetried(false);
        setStatusFilter(value);
      },
      onFormBaseModel: (value) => {
        setFormBaseModel(value);
        setFormErrors(NO_FIELD_ERRORS);
      },
      onFormDataset,
      onFormEpochs: (value) => {
        setFormEpochs(value);
        setFormErrors(NO_FIELD_ERRORS);
      },
      onFormFamily,
      onFormVersion: (value) => {
        setFormVersionId(value);
        setFormErrors(NO_FIELD_ERRORS);
      },
      onLoadMore,
      onOpenForm: () => {
        setFormErrors(NO_FIELD_ERRORS);
        setFormOpen(true);
      },
      onRequestCancel: () => {
        setCancelError(null);
        setCancelOpen(true);
      },
      onRetry,
      onSelectDataset: setSelectedDatasetId,
      onSelectDatasetFamily: (family) => {
        setDatasetFamily(family);
        setSelectedDatasetId(null);
      },
      onSelectJob,
      onSelectTab: setActiveTab,
      onSubmitForm,
    }),
    [onConfirmCancel, onFormDataset, onFormFamily, onLoadMore, onRetry, onSelectJob, onSubmitForm],
  );

  return { actions, model };
}

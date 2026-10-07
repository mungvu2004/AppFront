/**
 * Bảy kịch bản của {@link TrainingJobsViewModel} (A11), dữ liệu thuần — không React, không
 * mạng, không `vitest`. `TrainingJobs.test.tsx` và `TrainingJobs.stories.tsx` nhập chung.
 *
 * Dựng bằng CHÍNH các hàm dựng của `useTrainingJobs.ts` trên CHÍNH bộ mẫu của
 * `src/api/__mocks__/adminMlJobsClient.ts`, nên không chuỗi hay số nào được gõ lại ở đây.
 */

import {
  MOCK_DATASETS,
  MOCK_DATASET_VERSIONS,
  MOCK_TRAINING_IDS,
  MOCK_TRAINING_JOBS,
} from '@/api/__mocks__/adminMlJobsClient';
import type { TrainingJob, TrainingLogLine, TrainingMetricPoint } from '@/api/adminMlJobsClient';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { TRAINING_ERROR_TEXT } from './trainingJobsGateway';
import { emptyJobStream, jobStreamReducer, metricsSummary } from './trainingMetricsModel';
import { FILTER_ALL, type TrainingJobsActions, type TrainingJobsViewModel } from './types';
import {
  DATASET_FAMILY_OPTIONS,
  FAMILY_FILTERS,
  RELATED_LINK,
  SKELETON_ROW_COUNT,
  STATUS_FILTERS,
  TRAINING_JOBS_TEXT,
  buildDatasetVersionRow,
  buildJobDetail,
  buildJobRow,
  isActiveJob,
  partialNotice,
} from './useTrainingJobs';

/** Mốc cố định cho mọi nhãn thời gian, để ảnh chụp không đổi theo giờ máy chạy. */
export const TRAINING_JOBS_SCENARIO_NOW = Date.parse('2026-10-05T03:00:00.000Z');

const IDS = MOCK_TRAINING_IDS;

const SAMPLE_METRICS: readonly TrainingMetricPoint[] = [
  { epoch: 11, loss: 0.0833, recordedAt: '2026-10-05T01:11:05.000Z', split: 'train', step: 1100 },
  { epoch: 11, iou: 0.712, recordedAt: '2026-10-05T01:11:05.000Z', split: 'validation', step: 1100 },
  { epoch: 12, loss: 0.0769, recordedAt: '2026-10-05T01:12:05.000Z', split: 'train', step: 1200 },
  { epoch: 12, iou: 0.705, recordedAt: '2026-10-05T01:12:05.000Z', split: 'validation', step: 1200 },
];

const SAMPLE_LOGS: readonly TrainingLogLine[] = [
  { at: '2026-10-05T01:11:05.000Z', level: 'info', message: 'Vòng 11: đã xử lý lô 22.', seq: 21 },
  { at: '2026-10-05T01:12:05.000Z', level: 'warning', message: 'Vòng 12: số đo kiểm định giảm.', seq: 22 },
];

function streamOf(job: TrainingJob, withStream: boolean) {
  if (!withStream) return { logs: [], metrics: [], summary: null };

  let state = jobStreamReducer(emptyJobStream(job.id), { items: SAMPLE_METRICS, jobId: job.id, type: 'metrics' });
  state = jobStreamReducer(state, { items: SAMPLE_LOGS, jobId: job.id, type: 'logs' });

  return { logs: state.logs, metrics: state.metrics, summary: metricsSummary(state, 'IoU') };
}

function scenario(
  state: SevenState,
  options: {
    readonly jobs?: readonly TrainingJob[];
    readonly selectedId?: string | null;
    readonly isCollapsed?: boolean;
    readonly errorMessage?: string | null;
  } = {},
): TrainingJobsViewModel {
  const hasData = state !== 'loading' && state !== 'error' && state !== 'forbidden';
  const jobs = hasData ? (options.jobs ?? MOCK_TRAINING_JOBS) : [];
  const selectedId = options.selectedId ?? null;
  const selected = MOCK_TRAINING_JOBS.find((job) => job.id === selectedId);
  const active = jobs.filter((job) => isActiveJob(job.status)).length;
  const wallDatasets = MOCK_DATASETS.filter((dataset) => dataset.family === 'wallSegmentation');

  return {
    activeTab: 'jobs',
    cancelDialog: null,
    datasets: {
      datasets: wallDatasets.map((dataset, index) => ({ isSelected: index === 0, label: dataset.name, value: dataset.id })),
      families: DATASET_FAMILY_OPTIONS,
      family: 'wallSegmentation',
      isLoadingVersions: false,
      versionRows: MOCK_DATASET_VERSIONS.filter((version) => version.datasetId === IDS.datasets.wall).map((version) =>
        buildDatasetVersionRow(version, TRAINING_JOBS_SCENARIO_NOW),
      ),
      versionsError: null,
    },
    detail:
      selected === undefined || !hasData
        ? null
        : buildJobDetail({
            focusKey: 0,
            isLoading: false,
            job: selected,
            notice: null,
            nowMs: TRAINING_JOBS_SCENARIO_NOW,
            stream: streamOf(selected, selected.status === 'running'),
          }),
    emptyMessage: TRAINING_JOBS_TEXT.emptyJobs,
    errorMessage: options.errorMessage ?? null,
    familyFilter: FILTER_ALL,
    familyFilters: FAMILY_FILTERS,
    form: null,
    hasMore: false,
    isCollapsed: options.isCollapsed ?? false,
    isLoadingMore: false,
    loadMoreError: null,
    partialNotice: active > 0 ? partialNotice(active) : null,
    relatedLink: RELATED_LINK,
    rows: jobs.map((job) => buildJobRow(job, TRAINING_JOBS_SCENARIO_NOW, selectedId)),
    skeletonRowCount: SKELETON_ROW_COUNT,
    state,
    statusFilter: FILTER_ALL,
    statusFilters: STATUS_FILTERS,
  };
}

export const TRAINING_JOBS_SCENARIO_EMPTY = scenario('empty', { jobs: [] });

export const TRAINING_JOBS_SCENARIO_LOADING = scenario('loading');

export const TRAINING_JOBS_SCENARIO_PARTIAL = scenario('partial', { selectedId: IDS.jobs.running });

export const TRAINING_JOBS_SCENARIO_ERROR = scenario('error', { errorMessage: TRAINING_ERROR_TEXT.busy });

export const TRAINING_JOBS_SCENARIO_SUCCESS = scenario('success', {
  jobs: MOCK_TRAINING_JOBS.filter((job) => !isActiveJob(job.status)),
  selectedId: IDS.jobs.failed,
});

export const TRAINING_JOBS_SCENARIO_FORBIDDEN = scenario('forbidden');

export const TRAINING_JOBS_SCENARIO_COLLAPSED = scenario('collapsed', {
  isCollapsed: true,
  selectedId: IDS.jobs.succeeded,
});

export const TRAINING_JOBS_SCENARIOS: Readonly<Record<SevenState, TrainingJobsViewModel>> = {
  collapsed: TRAINING_JOBS_SCENARIO_COLLAPSED,
  empty: TRAINING_JOBS_SCENARIO_EMPTY,
  error: TRAINING_JOBS_SCENARIO_ERROR,
  forbidden: TRAINING_JOBS_SCENARIO_FORBIDDEN,
  loading: TRAINING_JOBS_SCENARIO_LOADING,
  partial: TRAINING_JOBS_SCENARIO_PARTIAL,
  success: TRAINING_JOBS_SCENARIO_SUCCESS,
};

const noop = (): void => undefined;

/** Hành động không làm gì — cho story; bài kiểm cần đếm lời gọi thì tự dựng bằng `vi.fn()`. */
export const TRAINING_JOBS_ACTIONS: TrainingJobsActions = {
  onCloseCancel: noop,
  onCloseForm: noop,
  onConfirmCancel: noop,
  onFilterFamily: noop,
  onFilterStatus: noop,
  onFormBaseModel: noop,
  onFormDataset: noop,
  onFormEpochs: noop,
  onFormFamily: noop,
  onFormVersion: noop,
  onLoadMore: noop,
  onOpenForm: noop,
  onRequestCancel: noop,
  onRetry: noop,
  onSelectDataset: noop,
  onSelectDatasetFamily: noop,
  onSelectJob: noop,
  onSelectTab: noop,
  onSubmitForm: noop,
};

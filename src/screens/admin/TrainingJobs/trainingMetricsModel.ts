/**
 * Số đo (N36) và nhật ký (N37) của MỘT lượt huấn luyện: reducer thuần và các hàm dựng hàng.
 *
 * Reducer khoá theo `jobId`: hành động của lượt khác lượt đang giữ bị bỏ, `reset` xoá sạch.
 * Bỏ trùng theo `(jobId, split, step)` và `(jobId, seq)`. Máy chủ trả `step`, `seq` tăng dần
 * (`B6-03a`), nên "đã thấy" là "không lớn hơn số lớn nhất đã nhận" — O(1) mỗi điểm thay cho
 * một tập khoá lớn dần tới 200 000 phần tử.
 *
 * Chỉ giữ {@link METRIC_POINTS_KEPT} điểm mới nhất để vẽ bảng, nhưng "tốt nhất" tính trên MỌI
 * điểm đã nhận.
 */

import type { TrainingLogLine, TrainingMetricPoint } from '@/api/adminMlJobsClient';
import { formatTimestamp } from '@/lib/format/datetime';
import { formatNumber, MISSING_VALUE } from '@/lib/format/number';

import type { LogRowModel, MetricRowModel, StatusBadgeVariant } from './types';

export const METRIC_POINTS_KEPT = 2_000;
/** Cùng trần cho nhật ký: bảng ảo không cần hơn, bộ nhớ không phình theo lượt dài. */
export const LOG_LINES_KEPT = 2_000;

const LOSS_FRACTION_DIGITS = 4;
const SCORE_FRACTION_DIGITS = 3;

type Split = TrainingMetricPoint['split'];

export interface JobStreamState {
  readonly jobId: string | null;
  readonly metrics: readonly TrainingMetricPoint[];
  readonly logs: readonly TrainingLogLine[];
  readonly lastStep: Readonly<Record<Split, number>>;
  readonly lastSeq: number;
  /** Điểm kiểm định có IoU/mAP50 lớn nhất trong mọi điểm đã nhận. */
  readonly best: TrainingMetricPoint | null;
  readonly latest: TrainingMetricPoint | null;
}

export type JobStreamAction =
  | { readonly type: 'reset'; readonly jobId: string | null }
  | { readonly type: 'metrics'; readonly jobId: string; readonly items: readonly TrainingMetricPoint[] }
  | { readonly type: 'logs'; readonly jobId: string; readonly items: readonly TrainingLogLine[] };

export const emptyJobStream = (jobId: string | null): JobStreamState => ({
  best: null,
  jobId,
  lastSeq: -1,
  lastStep: { train: -1, validation: -1 },
  latest: null,
  logs: [],
  metrics: [],
});

export const scoreOf = (point: TrainingMetricPoint): number | undefined => point.iou ?? point.map50;

const keepLast = <T>(items: readonly T[], limit: number): readonly T[] =>
  items.length > limit ? items.slice(items.length - limit) : items;

function addMetrics(state: JobStreamState, items: readonly TrainingMetricPoint[]): JobStreamState {
  const lastStep = { ...state.lastStep };
  let best = state.best;
  const fresh: TrainingMetricPoint[] = [];

  for (const point of items) {
    if (point.step <= lastStep[point.split]) continue;
    lastStep[point.split] = point.step;
    fresh.push(point);

    const score = scoreOf(point);
    const bestScore = best === null ? undefined : scoreOf(best);
    if (point.split === 'validation' && score !== undefined && (bestScore === undefined || score > bestScore)) {
      best = point;
    }
  }

  if (fresh.length === 0) return state;

  return {
    ...state,
    best,
    lastStep,
    latest: fresh[fresh.length - 1] ?? state.latest,
    metrics: keepLast([...state.metrics, ...fresh], METRIC_POINTS_KEPT),
  };
}

function addLogs(state: JobStreamState, items: readonly TrainingLogLine[]): JobStreamState {
  let lastSeq = state.lastSeq;
  const fresh: TrainingLogLine[] = [];

  for (const line of items) {
    if (line.seq <= lastSeq) continue;
    lastSeq = line.seq;
    fresh.push(line);
  }

  return fresh.length === 0 ? state : { ...state, lastSeq, logs: keepLast([...state.logs, ...fresh], LOG_LINES_KEPT) };
}

export function jobStreamReducer(state: JobStreamState, action: JobStreamAction): JobStreamState {
  if (action.type === 'reset') return emptyJobStream(action.jobId);
  if (action.jobId !== state.jobId) return state;

  return action.type === 'metrics' ? addMetrics(state, action.items) : addLogs(state, action.items);
}

/* -------------------------------------------------------------------------- */
/* Hàng của bảng — định dạng ở đây, không ở view (A15).                        */
/* -------------------------------------------------------------------------- */

const SPLIT_LABEL: Readonly<Record<Split, string>> = { train: 'Huấn luyện', validation: 'Kiểm định' };

const LOG_LEVEL: Readonly<Record<TrainingLogLine['level'], { readonly label: string; readonly variant: StatusBadgeVariant }>> = {
  info: { label: 'Thông tin', variant: 'neutral' },
  warning: { label: 'Cảnh báo', variant: 'attention' },
  error: { label: 'Lỗi', variant: 'violation' },
};

const formatLoss = (value: number | undefined): string =>
  value === undefined ? MISSING_VALUE : formatNumber(value, { fractionDigits: LOSS_FRACTION_DIGITS });

const formatScore = (value: number | undefined): string =>
  value === undefined ? MISSING_VALUE : formatNumber(value, { fractionDigits: SCORE_FRACTION_DIGITS });

export function buildMetricRow(point: TrainingMetricPoint, nowMs: number): MetricRowModel {
  return {
    at: formatTimestamp(Date.parse(point.recordedAt), nowMs),
    epoch: formatNumber(point.epoch),
    id: `${point.split}-${String(point.step)}`,
    loss: formatLoss(point.loss),
    score: formatScore(scoreOf(point)),
    split: SPLIT_LABEL[point.split],
    step: formatNumber(point.step),
  };
}

export function buildLogRow(line: TrainingLogLine, nowMs: number): LogRowModel {
  return {
    at: formatTimestamp(Date.parse(line.at), nowMs),
    id: String(line.seq),
    levelLabel: LOG_LEVEL[line.level].label,
    levelVariant: LOG_LEVEL[line.level].variant,
    message: line.message,
  };
}

function describePoint(point: TrainingMetricPoint, scoreName: string): string {
  const parts = [`vòng ${formatNumber(point.epoch)}`];
  if (point.loss !== undefined) parts.push(`loss ${formatLoss(point.loss)}`);
  const score = scoreOf(point);
  if (score !== undefined) parts.push(`${scoreName} ${formatScore(score)}`);

  return parts.join(', ');
}

/** Dòng "Mới nhất · Tốt nhất"; `null` khi chưa có điểm nào. */
export function metricsSummary(state: JobStreamState, scoreName: string): string | null {
  if (state.latest === null) return null;

  const latest = `Mới nhất: ${describePoint(state.latest, scoreName)}`;

  return state.best === null ? latest : `${latest} · Tốt nhất: ${describePoint(state.best, scoreName)}`;
}

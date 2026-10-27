/**
 * MỘT nguồn trạng thái cho chip `.state`, tiêu đề khung bước, hàng điều kiện của
 * cổng và nút chính (NGUYEN-TAC-BO-CUC §1). Hàm thuần trên `ProcessingScreenProps`,
 * không chạm tầng dữ liệu nào.
 *
 * Quyết định của chủ dự án: tỷ lệ bản vẽ là ĐIỀU KIỆN CHẶN. Xong mà chưa có tỷ lệ
 * (0 chuỗi kích thước, hoặc chưa đọc được số liệu) thì nút chính là "Hiệu chỉnh tỷ
 * lệ", không mời sang Duyệt tầng.
 */

import type { ProcessingReviewReason, ProcessingScreenProps } from './types';

export type ProcessingGateKind = 'running' | 'needs-scale' | 'needs-review' | 'ready' | 'error';

export interface ProcessingGateAction {
  readonly label: string;
  readonly note?: string;
  readonly isForward: boolean;
  readonly onClick: () => void;
}

/** Một lý do "cần xem lại" (N16 `readiness`): câu cho người đọc và màn sửa được nó. */
export interface ProcessingGateReviewRow {
  readonly reason: ProcessingReviewReason;
  readonly sentence: string;
  /** `scale` → nút Đặt tỷ lệ; `review` → nút Sang Duyệt tầng. */
  readonly target: 'scale' | 'review';
}

export interface ProcessingGateModel {
  readonly kind: ProcessingGateKind;
  readonly chipLabel: string;
  readonly chipVariant: 'neutral' | 'attention' | 'verified' | 'violation';
  readonly title: string;
  readonly doneStepsLabel: string;
  readonly isAiDone: boolean;
  readonly scaleValue: string;
  readonly scaleNote?: string;
  readonly isScaleOk: boolean;
  readonly action?: ProcessingGateAction;
  /** Tỷ lệ chưa kiểm (máy đoán/mặc định): lối đi tiếp mềm, không chặn cứng. */
  readonly secondaryAction?: ProcessingGateAction;
  /** Kết quả hiện trên hàng bước, theo `step.id`. */
  readonly resultByStepId: ReadonlyMap<string, string>;
  readonly warnStepIds: readonly string[];
  /** Có khi `kind` là `needs-review`: mỗi lý do một dòng. */
  readonly reviewRows?: readonly ProcessingGateReviewRow[];
}

export const GATE_LABEL = 'Để sang Duyệt tầng';
export const CALIBRATE_LABEL = 'Đặt tỷ lệ';
export const GO_REVIEW_LABEL = 'Sang Duyệt tầng';
export const WAITING_NOTE = 'Khi AI xong, nút sang Duyệt tầng hiện ở đây.';

const NO_DIMENSION_NOTE = 'Không đọc được số kích thước nào';
const NO_METRIC_NOTE = 'Chưa đọc được số liệu của lượt xử lý';
const CALIBRATE_NOTE = 'Đo một đoạn đã biết chiều dài, khoảng 1 phút.';

/** Câu cho từng lý do của N16 `readiness` (FIX-P0-15, thiết kế H5 §2.2). */
export const REVIEW_REASON_SENTENCE: Readonly<Record<ProcessingReviewReason, string>> = {
  scaleUnresolved: 'Tỷ lệ bản vẽ mới là tạm, chưa ai kiểm: kích thước và diện tích có thể sai.',
  criticalIssues: 'Mô hình còn lỗi nghiêm trọng cần sửa ở Duyệt tầng.',
  fallbackWallModel: 'Tường được dò bằng mô hình dự phòng, độ chính xác thấp hơn: nên kiểm lại tường.',
  fallbackObjectModel: 'Cửa và đồ vật được dò bằng mô hình dự phòng, có thể thiếu hoặc sai chỗ.',
  fallbackTextModel: 'Chữ và số kích thước được đọc bằng mô hình dự phòng, có thể đọc sai.',
};

/** Thứ tự `metricLabels` của hook: tường, "cửa, nội thất", chuỗi kích thước, phòng, diện tích. */
function resultsOf(props: ProcessingScreenProps): ReadonlyMap<string, string> {
  const metrics = props.summary?.metricLabels ?? [];
  // ponytail: số liệu là TỔNG mọi tầng, chỉ gắn lên hàng bước khi dự án có một tầng;
  // nhiều tầng cần kết quả từng bước theo tầng (CẦN BE `stepDetails`).
  if (props.state !== 'success' || metrics.length < 5 || props.floors.length > 1) return new Map();
  const [walls, objects, dimensions, rooms, area] = metrics;
  return new Map([
    ['wallSegmentation', walls ?? ''],
    ['openingAndFurnitureDetection', objects ?? ''],
    ['dimensionReading', dimensions ?? ''],
    ['spatialDataBuild', `${rooms ?? ''}, ${area ?? ''}`],
  ]);
}

export function deriveProcessingGate(props: ProcessingScreenProps): ProcessingGateModel {
  const total = props.steps.length;
  const done = props.steps.filter((step) => step.status === 'done').length;
  const runningIndex = props.steps.findIndex((step) => step.status === 'running');
  const doneStepsLabel = `${String(done)}/${String(total)} bước`;
  const isAiDone = props.state === 'success';
  const summary = props.summary;
  const noDimension = summary?.noDimensionSentence !== undefined;
  // Tầng đã có tỷ lệ đặt tay thì không thiếu, dù không đọc được chuỗi kích thước.
  const scaleKnown = summary?.scaleKnown === true;
  const scaleMissing = !scaleKnown && (noDimension || (summary?.metricLabels.length ?? 0) === 0);
  const base = {
    doneStepsLabel,
    isAiDone,
    resultByStepId: resultsOf(props),
    warnStepIds: isAiDone && noDimension && !scaleKnown ? ['dimensionReading'] : [],
  };

  if (props.state === 'error') {
    return {
      ...base,
      kind: 'error',
      chipLabel: 'Không đọc được tiến độ',
      chipVariant: 'violation',
      title: 'Chưa đọc được các bước',
      scaleValue: 'Chờ AI xong',
      isScaleOk: false,
    };
  }

  if (!isAiDone) {
    return {
      ...base,
      kind: 'running',
      chipLabel: `Đang chạy ${doneStepsLabel} xong`,
      chipVariant: 'neutral',
      title:
        runningIndex < 0
          ? 'AI đang chờ chạy'
          : `AI đang chạy bước ${String(runningIndex + 1)}/${String(total)}`,
      scaleValue: 'Chờ AI đọc kích thước',
      isScaleOk: false,
    };
  }

  if (scaleMissing || summary === undefined) {
    return {
      ...base,
      kind: 'needs-scale',
      chipLabel: 'Xong · tỷ lệ chưa kiểm',
      chipVariant: 'attention',
      title: 'Còn 1 việc: đặt tỷ lệ',
      scaleValue: 'Chưa có',
      scaleNote: noDimension ? NO_DIMENSION_NOTE : NO_METRIC_NOTE,
      isScaleOk: false,
      ...(summary !== undefined
        ? {
            action: {
              label: CALIBRATE_LABEL,
              note: CALIBRATE_NOTE,
              isForward: false,
              onClick: summary.onCalibrateScale,
            },
            secondaryAction: { label: GO_REVIEW_LABEL, isForward: true, onClick: summary.onReviewWalls },
          }
        : {}),
    };
  }

  // `needsReview` không bao giờ ra 'ready' (FIX-P0-15): tỷ lệ tạm mà có kích thước từng báo "Sẵn sàng".
  const reasons: readonly ProcessingReviewReason[] = summary.reviewReasons ?? [];
  if (reasons.length > 0) {
    const isScaleUnresolved = reasons.includes('scaleUnresolved');
    const calibrate = {
      label: CALIBRATE_LABEL,
      note: CALIBRATE_NOTE,
      isForward: false,
      onClick: summary.onCalibrateScale,
    };
    const review = { label: GO_REVIEW_LABEL, isForward: true, onClick: summary.onReviewWalls };
    return {
      ...base,
      kind: 'needs-review',
      chipLabel: 'Xong · cần xem lại',
      chipVariant: 'attention',
      title: reasons.length === 1 ? 'Còn 1 việc cần xem lại' : `Còn ${String(reasons.length)} việc cần xem lại`,
      scaleValue: isScaleUnresolved ? 'Tạm, chưa kiểm' : 'Suy từ chuỗi kích thước',
      isScaleOk: !isScaleUnresolved,
      reviewRows: reasons.map((reason): ProcessingGateReviewRow => ({
        reason,
        sentence: REVIEW_REASON_SENTENCE[reason],
        target: reason === 'scaleUnresolved' ? 'scale' : 'review',
      })),
      // Đặt tỷ lệ đi trước; Duyệt tầng vẫn mở (lối mềm như tỷ lệ chưa kiểm, không chặn cứng).
      action: isScaleUnresolved ? calibrate : review,
      ...(isScaleUnresolved ? { secondaryAction: review } : {}),
    };
  }

  return {
    ...base,
    kind: 'ready',
    chipLabel: `Xong ${doneStepsLabel}`,
    chipVariant: 'verified',
    title: 'Sẵn sàng duyệt tầng',
    scaleValue: scaleKnown && noDimension ? 'Đã đặt' : 'Suy từ chuỗi kích thước',
    isScaleOk: true,
    action: { label: GO_REVIEW_LABEL, isForward: true, onClick: summary.onReviewWalls },
  };
}

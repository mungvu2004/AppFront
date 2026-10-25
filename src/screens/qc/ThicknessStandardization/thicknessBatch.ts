/**
 * Lô chuẩn hoá của màn S-21 (bản Z): các nhóm đổi về chuẩn (thang sáu bậc), danh sách đoạn xem tay, câu trạng
 * thái và câu tóm tắt lô. THUẦN — chỉ ghép từ các dòng `ThicknessSegmentRow` mà cổng đã tính
 * (nhóm, dung sai, xem tay), không so ngưỡng lần thứ hai.
 *
 * Tường đã duyệt KHÔNG vào lô (không bao giờ ghi đè im lặng việc của người duyệt); câu tóm tắt
 * nói rõ số đó. Muốn đổi một tường đã duyệt thì dùng bảng từng đoạn.
 */

import type { WallId } from '@/domain/spatial/types';
import { formatCount } from '@/lib/commands/business/shared';

import { isApplicable } from './thicknessStandardizationGateway';
import {
  THICKNESS_GROUPS_MM,
  thicknessGroupLabel,
  type ThicknessGroup,
  type ThicknessSegmentRow,
  type ThicknessSummary,
} from './thicknessTypes';

/** Một nhóm đổi về chuẩn: khoảng đo thật, đích, số đoạn sẽ đổi. */
export interface ThicknessTargetGroupRow {
  readonly group: ThicknessGroup;
  /** Ví dụ "141–163 mm" — khoảng số đo THẬT của các đoạn trong nhóm. */
  readonly rangeLabel: string;
  readonly targetLabel: string;
  readonly wallCount: number;
  readonly wallIds: readonly WallId[];
  /** Mọi số đo của nhóm đã được tích. Mặc định `false` (không tích sẵn). */
  readonly accepted: boolean;
  /** Các số đo của nhóm — để tích/bỏ tích cả nhóm qua `acceptedMeasurements`. */
  readonly measurements: readonly number[];
}

/** Một đoạn lô không đổi, cần người xem tay. */
export interface ThicknessManualRow {
  readonly wallId: WallId;
  readonly code: string;
  readonly measuredLabel: string;
  readonly reasonLabel: string;
}

/** Phần lô của màn (bản Z) mà hook cấp thêm cho view. */
export interface ThicknessBatchProps {
  readonly targetGroups: readonly ThicknessTargetGroupRow[];
  readonly manualRows: readonly ThicknessManualRow[];
  /** Số đoạn nút "Đổi" sẽ đổi (nhóm đã tích). */
  readonly batchCount: number;
  /** Số đoạn của mọi nhóm, đã tích hay chưa. */
  readonly candidateCount: number;
  readonly batchSentence: string;
  readonly statusSentence: string;
  readonly batchStatus: ThicknessBatchStatus;
  /** Trạng thái lưu đã định dạng ("Đã lưu 14:02"). */
  readonly saveLabel: string | null;
  readonly reviewedCount: number;
  readonly onToggleGroupAccepted: (group: ThicknessGroup, accepted: boolean) => void;
  readonly onAcceptAllGroups: () => void;
  /** Đổi cả lô đã tích — MỘT lượt chạy, MỘT bước hoàn tác. */
  readonly onApplyBatch: () => void;
  /** Mở một đoạn ở màn duyệt tường (chọn sẵn đoạn đó). */
  readonly onOpenWall: (wallId: WallId) => void;
}

export const THICKNESS_BATCH_TEXT = {
  column: 'Dày bất thường, có thể là cột BTCT',
  statusPending: 'Chưa chuẩn hoá',
  statusManual: 'Còn đoạn xem tay',
  statusDone: 'Đã chuẩn hoá',
  statusEmpty: 'Chưa có số đo',
  idle: 'Chưa đổi gì. Tích nhóm muốn đổi, bản vẽ sáng các đoạn của nhóm khi rê chuột.',
  nothingLeft: 'Không còn đoạn nào cần đổi.',
} as const;

/** Dòng nằm trong lô: áp được và chưa được người duyệt xác nhận. */
export const isBatchCandidate = (row: ThicknessSegmentRow): boolean => isApplicable(row) && !row.reviewed;

const rangeLabelOf = (values: readonly number[]): string => {
  const low = Math.round(Math.min(...values));
  const high = Math.round(Math.max(...values));

  return low === high ? `${String(low)} mm` : `${String(low)}–${String(high)} mm`;
};

/** Các bậc của thang sáu bậc (chỉ bậc có đoạn), theo thứ tự 100 → 400. */
export function toTargetGroups(
  rows: readonly ThicknessSegmentRow[],
  acceptedMeasurements: ReadonlySet<number>,
): readonly ThicknessTargetGroupRow[] {
  const candidates = rows.filter(isBatchCandidate);

  return THICKNESS_GROUPS_MM.flatMap((group) => {
    const inGroup = candidates.filter((row) => row.normalizedGroup === group);

    if (inGroup.length === 0) {
      return [];
    }

    const measurements = [...new Set(inGroup.map((row) => row.measuredMm))];

    return [
      {
        group,
        rangeLabel: rangeLabelOf(measurements),
        targetLabel: thicknessGroupLabel(group),
        wallCount: inGroup.length,
        wallIds: inGroup.map((row) => row.wallId),
        accepted: measurements.every((value) => acceptedMeasurements.has(value)),
        measurements,
      },
    ];
  });
}

/** Các đoạn xem tay, mỗi đoạn một lý do. */
export function toManualRows(rows: readonly ThicknessSegmentRow[]): readonly ThicknessManualRow[] {
  return rows.flatMap((row) =>
    row.manualReview == null
      ? []
      : [
          {
            wallId: row.wallId,
            code: row.code,
            measuredLabel: `${String(Math.round(row.measuredMm))} mm`,
            reasonLabel: THICKNESS_BATCH_TEXT[row.manualReview],
          },
        ],
  );
}

/** Các đoạn "Đổi" sẽ thật sự đổi: trong nhóm đã tích. */
export function batchRowsOf(
  rows: readonly ThicknessSegmentRow[],
  acceptedMeasurements: ReadonlySet<number>,
): readonly ThicknessSegmentRow[] {
  return rows.filter((row) => isBatchCandidate(row) && acceptedMeasurements.has(row.measuredMm));
}

/** "51/81 đoạn không chuẩn, 30 đúng chuẩn" — đếm từ bốn con số của cổng. */
export function statusSentenceOf(summary: ThicknessSummary): string {
  const nonStandard = summary.segmentCount - summary.normalizedCount;

  return `${formatCount(nonStandard)}/${formatCount(summary.segmentCount)} đoạn không chuẩn, ${formatCount(summary.normalizedCount)} đúng chuẩn`;
}

export type ThicknessBatchStatus = 'empty' | 'pending' | 'manual' | 'done';

export function batchStatusOf(segmentCount: number, candidateCount: number, manualCount: number): ThicknessBatchStatus {
  if (segmentCount === 0) return 'empty';
  if (candidateCount > 0) return 'pending';
  return manualCount > 0 ? 'manual' : 'done';
}

/** Câu tóm tắt cạnh nút chính — ghép từ số đếm, không chuỗi cứng có số. */
export function batchSentenceOf(input: {
  readonly batchCount: number;
  readonly groupCount: number;
  readonly candidateCount: number;
  readonly manualCount: number;
  readonly reviewedCount: number;
}): string {
  const tail = [
    input.manualCount > 0 ? `${formatCount(input.manualCount)} đoạn không đổi.` : '',
    input.reviewedCount > 0 ? `${formatCount(input.reviewedCount)} tường đã duyệt không nằm trong lô.` : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  if (input.candidateCount === 0) {
    return [THICKNESS_BATCH_TEXT.nothingLeft, tail].filter((part) => part.length > 0).join(' ');
  }

  if (input.batchCount === 0) {
    return THICKNESS_BATCH_TEXT.idle;
  }

  const head = `${formatCount(input.batchCount)} đoạn về ${formatCount(input.groupCount)} nhóm chuẩn.`;

  return tail.length > 0 ? `${head} ${tail}` : head;
}

/**
 * Cổng sang bước Xử lý, rút từ MỘT nguồn: `footer.blockReasons` của hook.
 *
 * Dòng trạng thái đầu trang, khung "Điều kiện để xử lý", thanh bước (FlowGate) và
 * kiểu của nút "Bắt đầu xử lý" đều đọc kết quả của hàm này, nên không chỗ nào nói
 * khác chỗ nào (NGUYEN-TAC-BO-CUC §1, "một nguồn trạng thái").
 *
 * Ba điều kiện CHẶN (được đếm) là ba nhóm lý do mà hook vốn đã chặn nút chính:
 * bản vẽ (thiếu tệp, đang tải, dự án chưa có tầng), cao độ sàn, trùng cao độ.
 * Tệp ghép tự động chưa ai xác nhận là CẢNH BÁO: không đếm, không chặn.
 */

import type { FloorUploadBlockReason, FloorUploadBlockReasonKind, FloorUploadModel } from './types';

export type UploadGateConditionId = 'drawings' | 'elevation' | 'overlap';

export interface UploadGateCondition {
  readonly id: UploadGateConditionId;
  readonly done: boolean;
  /** Lý do đầu tiên còn chặn điều kiện này; `null` khi đã đạt. */
  readonly reason: FloorUploadBlockReason | null;
}

export interface UploadGate {
  readonly conditions: readonly UploadGateCondition[];
  readonly doneCount: number;
  readonly total: number;
  /** Mọi điều kiện chặn đã đạt. Với người sửa được thì trùng `footer.canSubmit`. */
  readonly isReady: boolean;
  /** Lý do đầu tiên theo thứ tự của hook — câu của dòng trạng thái. */
  readonly firstReason: FloorUploadBlockReason | null;
  /** Số tầng mang tệp ghép tự động từ tên tệp, chưa ai xác nhận (cảnh báo). */
  readonly unconfirmedCount: number;
}

const KINDS_BY_CONDITION: Readonly<Record<UploadGateConditionId, readonly FloorUploadBlockReasonKind[]>> = {
  drawings: ['noFloors', 'missingFile', 'uploading'],
  elevation: ['missingElevation'],
  overlap: ['duplicateElevation'],
};

const CONDITION_IDS: readonly UploadGateConditionId[] = ['drawings', 'elevation', 'overlap'];

export function deriveUploadGate(model: Pick<FloorUploadModel, 'footer' | 'floors'>): UploadGate {
  const reasons = model.footer.blockReasons;
  // Chưa biết tầng nào (đang đọc) thì chưa điều kiện nào đạt: không có gì để xử lý.
  const hasFloors = model.footer.totalCount > 0;
  const conditions = CONDITION_IDS.map((id) => {
    const reason = reasons.find((candidate) => KINDS_BY_CONDITION[id].includes(candidate.kind)) ?? null;

    return { id, done: hasFloors && reason === null, reason };
  });
  const doneCount = conditions.filter((condition) => condition.done).length;

  return {
    conditions,
    doneCount,
    total: conditions.length,
    isReady: doneCount === conditions.length,
    firstReason: reasons[0] ?? null,
    unconfirmedCount: model.floors.filter((row) => row.isAutoMatched).length,
  };
}

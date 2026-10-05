/**
 * Lỗi dây của registry model → câu người đọc (HOP-DONG-MOI §8, F-11 khối [2]).
 *
 * Thuần: không React, không mạng. Mã đọc bằng `readWireError` (F-01a). Mã lạ không bao giờ
 * được in ra — mọi nhánh không nhận ra đều rơi về câu dự phòng của lượt đọc hoặc lượt ghi.
 * 409 không có câu ở đây: nó là dải "tải lại" của màn, không phải một câu lỗi, và màn này
 * không dùng `resolveConflict` hay câu `errors.conflict` của bản vẽ.
 */

import { readWireError } from '@/lib/errors/wireError';

export const MODEL_REGISTRY_ERROR_TEXT = {
  notEvaluated:
    'Bản này chưa đánh giá xong nên chưa kích hoạt được. Bản gốc chỉ được đánh giá khi dịch vụ học máy đã chạy.',
  formatUnsupported: 'Chỉ kích hoạt được bản định dạng onnx.',
  familyMismatch: 'Bản này không thuộc họ model đang chọn.',
  versionNotFound: 'Không tìm thấy phiên bản này.',
  familyNotFound: 'Không tìm thấy họ model này.',
  busy: 'Máy chủ đang bận. Thử lại sau ít phút.',
  readFallback: 'Không đọc được danh sách model.',
  writeFallback: 'Chưa kích hoạt được bản này. Thử lại sau.',
} as const;

const MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  MODEL_VERSION_NOT_EVALUATED: MODEL_REGISTRY_ERROR_TEXT.notEvaluated,
  MODEL_FORMAT_UNSUPPORTED: MODEL_REGISTRY_ERROR_TEXT.formatUnsupported,
  MODEL_VERSION_FAMILY_MISMATCH: MODEL_REGISTRY_ERROR_TEXT.familyMismatch,
};

const MESSAGE_BY_RESOURCE: Readonly<Record<string, string>> = {
  modelVersion: MODEL_REGISTRY_ERROR_TEXT.versionNotFound,
  modelFamily: MODEL_REGISTRY_ERROR_TEXT.familyNotFound,
};

const BUSY_STATUSES = new Set([429, 503]);
const BUSY_KINDS = new Set(['network', 'timeout']);

const kindOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'kind' in error ? error.kind : undefined;

const statusOf = (error: unknown): number | undefined => readWireError(error)?.status;

export function isForbiddenError(error: unknown): boolean {
  return statusOf(error) === 403;
}

/** 409 `VERSION_CONFLICT` của N24 — `remoteChanges: []`, nên chỉ có một việc: tải lại. */
export function isConflictError(error: unknown): boolean {
  return statusOf(error) === 409;
}

export function isCursorInvalidError(error: unknown): boolean {
  return readWireError(error)?.code === 'CURSOR_INVALID';
}

function messageFor(error: unknown, fallback: string): string {
  const wire = readWireError(error);

  if ((wire?.status !== undefined && BUSY_STATUSES.has(wire.status)) || BUSY_KINDS.has(String(kindOf(error)))) {
    return MODEL_REGISTRY_ERROR_TEXT.busy;
  }

  const byCode = wire?.status === 422 && wire.code !== undefined ? MESSAGE_BY_CODE[wire.code] : undefined;
  const byResource = wire?.status === 404 && wire.resource !== undefined ? MESSAGE_BY_RESOURCE[wire.resource] : undefined;

  return byCode ?? byResource ?? fallback;
}

/** Câu cho một lượt đọc (N23, N25, N27) hỏng. */
export function describeReadError(error: unknown): string {
  return messageFor(error, MODEL_REGISTRY_ERROR_TEXT.readFallback);
}

/** Câu cho một lượt kích hoạt (N24) hỏng, trừ 409 và 403 — hai mã ấy đổi cả màn. */
export function describeWriteError(error: unknown): string {
  return messageFor(error, MODEL_REGISTRY_ERROR_TEXT.writeFallback);
}

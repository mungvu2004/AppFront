/**
 * Phân loại lỗi và câu chữ của các lượt ghi ở màn cài đặt dự án.
 *
 * Thuần (không React, không mạng): hook chỉ gọi vào đây rồi đặt trạng thái.
 * Lỗi đến ở hai hình — `HttpError` gốc từ cổng dữ liệu, hoặc `AppError` nếu một
 * tầng nào đó đã đọc nó — và `readWireError` chỉ hiểu hình đầu, nên phần còn
 * lại đọc `AppError.kind`/`code`/`params.field`.
 *
 * Mã lạ không bao giờ được in ra: mọi nhánh không nhận ra đều rơi về câu dự
 * phòng của màn.
 */

import type { ApiError } from '@/api/client';
import { describeError, toAppError } from '@/lib/errors';
import { isTransientWireError, readWireError } from '@/lib/errors/wireError';

export interface SettingsErrorInfo {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly field: string | undefined;
  readonly resource: string | undefined;
  readonly retryAfterSeconds: number | undefined;
}

const STATUS_BY_APP_ERROR_KIND: Readonly<Record<string, number>> = {
  conflict: 409,
  forbidden: 403,
  notFound: 404,
  rateLimited: 429,
  validation: 422,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Một cách đọc cho cả hai hình lỗi. */
export function readSettingsError(error: ApiError): SettingsErrorInfo {
  const wire = readWireError(error);

  if (wire !== null) {
    return {
      status: wire.status,
      code: wire.code,
      field: wire.field,
      resource: wire.resource,
      retryAfterSeconds: wire.retryAfterSeconds,
    };
  }

  const params: Record<string, unknown> = isRecord(error) && isRecord(error.params) ? error.params : {};
  const field = params.field;
  const resource = params.resource;

  return {
    status: STATUS_BY_APP_ERROR_KIND[error.kind],
    code: typeof error.code === 'string' ? error.code : undefined,
    field: typeof field === 'string' ? field : undefined,
    resource: typeof resource === 'string' ? resource : undefined,
    retryAfterSeconds: undefined,
  };
}

/** Lỗi tạm: engine tự hẹn lại. Chỉ `isTransientWireError` quyết định, không đoán thêm. */
export function isTransientSettingsError(error: ApiError): boolean {
  return isTransientWireError(error);
}

export type SettingsRejection = 'conflict' | 'validation' | 'precondition';

/** 409, 422, 428: máy chủ đã đọc và từ chối; gửi lại y nguyên chỉ lặp lại lời từ chối. */
export function rejectionOf(error: ApiError): SettingsRejection | null {
  const { status } = readSettingsError(error);

  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 428) return 'precondition';

  return null;
}

export type SettingsProblemKey =
  | 'name'
  | 'code'
  | 'address'
  | 'notes'
  | 'snapToleranceMm'
  | 'confidenceThreshold'
  | 'scaleMmPerPx';

const PROBLEM_KEY_BY_WIRE_FIELD: Readonly<Record<string, SettingsProblemKey>> = {
  name: 'name',
  code: 'code',
  address: 'address',
  'body.notes': 'notes',
  'body.snapToleranceMm': 'snapToleranceMm',
  'body.confidenceThreshold': 'confidenceThreshold',
  'body.defaultScaleMmPerPx': 'scaleMmPerPx',
};

/** Ô của biểu mẫu mà một lỗi 422 trỏ tới; `null` khi trường không có ô riêng. */
export function problemKeyOfError(error: ApiError): SettingsProblemKey | null {
  const { field } = readSettingsError(error);

  return field === undefined ? null : (PROBLEM_KEY_BY_WIRE_FIELD[field] ?? null);
}

export const SETTINGS_SENTENCES = {
  conflict: 'Cài đặt dự án vừa được đổi ở nơi khác. Tải lại để xem bản mới nhất.',
  /** Câu DUY NHẤT của một 422 trỏ đúng ô (BUG-356): nói ở ô, không đổ lỗi "máy chủ". */
  fieldRejected: 'Giá trị này chưa hợp lệ nên chưa được lưu; hãy sửa lại.',
  saveFallback: 'Không lưu được cài đặt dự án.',
  /** Viên chỉ báo khi lỗi nhập chặn tự lưu: không nói "chờ đồng bộ" cho thứ sẽ không đồng bộ (BUG-286). */
  unsavedProblems: 'Chưa lưu vì còn ô cần sửa',
  emptyBlocked: 'Giá trị đã lưu không xoá trống được; hãy nhập giá trị khác.',
  snapNotInteger: 'Dung sai bắt điểm phải là số nguyên.',
  /** Viên chỉ báo sau 422: thử lại y nguyên vô ích, nên không hứa "sẽ thử lưu lại" (BUG-300). */
  chipRejected: 'Chưa lưu vì còn ô cần sửa',
  /** Viên chỉ báo sau 409/428: chỉ tải lại mới gỡ được (BUG-300). */
  chipReload: 'Chưa lưu: cần tải lại bản mới nhất',
} as const;

/** Mọi ô của bản nháp, gọi bằng tên người dùng thấy trên màn — không bằng nhóm gửi nội bộ (BUG-300). */
export type SettingsFieldKey = SettingsProblemKey | 'buildingType' | 'lengthUnit';

const FIELD_LABELS: Readonly<Record<SettingsFieldKey, string>> = {
  name: 'tên dự án',
  code: 'mã dự án',
  address: 'địa chỉ',
  buildingType: 'loại công trình',
  notes: 'ghi chú',
  lengthUnit: 'đơn vị chiều dài',
  snapToleranceMm: 'dung sai bắt điểm',
  confidenceThreshold: 'ngưỡng tin cậy',
  scaleMmPerPx: 'tỉ lệ bản vẽ',
};

/** Bước tiếp theo theo lời từ chối; 409 không có câu vì dải xung đột đã mang nút "Tải lại". */
const NEXT_STEP: Readonly<Record<SettingsRejection, string>> = {
  validation: ' Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp.',
  conflict: '',
  precondition: ' Tải lại trang để lưu tiếp.',
};

function listOf(fields: readonly SettingsFieldKey[]): string {
  const labels = fields.map((field) => FIELD_LABELS[field]);
  const last = labels.pop();

  if (last === undefined) return 'thay đổi vừa rồi';

  return labels.length === 0 ? last : `${labels.join(', ')} và ${last}`;
}

/**
 * Câu nói ô nào đã lưu, ô nào chưa, và việc người dùng cần làm.
 *
 * `saved` là những ô vừa gửi thành công, `failed` là những ô hỏng hoặc còn bị giữ lại
 * vì máy chủ đã từ chối bản nháp hiện tại. `rejection` là lời từ chối gây ra phần hỏng;
 * `null` (lỗi tạm) thì không thêm câu nào: engine tự thử lại và viên chỉ báo đã nói điều đó.
 */
export function partialSaveSentence(
  saved: readonly SettingsFieldKey[],
  failed: readonly SettingsFieldKey[],
  rejection: SettingsRejection | null = null,
): string {
  const next = rejection === null ? '' : NEXT_STEP[rejection];

  if (saved.length === 0) {
    return `Chưa lưu được ${listOf(failed)}.${next}`;
  }

  return `Đã lưu ${listOf(saved)}, chưa lưu ${listOf(failed)}.${next}`;
}

/** Câu dự phòng cho lỗi ghi không có nhánh riêng. */
export function describeSaveFailure(error: ApiError): string {
  return describeError(toAppError(error)).description;
}

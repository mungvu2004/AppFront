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

import type { ProjectSettingsPart } from './projectSettingsGateway';

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
  fieldRejected: 'Máy chủ không nhận giá trị này. Kiểm tra lại ô này.',
  saveFallback: 'Không lưu được cài đặt dự án.',
  emptyBlocked: 'Bản này chưa xoá trống được.',
  snapNotInteger: 'Dung sai bắt điểm phải là số nguyên.',
} as const;

const PART_LABELS: Readonly<Record<ProjectSettingsPart, string>> = {
  general: 'thông tin chung',
  units: 'đơn vị đo',
};

/**
 * Câu nói phần nào đã lưu, phần nào chưa.
 *
 * `saved` là những phần vừa gửi thành công, `failed` là những phần hỏng hoặc còn
 * bị giữ lại vì máy chủ đã từ chối bản nháp hiện tại.
 */
export function partialSaveSentence(
  saved: readonly ProjectSettingsPart[],
  failed: readonly ProjectSettingsPart[],
): string {
  const failedText = failed.map((part) => PART_LABELS[part]).join(' và ');

  if (saved.length === 0) {
    return `Chưa lưu được ${failedText}.`;
  }

  const savedText = saved.map((part) => PART_LABELS[part]).join(' và ');

  return `Đã lưu ${savedText}, chưa lưu ${failedText}.`;
}

/** Câu dự phòng cho lỗi ghi không có nhánh riêng. */
export function describeSaveFailure(error: ApiError): string {
  return describeError(toAppError(error)).description;
}

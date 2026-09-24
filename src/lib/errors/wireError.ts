// Đọc tay, KHÔNG nhập zod làm giá trị: lý do đã ghi ở `./toAppError.ts:1-5` —
// một `instanceof ZodError` kéo cả thư viện zod vào mọi gói chạm tới module này.
import type { HttpError } from '@/lib/http';

import type { AppError } from './kinds';

/** Mã lỗi trên dây: UPPER_SNAKE (BE-00 §4, giống `api/schemas/errors.ts:49`). */
const WIRE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** `kind: 'http'` với các status này là lỗi tạm: hạ tầng, không phải yêu cầu sai. */
const TRANSIENT_HTTP_STATUS = new Set([408, 429, 502, 503, 504]);

/**
 * Mã dây mà `toAppError` giữ nguyên nhưng đọc kind thành `unknown` (5xx không
 * nằm trong `KNOWN_HTTP_STATUS_KIND`, `toAppError.ts:10-18`). Không đọc mã thì
 * một `AppError` dựng từ 503 sẽ bị coi là vĩnh viễn.
 */
const TRANSIENT_WIRE_CODES = new Set([
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'IDEMPOTENCY_IN_PROGRESS',
]);

const TRANSIENT_APP_ERROR_KINDS = new Set(['network', 'timeout', 'rateLimited']);

/** Thông tin đọc được từ một lỗi hình `HttpError`. Khoá không đọc được thì VẮNG. */
export interface WireErrorInfo {
  status?: number;
  code?: string;
  field?: string;
  resource?: string;
  retryAfterSeconds?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Cùng khuôn với `isHttpError` của `./toAppError.ts:120`. */
const isHttpErrorShape = (value: unknown): value is HttpError =>
  isRecord(value) &&
  typeof value.kind === 'string' &&
  typeof value.requestId === 'string' &&
  typeof value.retryable === 'boolean' &&
  'raw' in value;

/** `AppError` khác `HttpError` ở chỗ nó có `messageKey`/`severity` và KHÔNG có `raw`. */
const isAppErrorShape = (value: unknown): value is AppError =>
  isRecord(value) &&
  !('raw' in value) &&
  typeof value.kind === 'string' &&
  typeof value.code === 'string' &&
  typeof value.messageKey === 'string' &&
  typeof value.severity === 'string';

/** Lỗi dây hay bị bọc một lớp — `{ error }` của `Result`, hoặc `cause` của `Error`. */
const unwrap = (error: unknown): unknown => {
  if (!isRecord(error) || isHttpErrorShape(error)) {
    return error;
  }

  if (isHttpErrorShape(error.error)) {
    return error.error;
  }

  if (isHttpErrorShape(error.cause)) {
    return error.cause;
  }

  return error;
};

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Đọc `status`, `code`, `field`, `resource`, `retryAfterSeconds` của một lỗi
 * hình `HttpError` (kể cả khi bị bọc trong `.error` hoặc `.cause`).
 *
 * `code` chỉ giữ khi khớp UPPER_SNAKE: mã dây là thứ màn rẽ nhánh theo, nên một
 * chuỗi tự do lọt vào đây sẽ thành một nhánh không ai khai. `AppError`, chuỗi,
 * `null` và mọi thứ khác trả `null` — chúng không mang hình dạng dây.
 */
export function readWireError(error: unknown): WireErrorInfo | null {
  const candidate = unwrap(error);

  if (!isHttpErrorShape(candidate)) {
    return null;
  }

  const status = readNumber(candidate.status);
  const rawCode = readString(candidate.code);
  const code = rawCode !== undefined && WIRE_CODE_PATTERN.test(rawCode) ? rawCode : undefined;
  const raw = isRecord(candidate.raw) ? candidate.raw : undefined;
  const field = raw ? readString(raw.field) : undefined;
  const resource = raw ? readString(raw.resource) : undefined;
  const retryAfterSeconds = readNumber(candidate.retryAfterSeconds);

  return {
    ...(status !== undefined ? { status } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(field !== undefined ? { field } : {}),
    ...(resource !== undefined ? { resource } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

/**
 * Lỗi này thử lại có ích không?
 *
 * Không đọc được gì (ví dụ `Error` trần mà `lib/autosave/spatialLayerSave.ts:42-44`
 * ném, hoặc `TypeError` của `fetch`) thì trả `true` — giữ nguyên hành vi
 * thử-lại-tất-cả có từ trước, để việc siết này không biến một lỗi chưa phân
 * loại thành mất dữ liệu.
 */
export function isTransientWireError(error: unknown): boolean {
  const candidate = unwrap(error);

  if (isHttpErrorShape(candidate)) {
    if (candidate.kind === 'network' || candidate.kind === 'timeout') {
      return true;
    }

    if (candidate.kind === 'http') {
      return candidate.status !== undefined && TRANSIENT_HTTP_STATUS.has(candidate.status);
    }

    return false;
  }

  if (isAppErrorShape(candidate)) {
    return TRANSIENT_APP_ERROR_KINDS.has(candidate.kind) || TRANSIENT_WIRE_CODES.has(candidate.code);
  }

  // `TypeError` (fetch hỏng) rơi vào đúng nhánh này, cùng với mọi lỗi chưa đọc được.
  return true;
}

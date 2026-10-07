/**
 * Bộ dựng chung của các bài kiểm trong thư mục `src/screens/auth`: một lỗi dây đúng
 * hình `src/lib/http` trả, với thân lỗi dựng bằng `ApiErrorBodySchema` (không tự chế
 * hình thân). Chỉ bài kiểm và story nhập tệp này.
 */

import { ApiErrorBodySchema } from '@/api/schemas/errors';
import type { HttpError, Result } from '@/lib/http';

export interface WireFailureOptions {
  readonly code?: string;
  readonly field?: string;
  readonly retryAfterSeconds?: number;
}

/** Lỗi `kind: 'http'` với `status`; có `code` thì thân là một `ApiErrorBody` hợp lệ. */
export function wireFailure(status: number, options: WireFailureOptions = {}): Result<never, HttpError> {
  const { code, field, retryAfterSeconds } = options;
  const raw =
    code === undefined
      ? undefined
      : ApiErrorBodySchema.parse({ code, requestId: 'req-test', ...(field !== undefined ? { field } : {}) });

  return {
    ok: false,
    error: {
      kind: 'http',
      status,
      ...(code !== undefined ? { code } : {}),
      requestId: 'req-test',
      retryable: false,
      raw,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
  };
}

/** Lượt gửi thất bại vì mạng, không có phản hồi. */
export const networkFailure = (): Result<never, HttpError> => ({
  ok: false,
  error: { kind: 'network', requestId: 'req-test', retryable: true, raw: undefined },
});

export const okVoid = (): Result<void, never> => ({ ok: true, data: undefined });

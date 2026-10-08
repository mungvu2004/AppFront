/**
 * Phần dùng chung của ba luồng không cần phiên: quên mật khẩu (N8), đặt lại (N9),
 * nhận lời mời (N10). Thuần: không React, không store.
 *
 * Ba luồng trả lỗi theo cùng một bảng, nên bảng ở đây một lần: `readWireError`
 * đọc `code`/`field`/`status` rồi {@link classifyRecoveryFailure} rút còn năm
 * trường hợp. Không có nhánh nào trong đó in mã trần cho người dùng.
 */

import { MIN_PASSWORD_LENGTH } from '@/api/schemas';
import { describeError, toAppError } from '@/lib/errors';
import { readWireError } from '@/lib/errors/wireError';

/* Nhập THEO TÊN, không default — xem ghi chú ở `AuthScreen/useAuthScreen.ts`. */
import { auth as AUTH_MESSAGES, errors as ERROR_MESSAGES } from '@/i18n/vi.json';

/**
 * Số giây tối thiểu khoá nút sau một 429. `Retry-After` của BE bị kẹp ≤ 10 s
 * (BE-00 §11) trong khi hạn mức là 10 lượt/900 s, nên con số ấy nói dối: khoá
 * dài hơn và không hứa số giây nào.
 */
export const RECOVERY_LOCKOUT_SECONDS = 60;

export type RecoveryFailure =
  | { readonly kind: 'tokenInvalid' }
  | { readonly kind: 'field'; readonly field: string }
  | { readonly kind: 'rateLimited'; readonly seconds: number }
  | { readonly kind: 'originMismatch' }
  | { readonly kind: 'other'; readonly cause: unknown };

const TOO_MANY_REQUESTS_STATUS = 429;

/**
 * @param tokenInvalidCode `PASSWORD_RESET_TOKEN_INVALID` hoặc `INVITATION_TOKEN_INVALID`; N8 không có mã.
 * @param knownFields ô của biểu mẫu; `field` lạ thì không có ô nào để gắn lỗi.
 */
export function classifyRecoveryFailure(
  error: unknown,
  tokenInvalidCode: string | undefined,
  knownFields: readonly string[],
): RecoveryFailure {
  const wire = readWireError(error);

  if (wire?.status === TOO_MANY_REQUESTS_STATUS) {
    return {
      kind: 'rateLimited',
      seconds: Math.max(wire.retryAfterSeconds ?? 0, RECOVERY_LOCKOUT_SECONDS),
    };
  }

  if (
    (tokenInvalidCode !== undefined && wire?.code === tokenInvalidCode) ||
    (wire?.code === 'VALIDATION' && wire.field === 'token')
  ) {
    return { kind: 'tokenInvalid' };
  }

  if (wire?.code === 'ORIGIN_MISMATCH') {
    return { kind: 'originMismatch' };
  }

  if (wire?.code === 'VALIDATION' && wire.field !== undefined && knownFields.includes(wire.field)) {
    return { kind: 'field', field: wire.field };
  }

  return { kind: 'other', cause: error };
}

export type RecoveryNoticeTone = 'attention' | 'violation';

export interface RecoveryNotice {
  readonly tone: RecoveryNoticeTone;
  readonly title?: string;
  readonly message: string;
}

/** Câu cho một lỗi còn thử lại được. `tokenInvalid` và `field` không có dải: chúng có chỗ riêng. */
export function noticeForRecovery(failure: RecoveryFailure | null): RecoveryNotice | null {
  if (failure === null) {
    return null;
  }

  switch (failure.kind) {
    case 'tokenInvalid':
    case 'field':
      return null;
    case 'rateLimited':
      return {
        tone: 'attention',
        title: AUTH_MESSAGES.errors.tooManyAttempts.title,
        message: AUTH_MESSAGES.errors.tooManyRecovery,
      };
    case 'originMismatch':
      return {
        tone: 'violation',
        title: AUTH_MESSAGES.errors.originMismatch.title,
        message: AUTH_MESSAGES.errors.originMismatch.description,
      };
    default: {
      const appError = toAppError(failure.cause);

      // Câu chung của mọi loại khác mạng/chậm khuyên tải lại trang, mà tải lại làm mất mã
      // của đường dẫn trong thư (`fragmentToken.ts`): ở đây chỉ khuyên gửi lại (BUG-015).
      if (appError.kind !== 'network' && appError.kind !== 'timeout') {
        return {
          tone: 'violation',
          title: ERROR_MESSAGES.unknown.title,
          message: AUTH_MESSAGES.errors.recoveryFailed,
        };
      }

      const described = describeError(appError);

      return { tone: 'violation', title: described.title, message: described.description };
    }
  }
}

/** `{{name}}` điền từ bảng — cùng ba dòng với `useAuthScreen`, vì tầng đó không xuất nó. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

const passwordTooShort = (): string =>
  fillTemplate(AUTH_MESSAGES.problems.passwordTooShort, { count: String(MIN_PASSWORD_LENGTH) });

/**
 * Câu cho ô mật khẩu theo luật của schema BE (≥ 8; không chép luật "chữ và số" của
 * màn tài khoản). Rỗng là "chưa nhập", ngắn là "cần ít nhất 8".
 */
export function passwordProblem(
  schema: { safeParse(value: unknown): { success: boolean } },
  value: string,
): string | undefined {
  if (schema.safeParse(value).success) {
    return undefined;
  }

  return value.length === 0 ? AUTH_MESSAGES.problems.passwordRequired : passwordTooShort();
}

/** Ô nhập lại: so tại chỗ với mật khẩu, không gửi lên máy chủ. */
export function confirmProblem(password: string, confirm: string): string | undefined {
  if (confirm.length === 0) {
    return AUTH_MESSAGES.problems.confirmRequired;
  }

  return confirm === password ? undefined : AUTH_MESSAGES.problems.confirmMismatch;
}

/**
 * Câu gắn vào ô khi máy chủ nói `VALIDATION` kèm `field`. FE đã chặn họ tên trống và quá
 * dài trước khi gửi, nên `fullName` bị máy chủ từ chối chỉ còn là ký tự cấm (BUG-016).
 */
export function serverFieldProblem(field: string): string {
  return field === 'fullName' ? AUTH_MESSAGES.problems.fullNameInvalid : passwordTooShort();
}

/**
 * Quên mật khẩu (N8) — nửa logic của panel, do `useAuthScreen` gọi.
 *
 * Không nhập `./useAuthScreen` (hook đó gọi hook này: nhập lại là vòng). Mọi thứ nó
 * cần từ ngoài đến qua tham số.
 *
 * N8 **luôn** trả 204 dù địa chỉ có tài khoản hay không, nên thành công chỉ được nói
 * một câu trung tính — không màu trạng thái, không xác nhận địa chỉ nào tồn tại (A4,
 * A5). 429 khoá nút nhưng không hứa số giây: `Retry-After` bị kẹp ≤ 10 s còn hạn mức
 * là 10 lượt/900 s.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { MAX_EMAIL_LENGTH, PasswordResetRequestSchema } from '@/api/schemas/auth';
import type { Result } from '@/lib/http';

/* Nhập THEO TÊN, không default — xem ghi chú ở `useAuthScreen.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import {
  classifyRecoveryFailure,
  fillTemplate,
  noticeForRecovery,
  type RecoveryFailure,
  type RecoveryNotice,
} from '../recoveryShared';
import { useLockout } from '../useLockout';

export interface UseForgotPasswordOptions {
  readonly request: (input: { readonly email: string }, signal?: AbortSignal) => Promise<Result<void, unknown>>;
}

export interface ForgotPasswordModel {
  readonly email: string;
  /** Lỗi dưới ô thư điện tử, hoặc không có. */
  readonly problem: string | undefined;
  /** Dải cho lỗi còn thử lại được (429, cấu hình, mạng). Không bao giờ dùng cho câu thành công. */
  readonly notice: RecoveryNotice | null;
  /** Câu trung tính sau 204; null khi chưa gửi. */
  readonly sentMessage: string | null;
  readonly isSending: boolean;
  readonly isSent: boolean;
  /** Có lỗi còn thử lại được — dùng cho trạng thái `error` của màn. */
  readonly hasFailure: boolean;
  readonly canSubmit: boolean;
}

export interface ForgotPasswordActions {
  readonly setEmail: (email: string) => void;
  readonly submit: () => void;
  /** Mở panel: mang địa chỉ đã gõ ở biểu mẫu đăng nhập, xoá kết quả lần trước. */
  readonly reset: (email: string) => void;
}

type Phase = 'idle' | 'sending' | 'sent';

export function useForgotPassword(options: UseForgotPasswordOptions): {
  readonly model: ForgotPasswordModel;
  readonly actions: ForgotPasswordActions;
} {
  const { request } = options;
  const [email, setEmailState] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<RecoveryFailure | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const { isLocked, lock } = useLockout();
  const inFlight = useRef(false);
  const emailRef = useRef(email);
  emailRef.current = email;

  /** A new address after a send is a new request: the "sent" result belonged to the old one. */
  const setEmail = useCallback((next: string) => {
    setEmailState(next);
    setProblem(undefined);
    setPhase((current) => (current === 'sent' ? 'idle' : current));
  }, []);

  const reset = useCallback((next: string) => {
    setEmailState(next);
    setProblem(undefined);
    setFailure(null);
    setPhase('idle');
  }, []);

  const submit = useCallback(() => {
    // `sent`: the same address again would only send a second identical letter (BUG-022).
    if (inFlight.current || isLocked || phase === 'sent') {
      return;
    }

    const current = emailRef.current;

    const checked = PasswordResetRequestSchema.shape.email.safeParse(current);

    if (!checked.success) {
      // An address past the cap is too long, not malformed — the sign-in form says the same (BUG-010).
      setProblem(
        current.length === 0
          ? AUTH_MESSAGES.problems.emailRequired
          : checked.error.issues[0]?.code === 'too_big'
            ? fillTemplate(AUTH_MESSAGES.problems.emailTooLong, { count: String(MAX_EMAIL_LENGTH) })
            : AUTH_MESSAGES.problems.emailInvalid,
      );

      return;
    }

    setProblem(undefined);
    setFailure(null);
    inFlight.current = true;
    setPhase('sending');

    void request({ email: current })
      .then((result) => {
        inFlight.current = false;

        if (result.ok) {
          setPhase('sent');

          return;
        }

        setPhase('idle');

        const classified = classifyRecoveryFailure(result.error, undefined, ['email']);

        if (classified.kind === 'field') {
          setProblem(AUTH_MESSAGES.problems.emailInvalid);

          return;
        }

        setFailure(classified.kind === 'tokenInvalid' ? { kind: 'other', cause: result.error } : classified);

        if (classified.kind === 'rateLimited') {
          lock(classified.seconds);
        }
      })
      .catch((thrown: unknown) => {
        inFlight.current = false;
        setPhase('idle');
        setFailure({ kind: 'other', cause: thrown });
      });
  }, [isLocked, lock, phase, request]);

  // Hết khoá thì dải 429 đi theo; không cần effect riêng.
  const shownFailure = failure?.kind === 'rateLimited' && !isLocked ? null : failure;

  const model: ForgotPasswordModel = {
    email,
    problem,
    notice: noticeForRecovery(shownFailure),
    sentMessage: phase === 'sent' ? AUTH_MESSAGES.forgotPassword.sent : null,
    isSending: phase === 'sending',
    isSent: phase === 'sent',
    hasFailure: shownFailure !== null,
    canSubmit: phase === 'idle' && !isLocked,
  };

  const actions = useMemo(() => ({ setEmail, submit, reset }), [reset, setEmail, submit]);

  return { model, actions };
}

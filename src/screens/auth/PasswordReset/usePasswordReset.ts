/**
 * Đặt lại mật khẩu (N9), nửa logic: mọi thứ màn biết mà không vẽ gì.
 *
 * Mã `#token=` đọc **một lần, trong hàm khởi tạo `useState`** (StrictMode chạy nó
 * hai lần; `consumeFragmentToken` trả lại đúng mã ở lượt hai). Không bao giờ trong
 * `useEffect`, không sau `await`, không qua `useLocation().hash`.
 *
 * Đường mạng là một cổng ({@link PasswordResetPort}) do container đưa vào, nên cả
 * nhánh lỗi test được không cần mạng hay router.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { PasswordResetConfirmSchema } from '@/api/schemas/auth';
import type { Result } from '@/lib/http';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { consumeFragmentToken } from '../fragmentToken';
import {
  classifyRecoveryFailure,
  confirmProblem,
  noticeForRecovery,
  passwordProblem,
  serverFieldProblem,
  type RecoveryFailure,
  type RecoveryNotice,
} from '../recoveryShared';
import { useLockout } from '../useLockout';

export interface PasswordResetNavigateOptions {
  readonly replace?: boolean;
  readonly state?: { readonly notice: 'passwordReset' };
}

export interface PasswordResetPort {
  readonly confirm: (
    input: { readonly token: string; readonly newPassword: string },
    signal?: AbortSignal,
  ) => Promise<Result<void, unknown>>;
  /** `signOut`: N9 thu hồi mọi phiên, nên phiên cục bộ phải đi theo. */
  readonly endLocalSession: () => Promise<void>;
  readonly navigate: (to: string, options?: PasswordResetNavigateOptions) => void;
}

export interface UsePasswordResetOptions {
  readonly port: PasswordResetPort;
  readonly isCollapsed?: boolean;
  /** Chỉ host thu gọn mới biết mở lại thế nào; vắng thì nút không làm gì. */
  readonly onExpand?: () => void;
}

export type PasswordResetField = 'newPassword' | 'confirmPassword';

export interface PasswordResetValues {
  readonly newPassword: string;
  readonly confirmPassword: string;
}

export type PasswordResetProblems = Partial<Readonly<Record<PasswordResetField, string>>>;

export interface PasswordResetModel {
  readonly state: SevenState;
  readonly values: PasswordResetValues;
  readonly problems: PasswordResetProblems;
  readonly notice: RecoveryNotice | null;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  readonly isDone: boolean;
  /**
   * Ngõ cụt vì chính đường dẫn thiếu hoặc hỏng mã (không có `#token=`, mã sai dạng, mã đặt
   * nhầm vào `?token=`), khác với mã đủ mà máy chủ từ chối (hết hạn, đã dùng) — BUG-005.
   */
  readonly isLinkIncomplete: boolean;
}

export interface PasswordResetActions {
  readonly setNewPassword: (value: string) => void;
  readonly setConfirmPassword: (value: string) => void;
  readonly submit: () => void;
  readonly goToSignIn: () => void;
  readonly expand: () => void;
}

const EMPTY_VALUES: PasswordResetValues = { newPassword: '', confirmPassword: '' };
const FIELDS: readonly string[] = ['newPassword'];

type Phase = 'idle' | 'submitting' | 'succeeded';

export function usePasswordReset(options: UsePasswordResetOptions): {
  readonly model: PasswordResetModel;
  readonly actions: PasswordResetActions;
} {
  const { port, isCollapsed = false, onExpand } = options;

  // Đúng một lần, trước mọi `await`; xem đầu tệp.
  const [token] = useState<string | null>(() => consumeFragmentToken());
  const hasUsableToken = useMemo(
    () => token !== null && PasswordResetConfirmSchema.shape.token.safeParse(token).success,
    [token],
  );

  const [values, setValues] = useState<PasswordResetValues>(EMPTY_VALUES);
  const [problems, setProblems] = useState<PasswordResetProblems>({});
  const [failure, setFailure] = useState<RecoveryFailure | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const { isLocked, lock } = useLockout();
  const inFlight = useRef(false);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const edit = useCallback((field: PasswordResetField, patch: Partial<PasswordResetValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblems((current) => {
      if (current[field] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[field];

      return next;
    });
  }, []);

  const setNewPassword = useCallback(
    (newPassword: string) => {
      edit('newPassword', { newPassword });
    },
    [edit],
  );

  const setConfirmPassword = useCallback(
    (confirmPassword: string) => {
      edit('confirmPassword', { confirmPassword });
    },
    [edit],
  );

  const isDead = !hasUsableToken || failure?.kind === 'tokenInvalid';
  // Hết khoá thì dải 429 đi theo; không cần effect riêng.
  const shownFailure = failure?.kind === 'rateLimited' && !isLocked ? null : failure;

  const submit = useCallback(() => {
    if (inFlight.current || isLocked || isDead || token === null) {
      return;
    }

    const current = valuesRef.current;
    const found: Partial<Record<PasswordResetField, string>> = {};
    const newProblem = passwordProblem(PasswordResetConfirmSchema.shape.newPassword, current.newPassword);
    const matchProblem = confirmProblem(current.newPassword, current.confirmPassword);

    if (newProblem !== undefined) {
      found.newPassword = newProblem;
    }
    if (matchProblem !== undefined) {
      found.confirmPassword = matchProblem;
    }
    if (Object.keys(found).length > 0) {
      setProblems(found);

      return;
    }

    setProblems({});
    setFailure(null);
    inFlight.current = true;
    setPhase('submitting');

    void port
      .confirm({ token, newPassword: current.newPassword })
      .then(async (result) => {
        if (result.ok) {
          setPhase('succeeded');

          try {
            await port.endLocalSession();
          } finally {
            inFlight.current = false;
            port.navigate(ROUTES.login, { replace: true, state: { notice: 'passwordReset' } });
          }

          return;
        }

        inFlight.current = false;
        setPhase('idle');

        const classified = classifyRecoveryFailure(result.error, 'PASSWORD_RESET_TOKEN_INVALID', FIELDS);

        if (classified.kind === 'field') {
          setProblems({ newPassword: serverFieldProblem(classified.field) });

          return;
        }

        setFailure(classified);

        if (classified.kind === 'rateLimited') {
          lock(classified.seconds);
        }
      })
      .catch((thrown: unknown) => {
        inFlight.current = false;
        setPhase('idle');
        setFailure({ kind: 'other', cause: thrown });
      });
  }, [isDead, isLocked, lock, port, token]);

  const goToSignIn = useCallback(() => {
    port.navigate(ROUTES.login);
  }, [port]);

  const expand = useCallback(() => {
    onExpand?.();
  }, [onExpand]);

  const isSubmitting = phase === 'submitting';
  const isDone = phase === 'succeeded';
  const typed = values.newPassword.length > 0 || values.confirmPassword.length > 0;

  const state = useMemo<SevenState>(() => {
    if (isCollapsed) {
      return 'collapsed';
    }
    if (isDead) {
      return 'forbidden';
    }
    if (isSubmitting) {
      return 'loading';
    }
    if (isDone) {
      return 'success';
    }
    if (shownFailure !== null) {
      return 'error';
    }

    return typed ? 'partial' : 'empty';
  }, [isCollapsed, isDead, isDone, isSubmitting, shownFailure, typed]);

  const model: PasswordResetModel = {
    state,
    values,
    problems,
    notice: noticeForRecovery(shownFailure),
    canSubmit: !isSubmitting && !isDone && !isLocked,
    isSubmitting,
    isDone,
    isLinkIncomplete: !hasUsableToken,
  };

  return {
    model,
    actions: { setNewPassword, setConfirmPassword, submit, goToSignIn, expand },
  };
}

/**
 * Nhận lời mời (N10), nửa logic.
 *
 * Mã `#token=` đọc một lần trong hàm khởi tạo `useState`, như màn đặt lại mật khẩu —
 * lý do ở `../fragmentToken.ts`. Khác màn kia ở chỗ N10 trả cookie phiên, nên sau 204
 * còn một bước: đổi cookie thành phiên thật qua `port.bootstrapSession`. Container đưa
 * HÀM `bootstrapAfterNewCookie` vào (không gọi nó): lượt mở phiên lúc tải trang còn
 * bay thì single-flight trả kết quả cũ, chứ không gửi thêm lượt thứ hai.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { AcceptInvitationSchema } from '@/api/schemas/auth';
import type { Result } from '@/lib/http';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

/* Nhập THEO TÊN, không default — lý do ở `../recoveryShared.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { consumeFragmentToken } from '../fragmentToken';
import {
  classifyRecoveryFailure,
  confirmProblem,
  fillTemplate,
  noticeForRecovery,
  passwordProblem,
  serverFieldProblem,
  type RecoveryFailure,
  type RecoveryNotice,
} from '../recoveryShared';
import { useLockout } from '../useLockout';

export interface InvitationAcceptPort {
  readonly accept: (
    input: { readonly token: string; readonly fullName: string; readonly password: string },
    signal?: AbortSignal,
  ) => Promise<Result<void, unknown>>;
  readonly bootstrapSession: () => Promise<boolean>;
  readonly navigate: (to: string, options?: { readonly replace?: boolean }) => void;
  /** Đang có người đăng nhập: nhận lời mời sẽ đăng xuất họ (N10 thu hồi phiên cũ). */
  readonly isSignedIn: boolean;
  /** Phiên `unknown` mà máy chủ chưa được báo là không tới được: chưa biết có ai đăng nhập hay không. */
  readonly isSessionPending: boolean;
}

export interface UseInvitationAcceptOptions {
  readonly port: InvitationAcceptPort;
  readonly isCollapsed?: boolean;
  /** Chỉ host thu gọn mới biết mở lại thế nào; vắng thì nút không làm gì. */
  readonly onExpand?: () => void;
}

export type InvitationAcceptField = 'fullName' | 'password' | 'confirmPassword';

export interface InvitationAcceptValues {
  readonly fullName: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export type InvitationAcceptProblems = Partial<Readonly<Record<InvitationAcceptField, string>>>;

export interface InvitationAcceptModel {
  readonly state: SevenState;
  readonly values: InvitationAcceptValues;
  readonly problems: InvitationAcceptProblems;
  readonly notice: RecoveryNotice | null;
  /** Dải cảnh báo "sẽ đăng xuất"; chỉ có khi phiên đã rõ. */
  readonly warning: RecoveryNotice | null;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  readonly isDone: boolean;
  /** Đã nhận lời mời nhưng phiên không mở: biểu mẫu khoá, chỉ còn đường tới đăng nhập. */
  readonly needsSignIn: boolean;
  /** Dành cho `aria-busy` của biểu mẫu. */
  readonly isSessionPending: boolean;
}

export interface InvitationAcceptActions {
  readonly setFullName: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly setConfirmPassword: (value: string) => void;
  readonly submit: () => void;
  readonly goToSignIn: () => void;
  readonly expand: () => void;
}

const EMPTY_VALUES: InvitationAcceptValues = { fullName: '', password: '', confirmPassword: '' };
const FIELDS: readonly string[] = ['fullName', 'password'];

type Failure = RecoveryFailure | { readonly kind: 'sessionNotOpened' };
type Phase = 'idle' | 'submitting' | 'succeeded';

function fullNameProblem(value: string): string | undefined {
  const parsed = AcceptInvitationSchema.shape.fullName.safeParse(value);

  if (parsed.success) {
    return undefined;
  }

  const issue = parsed.error.issues[0];

  return issue?.code === 'too_big'
    ? fillTemplate(AUTH_MESSAGES.problems.fullNameTooLong, { count: String(issue.maximum) })
    : AUTH_MESSAGES.problems.fullNameRequired;
}

export function useInvitationAccept(options: UseInvitationAcceptOptions): {
  readonly model: InvitationAcceptModel;
  readonly actions: InvitationAcceptActions;
} {
  const { port, isCollapsed = false, onExpand } = options;

  // Đúng một lần, trước mọi `await`.
  const [token] = useState<string | null>(() => consumeFragmentToken());
  const hasUsableToken = useMemo(
    () => token !== null && AcceptInvitationSchema.shape.token.safeParse(token).success,
    [token],
  );

  const [values, setValues] = useState<InvitationAcceptValues>(EMPTY_VALUES);
  const [problems, setProblems] = useState<InvitationAcceptProblems>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const { isLocked, lock } = useLockout();
  const inFlight = useRef(false);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const edit = useCallback((field: InvitationAcceptField, patch: Partial<InvitationAcceptValues>) => {
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

  const setFullName = useCallback(
    (fullName: string) => {
      edit('fullName', { fullName });
    },
    [edit],
  );
  const setPassword = useCallback(
    (password: string) => {
      edit('password', { password });
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
  const needsSignIn = failure?.kind === 'sessionNotOpened';
  // Hết khoá thì dải 429 đi theo; không cần effect riêng.
  const shownFailure = failure?.kind === 'rateLimited' && !isLocked ? null : failure;

  const submit = useCallback(() => {
    if (inFlight.current || isLocked || isDead || needsSignIn || port.isSessionPending || token === null) {
      return;
    }

    const current = valuesRef.current;
    const found: Partial<Record<InvitationAcceptField, string>> = {};
    const nameProblem = fullNameProblem(current.fullName);
    const passwordIssue = passwordProblem(AcceptInvitationSchema.shape.password, current.password);
    const matchProblem = confirmProblem(current.password, current.confirmPassword);

    if (nameProblem !== undefined) {
      found.fullName = nameProblem;
    }
    if (passwordIssue !== undefined) {
      found.password = passwordIssue;
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
      .accept({ token, fullName: current.fullName.trim(), password: current.password })
      .then(async (result) => {
        if (result.ok) {
          setPhase('succeeded');

          // A throw is the same as `false`: the cookie is already accepted, so resubmitting would burn the token.
          const established = await port.bootstrapSession().catch(() => false);

          inFlight.current = false;

          if (established) {
            port.navigate(ROUTES.dashboard, { replace: true });

            return;
          }

          setPhase('idle');
          setFailure({ kind: 'sessionNotOpened' });

          return;
        }

        inFlight.current = false;
        setPhase('idle');

        const classified = classifyRecoveryFailure(result.error, 'INVITATION_TOKEN_INVALID', FIELDS);

        if (classified.kind === 'field') {
          const field = classified.field === 'fullName' ? 'fullName' : 'password';

          setProblems({ [field]: serverFieldProblem(classified.field) });

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
  }, [isDead, isLocked, lock, needsSignIn, port, token]);

  const goToSignIn = useCallback(() => {
    port.navigate(ROUTES.login);
  }, [port]);

  const expand = useCallback(() => {
    onExpand?.();
  }, [onExpand]);

  const isSubmitting = phase === 'submitting';
  const isDone = phase === 'succeeded';
  const typed = values.fullName.length > 0 || values.password.length > 0 || values.confirmPassword.length > 0;

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

  const notice: RecoveryNotice | null =
    shownFailure?.kind === 'sessionNotOpened'
      ? { tone: 'violation', message: AUTH_MESSAGES.invitation.sessionNotOpened }
      : noticeForRecovery(shownFailure);

  const model: InvitationAcceptModel = {
    state,
    values,
    problems,
    notice,
    warning:
      port.isSignedIn && !port.isSessionPending && !isDone
        ? { tone: 'attention', message: AUTH_MESSAGES.invitation.signedInWarning }
        : null,
    canSubmit: !isSubmitting && !isDone && !isLocked && !needsSignIn && !port.isSessionPending,
    isSubmitting,
    isDone,
    needsSignIn,
    isSessionPending: port.isSessionPending,
  };

  return {
    model,
    actions: { setFullName, setPassword, setConfirmPassword, submit, goToSignIn, expand },
  };
}

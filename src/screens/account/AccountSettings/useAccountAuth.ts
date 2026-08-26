/**
 * Ba khối của T3: mật khẩu, phiên đăng nhập, vùng nguy hiểm.
 *
 * **Hook này cố ý KHÔNG nhận `AccountDraftPort`.** Đó không phải chuyện quên:
 * [CẤM TUYỆT ĐỐI] nói không tự lưu mật khẩu, và cách chắc chắn nhất để giữ lời
 * đó là không đưa cho khối mật khẩu cái cửa dẫn tới bộ tự lưu. Đổi mật khẩu,
 * thu hồi phiên và việc trong vùng nguy hiểm đều là hành động chủ động, có nút
 * bấm và — với việc cuối — có hộp thoại xác nhận của A9.
 *
 * Ba trạng thái màn hình thuộc về T3: **4 lỗi** (mật khẩu hiện tại sai, lỗi buộc
 * vào đúng ô đó), **6 không có quyền** (tài khoản đăng nhập một lần, khối mật
 * khẩu chỉ đọc kèm câu "Do quản trị viên công ty quản lý."), và **nửa của 3 một
 * phần** (đọc phiên hỏng, dải cảnh báo nằm trong khối phiên chứ không phải trên
 * đầu trang).
 *
 * ## Bốn việc file này làm
 *
 * 1. **Đọc** danh tính và danh sách phiên qua `useQuery`, hai lượt tách rời —
 *    xem `accountAuthGateway.ts` để biết vì sao chúng không gộp làm một.
 * 2. **Kiểm** mật khẩu mới bằng một schema zod dựng tại chỗ, và **cùng schema đó**
 *    quyết định thanh sức mạnh sáng mấy ô. Xem {@link NewPasswordSchema}.
 * 3. **Hoãn** lượt thu hồi phiên sau một vé hoàn tác `UNDO_WINDOW_MS` (D-05).
 * 4. **Định dạng** mốc hoạt động cuối thành câu tương đối bằng `formatTimestamp`
 *    (P-02, A15) — view nhận chuỗi đã xong và không có phép định dạng nào.
 *
 * ## Ba luật của mối nối, và vì sao chữ ký chỉ mọc thêm một tham số tuỳ chọn
 *
 * `useAccountSettings.ts` (T2) gọi `useAccountAuth()` không tham số, và lời gọi
 * đó vẫn đúng từng chữ. Tham số `options` dưới đây có mặc định rỗng và chỉ tồn
 * tại cho test cùng story cắm cổng giả vào — đúng khuôn
 * `UseAccountSettingsOptions` của chính T2. Không có `AccountDraftPort` nào ở
 * đây, và sẽ không bao giờ có.
 *
 * Hook này **không** nhập ngược lại `useAccountSettings`: làm thế là khép một
 * vòng import mà `pnpm cycles` từ chối. Nó cũng chỉ nhập **kiểu** từ ba file
 * view, và ba file view không nhập gì từ đây — cùng một lý do.
 *
 * ## R1: 240 ms không tồn tại
 *
 * Đặc tả viết 240 ms cho lượt thu chiều cao của một hàng phiên. Thang chuyển
 * động của mục B có 120/180/260/340, không có 240, và `local/no-raw-duration`
 * từ chối mọi con số mili-giây viết thẳng trong `src/`. Nên con số đó là
 * `durationSeconds('standard')` — 260 ms — và nó nằm trong `SessionsSection.tsx`
 * chứ không ở đây. Tám giây của vé hoàn tác thì có sẵn tên: `UNDO_WINDOW_MS`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useToast } from '@/components/feedback/Toast';
import { MIN_PASSWORD_LENGTH, PasswordSchema } from '@/api/schemas';
import { formatTimestamp } from '@/lib/format/datetime';
import { UNDO_WINDOW_MS, createUndoTicket, type UndoTicket } from '@/lib/mutations/undoTicket';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import {
  createAccountAuthGateway,
  type AccountAuthFailure,
  type AccountAuthGateway,
  type AccountSession,
} from './accountAuthGateway';
import type { DangerZoneProps } from './DangerZone';
import type { PasswordSectionProps, PasswordStrengthLevel } from './PasswordSection';
import type { AccountSessionRow, SessionsSectionProps } from './SessionsSection';

/* -------------------------------------------------------------------------- */
/* Từ vựng.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu khối này nói ra, gom một chỗ.
 *
 * Viết thẳng bằng tiếng Việt chứ không tra `vi.json` lúc chạy: `src/i18n/vi.json`
 * là **từ điển để kiểm tra** chứ không phải bảng dịch (CLAUDE.md). Bản sao dành
 * cho bộ soát nằm ở `_i18n.auth.json` cùng thư mục, và lượt cuối gộp nó vào.
 */
const MESSAGES = {
  currentPasswordRequired: 'Chưa nhập mật khẩu hiện tại.',
  currentPasswordWrong: 'Mật khẩu hiện tại không đúng.',
  newPasswordRequired: 'Chưa nhập mật khẩu mới.',
  newPasswordTooShort: `Mật khẩu cần ít nhất ${String(MIN_PASSWORD_LENGTH)} ký tự.`,
  newPasswordNeedsLetterAndDigit: 'Mật khẩu cần có cả chữ và số.',
  newPasswordSameAsCurrent: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  confirmMismatch: 'Hai ô mật khẩu chưa khớp nhau.',
  passwordChanged: 'Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.',
  passwordManagedExternally: 'Tài khoản này do quản trị viên công ty quản lý, không đổi ở đây được.',
  sessionsUnavailable: 'Không đọc được danh sách phiên đang mở. Thử lại sau ít phút.',
  sessionGone: 'Phiên này đã đóng từ trước. Danh sách vừa được đọc lại.',
  signedOutOf: (device: string) => `Đã đăng xuất khỏi ${device}`,
  deleteEmailMismatch: 'Địa chỉ vừa gõ không khớp với tài khoản này.',
  deleteFailed: 'Không xoá được tài khoản lúc này. Thử lại sau ít phút.',
  identityUnavailable:
    'Chưa đọc được địa chỉ thư của tài khoản, nên chưa xoá được. Tải lại trang rồi thử lại.',
} as const;

/** Câu cho từng loại hỏng của cổng, khi không có câu cụ thể hơn. */
const FAILURE_MESSAGE: Readonly<Record<AccountAuthFailure, string>> = {
  'wrong-current-password': MESSAGES.currentPasswordWrong,
  'managed-externally': MESSAGES.passwordManagedExternally,
  'email-mismatch': MESSAGES.deleteEmailMismatch,
  'session-gone': MESSAGES.sessionGone,
  unavailable: MESSAGES.sessionsUnavailable,
};

/* -------------------------------------------------------------------------- */
/* Luật của mật khẩu mới.                                                      */
/* -------------------------------------------------------------------------- */

/** Chữ, theo nghĩa Unicode — `ắ` là chữ, `1` thì không. */
const LETTER_PATTERN = /\p{L}/u;

/** Chữ số thập phân, cũng theo nghĩa Unicode. */
const DIGIT_PATTERN = /\p{Nd}/u;

/** Từ đây trở lên thì thanh sức mạnh sáng đủ ba ô. */
const STRONG_PASSWORD_LENGTH = 12;

/**
 * Nửa còn thiếu của T-04, ghép tại chỗ.
 *
 * Đặc tả nói "tối thiểu 8 ký tự, **có chữ và số**". `src/api/schemas` chỉ có nửa
 * đầu — `PasswordSchema = z.string().min(1).min(MIN_PASSWORD_LENGTH)` — và không
 * có `.regex`, `.refine` hay `.superRefine` nào ở đó. Thư mục ấy là thứ màn này
 * không được sửa, nên nửa sau ghép ở đây, **trên nền `PasswordSchema` chứ không
 * viết lại số 8**: hai màn cùng từ chối một mật khẩu phải từ chối vì cùng một
 * lý do, và ngày `src/api` mọc thêm luật thì dòng này thừa ra chứ không lệch đi.
 *
 * Zod chỉ chạy phép `.refine` khi schema nền đã đạt, nên `issues[0]` luôn nói
 * đúng một chuyện: hoặc độ dài, hoặc chữ-và-số. Không bao giờ cả hai cùng lúc.
 */
export const NewPasswordSchema = PasswordSchema.refine(
  (value) => LETTER_PATTERN.test(value) && DIGIT_PATTERN.test(value),
  { message: 'letter-and-digit' },
);

/**
 * Câu phàn nàn đầu tiên về một mật khẩu mới, hoặc `null`.
 *
 * Cùng lối đi mà `useAuthScreen.sentenceFor` đã mở: schema mô tả **hình dạng**,
 * và hình dạng thì không có ngôn ngữ; chỗ một hình dạng không đạt trở thành câu
 * người đọc được là đây. Ô trống rơi vào `too_small` với `minimum` bằng 1 — vì
 * `.min(1)` khai trước `.min(8)` trong `PasswordSchema` — nên nó thành "chưa
 * nhập" chứ không thành "quá ngắn".
 */
export function newPasswordProblemOf(value: string): string | null {
  const parsed = NewPasswordSchema.safeParse(value);

  if (parsed.success) {
    return null;
  }

  const issue = parsed.error.issues[0];

  if (issue === undefined) {
    return null;
  }

  if (issue.code === z.ZodIssueCode.too_small && issue.minimum === MIN_PASSWORD_LENGTH) {
    return MESSAGES.newPasswordTooShort;
  }

  if (issue.code === z.ZodIssueCode.custom) {
    return MESSAGES.newPasswordNeedsLetterAndDigit;
  }

  return MESSAGES.newPasswordRequired;
}

/**
 * Ba mức của thanh sức mạnh, đọc ra từ **cùng** schema quyết định nút bấm được.
 *
 * Đó là toàn bộ lý do hàm này gọi `NewPasswordSchema` thay vì tự đếm ký tự: một
 * thanh nói "khá" cạnh một cái nút không bấm được là hai câu trả lời cho một câu
 * hỏi, và người dùng sẽ tin câu sai.
 */
export function passwordStrengthOf(value: string): PasswordStrengthLevel | null {
  if (value === '') {
    return null;
  }

  if (!NewPasswordSchema.safeParse(value).success) {
    return 'weak';
  }

  return value.length >= STRONG_PASSWORD_LENGTH ? 'strong' : 'fair';
}

/* -------------------------------------------------------------------------- */
/* Mối nối.                                                                    */
/* -------------------------------------------------------------------------- */

export interface AccountAuthModel {
  readonly password: PasswordSectionProps;
  readonly sessions: SessionsSectionProps;
  readonly danger: DangerZoneProps;
}

export interface UseAccountAuthOptions {
  /** Nguồn dữ liệu. Mặc định là cổng thật của ứng dụng. */
  readonly gateway?: AccountAuthGateway;
  /** Đồng hồ tiêm vào, cho `fakeClock`. Mốc "hoạt động cuối" đo theo nó. */
  readonly now?: () => number;
  /** Việc chạy sau khi tài khoản đã xoá — T-09 nối nó vào `signOut()` và điều hướng. */
  readonly onDeleted?: () => void;
}

/** Khoá bộ đệm, dựng tại chỗ: `queryKeys` chỉ có `user.current`/`user.list`. */
export const accountIdentityQueryKey = ['account', 'auth', 'identity'] as const;
export const accountSessionsQueryKey = ['account', 'auth', 'sessions'] as const;

/** Một lượt thu hồi đang đợi hết cửa sổ hoàn tác. */
interface PendingRevocation {
  readonly ticket: UndoTicket;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Ba ô mật khẩu. */
interface PasswordValues {
  readonly current: string;
  readonly next: string;
  readonly confirm: string;
}

const EMPTY_PASSWORDS: PasswordValues = { current: '', next: '', confirm: '' };

/**
 * `addToast` khi có `Toast.Provider`, `null` khi không.
 *
 * `AccountSettingsRoute` dựng provider, còn `AccountSettingsContainer` cố ý
 * không — để story và test dựng được màn mà không bắt buộc phải có nó
 * (`AccountSettings.container.tsx`). Gọi thẳng `useToast()` ở đây thì bộ kiểm của
 * T2, vốn dựng container trần, sẽ ném ngay lúc render; mà file đó là file T3
 * không được sửa.
 *
 * `useToast` là `useContext(ToastContext)` cộng một câu ném, và context đó không
 * được xuất ra — nên đây là cách duy nhất hỏi "có provider không" mà không sửa
 * `src/components`, thư mục màn này không được chạm. Lời gọi hook **không** có
 * điều kiện: `useContext` chạy xong rồi mới tới câu ném, nên số lời gọi hook
 * giống nhau ở mọi lượt render dù có provider hay không, và thứ tự hook — thứ
 * luật `rules-of-hooks` bảo vệ — không hề đổi. Vì vậy luật được tắt đúng một
 * dòng, kèm câu này.
 *
 * Toast là **thứ thêm vào** cho vé hoàn tác chứ không phải chỗ giữ nó: vé nằm ở
 * `createUndoTicket`, và không có provider thì lượt thu hồi vẫn hoãn đủ tám
 * giây, chỉ là không ai thấy lời mời bấm "Hoàn tác".
 */
function useOptionalToast(): ((message: string, onUndo: () => void) => void) | null {
  let addToast: ((toast: { message: string; onUndo?: () => void }) => void) | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- không có điều kiện: `useContext` bên trong `useToast` chạy ở mọi lượt render, chỉ câu ném sau nó mới phụ thuộc vào việc có `Toast.Provider` hay không. Xem đoạn tài liệu ngay trên.
    addToast = useToast().addToast;
  } catch {
    addToast = null;
  }

  return useMemo(() => {
    if (addToast === null) {
      return null;
    }

    const add = addToast;

    return (message: string, onUndo: () => void) => {
      add({ message, onUndo });
    };
  }, [addToast]);
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useAccountAuth(options: UseAccountAuthOptions = {}): AccountAuthModel {
  const [gateway] = useState(() => options.gateway ?? createAccountAuthGateway());
  // Chốt đồng hồ ở lượt render đầu: nơi gọi hay truyền một mũi tên mới mỗi lượt
  // render, và một `now` đổi tham chiếu mỗi lượt sẽ dựng lại mọi `useCallback`
  // và `useMemo` dưới đây mà không đổi lấy một hành vi nào.
  const [now] = useState(() => options.now ?? Date.now);
  const reducedMotion = useReducedMotion();
  const showUndoToast = useOptionalToast();

  const identityQuery = useQuery({
    queryKey: accountIdentityQueryKey,
    queryFn: async () => {
      const result = await gateway.readIdentity();

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });

  const sessionsQuery = useQuery({
    queryKey: accountSessionsQueryKey,
    queryFn: async () => {
      const result = await gateway.listSessions();

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });

  /* ---- Khối mật khẩu ---------------------------------------------------- */

  const [passwords, setPasswords] = useState<PasswordValues>(EMPTY_PASSWORDS);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [serverProblem, setServerProblem] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Chặn lượt gửi thứ hai trong cùng một nhịp.
   *
   * `isSubmitting` một mình không chặn được: hai lần Enter trong cùng một tick
   * đều đọc state của lượt render trước cả hai, và cả hai cùng gửi. Ref ghi đồng
   * bộ, nên lần thứ hai nhìn thấy lần thứ nhất. Cùng khuôn `useAuthScreen.ts`.
   */
  const inFlight = useRef(false);

  const setPasswordField = useCallback((field: keyof PasswordValues, value: string) => {
    setPasswords((current) => ({ ...current, [field]: value }));
    setSuccessMessage(null);

    if (field === 'current') {
      // Câu lỗi của máy chủ nói về chuỗi vừa bị thay; giữ nó lại là nói về một
      // thứ không còn nữa.
      setServerProblem(null);
    }
  }, []);

  const isManagedExternally = identityQuery.data?.isManagedExternally ?? false;
  const email = identityQuery.data?.email ?? '';

  const localNewProblem = newPasswordProblemOf(passwords.next);
  const sameAsCurrent =
    passwords.next !== '' && passwords.next === passwords.current
      ? MESSAGES.newPasswordSameAsCurrent
      : null;
  const confirmProblem =
    passwords.confirm !== passwords.next ? MESSAGES.confirmMismatch : null;

  const submitPassword = useCallback(() => {
    if (inFlight.current || isManagedExternally) {
      return;
    }

    setHasSubmitted(true);
    setSuccessMessage(null);

    const problem =
      newPasswordProblemOf(passwords.next) ??
      (passwords.next === passwords.current ? MESSAGES.newPasswordSameAsCurrent : null) ??
      (passwords.confirm === passwords.next ? null : MESSAGES.confirmMismatch);

    if (passwords.current === '' || problem !== null) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setServerProblem(null);

    void gateway
      .changePassword({ currentPassword: passwords.current, newPassword: passwords.next })
      .then((result) => {
        if (result.ok) {
          setPasswords(EMPTY_PASSWORDS);
          setHasSubmitted(false);
          setSuccessMessage(MESSAGES.passwordChanged);

          return;
        }

        setServerProblem(FAILURE_MESSAGE[result.error]);
      })
      .finally(() => {
        inFlight.current = false;
        setSubmitting(false);
      });
  }, [gateway, isManagedExternally, passwords]);

  /* ---- Khối phiên đăng nhập --------------------------------------------- */

  /**
   * Phiên đã biến khỏi danh sách nhưng chưa gửi lệnh thu hồi đi.
   *
   * Đây là chỗ vé hoàn tác của D-05 thật sự sống: hàng biến ngay để người dùng
   * thấy việc đã xong, còn lời gọi mạng đợi hết tám giây. Bấm "Hoàn tác" thì vé
   * chuyển sang `used`, hẹn giờ bị huỷ, và **chưa có gì đi qua dây** — nên đây
   * là một lượt hoàn tác thật chứ không phải một lượt thu hồi rồi tạo lại, thứ
   * mà không điểm cuối nào làm được.
   */
  const [pendingIds, setPendingIds] = useState<readonly string[]>([]);
  const [signingOutId, setSigningOutId] = useState<string | null>(null);
  const [revokeProblem, setRevokeProblem] = useState<string | null>(null);
  const pendingRef = useRef(new Map<string, PendingRevocation>());

  /**
   * Rời màn giữa cửa sổ hoàn tác thì hẹn giờ phải chết theo — nếu không nó gọi
   * `setState` trên một cây đã tháo.
   *
   * Nhưng **huỷ hẹn giờ không phải là huỷ việc**. Người dùng đã bấm "Đăng xuất",
   * đã thấy hàng biến, và đã không bấm hoàn tác; đóng thẻ trình duyệt hai giây
   * sau đó mà phiên vẫn còn mở là màn hình nói dối về đúng chuyện nó tồn tại để
   * nói thật. Nên lượt tháo cây **gửi nốt** mọi vé còn hiệu lực, thẳng qua cổng
   * và không chạm state — cây đã không còn ở đó để nghe câu trả lời.
   */
  useEffect(() => {
    const pending = pendingRef.current;

    return () => {
      for (const [sessionId, entry] of pending) {
        clearTimeout(entry.timer);

        if (entry.ticket.getStatus() === 'active') {
          void gateway.revokeSession({ sessionId });
        }
      }

      pending.clear();
    };
  }, [gateway]);

  const refetchSessions = sessionsQuery.refetch;

  const commitRevoke = useCallback(
    (sessionId: string) => {
      pendingRef.current.delete(sessionId);
      setSigningOutId(sessionId);

      void gateway
        .revokeSession({ sessionId })
        .then((result) => {
          if (!result.ok) {
            // Trả hàng về chỗ cũ: một hàng biến mất mà máy chủ vẫn giữ phiên đó
            // là màn hình nói dối về một chuyện an toàn.
            setRevokeProblem(FAILURE_MESSAGE[result.error]);
          }

          setPendingIds((current) => current.filter((id) => id !== sessionId));

          return refetchSessions();
        })
        .finally(() => {
          setSigningOutId(null);
        });
    },
    [gateway, refetchSessions],
  );

  const signOutSession = useCallback(
    (sessionId: string) => {
      if (pendingRef.current.has(sessionId)) {
        return;
      }

      const session = sessionsQuery.data?.find((candidate) => candidate.id === sessionId);

      if (session === undefined) {
        return;
      }

      setRevokeProblem(null);
      setPendingIds((current) => [...current, sessionId]);

      const ticket = createUndoTicket({
        description: MESSAGES.signedOutOf(session.device),
        now,
        undo: () => {
          const entry = pendingRef.current.get(sessionId);

          if (entry !== undefined) {
            clearTimeout(entry.timer);
            pendingRef.current.delete(sessionId);
          }

          setPendingIds((current) => current.filter((id) => id !== sessionId));
        },
      });

      showUndoToast?.(ticket.description, () => {
        ticket.undo();
      });

      const timer = setTimeout(() => {
        // Vé hết hạn nghĩa là người dùng đã để nó trôi qua: giờ mới gửi đi.
        if (ticket.getStatus() !== 'used') {
          commitRevoke(sessionId);
        }
      }, UNDO_WINDOW_MS);

      pendingRef.current.set(sessionId, { ticket, timer });
    },
    [commitRevoke, now, sessionsQuery.data, showUndoToast],
  );

  const rows = useMemo<readonly AccountSessionRow[]>(() => {
    const sessions: readonly AccountSession[] = sessionsQuery.data ?? [];
    const nowMs = now();

    return sessions
      .filter((session) => !pendingIds.includes(session.id))
      .map((session) => ({
        id: session.id,
        device: session.device,
        location: session.location,
        // P-02 và A15: mốc thô thành câu ở đây, một lần, không ở view.
        lastActiveLabel: formatTimestamp(session.lastActiveAt, nowMs),
        isCurrent: session.isCurrent,
      }));
  }, [now, pendingIds, sessionsQuery.data]);

  // Trạng thái 3 — một phần. Dải cảnh báo này đi vào KHỐI phiên; lỗi đọc cấp
  // trang là chuyện của T2 và nó thay chỗ cả bảy khối.
  const sessionsWarning =
    revokeProblem ?? (sessionsQuery.isError ? MESSAGES.sessionsUnavailable : null);

  const retrySessions = useCallback(() => {
    setRevokeProblem(null);
    void refetchSessions();
  }, [refetchSessions]);

  /* ---- Vùng nguy hiểm ---------------------------------------------------- */

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState('');
  const [isDeleting, setDeleting] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState<string | null>(null);
  const onDeleted = options.onDeleted;

  const canConfirmDelete =
    email !== '' && confirmValue.trim().toLowerCase() === email.toLowerCase() && !isDeleting;

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setConfirmValue('');
    setDeleteProblem(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!canConfirmDelete) {
      return;
    }

    setDeleting(true);
    setDeleteProblem(null);

    void gateway
      .deleteAccount({ confirmEmail: confirmValue })
      .then((result) => {
        if (!result.ok) {
          setDeleteProblem(FAILURE_MESSAGE[result.error] ?? MESSAGES.deleteFailed);

          return;
        }

        setDialogOpen(false);
        setConfirmValue('');
        onDeleted?.();
      })
      .finally(() => {
        setDeleting(false);
      });
  }, [canConfirmDelete, confirmValue, gateway, onDeleted]);

  /* ---- Ghép mô hình ------------------------------------------------------ */

  return {
    password: {
      currentPassword: passwords.current,
      newPassword: passwords.next,
      confirmPassword: passwords.confirm,
      onCurrentPasswordChange: (value) => setPasswordField('current', value),
      onNewPasswordChange: (value) => setPasswordField('next', value),
      onConfirmPasswordChange: (value) => setPasswordField('confirm', value),
      // Trạng thái 4: câu của máy chủ đứng trước, vì nó nói về đúng ô này.
      currentPasswordProblem:
        serverProblem ??
        (hasSubmitted && passwords.current === '' ? MESSAGES.currentPasswordRequired : null),
      newPasswordProblem: hasSubmitted ? (localNewProblem ?? sameAsCurrent) : null,
      confirmPasswordProblem: hasSubmitted ? confirmProblem : null,
      strength: passwordStrengthOf(passwords.next),
      canSubmit:
        passwords.current !== '' &&
        passwords.next !== '' &&
        passwords.confirm !== '' &&
        !isSubmitting,
      isSubmitting,
      onSubmit: submitPassword,
      successMessage,
      isManagedExternally,
    },
    sessions: {
      rows,
      warning: sessionsWarning,
      onRetry: retrySessions,
      onSignOut: signOutSession,
      signingOutId,
      reducedMotion,
    },
    danger: {
      email,
      isDialogOpen,
      onRequestDelete: () => setDialogOpen(true),
      onCancelDelete: closeDialog,
      onConfirmDelete: confirmDelete,
      confirmValue,
      onConfirmValueChange: setConfirmValue,
      canConfirm: canConfirmDelete,
      isDeleting,
      // Đọc danh tính hỏng thì không có địa chỉ nào để đối chiếu, nên cửa của A9
      // không mở được. Nói ra lý do; một cái nút khoá không giải thích gì là
      // cách chắc chắn nhất để người dùng bấm mười lần rồi bỏ đi.
      errorMessage:
        deleteProblem ?? (identityQuery.isError ? MESSAGES.identityUnavailable : null),
    },
  };
}

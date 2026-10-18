/**
 * `/login/invitation#token=…` — người được mời đặt họ tên và mật khẩu (N10).
 *
 * View thuần, cùng khuôn với màn đặt lại mật khẩu: props vào, markup ra. Hai điều riêng
 * của màn này: biểu mẫu mang `aria-busy` khi phiên chưa rõ (nút nhận lời mời khoá cho
 * tới lúc biết có ai đang đăng nhập không), và sau khi nhận xong mà phiên không mở thì
 * chỉ còn một đường — tới đăng nhập.
 */

import { useCallback, useEffect, useRef } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCalendarDate, formatClockTime } from '@/lib/format/datetime';
import { ROUTES } from '@/routes/paths';

/* Nhập THEO TÊN, không default — lý do ở `../recoveryShared.ts`. */
import {
  auth as AUTH_MESSAGES,
  common as COMMON_MESSAGES,
  errors as ERROR_MESSAGES,
} from '@/i18n/vi.json';

import { PasswordField } from '../PasswordField';
import {
  FIELD_ERROR_SLOT,
  FIELD_ERROR_SLOT_THREE_LINES,
  RecoveryDeadEnd,
  RecoveryLink,
  RecoveryNoticeStrip,
  RecoveryShell,
  RecoveryStatus,
} from '../RecoveryShell';
import { passwordTooShort } from '../recoveryShared';
import { useReturnFocus } from '../useReturnFocus';
import {
  useInvitationAccept,
  type InvitationAcceptActions,
  type InvitationAcceptModel,
  type InvitationDeadReason,
  type UseInvitationAcceptOptions,
} from './useInvitationAccept';
import type { InvitationPreview } from '@/api/schemas/auth';

export type InvitationAcceptViewProps = InvitationAcceptModel & InvitationAcceptActions;

// ponytail: chữ để tại chỗ vì vi.json thuộc gói khác (P54); chuyển vào `auth.invitation` khi gộp.
const DEAD_REASON_MESSAGES: Readonly<Record<InvitationDeadReason, string>> = {
  invalid:
    'Liên kết lời mời không đúng (có thể bị chép thiếu hoặc sai). Hãy mở lại đúng liên kết trong thư mời, hoặc nhờ quản trị viên gửi lại lời mời.',
  expired:
    'Lời mời đã hết hạn hoặc đã được gửi lại bằng thư mới. Hãy mở liên kết trong thư mời mới nhất, hoặc nhờ quản trị viên gửi lại lời mời.',
  used: 'Lời mời này đã được nhận. Hãy đăng nhập bằng mật khẩu bạn đã đặt.',
};
const ROLE_LABELS: Readonly<Record<InvitationPreview['role'], string>> = {
  admin: 'Quản trị viên',
  engineer: 'Kỹ sư',
  viewer: 'Người xem',
};
const CHECKING_MESSAGE = 'Đang kiểm tra lời mời…';

function InvitationSummary({ preview }: { readonly preview: InvitationPreview }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border-default bg-bg-sunken px-3 py-2 text-[14px] leading-5">
      <dt className="text-text-secondary">Tài khoản</dt>
      <dd className="break-all font-medium text-text-primary">{preview.email}</dd>
      <dt className="text-text-secondary">Vai</dt>
      <dd className="text-text-primary">{ROLE_LABELS[preview.role]}</dd>
      {preview.inviterName !== undefined && (
        <>
          <dt className="text-text-secondary">Người mời</dt>
          <dd className="text-text-primary">{preview.inviterName}</dd>
        </>
      )}
      <dt className="text-text-secondary">Hết hạn</dt>
      <dd className="text-text-primary">
        {formatClockTime(new Date(preview.expiresAt))} {formatCalendarDate(new Date(preview.expiresAt))}
      </dd>
    </dl>
  );
}

export function InvitationAcceptView(props: InvitationAcceptViewProps) {
  const { state, values, problems, notice, warning, canSubmit, isSubmitting, isDone } = props;
  const { needsSignIn, isSessionPending, isSessionUnavailable, retryNotice, isLinkIncomplete } = props;
  const { deadReason = null, preview = null, isPreviewPending = false } = props;
  const { setFullName, setPassword, setConfirmPassword, submit, goToSignIn, expand, retrySession } =
    props;
  const fullNameRef = useRef<HTMLInputElement>(null);

  // Thử lại thành công thì dải (và nút đang giữ tiêu điểm) biến mất: đưa tiêu điểm về ô đầu
  // tiên thay vì để nó rơi về `body`. Chỉ khi nó thật sự rơi — không giật tiêu điểm của ai.
  const wasUnavailable = useRef(isSessionUnavailable);
  useEffect(() => {
    const lostFocus = document.activeElement === null || document.activeElement === document.body;

    if (wasUnavailable.current && !isSessionUnavailable && lostFocus) {
      fullNameRef.current?.focus();
    }

    wasUnavailable.current = isSessionUnavailable;
  }, [isSessionUnavailable]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const fieldsDisabled = isSubmitting || isDone || needsSignIn;
  const focusReturn = useReturnFocus(isSubmitting);

  return (
    <RecoveryShell
      title={AUTH_MESSAGES.invitation.title}
      // Ngõ cụt không còn ô nhập, và xong rồi thì ô đã khoá: phụ đề "đặt họ tên và mật khẩu" thành lời mời
      // làm việc không làm được nữa (BUG-005, BUG-097).
      subtitle={
        state === 'forbidden'
          ? AUTH_MESSAGES.invitation.deadEndSubtitle
          : isDone
            ? AUTH_MESSAGES.invitation.doneSubtitle
            : AUTH_MESSAGES.invitation.subtitle
      }
      state={state}
    >
      {state === 'collapsed' ? (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-5 text-text-secondary">
            {AUTH_MESSAGES.notices.collapsedRecovery}
          </p>
          <Button size="lg" fullWidth onClick={expand}>
            {AUTH_MESSAGES.actions.expand}
          </Button>
        </div>
      ) : state === 'forbidden' ? (
        <RecoveryDeadEnd
          message={
            isLinkIncomplete
              ? AUTH_MESSAGES.invitation.incomplete
              : deadReason !== null
                ? DEAD_REASON_MESSAGES[deadReason]
                : AUTH_MESSAGES.invitation.expired
          }
          linkLabel={AUTH_MESSAGES.actions.goToSignIn}
          href={ROUTES.login}
          onLinkClick={goToSignIn}
        />
      ) : isPreviewPending ? (
        <p role="status" aria-busy="true" className="text-[14px] leading-5 text-text-secondary">
          {CHECKING_MESSAGE}
        </p>
      ) : (
        <form
          ref={focusReturn.ref}
          className="flex flex-col gap-6"
          noValidate
          aria-busy={isSessionPending}
          onSubmit={handleSubmit}
          onFocus={focusReturn.onFocus}
        >
          {preview !== null && <InvitationSummary preview={preview} />}
          {/* Không `gap`: mỗi ô giữ sẵn chỗ cho câu lỗi dài nhất của nó, chỗ ấy là khoảng cách — câu
              lỗi hiện hay mất không đẩy ô dưới và nút gửi (BUG-008, QA-01c nợ #10). */}
          <div className="flex flex-col">
            <Input
              label={AUTH_MESSAGES.fields.fullName}
              ref={fullNameRef}
              autoComplete="name"
              wrapperClassName={FIELD_ERROR_SLOT_THREE_LINES}
              autoFocus
              value={values.fullName}
              disabled={fieldsDisabled}
              {...(problems.fullName !== undefined ? { error: problems.fullName } : {})}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
            />
            <PasswordField
              label={AUTH_MESSAGES.fields.password}
              hint={passwordTooShort()}
              autoComplete="new-password"
              wrapperClassName={FIELD_ERROR_SLOT}
              value={values.password}
              disabled={fieldsDisabled}
              {...(problems.password !== undefined ? { error: problems.password } : {})}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
            <PasswordField
              label={AUTH_MESSAGES.fields.confirmPassword}
              autoComplete="new-password"
              wrapperClassName={FIELD_ERROR_SLOT}
              value={values.confirmPassword}
              disabled={fieldsDisabled}
              {...(problems.confirmPassword !== undefined
                ? { error: problems.confirmPassword }
                : {})}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
              }}
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!canSubmit}>
            {isSubmitting
              ? AUTH_MESSAGES.actions.submitting
              : AUTH_MESSAGES.actions.acceptInvitation}
          </Button>
          {/* Dải mất kết nối phiên cũng dưới nút: trên ô nhập nó đẩy cả biểu mẫu xuống ~100 px khi hiện (BUG-008).
              Nút "Thử lại" của nó là `type="button"` (InlineAlert) — không gửi biểu mẫu, không tiêu mã. */}
          {isSessionUnavailable && (
            <InlineAlert
              level="attention"
              message={ERROR_MESSAGES.network.description}
              action={{ label: COMMON_MESSAGES.retry, onClick: retrySession }}
            />
          )}
          {/* Dưới nút gửi, không trên ô nhập: dải hiện ra không đẩy nút và ô khỏi chỗ con trỏ vừa bấm
              (BUG-008) — cả dải cảnh báo lẫn câu thử lại (QA-01c nợ #11). Câu trạng thái luôn gắn sẵn,
              điền sau, để trình đọc màn hình đọc ra. */}
          <RecoveryStatus success={isDone ? AUTH_MESSAGES.invitation.success : null} note={retryNotice} />
          <RecoveryNoticeStrip notice={warning} />
          <RecoveryNoticeStrip notice={notice} />

          {needsSignIn && (
            <RecoveryLink
              label={AUTH_MESSAGES.actions.goToSignIn}
              href={ROUTES.login}
              onClick={goToSignIn}
            />
          )}
        </form>
      )}
    </RecoveryShell>
  );
}

export type InvitationAcceptProps = UseInvitationAcceptOptions;

/** Giao diện nối với logic, cho host đã có sẵn cổng. */
export function InvitationAccept(props: InvitationAcceptProps) {
  const { model, actions } = useInvitationAccept(props);

  return <InvitationAcceptView {...model} {...actions} />;
}

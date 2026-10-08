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
import { ROUTES } from '@/routes/paths';

/* Nhập THEO TÊN, không default — lý do ở `../recoveryShared.ts`. */
import {
  auth as AUTH_MESSAGES,
  common as COMMON_MESSAGES,
  errors as ERROR_MESSAGES,
} from '@/i18n/vi.json';

import { RecoveryDeadEnd, RecoveryLink, RecoveryNoticeStrip, RecoveryShell } from '../RecoveryShell';
import {
  useInvitationAccept,
  type InvitationAcceptActions,
  type InvitationAcceptModel,
  type UseInvitationAcceptOptions,
} from './useInvitationAccept';

export type InvitationAcceptViewProps = InvitationAcceptModel & InvitationAcceptActions;

export function InvitationAcceptView(props: InvitationAcceptViewProps) {
  const { state, values, problems, notice, warning, canSubmit, isSubmitting, isDone } = props;
  const { needsSignIn, isSessionPending, isSessionUnavailable, retryNotice, isLinkIncomplete } = props;
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

  return (
    <RecoveryShell
      title={AUTH_MESSAGES.invitation.title}
      // Ngõ cụt không còn ô nhập: phụ đề "đặt họ tên và mật khẩu" thành lời mời làm việc không làm được (BUG-005).
      subtitle={
        state === 'forbidden' ? AUTH_MESSAGES.invitation.deadEndSubtitle : AUTH_MESSAGES.invitation.subtitle
      }
      state={state}
    >
      {state === 'collapsed' ? (
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-[20px] text-text-secondary">
            {AUTH_MESSAGES.notices.collapsedRecovery}
          </p>
          <Button size="lg" fullWidth onClick={expand}>
            {AUTH_MESSAGES.actions.expand}
          </Button>
        </div>
      ) : state === 'forbidden' ? (
        <RecoveryDeadEnd
          message={isLinkIncomplete ? AUTH_MESSAGES.invitation.incomplete : AUTH_MESSAGES.invitation.expired}
          linkLabel={AUTH_MESSAGES.actions.goToSignIn}
          href={ROUTES.login}
          onLinkClick={goToSignIn}
        />
      ) : (
        <>
          {/* Ngoài `<form>`: dải nói về phiên, không phải về biểu mẫu — bấm "Thử lại" không dính gì tới lượt gửi. */}
          {isSessionUnavailable && (
            <InlineAlert
              level="attention"
              title={ERROR_MESSAGES.network.title}
              message={ERROR_MESSAGES.network.description}
              action={{ label: COMMON_MESSAGES.retry, onClick: retrySession }}
            />
          )}
          <form
            className="flex flex-col gap-6"
            noValidate
            aria-busy={isSessionPending}
            onSubmit={handleSubmit}
          >
            <RecoveryNoticeStrip notice={warning} />
            {/* Always mounted, filled later, so a screen reader announces the text. */}
            <p
              role="status"
              className="text-[13px] leading-[18px] text-text-secondary empty:sr-only"
            >
              {isDone ? AUTH_MESSAGES.invitation.success : retryNotice}
            </p>

            <div className="flex flex-col gap-4">
              <Input
                label={AUTH_MESSAGES.fields.fullName}
                ref={fullNameRef}
                autoComplete="name"
                autoFocus
                value={values.fullName}
                disabled={fieldsDisabled}
                {...(problems.fullName !== undefined ? { error: problems.fullName } : {})}
                onChange={(event) => {
                  setFullName(event.target.value);
                }}
              />
              <Input
                type="password"
                label={AUTH_MESSAGES.fields.password}
                autoComplete="new-password"
                value={values.password}
                disabled={fieldsDisabled}
                {...(problems.password !== undefined ? { error: problems.password } : {})}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
              <Input
                type="password"
                label={AUTH_MESSAGES.fields.confirmPassword}
                autoComplete="new-password"
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
            {/* Dưới nút gửi, không trên ô nhập: dải hiện ra không đẩy nút và ô khỏi chỗ con trỏ vừa bấm (BUG-008). */}
            <RecoveryNoticeStrip notice={notice} />

            {needsSignIn && (
              <RecoveryLink
                label={AUTH_MESSAGES.actions.goToSignIn}
                href={ROUTES.login}
                onClick={goToSignIn}
              />
            )}
          </form>
        </>
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

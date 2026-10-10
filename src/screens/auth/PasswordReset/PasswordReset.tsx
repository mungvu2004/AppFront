/**
 * `/login/reset-password#token=…` — đặt mật khẩu mới từ liên kết trong thư (N9).
 *
 * View thuần: nhận props, vẽ, không giữ state, không gọi cổng, không viết câu nào
 * ngoài `vi.json`. Bảy trạng thái của A11 đến từ `state`; riêng `forbidden` (mã hỏng
 * hoặc đã dùng) bỏ hẳn biểu mẫu vì không còn gì để nhập.
 */

import { useCallback } from 'react';

import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/routes/paths';

/* Nhập THEO TÊN, không default — lý do ở `../recoveryShared.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { PasswordField } from '../PasswordField';
import {
  FIELD_ERROR_SLOT,
  RecoveryDeadEnd,
  RecoveryLink,
  RecoveryNoticeStrip,
  RecoveryShell,
  RecoveryStatus,
} from '../RecoveryShell';
import { useReturnFocus } from '../useReturnFocus';
import { passwordTooShort } from '../recoveryShared';
import {
  usePasswordReset,
  type PasswordResetActions,
  type PasswordResetModel,
  type UsePasswordResetOptions,
} from './usePasswordReset';

export type PasswordResetViewProps = PasswordResetModel & PasswordResetActions;

export function PasswordResetView(props: PasswordResetViewProps) {
  const { state, values, problems, notice, canSubmit, isSubmitting, isDone, isLinkIncomplete } = props;
  const { setNewPassword, setConfirmPassword, submit, goToSignIn, expand } = props;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const fieldsDisabled = isSubmitting || isDone;
  const focusReturn = useReturnFocus(isSubmitting);

  return (
    <RecoveryShell
      title={AUTH_MESSAGES.passwordReset.title}
      // Ngõ cụt không còn ô nhập, và xong rồi thì ô đã khoá: phụ đề "nhập mật khẩu mới" thành lời mời làm
      // việc không làm được nữa (BUG-005, BUG-097).
      subtitle={
        state === 'forbidden'
          ? AUTH_MESSAGES.passwordReset.deadEndSubtitle
          : isDone
            ? AUTH_MESSAGES.passwordReset.doneSubtitle
            : AUTH_MESSAGES.passwordReset.subtitle
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
          message={
            isLinkIncomplete ? AUTH_MESSAGES.passwordReset.incomplete : AUTH_MESSAGES.passwordReset.expired
          }
          linkLabel={AUTH_MESSAGES.actions.goToSignIn}
          href={ROUTES.login}
          onLinkClick={goToSignIn}
        />
      ) : (
        <form
          ref={focusReturn.ref}
          className="flex flex-col gap-6"
          noValidate
          onSubmit={handleSubmit}
          onFocus={focusReturn.onFocus}
        >
          {/* Không `gap`: mỗi ô giữ sẵn chỗ cho câu lỗi hai dòng, chỗ ấy là khoảng cách — câu lỗi hiện
              hay mất không đẩy ô dưới và nút gửi (BUG-008, QA-01c nợ #10). */}
          <div className="flex flex-col">
            <PasswordField
              label={AUTH_MESSAGES.fields.newPassword}
              hint={passwordTooShort()}
              autoComplete="new-password"
              wrapperClassName={FIELD_ERROR_SLOT}
              autoFocus
              value={values.newPassword}
              disabled={fieldsDisabled}
              {...(problems.newPassword !== undefined ? { error: problems.newPassword } : {})}
              onChange={(event) => {
                setNewPassword(event.target.value);
              }}
            />
            <PasswordField
              label={AUTH_MESSAGES.fields.confirmPassword}
              autoComplete="new-password"
              wrapperClassName={FIELD_ERROR_SLOT}
              value={values.confirmPassword}
              disabled={fieldsDisabled}
              {...(problems.confirmPassword !== undefined ? { error: problems.confirmPassword } : {})}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
              }}
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!canSubmit}>
            {isSubmitting ? AUTH_MESSAGES.actions.submitting : AUTH_MESSAGES.actions.setNewPassword}
          </Button>
          {/* Ngay dưới nút gửi, cùng chỗ với màn lời mời (BUG-097). */}
          <RecoveryStatus success={isDone ? AUTH_MESSAGES.passwordReset.success : null} />
          {/* Dưới nút gửi, không trên ô nhập: dải hiện ra không đẩy nút và ô khỏi chỗ con trỏ vừa bấm (BUG-008). */}
          <RecoveryNoticeStrip notice={notice} />
          {/* Lối về `/login` cả khi biểu mẫu còn dùng được, không chỉ ở ngõ cụt (BUG-050). */}
          <RecoveryLink label={AUTH_MESSAGES.actions.goToSignIn} href={ROUTES.login} onClick={goToSignIn} />
        </form>
      )}
    </RecoveryShell>
  );
}

export type PasswordResetProps = UsePasswordResetOptions;

/** Giao diện nối với logic, cho host đã có sẵn cổng. */
export function PasswordReset(props: PasswordResetProps) {
  const { model, actions } = usePasswordReset(props);

  return <PasswordResetView {...model} {...actions} />;
}

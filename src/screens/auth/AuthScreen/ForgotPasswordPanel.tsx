/**
 * Panel "Quên mật khẩu" của `/login` (N8) — view thuần, nhận props.
 *
 * Thay chỗ biểu mẫu đăng nhập chứ không mở lớp phủ: Esc ở đây là "quay lại đăng
 * nhập" (A12), và nút quay lại trả tiêu điểm về ô thư điện tử của biểu mẫu đăng nhập.
 * Câu "đã gửi" nằm trong một khối trung tính có viền và biểu tượng thư để người dùng nhận ra
 * yêu cầu đã đi (BUG-022) — KHÔNG phải xanh "verified": N8 luôn trả 204 nên chẳng có gì được
 * xác minh, và A5 giữ màu ấy cho việc người duyệt làm. Câu chữ vốn cũng không khẳng định chắc.
 */

import { useCallback } from 'react';
import { Mail } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/* Nhập THEO TÊN, không default — xem ghi chú ở `useAuthScreen.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { FIELD_ERROR_SLOT, RecoveryNoticeStrip } from '../RecoveryShell';
import type { ForgotPasswordActions, ForgotPasswordModel } from './useForgotPassword';

export interface ForgotPasswordPanelProps {
  readonly model: ForgotPasswordModel;
  readonly actions: ForgotPasswordActions;
  readonly onBack: () => void;
  /** Đưa tiêu điểm vào ô thư điện tử khi panel vừa hiện. */
  readonly registerEmailField: (element: HTMLInputElement | null) => void;
}

export function ForgotPasswordPanel({ model, actions, onBack, registerEmailField }: ForgotPasswordPanelProps) {
  const { email, problem, notice, sentMessage, isSending, isSent, canSubmit } = model;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      actions.submit();
    },
    [actions],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }
    },
    [onBack],
  );

  return (
    <form className="flex flex-col" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <Input
        ref={registerEmailField}
        type="email"
        label={AUTH_MESSAGES.fields.email}
        autoComplete="username"
        wrapperClassName={FIELD_ERROR_SLOT}
        value={email}
        disabled={isSending}
        {...(problem !== undefined ? { error: problem } : {})}
        onChange={(event) => {
          actions.setEmail(event.target.value);
        }}
      />

      <div className="flex flex-col gap-4">
        <Button type="submit" size="lg" fullWidth loading={isSending} disabled={!canSubmit}>
          {isSending ? AUTH_MESSAGES.actions.submitting : AUTH_MESSAGES.actions.sendResetLink}
        </Button>
        {/* Under the button, as on the sign-in form: above the field, the strip and the "đã gửi"
            block pushed the field and the button down from under the cursor (BUG-008). */}
        <RecoveryNoticeStrip notice={notice} />
        {/* Always mounted, filled later: a region inserted together with its text is often not read. */}
        <div role="status" className="empty:sr-only">
          {sentMessage !== null && (
            <div className="flex items-start gap-3 rounded-[8px] border border-border-default p-3">
              <Mail aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-text-secondary" strokeWidth={2} />
              <p className="text-[14px] leading-relaxed text-text-primary">{sentMessage}</p>
            </div>
          )}
        </div>
        {/* The button is locked after a send (a second identical letter helps no one): say how to unlock it. */}
        {isSent && (
          <p className="text-center text-[13px] leading-[18px] text-text-secondary">
            {AUTH_MESSAGES.forgotPassword.sentHint}
          </p>
        )}
        <button
          type="button"
          onClick={onBack}
          className="self-center py-1 text-[13px] leading-[18px] text-accent-hover transition-colors duration-120 hover:text-accent-active rounded outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
        >
          {AUTH_MESSAGES.actions.backToSignIn}
        </button>
      </div>
    </form>
  );
}

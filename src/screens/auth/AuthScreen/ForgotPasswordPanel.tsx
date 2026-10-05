/**
 * Panel "Quên mật khẩu" của `/login` (N8) — view thuần, nhận props.
 *
 * Thay chỗ biểu mẫu đăng nhập chứ không mở lớp phủ: Esc ở đây là "quay lại đăng
 * nhập" (A12), và nút quay lại trả tiêu điểm về ô thư điện tử của biểu mẫu đăng nhập.
 * Câu thành công là câu trung tính, chữ phụ, không màu trạng thái: N8 luôn trả 204 nên
 * nó không được nói địa chỉ có tài khoản hay không.
 */

import { useCallback } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/* Nhập THEO TÊN, không default — xem ghi chú ở `useAuthScreen.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { RecoveryNoticeStrip } from '../RecoveryShell';
import type { ForgotPasswordActions, ForgotPasswordModel } from './useForgotPassword';

export interface ForgotPasswordPanelProps {
  readonly model: ForgotPasswordModel;
  readonly actions: ForgotPasswordActions;
  readonly onBack: () => void;
  /** Đưa tiêu điểm vào ô thư điện tử khi panel vừa hiện. */
  readonly registerEmailField: (element: HTMLInputElement | null) => void;
}

export function ForgotPasswordPanel({ model, actions, onBack, registerEmailField }: ForgotPasswordPanelProps) {
  const { email, problem, notice, sentMessage, isSending, canSubmit } = model;

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
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <p className="text-[14px] leading-[20px] text-text-secondary">{AUTH_MESSAGES.forgotPassword.subtitle}</p>

      <RecoveryNoticeStrip notice={notice} />

      {sentMessage !== null && (
        <p role="status" className="text-[13px] leading-[18px] text-text-secondary">
          {sentMessage}
        </p>
      )}

      <Input
        ref={registerEmailField}
        type="email"
        label={AUTH_MESSAGES.fields.email}
        autoComplete="username"
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
        <button
          type="button"
          onClick={onBack}
          className="self-center text-[13px] leading-[18px] text-accent transition-colors duration-120 hover:text-accent-hover"
        >
          {AUTH_MESSAGES.actions.backToSignIn}
        </button>
      </div>
    </form>
  );
}

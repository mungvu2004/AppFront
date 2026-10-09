import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';

import { PasswordField } from './PasswordField';

const AUTH = viMessages.auth;
const LABEL = AUTH.fields.newPassword;

afterEach(cleanup);

function box(): HTMLInputElement {
  return screen.getByLabelText(LABEL);
}

describe('PasswordField — the eye button (BUG-051)', () => {
  it('starts masked, then shows and hides the text, saying which on its name alone', () => {
    render(<PasswordField label={LABEL} defaultValue="mat-khau-moi-1" />);

    const show = screen.getByRole('button', { name: AUTH.actions.showPassword });
    expect(box()).toHaveAttribute('type', 'password');
    // Nhãn đổi Hiện/Ẩn đã nói trạng thái; `aria-pressed` nữa là nói hai lần (APG).
    expect(show).not.toHaveAttribute('aria-pressed');
    expect(show).toHaveAttribute('aria-controls', box().id);

    fireEvent.click(show);

    const hide = screen.getByRole('button', { name: AUTH.actions.hidePassword });
    expect(box()).toHaveAttribute('type', 'text');
    expect(box().value).toBe('mat-khau-moi-1');
    expect(hide).not.toHaveAttribute('aria-pressed');

    fireEvent.click(hide);
    expect(box()).toHaveAttribute('type', 'password');
  });

  /**
   * Enter trên một nút đang giữ tiêu điểm, trình duyệt làm đúng một việc: kích hoạt nút, tức
   * phát `click`. `user-event` dựng đúng chuỗi ấy (keydown Enter → click → keyup), và lượt kích
   * hoạt KHÔNG rỗng: nếu nút là `type="submit"` thì nó gửi biểu mẫu và `onSubmit` bị gọi.
   */
  it('never sends the form it sits in when Enter activates it (BUG-011)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label={LABEL} />
      </form>,
    );

    const button = screen.getByRole('button', { name: AUTH.actions.showPassword });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');

    expect(box()).toHaveAttribute('type', 'text');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks the button with the box', () => {
    render(<PasswordField label={LABEL} disabled />);

    expect(screen.getByRole('button', { name: AUTH.actions.showPassword })).toBeDisabled();
  });
});

describe('PasswordField — the rule said up front (BUG-049)', () => {
  const HINT = 'Mật khẩu cần ít nhất 8 ký tự.';

  it('shows the hint under the box and ties it to the box', () => {
    render(<PasswordField label={LABEL} hint={HINT} />);

    expect(box()).toHaveAccessibleDescription(HINT);
  });

  it('gives way to the error, which then describes the box', () => {
    render(<PasswordField label={LABEL} hint={HINT} error={AUTH.problems.passwordRequired} />);

    expect(screen.queryByText(HINT)).toBeNull();
    expect(box()).toHaveAccessibleDescription(AUTH.problems.passwordRequired);
  });

  it('keeps a description the caller ties on, next to its own', () => {
    render(
      <>
        <p id="caller-note">Mật khẩu do quản trị cấp.</p>
        <PasswordField label={LABEL} hint={HINT} aria-describedby="caller-note" />
      </>,
    );

    expect(box()).toHaveAccessibleDescription(`Mật khẩu do quản trị cấp. ${HINT}`);
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
   * phát `click`. `@testing-library/user-event` không có trong repo (xem
   * `DimensionOcrReview.test.tsx`) và jsdom không tự đổi `keydown` thành `click`, nên bài kiểm
   * dựng đúng chuỗi ấy: tiêu điểm lên nút, `keydown` Enter, rồi lượt kích hoạt. Lượt kích hoạt
   * KHÔNG rỗng: jsdom có cài hành vi kích hoạt của nút gửi, nên nếu nút là `type="submit"` thì
   * `click` này gửi biểu mẫu và `onSubmit` bị gọi.
   */
  it('never sends the form it sits in when Enter activates it (BUG-011)', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label={LABEL} />
      </form>,
    );

    const button = screen.getByRole('button', { name: AUTH.actions.showPassword });
    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.click(button);

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
});

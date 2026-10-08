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
  it('starts masked, then shows and hides the text, saying which on its name and on aria-pressed', () => {
    render(<PasswordField label={LABEL} defaultValue="mat-khau-moi-1" />);

    const show = screen.getByRole('button', { name: AUTH.actions.showPassword });
    expect(box()).toHaveAttribute('type', 'password');
    expect(show).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(show);

    const hide = screen.getByRole('button', { name: AUTH.actions.hidePassword });
    expect(box()).toHaveAttribute('type', 'text');
    expect(box().value).toBe('mat-khau-moi-1');
    expect(hide).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hide);
    expect(box()).toHaveAttribute('type', 'password');
  });

  it('never sends the form it sits in, by click or by Enter (BUG-011)', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <PasswordField label={LABEL} />
      </form>,
    );

    const button = screen.getByRole('button', { name: AUTH.actions.showPassword });
    expect(button).toHaveAttribute('type', 'button');
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true);
    fireEvent.click(button);

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

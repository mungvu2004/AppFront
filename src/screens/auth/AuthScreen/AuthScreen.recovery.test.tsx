/**
 * F-09a on the sign-in screen: no sign-up, errors by wire `code`, the forgot-password
 * panel (N8) and the opening sentences. The older behaviour stays in `AuthScreen.test.tsx`.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import type { Result } from '@/lib/http';

import { networkFailure, okVoid, wireFailure } from '../authTestKit';
import { AuthScreen } from './AuthScreen';
import type { AuthGateway } from './useAuthScreen';

const AUTH = viMessages.auth;
const EMAIL = 'thu.ha@vidu.vn';
const PASSWORD = 'khong-doan-duoc';

type Reply = Result<void, unknown>;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(options: { signIn?: Reply; reset?: Reply; initialNotice?: 'passwordReset' | 'sessionEnded' } = {}) {
  const signIn = vi.fn<AuthGateway['signIn']>(async () => options.signIn ?? okVoid());
  const requestPasswordReset = vi.fn<AuthGateway['requestPasswordReset']>(
    async () => options.reset ?? okVoid(),
  );
  const gateway: AuthGateway = { signIn, requestPasswordReset };
  const view = render(
    <AuthScreen
      gateway={gateway}
      onAuthenticated={() => undefined}
      reducedMotion
      {...(options.initialNotice !== undefined ? { initialNotice: options.initialNotice } : {})}
    />,
  );

  return { ...view, signIn, requestPasswordReset };
}

const stateOf = (container: HTMLElement): string | null =>
  container.querySelector('main')?.getAttribute('data-auth-state') ?? null;

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function signInWith(): void {
  type(AUTH.fields.email, EMAIL);
  type(AUTH.fields.password, PASSWORD);
  fireEvent.keyDown(screen.getByLabelText(AUTH.fields.password), { key: 'Enter' });
}

describe('AuthScreen — no sign-up in v1', () => {
  it('has no tablist, no tab and no word "đăng ký" anywhere in the DOM', () => {
    const { container } = setup();

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(container.textContent?.toLocaleLowerCase('vi')).not.toContain('đăng ký');
    expect(screen.queryByLabelText(AUTH.fields.fullName)).toBeNull();
  });
});

describe('AuthScreen — failures read by wire code', () => {
  it('does NOT read a bare 403 as a disabled account', async () => {
    const { container } = setup({ signIn: wireFailure(403) });

    signInWith();

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(screen.queryByText(AUTH.errors.accountDisabled.title)).toBeNull();
    expect(screen.getByLabelText(AUTH.fields.email)).toBeInTheDocument();
  });

  it('reads 403 ORIGIN_MISMATCH as a configuration fault and keeps the form', async () => {
    const { container } = setup({ signIn: wireFailure(403, { code: 'ORIGIN_MISMATCH' }) });

    signInWith();

    expect(await screen.findByText(AUTH.errors.originMismatch.description)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
    expect(screen.queryByText(AUTH.errors.accountDisabled.title)).toBeNull();
    expect((screen.getByLabelText(AUTH.fields.email) as HTMLInputElement).value).toBe(EMAIL);
  });

  it('keeps forbidden for ACCOUNT_DISABLED alone', async () => {
    const { container } = setup({ signIn: wireFailure(403, { code: 'ACCOUNT_DISABLED' }) });

    signInWith();

    await waitFor(() => {
      expect(stateOf(container)).toBe('forbidden');
    });
  });

  it.each([
    ['RATE_LIMITED', { code: 'RATE_LIMITED', retryAfterSeconds: 5 }],
    ['a 429 with no code', { retryAfterSeconds: 5 }],
  ])('locks the button for a fixed minute on %s, promising no number', async (_label, body) => {
    vi.useFakeTimers();
    setup({ signIn: wireFailure(429, body) });

    signInWith();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const sentence = screen.getByText(AUTH.errors.tooManyAttempts.description);

    expect(sentence.textContent).not.toMatch(/\d/u);
    expect(screen.getByRole('button', { name: AUTH.actions.signIn })).toBeDisabled();

    // `Retry-After: 5` does not open it early.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.signIn })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.signIn })).toBeEnabled();
  });

  it.each([
    ['email', AUTH.problems.emailInvalid],
    ['password', 'Mật khẩu cần ít nhất 8 ký tự.'],
  ])('puts VALIDATION on %s under that box', async (field, sentence) => {
    const { container } = setup({ signIn: wireFailure(422, { code: 'VALIDATION', field }) });

    signInWith();

    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
  });

  it.each([
    ['an unknown code', wireFailure(500, { code: 'FOO_BAR' })],
    ['VALIDATION on an unknown field', wireFailure(422, { code: 'VALIDATION', field: 'nickname' })],
    ['a dropped network', networkFailure()],
  ])('falls back to the shared sentence for %s and never prints a code', async (_label, reply) => {
    const { container } = setup({ signIn: reply });

    signInWith();

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(container.textContent).not.toMatch(/FOO_BAR|VALIDATION|nickname/u);
  });
});

describe('AuthScreen — the forgot-password panel (N8)', () => {
  const openPanel = (): void => {
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.forgotPassword }));
  };

  it('opens from the link, carries the typed address and focuses its email box', () => {
    setup();

    type(AUTH.fields.email, EMAIL);
    openPanel();

    const email = screen.getByLabelText(AUTH.fields.email) as HTMLInputElement;

    expect(screen.queryByLabelText(AUTH.fields.password)).toBeNull();
    expect(email.value).toBe(EMAIL);
    expect(document.activeElement).toBe(email);
  });

  it('swaps the tagline under the title for the panel instruction, said once (BUG-023)', () => {
    setup();

    expect(screen.getByText(AUTH.brand.subtitle)).toBeInTheDocument();
    openPanel();

    expect(screen.queryByText(AUTH.brand.subtitle)).toBeNull();
    expect(screen.getAllByText(AUTH.forgotPassword.subtitle)).toHaveLength(1);
  });

  it('opens from the wrong-password strip too', async () => {
    setup({ signIn: wireFailure(401, { code: 'INVALID_CREDENTIALS' }) });

    signInWith();
    fireEvent.click(await screen.findByRole('button', { name: AUTH.actions.resetPassword }));

    expect(screen.getByRole('button', { name: AUTH.actions.sendResetLink })).toBeInTheDocument();
    expect((screen.getByLabelText(AUTH.fields.email) as HTMLInputElement).value).toBe(EMAIL);
  });

  it('goes back on Esc, and the back button returns focus to the sign-in email box', () => {
    setup();

    openPanel();
    fireEvent.keyDown(screen.getByLabelText(AUTH.fields.email), { key: 'Escape' });

    expect(screen.getByLabelText(AUTH.fields.password)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(AUTH.fields.email));

    openPanel();
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.backToSignIn }));

    expect(screen.getByLabelText(AUTH.fields.password)).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(AUTH.fields.email));
  });

  it('on 204 says one neutral sentence in a neutral block, through the status region, not as an alert (BUG-022)', async () => {
    const { container, requestPasswordReset } = setup();

    type(AUTH.fields.email, EMAIL);
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));

    const sentence = await screen.findByText(AUTH.forgotPassword.sent);

    expect(requestPasswordReset).toHaveBeenCalledWith({ email: EMAIL });
    expect(screen.getByRole('status')).toContainElement(sentence);
    // Neutral, not "verified" green: N8 answers 204 for any address, so nothing was verified (A5).
    expect(sentence.closest('.border-border-default')).not.toBeNull();
    expect(container.querySelector('[class*="state-verified"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(stateOf(container)).toBe('success');
    // The send button is locked now; say how to send again.
    expect(screen.getByRole('button', { name: AUTH.actions.sendResetLink })).toBeDisabled();
    expect(screen.getByText(AUTH.forgotPassword.sentHint)).toBeInTheDocument();
  });

  it('keeps the status region mounted and empty before anything is sent', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.forgotPassword }));

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('refuses a malformed address without calling the gateway', () => {
    const { requestPasswordReset } = setup();

    openPanel();
    type(AUTH.fields.email, 'thu.ha');
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));

    expect(screen.getByText(AUTH.problems.emailInvalid)).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('puts a 422 on the email under the box', async () => {
    setup({ reset: wireFailure(422, { code: 'VALIDATION', field: 'email' }) });

    openPanel();
    type(AUTH.fields.email, EMAIL);
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));

    expect(await screen.findByText(AUTH.problems.emailInvalid)).toBeInTheDocument();
  });

  it.each([
    ['with a code', { code: 'RATE_LIMITED', retryAfterSeconds: 7 }],
    ['without a code', { retryAfterSeconds: 7 }],
  ])('locks the button a full minute on a 429 %s and promises no number', async (_label, body) => {
    vi.useFakeTimers();
    setup({ reset: wireFailure(429, body) });

    openPanel();
    type(AUTH.fields.email, EMAIL);
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const sentence = screen.getByText(AUTH.errors.tooManyRecovery);

    expect(sentence.textContent).not.toMatch(/\d/u);
    expect(screen.getByRole('button', { name: AUTH.actions.sendResetLink })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.sendResetLink })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.sendResetLink })).toBeEnabled();
  });

  it('answers ORIGIN_MISMATCH with the configuration sentence', async () => {
    const { container } = setup({ reset: wireFailure(403, { code: 'ORIGIN_MISMATCH' }) });

    openPanel();
    type(AUTH.fields.email, EMAIL);
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));

    expect(await screen.findByText(AUTH.errors.originMismatch.description)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
  });

  it('answers anything else with the shared sentence and no raw code', async () => {
    const { container } = setup({ reset: wireFailure(500, { code: 'FOO_BAR' }) });

    openPanel();
    type(AUTH.fields.email, EMAIL);
    fireEvent.click(screen.getByRole('button', { name: AUTH.actions.sendResetLink }));

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(container.textContent).not.toContain('FOO_BAR');
  });
});

describe('AuthScreen — opening sentences', () => {
  it('shows the verified strip after a password reset', () => {
    setup({ initialNotice: 'passwordReset' });

    expect(screen.getByText(AUTH.notices.passwordReset)).toBeInTheDocument();
  });

  it('shows the attention strip after a session ended', () => {
    setup({ initialNotice: 'sessionEnded' });

    expect(screen.getByText(AUTH.notices.sessionEnded)).toBeInTheDocument();
  });

  it('lets the first attempt replace the sentence', async () => {
    setup({ initialNotice: 'sessionEnded', signIn: wireFailure(401, { code: 'INVALID_CREDENTIALS' }) });

    signInWith();

    await screen.findByText(AUTH.errors.invalidCredentials.description);
    expect(screen.queryByText(AUTH.notices.sessionEnded)).toBeNull();
  });
});

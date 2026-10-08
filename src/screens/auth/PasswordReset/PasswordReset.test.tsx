import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import type { Result } from '@/lib/http';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { networkFailure, okVoid, wireFailure } from '../authTestKit';
import { __resetFragmentTokenForTests } from '../fragmentToken';
import { PasswordReset, PasswordResetView, type PasswordResetViewProps } from './PasswordReset';
import type { PasswordResetPort } from './usePasswordReset';

const AUTH = viMessages.auth;
const PATH = '/login/reset-password';
const NEW_PASSWORD = 'mat-khau-moi-1';

const noop = (): void => undefined;

function setUrl(hash: string): void {
  window.history.replaceState(null, '', `${PATH}${hash}`);
}

function makePort(reply: Result<void, unknown> = okVoid()) {
  const order: string[] = [];
  const confirm = vi.fn<PasswordResetPort['confirm']>(async () => {
    order.push('confirm');

    return reply;
  });
  const endLocalSession = vi.fn(async () => {
    order.push('endLocalSession');
  });
  const navigate = vi.fn<PasswordResetPort['navigate']>(() => {
    order.push('navigate');
  });

  return {
    order,
    confirm,
    endLocalSession,
    navigate,
    port: { confirm, endLocalSession, navigate } satisfies PasswordResetPort,
  };
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label);
}

function type(label: string, value: string): void {
  fireEvent.change(field(label), { target: { value } });
}

function fillAndSubmit(container: HTMLElement, password = NEW_PASSWORD, confirm = password): void {
  type(AUTH.fields.newPassword, password);
  type(AUTH.fields.confirmPassword, confirm);
  fireEvent.submit(container.querySelector('form') as HTMLFormElement);
}

function stateOf(container: HTMLElement): string | null {
  return container.querySelector('main')?.getAttribute('data-auth-state') ?? null;
}

beforeEach(() => {
  __resetFragmentTokenForTests();
  setUrl('#token=abc');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* ---- the seven states ----------------------------------------------------- */

function baseProps(): PasswordResetViewProps {
  return {
    state: 'empty',
    values: { newPassword: '', confirmPassword: '' },
    problems: {},
    notice: null,
    canSubmit: true,
    isSubmitting: false,
    isDone: false,
    isLinkIncomplete: false,
    setNewPassword: noop,
    setConfirmPassword: noop,
    submit: noop,
    goToSignIn: noop,
    expand: noop,
  };
}

const PROPS_BY_STATE: Readonly<Record<SevenState, () => PasswordResetViewProps>> = {
  empty: baseProps,
  loading: () => ({ ...baseProps(), state: 'loading', isSubmitting: true, canSubmit: false }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    values: { newPassword: NEW_PASSWORD, confirmPassword: '' },
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    notice: { tone: 'violation', message: AUTH.errors.tooManyRecovery },
  }),
  success: () => ({ ...baseProps(), state: 'success', isDone: true, canSubmit: false }),
  forbidden: () => ({ ...baseProps(), state: 'forbidden' }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed' }),
};

describe('PasswordResetView — the seven states', () => {
  it('renders all seven, none blank, each marked on a data attribute', () => {
    expect(() => {
      expectSevenStates(
        (scenario) => render(<PasswordResetView {...PROPS_BY_STATE[scenario.state]()} />),
        createSevenStateScenarios(),
      );
    }).not.toThrow();

    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<PasswordResetView {...PROPS_BY_STATE[state]()} />);

      expect(stateOf(container)).toBe(state);
      expect(() => {
        expectVietnamese(container);
        expectAccessible(container);
      }, state).not.toThrow();
      unmount();
    }
  });

  it('drops the form when the link is dead, leaving a sentence and a link to /login', () => {
    render(<PasswordResetView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.queryByLabelText(AUTH.fields.newPassword)).toBeNull();
    expect(screen.getByText(AUTH.passwordReset.expired)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH.actions.goToSignIn })).toHaveAttribute('href', '/login');
  });

  it('puts the failure strip under the submit button, so it never pushes the button (BUG-008)', () => {
    render(<PasswordResetView {...PROPS_BY_STATE.error()} />);

    const button = screen.getByRole('button', { name: AUTH.actions.setNewPassword });
    const strip = screen.getByRole('alert');

    expect(button.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('holds no raw colour', () => {
    expect(() => {
      expectNoRawColor('src/screens/auth/PasswordReset/PasswordReset.tsx');
      expectNoRawColor('src/screens/auth/PasswordReset/usePasswordReset.ts');
      expectNoRawColor('src/screens/auth/PasswordReset/PasswordReset.container.tsx');
    }).not.toThrow();
  });

  it('never imports the sign-in screen, the house scene or three', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const directory = 'src/screens/auth/PasswordReset';

    for (const name of readdirSync(directory).filter((file) => !/\.(test|stories)\./u.test(file))) {
      const source = readFileSync(`${directory}/${name}`, 'utf8');

      expect(source, name).not.toMatch(/AuthScreen|houseScene|three/u);
    }
  });
});

/* ---- the token ------------------------------------------------------------ */

describe('PasswordReset — the fragment token', () => {
  it('under StrictMode hands the port the token, with replaceState already run', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { confirm, port } = makePort();
    const { container } = render(
      <StrictMode>
        <PasswordReset port={port} />
      </StrictMode>,
    );

    fillAndSubmit(container);

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledTimes(1);
    });
    expect(confirm).toHaveBeenCalledWith({ token: 'abc', newPassword: NEW_PASSWORD });
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(confirm.mock.invocationCallOrder[0] ?? 0);
    expect(window.location.hash).toBe('');
  });

  it.each([
    ['no fragment', ''],
    ['a token of 513 characters', `#token=${'a'.repeat(513)}`],
  ])('is forbidden with %s, and the port is never called', (_label, hash) => {
    setUrl(hash);

    const { confirm, port } = makePort();
    const { container } = render(<PasswordReset port={port} />);

    expect(stateOf(container)).toBe('forbidden');
    expect(screen.queryByLabelText(AUTH.fields.newPassword)).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([
    ['no token at all', ''],
    ['the token in the query instead of the fragment', '?token=abc'],
  ])('says the link is incomplete, not expired, with %s (BUG-005)', (_label, suffix) => {
    setUrl(suffix);

    const { port } = makePort();

    render(<PasswordReset port={port} />);

    expect(screen.getByText(AUTH.passwordReset.incomplete)).toBeInTheDocument();
    expect(screen.queryByText(AUTH.passwordReset.expired)).toBeNull();
    expect(screen.getByText(AUTH.passwordReset.deadEndSubtitle)).toBeInTheDocument();
    expect(screen.queryByText(AUTH.passwordReset.subtitle)).toBeNull();
  });
});

/* ---- answers -------------------------------------------------------------- */

describe('PasswordReset — what the server answers', () => {
  it('on 204 ends the local session, then goes to /login with the notice', async () => {
    const { endLocalSession, navigate, order, port } = makePort();
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
    });
    expect(endLocalSession).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['confirm', 'endLocalSession', 'navigate']);
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true, state: { notice: 'passwordReset' } });
  });

  it.each([
    ['PASSWORD_RESET_TOKEN_INVALID', { code: 'PASSWORD_RESET_TOKEN_INVALID' }],
    ['VALIDATION on the token', { code: 'VALIDATION', field: 'token' }],
  ])('treats %s as a dead link and removes the form', async (_label, body) => {
    const { port } = makePort(wireFailure(422, body));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('forbidden');
    });
    expect(screen.getByText(AUTH.passwordReset.expired)).toBeInTheDocument();
    expect(screen.queryByText(AUTH.passwordReset.incomplete)).toBeNull();
    expect(screen.getByText(AUTH.passwordReset.deadEndSubtitle)).toBeInTheDocument();
  });

  it('puts a newPassword complaint under its own box', async () => {
    const { port } = makePort(wireFailure(422, { code: 'VALIDATION', field: 'newPassword' }));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    expect(await screen.findByText(/Mật khẩu cần ít nhất 8 ký tự/u)).toBeInTheDocument();
    expect(field(AUTH.fields.newPassword).value).toBe(NEW_PASSWORD);
  });

  it.each([
    ['with a code', { code: 'RATE_LIMITED', retryAfterSeconds: 7 }],
    ['without a code', { retryAfterSeconds: 7 }],
  ])('locks the button on a 429 %s and promises no number', async (_label, body) => {
    const { port } = makePort(wireFailure(429, body));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    const sentence = await screen.findByText(AUTH.errors.tooManyRecovery);

    expect(sentence.textContent).not.toMatch(/\d/u);
    expect(screen.getByRole('button', { name: AUTH.actions.setNewPassword })).toBeDisabled();
    expect(stateOf(container)).toBe('error');
  });

  it('releases the lock after 60 seconds, not before', async () => {
    vi.useFakeTimers();

    const { port } = makePort(wireFailure(429, { retryAfterSeconds: 7 }));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.setNewPassword })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.setNewPassword })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.setNewPassword })).toBeEnabled();
  });

  it('answers ORIGIN_MISMATCH with the configuration sentence and keeps the form', async () => {
    const { port } = makePort(wireFailure(403, { code: 'ORIGIN_MISMATCH' }));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    expect(await screen.findByText(AUTH.errors.originMismatch.description)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
    expect(screen.getByLabelText(AUTH.fields.newPassword)).toBeInTheDocument();
  });

  it('answers an unknown code with the fallback sentence, keeping what was typed and never the code', async () => {
    const { port } = makePort(wireFailure(500, { code: 'FOO_BAR' }));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(container.textContent).not.toContain('FOO_BAR');
    // Reloading would drop the fragment token: the sentence asks for a resend, never a reload (BUG-015).
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH.errors.recoveryFailed);
    expect(screen.getByRole('alert').textContent).not.toMatch(/tải lại/iu);
    expect(field(AUTH.fields.newPassword).value).toBe(NEW_PASSWORD);
  });

  it('keeps the form on a network failure', async () => {
    const { port } = makePort(networkFailure());
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(screen.getByLabelText(AUTH.fields.newPassword)).toBeInTheDocument();
    // The sentence already opens with the incident: no heading repeating it (BUG-021).
    expect(screen.getByRole('alert')).toHaveTextContent(viMessages.errors.network.description);
    expect(within(screen.getByRole('alert')).queryByRole('heading')).toBeNull();
  });

  it('names a 429 once, in the heading, not again in the sentence (BUG-021)', async () => {
    const { port } = makePort(wireFailure(429, { retryAfterSeconds: 7 }));
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container);

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByRole('heading')).toHaveTextContent(AUTH.errors.tooManyAttempts.title);
    expect(alert.textContent?.split(AUTH.errors.tooManyAttempts.title)).toHaveLength(2);
  });
});

/* ---- local checks --------------------------------------------------------- */

describe('PasswordReset — checks before sending', () => {
  it('refuses two different passwords, without calling the port', () => {
    const { confirm, port } = makePort();
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container, NEW_PASSWORD, 'khac-hoan-toan-1');

    expect(screen.getByText(AUTH.problems.confirmMismatch)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('refuses a password below the minimum, using the BE rule and not the account screen rule', () => {
    const { confirm, port } = makePort();
    const { container } = render(<PasswordReset port={port} />);

    fillAndSubmit(container, 'ngan', 'ngan');

    expect(screen.getByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('opens /login from the dead-end link without a full reload', () => {
    setUrl('');

    const { navigate, port } = makePort();

    render(<PasswordReset port={port} />);
    fireEvent.click(screen.getByRole('link', { name: AUTH.actions.goToSignIn }));

    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

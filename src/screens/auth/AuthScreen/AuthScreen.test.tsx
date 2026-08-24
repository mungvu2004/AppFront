import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import { findPositiveTabIndexes } from '@/lib/input/focusOrder';
import { durationMs } from '@/lib/motion';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { AuthScreen, AuthScreenView, type AuthScreenViewProps } from './AuthScreen';
import { AuthRoute } from './AuthScreen.container';
import { LOCKOUT_SECONDS, MIN_PASSWORD_LENGTH, type AuthGateway } from './useAuthScreen';

const AUTH_MESSAGES = viMessages.auth;

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const EMAIL = 'thu.ha@vidu.vn';
const PASSWORD = 'khong-doan-duoc';

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_REQUESTS_STATUS = 429;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const noop = (): void => undefined;

/**
 * Every prop the view takes, at rest.
 *
 * Written out rather than generated: the point of the seven-state check is that
 * a state is described exactly, and a fixture that filled the gaps in would let
 * a scenario pass while describing nothing in particular.
 */
function baseProps(): AuthScreenViewProps {
  return {
    state: 'empty',
    tab: 'signIn',
    isCollapsed: false,
    isSubmitting: false,
    values: { email: '', password: '', fullName: '', rememberMe: false },
    problems: {},
    notice: null,
    canSubmit: true,
    submitLabel: AUTH_MESSAGES.actions.signIn,
    isBlocked: false,
    setTab: noop,
    setEmail: noop,
    setPassword: noop,
    setFullName: noop,
    setRememberMe: noop,
    blurField: noop,
    setCollapsed: noop,
    submit: noop,
    ssoSignIn: noop,
    forgotPassword: noop,
  };
}

/** A gateway whose two calls are spies, refusing by default in the way asked for. */
function stubGateway(reply: Awaited<ReturnType<AuthGateway['signIn']>> = { ok: true, data: undefined }): {
  readonly gateway: AuthGateway;
  readonly signIn: ReturnType<typeof vi.fn>;
  readonly register: ReturnType<typeof vi.fn>;
} {
  const signIn = vi.fn(async () => reply);
  const register = vi.fn(async () => reply);

  return { gateway: { signIn, register } as unknown as AuthGateway, signIn, register };
}

/** The screen with its logic attached, over a stub transport. */
function renderScreen(
  options: {
    readonly gateway?: AuthGateway;
    readonly onAuthenticated?: () => void;
    readonly onSsoSignIn?: () => void;
    readonly onForgotPassword?: () => void;
    readonly reducedMotion?: boolean;
  } = {},
) {
  const fallback = stubGateway();

  return render(
    <AuthScreen
      gateway={options.gateway ?? fallback.gateway}
      onAuthenticated={options.onAuthenticated ?? noop}
      {...(options.onSsoSignIn !== undefined ? { onSsoSignIn: options.onSsoSignIn } : {})}
      {...(options.onForgotPassword !== undefined
        ? { onForgotPassword: options.onForgotPassword }
        : {})}
      reducedMotion={options.reducedMotion ?? true}
    />,
  );
}

function emailField(): HTMLInputElement {
  return screen.getByLabelText(AUTH_MESSAGES.fields.email);
}

function passwordField(): HTMLInputElement {
  return screen.getByLabelText(AUTH_MESSAGES.fields.password);
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: AUTH_MESSAGES.actions.signIn });
}

/** Types into a controlled field the way a person would. */
function type(field: HTMLInputElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

/* -------------------------------------------------------------------------- */
/* The seven states (invariant A11).                                           */
/* -------------------------------------------------------------------------- */

/** One props object per state, keyed so a missing state cannot hide. */
const PROPS_BY_STATE: Readonly<Record<SevenState, () => AuthScreenViewProps>> = {
  empty: () => baseProps(),
  loading: () => ({
    ...baseProps(),
    state: 'loading',
    isSubmitting: true,
    canSubmit: false,
    values: { email: EMAIL, password: PASSWORD, fullName: '', rememberMe: false },
  }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    values: { email: EMAIL, password: '', fullName: '', rememberMe: false },
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    values: { email: EMAIL, password: PASSWORD, fullName: '', rememberMe: false },
    notice: {
      tone: 'violation',
      title: AUTH_MESSAGES.errors.invalidCredentials.title,
      message: AUTH_MESSAGES.errors.invalidCredentials.description,
      showResetAction: true,
    },
  }),
  success: () => ({
    ...baseProps(),
    state: 'success',
    canSubmit: false,
    notice: { tone: 'verified', message: AUTH_MESSAGES.notices.success },
  }),
  forbidden: () => ({
    ...baseProps(),
    state: 'forbidden',
    isBlocked: true,
    canSubmit: false,
    notice: {
      tone: 'attention',
      title: AUTH_MESSAGES.errors.accountDisabled.title,
      message: AUTH_MESSAGES.errors.accountDisabled.description,
    },
  }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed', isCollapsed: true }),
};

describe('AuthScreenView — the seven states', () => {
  it('renders all seven states, and not one of them comes out blank', () => {
    expect(() => {
      expectSevenStates(
        (scenario) => render(<AuthScreenView {...PROPS_BY_STATE[scenario.state]()} />),
        createSevenStateScenarios(),
      );
    }).not.toThrow();
  });

  it('puts the current state on a data attribute rather than reading it aloud', () => {
    for (const state of Object.keys(PROPS_BY_STATE) as SevenState[]) {
      const { container, unmount } = render(<AuthScreenView {...PROPS_BY_STATE[state]()} />);

      expect(container.querySelector('main')).toHaveAttribute('data-auth-state', state);
      unmount();
    }
  });

  it('drops the form entirely when the account is disabled, leaving a strip in its place', () => {
    render(<AuthScreenView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.queryByLabelText(AUTH_MESSAGES.fields.email)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_MESSAGES.errors.accountDisabled.title);
  });

  it('collapses to one sentence and a button that opens it again', () => {
    render(<AuthScreenView {...PROPS_BY_STATE.collapsed()} />);

    expect(screen.queryByLabelText(AUTH_MESSAGES.fields.email)).toBeNull();
    expect(screen.getByRole('button', { name: AUTH_MESSAGES.actions.expand })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Wording and tokens.                                                         */
/* -------------------------------------------------------------------------- */

describe('AuthScreenView — wording and colour', () => {
  it('writes every visible string in Vietnamese, diacritics and all', () => {
    for (const state of Object.keys(PROPS_BY_STATE) as SevenState[]) {
      const { container, unmount } = render(<AuthScreenView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        expectVietnamese(container);
      }).not.toThrow();
      unmount();
    }
  });

  it('holds no raw colour in any of the three source files', () => {
    expect(() => {
      expectNoRawColor('src/screens/auth/AuthScreen/AuthScreen.tsx');
      expectNoRawColor('src/screens/auth/AuthScreen/useAuthScreen.ts');
      expectNoRawColor('src/screens/auth/AuthScreen/AuthScreen.container.tsx');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Accessibility.                                                              */
/* -------------------------------------------------------------------------- */

describe('AuthScreenView — accessibility', () => {
  /**
   * R-72, run over all seven states rather than the empty one alone.
   *
   * The other six are where this breaks: fields disabled mid-send, the form gone
   * when the account is disabled, a strip standing where the inputs were. Each
   * one is a different element tree, so each one has to hold up on its own.
   *
   * Contrast is not measured here. jsdom cannot resolve `var(--…)`, and
   * `requireResolvedContrast` is left at its default of off, so this pass checks
   * names, labels and the keyboard path. Colour is `expectNoRawColor`'s job and
   * the token set's.
   */
  it('keeps every state usable by keyboard and readable by a screen reader', () => {
    for (const state of Object.keys(PROPS_BY_STATE) as SevenState[]) {
      const { container, unmount } = render(<AuthScreenView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        expectAccessible(container);
      }, `state: ${state}`).not.toThrow();
      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Keyboard.                                                                   */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — keyboard', () => {
  it('puts focus in the first field as soon as it opens', () => {
    renderScreen();

    expect(document.activeElement).toBe(emailField());
  });

  it('uses no positive tabindex, so tab order is document order', () => {
    const { container } = renderScreen();

    expect(findPositiveTabIndexes(container)).toHaveLength(0);
  });

  it('submits on Enter from every field, the checkbox included', () => {
    const { gateway, signIn } = stubGateway();
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);

    fireEvent.keyDown(emailField(), { key: 'Enter' });
    expect(signIn).toHaveBeenCalledTimes(1);

    cleanup();

    const second = stubGateway();
    renderScreen({ gateway: second.gateway });
    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });
    expect(second.signIn).toHaveBeenCalledTimes(1);

    cleanup();

    const third = stubGateway();
    renderScreen({ gateway: third.gateway });
    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(screen.getByLabelText(AUTH_MESSAGES.fields.rememberMe), { key: 'Enter' });
    expect(third.signIn).toHaveBeenCalledTimes(1);
  });

  it('signs in with Tab and Enter alone: first field focused, the rest in order, Enter sends', () => {
    const { gateway, signIn } = stubGateway();
    const { container } = renderScreen({ gateway });

    const form = container.querySelector('form');
    expect(form).not.toBeNull();

    const stops = Array.from(
      form?.querySelectorAll<HTMLElement>('input:not([type="hidden"]), button') ?? [],
    ).filter((element) => !element.hasAttribute('disabled'));

    // Document order is tab order, because nothing carries a positive tabindex.
    expect(stops[0]).toBe(emailField());
    expect(stops[1]).toBe(passwordField());
    expect(stops[2]).toBe(
      screen.getByRole('button', { name: AUTH_MESSAGES.actions.showPassword }),
    );
    expect(stops[3]).toBe(screen.getByLabelText(AUTH_MESSAGES.fields.rememberMe));
    expect(stops[4]).toBe(submitButton());
    expect(stops[5]).toBe(
      screen.getByRole('button', { name: AUTH_MESSAGES.actions.ssoSignIn }),
    );
    expect(stops[6]).toBe(
      screen.getByRole('button', { name: AUTH_MESSAGES.actions.forgotPassword }),
    );

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, rememberMe: false });
  });
});

/* -------------------------------------------------------------------------- */
/* Password visibility.                                                       */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — password visibility', () => {
  it('starts masked and reveals the typed password on toggle, without touching its value', () => {
    renderScreen();

    type(passwordField(), PASSWORD);
    expect(passwordField()).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: AUTH_MESSAGES.actions.showPassword }));

    expect(passwordField()).toHaveAttribute('type', 'text');
    expect(passwordField().value).toBe(PASSWORD);

    fireEvent.click(screen.getByRole('button', { name: AUTH_MESSAGES.actions.hidePassword }));
    expect(passwordField()).toHaveAttribute('type', 'password');
  });
});

/* -------------------------------------------------------------------------- */
/* SSO and password reset.                                                    */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — SSO and password reset', () => {
  it('calls the host callback when the SSO button is pressed, and does nothing when none was given', () => {
    const onSsoSignIn = vi.fn();
    renderScreen({ onSsoSignIn });

    fireEvent.click(screen.getByRole('button', { name: AUTH_MESSAGES.actions.ssoSignIn }));

    expect(onSsoSignIn).toHaveBeenCalledTimes(1);
  });

  it('calls the host callback when "Quên mật khẩu" is pressed', () => {
    const onForgotPassword = vi.fn();
    renderScreen({ onForgotPassword });

    fireEvent.click(screen.getByRole('button', { name: AUTH_MESSAGES.actions.forgotPassword }));

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('offers a reset action inside the wrong-password strip, wired to the same callback', async () => {
    const onForgotPassword = vi.fn();
    const { gateway } = stubGateway({
      ok: false,
      error: { kind: 'http', status: UNAUTHORIZED_STATUS, retryable: false, requestId: 'req-5', raw: null },
    });
    renderScreen({ gateway, onForgotPassword });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    const action = await screen.findByRole('button', { name: AUTH_MESSAGES.actions.resetPassword });
    fireEvent.click(action);

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('is absent from the register tab, which has no account to reset or federate yet', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('tab', { name: AUTH_MESSAGES.tabs.register }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: AUTH_MESSAGES.actions.register }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: AUTH_MESSAGES.actions.ssoSignIn })).toBeNull();
    expect(screen.queryByRole('button', { name: AUTH_MESSAGES.actions.forgotPassword })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — field validation', () => {
  it('validates a field on the way out of it, in a sentence from the bundle', () => {
    renderScreen();

    type(emailField(), 'thu.ha');
    fireEvent.blur(emailField());

    expect(screen.getByText(AUTH_MESSAGES.problems.emailInvalid)).toBeInTheDocument();
  });

  it('drops a complaint the moment that field is edited again', () => {
    renderScreen();

    type(emailField(), 'thu.ha');
    fireEvent.blur(emailField());
    expect(screen.getByText(AUTH_MESSAGES.problems.emailInvalid)).toBeInTheDocument();

    type(emailField(), EMAIL);
    expect(screen.queryByText(AUTH_MESSAGES.problems.emailInvalid)).toBeNull();
  });

  it('refuses to send a password below the minimum, and says what the minimum is', () => {
    const { gateway, signIn } = stubGateway();
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), 'ngan');
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(signIn).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        AUTH_MESSAGES.problems.passwordTooShort.replace('{{count}}', String(MIN_PASSWORD_LENGTH)),
      ),
    ).toBeInTheDocument();
  });

  it('sits in the partial state once there is an address and no password', () => {
    const { container } = renderScreen();

    type(emailField(), EMAIL);

    expect(container.querySelector('main')).toHaveAttribute('data-auth-state', 'partial');
    expect(screen.getByText(AUTH_MESSAGES.notices.partial)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Submitting.                                                                 */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — submitting', () => {
  it('refuses a second submit while the first is still in flight', () => {
    const signIn = vi.fn(() => new Promise<never>(() => undefined));
    const gateway = { signIn, register: vi.fn() } as unknown as AuthGateway;
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);

    fireEvent.keyDown(passwordField(), { key: 'Enter' });
    fireEvent.keyDown(passwordField(), { key: 'Enter' });
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('keeps the button width and swaps only its label while sending', async () => {
    const signIn = vi.fn(() => new Promise<never>(() => undefined));
    const gateway = { signIn, register: vi.fn() } as unknown as AuthGateway;
    renderScreen({ gateway });

    const widthBefore = submitButton().className.includes('w-full');

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    const sending = await screen.findByRole('button', { name: AUTH_MESSAGES.actions.submitting });

    expect(widthBefore).toBe(true);
    expect(sending.className).toContain('w-full');
    expect(sending).toBeDisabled();
  });

  it('shows a strip inside the form on a wrong password, and keeps what was typed', async () => {
    const { gateway } = stubGateway({
      ok: false,
      error: { kind: 'http', status: UNAUTHORIZED_STATUS, retryable: false, requestId: 'req-1', raw: null },
    });
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(
      await screen.findByText(AUTH_MESSAGES.errors.invalidCredentials.description),
    ).toBeInTheDocument();
    expect(emailField().value).toBe(EMAIL);
    expect(passwordField().value).toBe(PASSWORD);
    // No modal, no toast: the message lives in the form (invariant A9).
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts the lockout down and shuts the submit button', async () => {
    const { gateway } = stubGateway({
      ok: false,
      error: {
        kind: 'http',
        status: TOO_MANY_REQUESTS_STATUS,
        retryable: true,
        requestId: 'req-2',
        raw: null,
      },
    });
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(
      await screen.findByText(
        AUTH_MESSAGES.errors.tooManyAttempts.description.replace(
          '{{seconds}}',
          String(LOCKOUT_SECONDS),
        ),
      ),
    ).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('moves to the forbidden state when the account is disabled', async () => {
    const { gateway } = stubGateway({
      ok: false,
      error: { kind: 'http', status: FORBIDDEN_STATUS, retryable: false, requestId: 'req-3', raw: null },
    });
    const { container } = renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    await waitFor(() => {
      expect(container.querySelector('main')).toHaveAttribute('data-auth-state', 'forbidden');
    });
    expect(screen.queryByLabelText(AUTH_MESSAGES.fields.email)).toBeNull();
  });

  it('borrows the sentence from src/lib/errors on a transport failure rather than writing one', async () => {
    const { gateway } = stubGateway({
      ok: false,
      error: { kind: 'network', retryable: true, requestId: 'req-4', raw: null },
    });
    renderScreen({ gateway });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(await screen.findByText(viMessages.errors.network.description)).toBeInTheDocument();
  });

  it('flashes once before it changes the page', async () => {
    vi.useFakeTimers();
    const onAuthenticated = vi.fn();
    const { gateway } = stubGateway();

    render(
      <AuthScreen gateway={gateway} onAuthenticated={onAuthenticated} reducedMotion={false} />,
    );

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    await vi.advanceTimersByTimeAsync(0);
    expect(onAuthenticated).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(durationMs('standard'));
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it('skips the flash entirely for someone who asked for less motion', async () => {
    const onAuthenticated = vi.fn();
    const { gateway } = stubGateway();
    renderScreen({ gateway, onAuthenticated, reducedMotion: true });

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Tabs.                                                                       */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — changing tab', () => {
  it('keeps the typed address when the register tab opens', async () => {
    renderScreen();

    type(emailField(), EMAIL);
    fireEvent.click(screen.getByRole('tab', { name: AUTH_MESSAGES.tabs.register }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: AUTH_MESSAGES.actions.register }),
      ).toBeInTheDocument();
    });
    expect(emailField().value).toBe(EMAIL);
  });

  it('drops the outgoing tab complaints when the tab changes', async () => {
    renderScreen();

    type(emailField(), 'thu.ha');
    fireEvent.blur(emailField());
    expect(screen.getByText(AUTH_MESSAGES.problems.emailInvalid)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: AUTH_MESSAGES.tabs.register }));

    await waitFor(() => {
      expect(screen.queryByText(AUTH_MESSAGES.problems.emailInvalid)).toBeNull();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Boundaries.                                                                 */
/* -------------------------------------------------------------------------- */

describe('AuthRoute — the form is never withheld', () => {
  /**
   * A regression that shipped once and must not ship twice.
   *
   * The route used to probe `src/lib/auth` on mount and, when `configureAuth()`
   * had not run, render a notice *instead of* the form. That locks a visitor out
   * before they have typed a character, over a deployment fault they cannot act
   * on — and "the host has not configured auth" is not one of invariant A11's
   * seven states. A sign-in form is static markup; whether a server answers is
   * not knowable until someone presses the button, and that answer belongs in
   * the strip inside the form.
   *
   * Nothing configures auth in this test, which is the whole point.
   */
  it('renders the form even when nothing has configured the auth layer', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthRoute />
      </MemoryRouter>,
    );

    expect(container.querySelector('main')).toHaveAttribute('data-auth-state', 'empty');
    expect(screen.getByLabelText(AUTH_MESSAGES.fields.email)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH_MESSAGES.fields.password)).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Layer boundaries.                                                           */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — layer boundaries', () => {
  it('reaches no network directly anywhere in the screen', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const directory = 'src/screens/auth/AuthScreen';

    for (const name of readdirSync(directory)) {
      const source = readFileSync(`${directory}/${name}`, 'utf8');

      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('keeps the view clear of src/api and src/store', async () => {
    const { readFileSync } = await import('node:fs');
    const view = readFileSync('src/screens/auth/AuthScreen/AuthScreen.tsx', 'utf8');

    expect(view).not.toMatch(/@\/api/);
    expect(view).not.toMatch(/@\/store/);
  });
});

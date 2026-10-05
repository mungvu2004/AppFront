import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { InvitationAccept, InvitationAcceptView, type InvitationAcceptViewProps } from './InvitationAccept';
import type { InvitationAcceptPort } from './useInvitationAccept';

const AUTH = viMessages.auth;
const PATH = '/login/invitation';
const FULL_NAME = 'Nguyễn Thu Hà';
const PASSWORD = 'mat-khau-moi-1';

const noop = (): void => undefined;

function setUrl(hash: string): void {
  window.history.replaceState(null, '', `${PATH}${hash}`);
}

interface PortOptions {
  readonly reply?: Result<void, unknown>;
  readonly established?: boolean;
  readonly isSignedIn?: boolean;
  readonly isSessionPending?: boolean;
}

function makePort(options: PortOptions = {}) {
  const accept = vi.fn<InvitationAcceptPort['accept']>(async () => options.reply ?? okVoid());
  const bootstrapSession = vi.fn(async () => options.established ?? true);
  const navigate = vi.fn<InvitationAcceptPort['navigate']>();
  const port: InvitationAcceptPort = {
    accept,
    bootstrapSession,
    navigate,
    isSignedIn: options.isSignedIn ?? false,
    isSessionPending: options.isSessionPending ?? false,
  };

  return { accept, bootstrapSession, navigate, port };
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillAndSubmit(container: HTMLElement, password = PASSWORD, confirm = password): void {
  type(AUTH.fields.fullName, FULL_NAME);
  type(AUTH.fields.password, password);
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

function baseProps(): InvitationAcceptViewProps {
  return {
    state: 'empty',
    values: { fullName: '', password: '', confirmPassword: '' },
    problems: {},
    notice: null,
    warning: null,
    canSubmit: true,
    isSubmitting: false,
    isDone: false,
    needsSignIn: false,
    isSessionPending: false,
    setFullName: noop,
    setPassword: noop,
    setConfirmPassword: noop,
    submit: noop,
    goToSignIn: noop,
    expand: noop,
  };
}

const PROPS_BY_STATE: Readonly<Record<SevenState, () => InvitationAcceptViewProps>> = {
  empty: baseProps,
  loading: () => ({ ...baseProps(), state: 'loading', isSubmitting: true, canSubmit: false }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    values: { fullName: FULL_NAME, password: '', confirmPassword: '' },
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    notice: { tone: 'violation', message: AUTH.invitation.sessionNotOpened },
    needsSignIn: true,
    canSubmit: false,
  }),
  success: () => ({ ...baseProps(), state: 'success', isDone: true, canSubmit: false }),
  forbidden: () => ({ ...baseProps(), state: 'forbidden' }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed' }),
};

describe('InvitationAcceptView — the seven states', () => {
  it('renders all seven, none blank, each marked on a data attribute', () => {
    expect(() => {
      expectSevenStates(
        (scenario) => render(<InvitationAcceptView {...PROPS_BY_STATE[scenario.state]()} />),
        createSevenStateScenarios(),
      );
    }).not.toThrow();

    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<InvitationAcceptView {...PROPS_BY_STATE[state]()} />);

      expect(stateOf(container)).toBe(state);
      expect(() => {
        expectVietnamese(container);
        expectAccessible(container);
      }, state).not.toThrow();
      unmount();
    }
  });

  it('holds no raw colour', () => {
    expect(() => {
      expectNoRawColor('src/screens/auth/InvitationAccept/InvitationAccept.tsx');
      expectNoRawColor('src/screens/auth/InvitationAccept/useInvitationAccept.ts');
      expectNoRawColor('src/screens/auth/InvitationAccept/InvitationAccept.container.tsx');
    }).not.toThrow();
  });

  it('never imports the sign-in screen, the house scene or three', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const directory = 'src/screens/auth/InvitationAccept';

    for (const name of readdirSync(directory).filter((file) => !/\.(test|stories)\./u.test(file))) {
      const source = readFileSync(`${directory}/${name}`, 'utf8');

      expect(source, name).not.toMatch(/AuthScreen|houseScene|three/u);
    }
  });
});

/* ---- the token ------------------------------------------------------------ */

describe('InvitationAccept — the fragment token', () => {
  it('under StrictMode hands the port the token, with replaceState already run', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { accept, port } = makePort();
    const { container } = render(
      <StrictMode>
        <InvitationAccept port={port} />
      </StrictMode>,
    );

    fillAndSubmit(container);

    await waitFor(() => {
      expect(accept).toHaveBeenCalledTimes(1);
    });
    expect(accept).toHaveBeenCalledWith({ token: 'abc', fullName: FULL_NAME, password: PASSWORD });
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(accept.mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    ['no fragment', ''],
    ['a token of 513 characters', `#token=${'a'.repeat(513)}`],
  ])('is forbidden with %s, and the port is never called', (_label, hash) => {
    setUrl(hash);

    const { accept, port } = makePort();
    const { container } = render(<InvitationAccept port={port} />);

    expect(stateOf(container)).toBe('forbidden');
    expect(accept).not.toHaveBeenCalled();
  });

  it('offers a link to /login from the forbidden state', () => {
    setUrl('');

    const { navigate, port } = makePort();

    render(<InvitationAccept port={port} />);

    const link = screen.getByRole('link', { name: AUTH.actions.goToSignIn });

    expect(link).toHaveAttribute('href', '/login');
    expect(screen.getByText(AUTH.invitation.expired)).toBeInTheDocument();

    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

/* ---- answers -------------------------------------------------------------- */

describe('InvitationAccept — what the server answers', () => {
  it('on 204 opens the session through the port and goes to the dashboard', async () => {
    const { bootstrapSession, navigate, port } = makePort();
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledTimes(1);
    });
    expect(bootstrapSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('on 204 with no session shows the error and a link to /login, and does not navigate', async () => {
    const { navigate, port } = makePort({ established: false });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    expect(await screen.findByText(AUTH.invitation.sessionNotOpened)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
    expect(screen.getByRole('link', { name: AUTH.actions.goToSignIn })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('treats a throwing session open like `false`: error, link to /login, form not resubmittable', async () => {
    const { navigate, port } = makePort();
    const bootstrapSession = vi.fn(async (): Promise<boolean> => {
      throw new Error('bootstrap failed');
    });
    const { container } = render(<InvitationAccept port={{ ...port, bootstrapSession }} />);

    fillAndSubmit(container);

    expect(await screen.findByText(AUTH.invitation.sessionNotOpened)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeDisabled();
    expect(screen.getByRole('link', { name: AUTH.actions.goToSignIn })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['INVITATION_TOKEN_INVALID', { code: 'INVITATION_TOKEN_INVALID' }],
    ['VALIDATION on the token', { code: 'VALIDATION', field: 'token' }],
  ])('treats %s as a dead invitation and removes the form', async (_label, body) => {
    const { port } = makePort({ reply: wireFailure(422, body) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('forbidden');
    });
    expect(screen.getByText(AUTH.invitation.expired)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: AUTH.actions.goToSignIn })).toHaveAttribute('href', '/login');
  });

  it.each([
    ['fullName', 'fullName', AUTH.problems.fullNameRequired],
    ['password', 'password', 'Mật khẩu cần ít nhất 8 ký tự.'],
  ])('puts a %s complaint under its own box', async (_label, field, sentence) => {
    const { port } = makePort({ reply: wireFailure(422, { code: 'VALIDATION', field }) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });

  it.each([
    ['with a code', { code: 'RATE_LIMITED', retryAfterSeconds: 7 }],
    ['without a code', { retryAfterSeconds: 7 }],
  ])('locks the button on a 429 %s and promises no number', async (_label, body) => {
    const { port } = makePort({ reply: wireFailure(429, body) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    const sentence = await screen.findByText(AUTH.errors.tooManyRecovery);

    expect(sentence.textContent).not.toMatch(/\d/u);
    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeDisabled();
  });

  it('releases the lock after 60 seconds', async () => {
    vi.useFakeTimers();

    const { port } = makePort({ reply: wireFailure(429, { retryAfterSeconds: 7 }) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeEnabled();
  });

  it('answers ORIGIN_MISMATCH with the configuration sentence', async () => {
    const { port } = makePort({ reply: wireFailure(403, { code: 'ORIGIN_MISMATCH' }) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    expect(await screen.findByText(AUTH.errors.originMismatch.description)).toBeInTheDocument();
    expect(stateOf(container)).toBe('error');
  });

  it('answers an unknown code with the fallback sentence, never the code', async () => {
    const { port } = makePort({ reply: wireFailure(500, { code: 'FOO_BAR' }) });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
    expect(container.textContent).not.toContain('FOO_BAR');
    expect((screen.getByLabelText(AUTH.fields.fullName) as HTMLInputElement).value).toBe(FULL_NAME);
  });

  it('falls into error on a network failure, the way an unreachable server does', async () => {
    const { port } = makePort({ reply: networkFailure(), isSessionPending: false });
    const { container } = render(<InvitationAccept port={port} />);

    fillAndSubmit(container);

    await waitFor(() => {
      expect(stateOf(container)).toBe('error');
    });
  });
});

/* ---- the session ---------------------------------------------------------- */

describe('InvitationAccept — the session around it', () => {
  it('locks the button and marks the form busy while the session is unknown', () => {
    const { port } = makePort({ isSessionPending: true });
    const { container } = render(<InvitationAccept port={port} />);

    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeDisabled();
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('opens the button when the session is unknown but the server cannot be reached', () => {
    // The container turns `unknown` + `serverUnreachable` into `isSessionPending: false`.
    const { port } = makePort({ isSessionPending: false });
    const { container } = render(<InvitationAccept port={port} />);

    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeEnabled();
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'false');
  });

  it('warns that accepting will sign the current account out, once the session is known', () => {
    const { port } = makePort({ isSignedIn: true });

    render(<InvitationAccept port={port} />);

    expect(screen.getByText(AUTH.invitation.signedInWarning)).toBeInTheDocument();
  });

  it('keeps the warning away while the session is still unknown', () => {
    const { port } = makePort({ isSignedIn: true, isSessionPending: true });

    render(<InvitationAccept port={port} />);

    expect(screen.queryByText(AUTH.invitation.signedInWarning)).toBeNull();
  });
});

/* ---- local checks --------------------------------------------------------- */

describe('InvitationAccept — checks before sending', () => {
  it('refuses a blank name, a short password and a mismatch, without calling the port', () => {
    const { accept, port } = makePort();
    const { container } = render(<InvitationAccept port={port} />);

    type(AUTH.fields.fullName, '   ');
    type(AUTH.fields.password, 'ngan');
    type(AUTH.fields.confirmPassword, 'khac');
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(screen.getByText(AUTH.problems.fullNameRequired)).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeInTheDocument();
    expect(screen.getByText(AUTH.problems.confirmMismatch)).toBeInTheDocument();
    expect(accept).not.toHaveBeenCalled();
  });

  it('refuses a name longer than 120 characters', () => {
    const { accept, port } = makePort();
    const { container } = render(<InvitationAccept port={port} />);

    type(AUTH.fields.fullName, 'a'.repeat(121));
    type(AUTH.fields.password, PASSWORD);
    type(AUTH.fields.confirmPassword, PASSWORD);
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(screen.getByText('Họ và tên tối đa 120 ký tự.')).toBeInTheDocument();
    expect(accept).not.toHaveBeenCalled();
  });

  it('sends the trimmed name', async () => {
    const { accept, port } = makePort();
    const { container } = render(<InvitationAccept port={port} />);

    type(AUTH.fields.fullName, `  ${FULL_NAME}  `);
    type(AUTH.fields.password, PASSWORD);
    type(AUTH.fields.confirmPassword, PASSWORD);
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(accept).toHaveBeenCalledWith({ token: 'abc', fullName: FULL_NAME, password: PASSWORD });
    });
  });
});

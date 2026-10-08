/**
 * `AuthRoute` end to end over a fake client and a fake session set-up: what it reads from
 * `location.state`, and when it moves on by itself.
 *
 * The rule under test: a session that turns `authenticated` because the sign-in THIS screen
 * just sent finished late (cookie accepted while the server was unreachable) takes the
 * visitor to their destination; a session that turns `authenticated` at start-up, before
 * anything was sent, leaves the form where it is (mock mode opens `user-mock` on boot and
 * the e2e then fills the form in).
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import { __resetAuthForTests, type RefreshSessionPayload } from '@/lib/auth';
import { setAuthenticatedSession, setServerUnreachable } from '@/lib/auth/state';

const AUTH = viMessages.auth;
const EMAIL = 'thu.ha@vidu.vn';
const PASSWORD = 'khong-doan-duoc';

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(async () => ({ ok: true as const, data: undefined })),
  bootstrap: vi.fn(async () => false),
}));

vi.mock('@/api/appClient', () => ({
  createAppApiClient: () => ({
    auth: { signIn: mocks.signIn, requestPasswordReset: vi.fn(), acceptInvitation: vi.fn() },
  }),
  resolveUseMockApi: () => false,
}));

vi.mock('@/routes/sessionSetup', () => ({
  bootstrapAfterNewCookie: mocks.bootstrap,
  configureAppSession: vi.fn(async () => undefined),
}));

const { AuthRoute } = await import('./AuthScreen.container');

const SESSION: RefreshSessionPayload = {
  accessToken: 't',
  expiresAt: 9_999_999_999,
  user: null,
  roles: ['engineer'],
};

function renderRoute(
  entry: string | { pathname: string; search?: string; state: unknown } = '/login?next=/tai-khoan',
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<AuthRoute />} />
        <Route path="/tai-khoan" element={<div>trang-dich</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function signIn(): void {
  fireEvent.change(screen.getByLabelText(AUTH.fields.email), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText(AUTH.fields.password), { target: { value: PASSWORD } });
  fireEvent.keyDown(screen.getByLabelText(AUTH.fields.password), { key: 'Enter' });
}

beforeEach(() => {
  __resetAuthForTests();
  mocks.signIn.mockClear();
  mocks.bootstrap.mockReset();
  mocks.bootstrap.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
});

describe('AuthRoute — location.state.notice', () => {
  it('opens with the verified strip after a password reset', () => {
    renderRoute({ pathname: '/login', state: { notice: 'passwordReset' } });

    expect(screen.getByText(AUTH.notices.passwordReset)).toBeInTheDocument();
  });

  it('opens with the attention strip when the session ended', () => {
    renderRoute({ pathname: '/login', state: { notice: 'sessionEnded' } });

    expect(screen.getByText(AUTH.notices.sessionEnded)).toBeInTheDocument();
  });

  it('asks to sign in to continue when bounced here with ?next= (BUG-007)', () => {
    renderRoute('/login?next=/tai-khoan');

    expect(screen.getByText(AUTH.notices.signInRequired)).toBeInTheDocument();
  });

  it('prefers the session-ended sentence over the ?next= one', () => {
    renderRoute({ pathname: '/login', search: '?next=/tai-khoan', state: { notice: 'sessionEnded' } });

    expect(screen.getByText(AUTH.notices.sessionEnded)).toBeInTheDocument();
    expect(screen.queryByText(AUTH.notices.signInRequired)).toBeNull();
  });

  it('says nothing on a plain visit to /login', () => {
    renderRoute('/login');

    expect(screen.queryByText(AUTH.notices.signInRequired)).toBeNull();
  });

  it('ignores a notice it does not know', () => {
    renderRoute({ pathname: '/login', state: { notice: 'whatever' } });

    expect(screen.queryByText(AUTH.notices.passwordReset)).toBeNull();
    expect(screen.queryByText(AUTH.notices.sessionEnded)).toBeNull();
  });
});

describe('AuthRoute — the notice does not survive a reload', () => {
  it('drops state.notice from the history entry after reading it, keeping other keys', async () => {
    const seen: unknown[] = [];

    function Probe() {
      seen.push(useLocation().state);

      return null;
    }

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { notice: 'passwordReset', from: '/tai-khoan' } }]}>
        <Probe />
        <Routes>
          <Route path="/login" element={<AuthRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(AUTH.notices.passwordReset)).toBeInTheDocument();
    await waitFor(() => {
      expect(seen.at(-1)).toEqual({ from: '/tai-khoan' });
    });
    // The sentence stays on screen even though the entry no longer carries it.
    expect(screen.getByText(AUTH.notices.passwordReset)).toBeInTheDocument();
  });
});

describe('AuthRoute — a session that opens by itself', () => {
  it('says so when the cookie was accepted but the server cannot be reached, then moves on once the session opens', async () => {
    renderRoute();
    act(() => {
      setServerUnreachable(true);
    });

    signIn();

    expect(await screen.findByText(AUTH.notices.signedInOffline)).toBeInTheDocument();
    expect(screen.queryByText('trang-dich')).toBeNull();
    // Nothing guarantees a retry behind the scenes (BUG-013): the button stays usable, and a
    // second press really tries again.
    const button = screen.getByRole('button', { name: AUTH.actions.signIn });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledTimes(2);
    });

    act(() => {
      setAuthenticatedSession(SESSION);
    });

    await waitFor(() => {
      expect(screen.getByText('trang-dich')).toBeInTheDocument();
    });
  });

  it('keeps the form when the session turns authenticated at start-up, before anything was sent', async () => {
    renderRoute();

    act(() => {
      setAuthenticatedSession(SESSION);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('trang-dich')).toBeNull();
    expect(screen.getByLabelText(AUTH.fields.email)).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('does not treat a plain failed session open as "offline"', async () => {
    renderRoute();

    signIn();

    await waitFor(() => {
      expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(AUTH.notices.signedInOffline)).toBeNull();
    // Its own sentence, not "Phiên làm việc đã hết hạn" guessed from the English message (BUG-014).
    expect(await screen.findByText(AUTH.notices.sessionNotOpened)).toBeInTheDocument();
    expect(screen.queryByText(viMessages.errors.unauthenticated.description)).toBeNull();

    act(() => {
      setAuthenticatedSession(SESSION);
    });

    expect(screen.queryByText('trang-dich')).toBeNull();
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import { findPositiveTabIndexes } from '@/lib/input/focusOrder';
import { durationMs } from '@/lib/motion';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { AuthScreen, AuthScreenView, type AuthScreenViewProps } from './AuthScreen';
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
    readonly reducedMotion?: boolean;
  } = {},
) {
  const fallback = stubGateway();

  return render(
    <AuthScreen
      gateway={options.gateway ?? fallback.gateway}
      onAuthenticated={options.onAuthenticated ?? noop}
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

describe('AuthScreenView — bảy trạng thái', () => {
  it('dựng được cả bảy trạng thái, không trạng thái nào ra màn hình trắng', () => {
    expect(() => {
      expectSevenStates(
        (scenario) => render(<AuthScreenView {...PROPS_BY_STATE[scenario.state]()} />),
        createSevenStateScenarios(),
      );
    }).not.toThrow();
  });

  it('ghi trạng thái hiện tại lên thuộc tính dữ liệu, không đọc thành chữ', () => {
    for (const state of Object.keys(PROPS_BY_STATE) as SevenState[]) {
      const { container, unmount } = render(<AuthScreenView {...PROPS_BY_STATE[state]()} />);

      expect(container.querySelector('main')).toHaveAttribute('data-auth-state', state);
      unmount();
    }
  });

  it('bỏ hẳn biểu mẫu khi tài khoản bị vô hiệu, thay bằng một dải cảnh báo', () => {
    render(<AuthScreenView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.queryByLabelText(AUTH_MESSAGES.fields.email)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_MESSAGES.errors.accountDisabled.title);
  });

  it('thu gọn thì chỉ còn một câu và một nút mở lại', () => {
    render(<AuthScreenView {...PROPS_BY_STATE.collapsed()} />);

    expect(screen.queryByLabelText(AUTH_MESSAGES.fields.email)).toBeNull();
    expect(screen.getByRole('button', { name: AUTH_MESSAGES.actions.expand })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Wording and tokens.                                                         */
/* -------------------------------------------------------------------------- */

describe('AuthScreenView — chữ và màu', () => {
  it('mọi chuỗi hiển thị đều là tiếng Việt có dấu', () => {
    for (const state of Object.keys(PROPS_BY_STATE) as SevenState[]) {
      const { container, unmount } = render(<AuthScreenView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        expectVietnamese(container);
      }).not.toThrow();
      unmount();
    }
  });

  it('không có mã màu thô trong ba tệp nguồn của màn hình', () => {
    expect(() => {
      expectNoRawColor('src/screens/auth/AuthScreen/AuthScreen.tsx');
      expectNoRawColor('src/screens/auth/AuthScreen/useAuthScreen.ts');
      expectNoRawColor('src/screens/auth/AuthScreen/AuthScreen.container.tsx');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Keyboard.                                                                   */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — bàn phím', () => {
  it('đặt tiêu điểm vào ô đầu tiên ngay khi mở', () => {
    renderScreen();

    expect(document.activeElement).toBe(emailField());
  });

  it('không dùng tabindex dương, nên thứ tự tiêu điểm đúng bằng thứ tự trong tài liệu', () => {
    const { container } = renderScreen();

    expect(findPositiveTabIndexes(container)).toHaveLength(0);
  });

  it('Enter gửi biểu mẫu từ mọi ô, kể cả ô đánh dấu', () => {
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

  it('chỉ dùng Tab và Enter là đăng nhập được: ô đầu có tiêu điểm, ô sau nối tiếp, Enter gửi', () => {
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
    expect(stops[2]).toBe(screen.getByLabelText(AUTH_MESSAGES.fields.rememberMe));
    expect(stops[3]).toBe(submitButton());

    type(emailField(), EMAIL);
    type(passwordField(), PASSWORD);
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, rememberMe: false });
  });
});

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — kiểm tra ô', () => {
  it('kiểm tra ô lúc rời ô, bằng câu lấy từ bó chuỗi', () => {
    renderScreen();

    type(emailField(), 'thu.ha');
    fireEvent.blur(emailField());

    expect(screen.getByText(AUTH_MESSAGES.problems.emailInvalid)).toBeInTheDocument();
  });

  it('bỏ lời phàn nàn ngay khi người dùng sửa lại ô đó', () => {
    renderScreen();

    type(emailField(), 'thu.ha');
    fireEvent.blur(emailField());
    expect(screen.getByText(AUTH_MESSAGES.problems.emailInvalid)).toBeInTheDocument();

    type(emailField(), EMAIL);
    expect(screen.queryByText(AUTH_MESSAGES.problems.emailInvalid)).toBeNull();
  });

  it('không gửi khi mật khẩu ngắn hơn mức tối thiểu, và nói rõ mức đó', () => {
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

  it('đứng ở trạng thái một phần khi đã có thư điện tử mà chưa có mật khẩu', () => {
    const { container } = renderScreen();

    type(emailField(), EMAIL);

    expect(container.querySelector('main')).toHaveAttribute('data-auth-state', 'partial');
    expect(screen.getByText(AUTH_MESSAGES.notices.partial)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Submitting.                                                                 */
/* -------------------------------------------------------------------------- */

describe('AuthScreen — gửi', () => {
  it('khoá lần gửi thứ hai khi lần thứ nhất còn đang bay', () => {
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

  it('giữ nguyên chiều rộng nút và đổi nhãn trong lúc gửi', async () => {
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

  it('sai mật khẩu thì hiện dải cảnh báo trong biểu mẫu và giữ nguyên chữ đã nhập', async () => {
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

  it('quá nhiều lần thử thì đếm ngược và khoá nút gửi', async () => {
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

  it('tài khoản bị vô hiệu thì chuyển sang trạng thái không có quyền', async () => {
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

  it('lỗi mạng thì mượn câu của src/lib/errors chứ không tự viết', async () => {
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

  it('gửi xong thì nháy nhẹ rồi mới chuyển trang', async () => {
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

  it('bỏ hẳn nhịp nháy khi người dùng đã xin bớt chuyển động', async () => {
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

describe('AuthScreen — đổi thẻ', () => {
  it('giữ lại thư điện tử đã nhập khi đổi sang thẻ đăng ký', async () => {
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

  it('bỏ lời phàn nàn của thẻ cũ khi đổi thẻ', async () => {
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

describe('AuthScreen — ranh giới tầng', () => {
  it('không gọi mạng trực tiếp ở đâu trong màn hình', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const directory = 'src/screens/auth/AuthScreen';

    for (const name of readdirSync(directory)) {
      const source = readFileSync(`${directory}/${name}`, 'utf8');

      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('phần giao diện không chạm tới src/api hay src/store', async () => {
    const { readFileSync } = await import('node:fs');
    const view = readFileSync('src/screens/auth/AuthScreen/AuthScreen.tsx', 'utf8');

    expect(view).not.toMatch(/@\/api/);
    expect(view).not.toMatch(/@\/store/);
  });
});

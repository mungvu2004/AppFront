/**
 * Cổng phiên, kiểm ở hai tầng vì nó được viết ở hai tầng.
 *
 * {@link SessionGate} là view thuần nên năm nhánh của nó kiểm thẳng từ props —
 * không máy chủ, không store. {@link SessionBootstrap} và `sessionSetup.ts` thì
 * kiểm qua một router thật và một chuyến đi giả, vì thứ đáng ngờ ở đó là *thứ
 * tự*: cấu hình trước, gia hạn sau, và đúng một lượt cho mỗi thứ.
 *
 * Bài này KHÔNG chạy `expectSevenStates`: `SessionGate` không phải một màn. Nó
 * có `loading`, `error` và một lượt chuyển hướng; năm trạng thái còn lại của
 * A11 là chuyện của màn con, và màn con chỉ mount sau khi cổng mở.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppClientModuleNamespace from '@/api/appClient';

import { __resetAuthForTests, bootstrapSession, getSession, signOut } from '@/lib/auth';
import { __resetLastKnownUserForTests } from '@/lib/auth/bootstrap';
import { getOptionalAuthConfig } from '@/lib/auth/state';
import { queryClient } from '@/lib/query/queryClient';
import { backgroundWatchRegistry } from '@/lib/realtime/backgroundWatch';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { useStore } from '@/store';

import { SessionBootstrap, SessionGate, type SessionGateProps } from './SessionBootstrap';
import {
  __resetAppSessionForTests,
  bootstrapAfterNewCookie,
  configureAppSession,
  ensureAuthConfigured,
  startAppSession,
} from './sessionSetup';

/* -------------------------------------------------------------------------- */
/* Khung dựng.                                                                 */
/* -------------------------------------------------------------------------- */

/** Bật lên thì lượt nạp `src/api` trong `configureAppSession` hỏng. */
let appClientBroken = false;

vi.mock('@/api/appClient', async (importOriginal) => {
  const actual = await importOriginal<typeof AppClientModuleNamespace>();

  return {
    ...actual,
    resolveApiBaseUrl: (): string => {
      if (appClientBroken) {
        throw new Error('không nạp được tầng API');
      }

      return actual.resolveApiBaseUrl();
    },
  };
});

const REFRESH_TTL_SECONDS = 900;

interface FakeServer {
  fetchImpl: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;
  /** Thả lượt gia hạn ĐẦU TIÊN, nếu nó được dựng ở chế độ giữ lại. */
  releaseFirstRefresh: () => void;
  /** Về khi lượt gia hạn đầu tiên đã ĐI — không phải khi nó đã về. */
  whenFirstRefreshStarted: () => Promise<void>;
  refreshCalls: () => number;
  setUser: (userId: string | null) => void;
}

/** Một máy chủ giả đủ để `bootstrapSession()` chạy trọn vòng. */
function createFakeServer(
  initialUserId: string | null,
  { holdFirstRefresh = false }: { holdFirstRefresh?: boolean } = {},
): FakeServer {
  let userId = initialUserId;
  let refreshCalls = 0;
  let releaseFirstRefresh = (): void => undefined;
  let markStarted = (): void => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const hold = holdFirstRefresh
    ? new Promise<void>((resolve) => {
        releaseFirstRefresh = resolve;
      })
    : Promise.resolve();

  return {
    fetchImpl: async (input: URL | RequestInfo): Promise<Response> => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (!url.includes('/auth/refresh')) {
        return new Response(null, { status: 204 });
      }

      refreshCalls += 1;
      // Ai đang đăng nhập được chốt lúc lượt gọi ĐI, không phải lúc nó về: đó
      // là cách dựng lại cảnh "cookie tới giữa lúc lượt khởi động còn bay".
      const answeringFor = userId;

      if (refreshCalls === 1) {
        markStarted();
        await hold;
      }

      if (answeringFor === null) {
        return new Response(null, { status: 401 });
      }

      return new Response(
        JSON.stringify({
          accessToken: 'token-gia',
          expiresIn: REFRESH_TTL_SECONDS,
          roles: ['engineer'],
          user: { email: `${answeringFor}@example.com`, id: answeringFor, name: 'Người dùng thử' },
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      );
    },
    refreshCalls: () => refreshCalls,
    releaseFirstRefresh: () => releaseFirstRefresh(),
    whenFirstRefreshStarted: () => started,
    setUser: (next: string | null) => {
      userId = next;
    },
  };
}

/* eslint-disable-next-line local/no-direct-set -- đưa store về trạng thái ban
 * đầu giữa hai bài là thao tác ghi duy nhất KHÔNG được vào lịch sử hoàn tác,
 * đúng ngoại lệ mà `src/lib/testing/render.tsx` đã ghi cho bộ kiểm. */
const resetStoreForTest = (): void => useStore.setState(useStore.getInitialState(), true);

/** Đếm số lượt gắn — thứ duy nhất chứng minh được "màn con không gắn lại". */
let screenMounts = 0;

function ProbeScreen() {
  useEffect(() => {
    screenMounts += 1;
  }, []);

  return <div data-testid="man-con">nội dung màn con</div>;
}

function LoginProbe() {
  const location = useLocation();
  const notice =
    typeof location.state === 'object' && location.state !== null
      ? (location.state as { readonly notice?: unknown }).notice
      : undefined;

  return (
    <div data-testid="man-dang-nhap" data-notice={typeof notice === 'string' ? notice : ''}>
      {`${location.pathname}${location.search}`}
    </div>
  );
}

/**
 * A12: nút phải nằm trong luồng Tab tự nhiên, không phải chỉ bấm được bằng chuột.
 *
 * Kiểm bằng chính hai điều kiện làm nên điều đó — có mặt trong thứ tự tab
 * (`tabIndex >= 0`, không `disabled`) và nhận được tiêu điểm — chứ không gõ một
 * phím Tab giả: repo không có `@testing-library/user-event`, và jsdom không tự
 * di chuyển tiêu điểm theo `keydown`.
 */
function expectTabbable(element: HTMLElement): void {
  expect(element).not.toBeDisabled();
  expect(element.tabIndex).toBeGreaterThanOrEqual(0);

  element.focus();
  expect(document.activeElement).toBe(element);
}

/* -------------------------------------------------------------------------- */
/* SessionGate — năm nhánh, theo đúng thứ tự hợp đồng.                         */
/* -------------------------------------------------------------------------- */

/** Props tối thiểu của cổng; mỗi bài chỉ đổi đúng thứ nó đang nói về. */
const gateProps = (overrides: Partial<SessionGateProps> = {}): SessionGateProps => ({
  children: <ProbeScreen />,
  isPublic: false,
  loginHref: '/login?next=%2Fbat-ky',
  onRetry: () => undefined,
  sessionEnded: false,
  setupFailed: false,
  status: 'authenticated',
  userId: 'u1',
  ...overrides,
});

const gateTree = (overrides: Partial<SessionGateProps>) => (
  <MemoryRouter initialEntries={['/bat-ky']}>
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route path="*" element={<SessionGate {...gateProps(overrides)} />} />
    </Routes>
  </MemoryRouter>
);

const renderGate = (overrides: Partial<SessionGateProps> = {}) => {
  const view = render(gateTree(overrides));

  return {
    ...view,
    update: (next: Partial<SessionGateProps>) => view.rerender(gateTree(next)),
  };
};

describe('SessionGate — năm nhánh', () => {
  it('vẽ màn con ngay trên đường công khai, kể cả khi đã đăng nhập', () => {
    renderGate({ isPublic: true, status: 'authenticated' });

    expect(screen.getByTestId('man-con')).toBeInTheDocument();
  });

  it('báo chưa mở được ứng dụng khi lượt dựng hỏng, với nút tới được bằng Tab', async () => {
    const { container } = renderGate({ setupFailed: true, status: 'unknown' });

    const button = screen.getByRole('button', { name: 'tải lại trang' });
    expect(screen.getByText('chưa mở được ứng dụng, hãy tải lại trang')).toBeInTheDocument();
    expect(screen.queryByTestId('man-con')).not.toBeInTheDocument();

    expectTabbable(button);

    expectVietnamese(container);
    expectAccessible(container);
  });

  it('báo không kết nối được máy chủ khi phiên còn chưa biết, và thử lại gọi onRetry', async () => {
    const onRetry = vi.fn();
    const { container } = renderGate({ onRetry, serverUnreachable: true, status: 'unknown' });

    fireEvent.click(screen.getByRole('button', { name: 'thử lại' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('man-con')).not.toBeInTheDocument();
    expectVietnamese(container);
    expectAccessible(container);
  });

  it('chờ bằng khung chờ có aria-busy, và KHÔNG mount màn con', () => {
    const { container } = renderGate({ status: 'unknown' });

    expect(screen.getByRole('status', { name: 'đang mở phiên' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByTestId('man-con')).not.toBeInTheDocument();
    expect(screenMounts).toBe(0);
    expectVietnamese(container);
  });

  it('đẩy người ẩn danh về màn đăng nhập, mang theo chỗ họ định tới', () => {
    renderGate({ status: 'anonymous' });

    expect(screen.getByTestId('man-dang-nhap')).toHaveTextContent('/login?next=%2Fbat-ky');
  });

  it('vẽ màn con khi đã đăng nhập', () => {
    renderGate({ status: 'authenticated' });

    expect(screen.getByTestId('man-con')).toBeInTheDocument();
  });
});

describe('SessionGate — mất kết nối khi đang đăng nhập', () => {
  it('vẫn vẽ màn con, và bật rồi tắt dải KHÔNG gắn lại màn', async () => {
    const onRetry = vi.fn();
    const { update, container } = renderGate({ onRetry, serverUnreachable: false });

    expect(screenMounts).toBe(1);

    update({ onRetry, serverUnreachable: true });

    expect(screen.getByTestId('man-con')).toBeInTheDocument();
    expect(
      screen.getByText('mất kết nối tới máy chủ, đang thử lại — đừng tải lại trang kẻo mất thay đổi'),
    ).toBeInTheDocument();
    expectVietnamese(container);
    expectAccessible(container);

    fireEvent.click(screen.getByRole('button', { name: 'thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    update({ onRetry, serverUnreachable: false });

    expect(screen.getByTestId('man-con')).toBeInTheDocument();
    expect(screenMounts).toBe(1);
  });

  it('gắn lại màn con khi đổi người', () => {
    const { update } = renderGate({ userId: 'u1' });

    expect(screenMounts).toBe(1);

    update({ userId: 'u2' });

    expect(screenMounts).toBe(2);
  });

  it('KHÔNG gắn lại màn công khai khi phiên đổi dưới chân nó', () => {
    const { update } = renderGate({ isPublic: true, status: 'anonymous', userId: null });

    expect(screenMounts).toBe(1);

    update({ isPublic: true, status: 'authenticated', userId: 'u1' });

    expect(screenMounts).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* SessionBootstrap — cổng thật, trên một router thật.                         */
/* -------------------------------------------------------------------------- */

/**
 * **Lệch khỏi prompt: `MemoryRouter` chứ không `createMemoryRouter`.**
 *
 * Một lượt chuyển hướng trong router-có-dữ-liệu đi qua `createClientSideRequest`
 * của `@remix-run/router`, hàm này dựng một `Request` toàn cục và gắn vào đó
 * `AbortSignal` của jsdom — mà `Request` ở đây là bản của Node, nên nó từ chối
 * chính cái signal ấy và lượt điều hướng chết lặng, không đổi địa chỉ, không
 * ném ở chỗ nào bài kiểm thấy được. Chữa ở tầng môi trường thì phải sửa
 * `vitest.setup.ts`, file khối [12] cấm chạm.
 *
 * `MemoryRouter` + `Routes` chạy đúng cùng một cây: cùng `matchPath`, cùng
 * `useLocation`, cùng `<Navigate>`. Thứ duy nhất khác là tầng dữ liệu mà cổng
 * phiên không dùng tới.
 */
const routeTree = (pathname: string) => (
  <MemoryRouter initialEntries={[pathname]}>
    <SessionBootstrap>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/login/reset-password" element={<LoginProbe />} />
        <Route path="/login/invitation/:token" element={<LoginProbe />} />
        <Route path="*" element={<ProbeScreen />} />
      </Routes>
    </SessionBootstrap>
  </MemoryRouter>
);

const renderAt = (pathname: string) => render(routeTree(pathname));

beforeEach(() => {
  appClientBroken = false;
  screenMounts = 0;
  __resetAppSessionForTests();
  __resetLastKnownUserForTests();
  __resetAuthForTests();
  backgroundWatchRegistry.releaseAll();
  queryClient.clear();
  resetStoreForTest();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SessionBootstrap', () => {
  it('đẩy người ẩn danh về /login kèm đường họ định tới', async () => {
    const server = createFakeServer(null);
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/projects/p1/3d?tab=a');

    await waitFor(() => {
      expect(screen.getByTestId('man-dang-nhap')).toHaveTextContent(
        '/login?next=%2Fprojects%2Fp1%2F3d%3Ftab%3Da',
      );
    });
    expect(screenMounts).toBe(0);
  });

  it('vẽ màn con trên /login/reset-password kể cả khi đã đăng nhập', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/login/reset-password');

    expect(screen.getByTestId('man-dang-nhap')).toBeInTheDocument();
    await waitFor(() => {
      expect(getSession().status).toBe('authenticated');
    });
    expect(screen.getByTestId('man-dang-nhap')).toBeInTheDocument();
  });

  /**
   * Đường lời mời MANG THAM SỐ, và đó là chỗ `end: true` từng nuốt lời hứa.
   *
   * `PUBLIC_ROUTE_PATTERNS` tự khai là phủ `/login/invitation`; với một mẫu
   * trần thì `matchPath({ end: true })` không khớp `/login/invitation/abc123`,
   * nên người bấm link mời bị đá về `/login?next=…` thay vì thấy màn nhận lời
   * mời. Ca này khoá lời hứa ấy lại trước khi F-09a dựng route thật.
   */
  it('để người ẩn danh vào thẳng link lời mời có tham số', async () => {
    const server = createFakeServer(null);
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/login/invitation/abc123');

    expect(screen.getByTestId('man-dang-nhap')).toBeInTheDocument();
    await waitFor(() => {
      expect(getSession().status).toBe('anonymous');
    });
    /* Vẫn ở nguyên chỗ cũ — không bị `<Navigate>` đá về `/login?next=…`. */
    expect(screen.getByTestId('man-dang-nhap')).toHaveTextContent('/login/invitation/abc123');
    expect(screenMounts).toBe(0);
  });

  it('mở màn con khi phiên mở được', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/projects/p1/3d');

    await waitFor(() => {
      expect(screen.getByTestId('man-con')).toBeInTheDocument();
    });
  });

  it('lượt nạp tầng API hỏng thì báo chưa mở được ứng dụng, nút tới được bằng Tab', async () => {
    appClientBroken = true;

    const { container } = renderAt('/projects/p1/3d');

    const button = await screen.findByRole('button', { name: 'tải lại trang' });
    expect(screen.queryByTestId('man-con')).not.toBeInTheDocument();

    expectTabbable(button);
    expectVietnamese(container);
  });

  it('phiên vừa kết thúc thì lượt chuyển hướng mang theo lý do', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/projects/p1/3d');

    await waitFor(() => {
      expect(screen.getByTestId('man-con')).toBeInTheDocument();
    });

    server.setUser(null);
    await signOut();

    await waitFor(() => {
      expect(screen.getByTestId('man-dang-nhap')).toHaveAttribute('data-notice', 'sessionEnded');
    });
  });

  it('người khác đăng nhập vào thì màn con gắn lại, không mang dữ liệu người cũ sang', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/projects/p1/3d');

    await waitFor(() => {
      expect(screenMounts).toBe(1);
    });

    server.setUser('u2');
    await bootstrapSession();

    await waitFor(() => {
      expect(screenMounts).toBe(2);
    });
  });

  it('KHÔNG gắn lại màn /login đang nháy thành công khi phiên mở ra', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    renderAt('/login');

    await waitFor(() => {
      expect(getSession().status).toBe('authenticated');
    });

    server.setUser('u2');
    await bootstrapSession();

    await waitFor(() => {
      expect(getSession().user?.id).toBe('u2');
    });
    expect(screen.getByTestId('man-dang-nhap')).toBeInTheDocument();
    expect(screenMounts).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* sessionSetup — một chỗ cấu hình, một lượt khởi động.                        */
/* -------------------------------------------------------------------------- */

describe('sessionSetup', () => {
  it('ensureAuthConfigured hỏi resolve đúng một lần dù hai người gọi cùng lúc', async () => {
    const resolve = vi.fn(() => ({ baseUrl: 'https://may-chu.example/api' }));

    await Promise.all([ensureAuthConfigured(resolve), ensureAuthConfigured(resolve)]);

    expect(resolve).toHaveBeenCalledTimes(1);

    await ensureAuthConfigured(resolve);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('cấu hình lại sau __resetAuthForTests, vì nó hỏi trạng thái thật chứ không đọc một cờ', async () => {
    const resolve = vi.fn(() => ({ baseUrl: 'https://may-chu.example/api' }));

    await ensureAuthConfigured(resolve);
    __resetAuthForTests();
    await ensureAuthConfigured(resolve);

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('nối đủ hai hàm xoá: bộ nhớ đệm truy vấn, và dữ liệu theo người', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    const config = getOptionalAuthConfig();
    expect(config).not.toBeNull();

    queryClient.setQueryData(['du-an', 'p1'], { ten: 'của người trước' });
    backgroundWatchRegistry.watch({
      id: 'p1:u1',
      label: 'đang dựng mô hình',
      onSettled: () => undefined,
      release: () => undefined,
    });
    useStore.getState().setUserRoles(['engineer']);
    useStore.getState().setZoom(2.5);

    await config?.clearQueryCache();
    await config?.clearUserData();

    expect(queryClient.getQueryData(['du-an', 'p1'])).toBeUndefined();
    expect(backgroundWatchRegistry.list()).toEqual([]);
    expect(useStore.getState().userRoles).toEqual([]);
    expect(useStore.getState().zoom).toBe(2.5);
  });

  it('dưới VITE_USE_MOCK_API, phiên mở ra thật mà không cần máy chủ nào', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');

    await expect(startAppSession()).resolves.toBe(true);
    expect(getSession().status).toBe('authenticated');
  });

  it('gọi hai lần thì vẫn đúng một lượt gia hạn', async () => {
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    const [first, second] = await Promise.all([startAppSession(), startAppSession()]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(server.refreshCalls()).toBe(1);
  });

  it('quên lượt đã hỏng đi, để lần sau còn thử lại được', async () => {
    appClientBroken = true;
    await expect(startAppSession()).rejects.toThrow();

    appClientBroken = false;
    const server = createFakeServer('u1');
    await configureAppSession({ fetchImpl: server.fetchImpl });

    await expect(startAppSession()).resolves.toBe(true);
  });

  it('cookie mới giữa lúc lượt khởi động còn bay thì gửi thêm đúng MỘT lượt gia hạn', async () => {
    const server = createFakeServer(null, { holdFirstRefresh: true });
    await configureAppSession({ fetchImpl: server.fetchImpl });

    const starting = startAppSession();
    await server.whenFirstRefreshStarted();
    // Máy chủ vừa nhận mật khẩu và đặt cookie, trong lúc lượt khởi động chưa về.
    server.setUser('u1');
    const afterLogin = bootstrapAfterNewCookie();
    server.releaseFirstRefresh();

    await expect(starting).resolves.toBe(false);
    await expect(afterLogin).resolves.toBe(true);

    expect(server.refreshCalls()).toBe(2);
    expect(getSession().status).toBe('authenticated');
  });
});

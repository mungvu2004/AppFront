/* eslint-disable react-refresh/only-export-components -- file này xuất `AuthRoute`
 * bên cạnh hai thứ không phải component: `safeDestination` và
 * `createHttpAuthGateway`. Fast refresh vì thế nạp lại cả màn
 * đăng nhập thay vì giữ trạng thái khi đang sửa — một cái giá thật, và là cái giá
 * nhỏ trên màn mà trạng thái chỉ gồm hai ô chữ.
 *
 * Phương án thay thế là thêm một module thứ tư bên cạnh, mà R-59 chốt một màn đúng
 * sáu file nên không có chỗ cho nó. `src/routes.tsx` tắt đúng luật này vì đúng lý do
 * này. `safeDestination` là chỗ chặn open-redirect và phải test thẳng được, nên
 * không thể chỉ để nó private trong module.
 */

/**
 * `/login`, wired to the router, the session transport and the motion setting.
 *
 * The thinnest layer in the feature, and deliberately so: it builds the gateway,
 * works out where the visitor was heading before they were bounced here, and
 * hands both to {@link AuthScreen} behind an error boundary. Everything else —
 * validating, classifying a failure, counting a lockout down, choosing which of
 * the seven states the screen is in — is below it in `useAuthScreen`, which is
 * what lets the screen be tested and storied without a router or a network.
 *
 * ## Signing in does not store a token
 *
 * The session in this application is refresh-cookie based. Posting to
 * `ENDPOINTS.auth.login` makes the server set that cookie and nothing else;
 * `bootstrapSession()` from `src/lib/auth` is what turns it into a live session
 * with an access token, a renewal timer and a broadcast to the other tabs. So
 * the gateway does both, in that order, and the screen never sees a credential
 * after it has posted one. A login the server accepted but which produced no
 * session is reported as a failure rather than waved through — the visitor would
 * otherwise land on a dashboard that immediately bounces them back here.
 *
 * ## Where the visitor goes back to
 *
 * Two sources, in order: `location.state.from`, which is what a private route
 * sets when it redirects, and `?next=`, which is what a link in an email
 * carries. Both are checked for being a path on this origin before they are
 * used — an open redirect is the one bug a login screen must not have, and
 * `//evil.example` is a *relative* URL to a browser but an absolute one to a
 * person reading it.
 *
 * ## Cấu hình phiên không còn xảy ra ở đây
 *
 * Tầng phiên được cấu hình lúc **tải trang**, ở `src/routes/sessionSetup.ts`,
 * chứ không phải lúc ai đó bấm nút. Màn này chỉ còn *gọi lại* chỗ ấy để chắc
 * chắn cấu hình đã xong trước lượt post — `configureAppSession()` không làm gì
 * khi tầng phiên đã được cấu hình.
 *
 * Nói rõ để không ai tin nhầm: `fetchImpl` truyền vào đây **không tới nơi** trên
 * đường chạy thật. `ensureAuthConfigured` thoát sớm khi `isAuthConfigured()`, và
 * từ lượt này `SessionBootstrap` luôn cấu hình trước ở lúc tải trang — nên lượt
 * gọi ở đây luôn là lượt thứ hai. Vô hại, vì dưới cờ mock thì chính
 * `sessionSetup` đã chọn đúng chuyến đi ấy; chỗ duy nhất tham số này còn tác
 * dụng là bài kiểm gọi thẳng màn khi chưa ai cấu hình.
 *
 * Trước lượt ấy, `configureAuth()` chỉ chạy từ đây, nên tải lại trang ở bất cứ
 * màn nào cũng vào với `roles: []`. Việc mở phiên là việc của cả ứng dụng, và
 * đặt nó sau một cái nút là đặt nó sau một điều kiện không phải lúc nào cũng
 * đúng.
 *
 * `VITE_USE_MOCK_API=true pnpm dev` vẫn đổi client của `useAuthGateway` sang
 * `src/api/__mocks__/client.ts` và vẫn đưa `createMockAuthTransport()` xuống
 * làm chuyến đi của lượt gia hạn, nên phiên ở dev mở ra THẬT — có
 * `accessToken`, có `roles`. Vai cấp theo địa chỉ đã gõ
 * (`viewer@example.com` → chỉ-xem, còn lại → kỹ sư), nên cả hai nhánh quyền
 * của A11 quan sát được mà không cần cờ thứ hai.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { createMockAuthTransport } from '@/api/__mocks__/client';
import { createAppApiClient, resolveUseMockApi } from '@/api/appClient';
import type { ApiClient } from '@/api/client';
import type { SignInInput } from '@/api/schemas';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSession } from '@/hooks/useSession';
import { getSession, type ConfigureAuthOptions } from '@/lib/auth';
import type { Result } from '@/lib/http';
import { ROUTES } from '@/routes/paths';
import { bootstrapAfterNewCookie, configureAppSession } from '@/routes/sessionSetup';

import { AuthScreen } from './AuthScreen';
import {
  SignedInOfflineError,
  type AuthGateway,
  type AuthInitialNotice,
} from './useAuthScreen';

/** Names this screen to the error boundary, and to anything reading its report. */
const SCREEN_ID = 'auth';

/** Where the visitor lands when they arrived at `/login` directly. */
const DEFAULT_DESTINATION = ROUTES.dashboard;

/** A host no real request can reach — only there so `URL` has a base to resolve against. */
const PARSE_BASE = 'http://app.invalid';

/** A backslash or a control character: the browser rewrites or drops them, so they never name what they look like. */
function hasForbiddenChar(candidate: string): boolean {
  return [...candidate].some((char) => {
    const code = char.charCodeAt(0);

    return char === '\\' || code < 0x20 || code === 0x7f;
  });
}

/**
 * A redirect target that cannot leave this origin, and is not the sign-in page.
 *
 * The candidate must start with `/`, and is then resolved the way the browser
 * would: `URL` treats `\` as `/` and drops tabs, so `/\evil.example` and
 * `/<tab>/evil.example` name another host exactly like `//evil.example` does —
 * a `startsWith('//')` test let them through (B-V1-02). Today the router happens
 * to drop the host again, but that is luck, not a guarantee.
 *
 * `/login` itself is rejected too: landing there after signing in leaves the
 * visitor on an empty sign-in form with nothing telling them it worked (B-V1-02).
 * Routes match case-insensitively and ignore a trailing slash, so the check does.
 *
 * Anything rejected falls back to the dashboard rather than failing the sign-in
 * — the visitor asked to log in, not to go somewhere in particular.
 */
export function safeDestination(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || hasForbiddenChar(candidate)) {
    return DEFAULT_DESTINATION;
  }

  let url: URL;
  try {
    url = new URL(candidate, PARSE_BASE);
  } catch {
    // `//host:99999` — a host with an impossible port does not parse at all.
    return DEFAULT_DESTINATION;
  }

  const pathname = url.pathname.toLowerCase().replace(/\/+$/u, '');

  if (url.origin !== PARSE_BASE || pathname === ROUTES.login) {
    return DEFAULT_DESTINATION;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The credential post, followed by the session it is worth nothing without.
 *
 * `bootstrapAfterNewCookie()` đợi lượt mở phiên lúc tải trang xong đã — nếu nó
 * còn đang bay thì single-flight của `src/lib/http` trả lại đúng kết quả ấy chứ
 * không gửi thêm một lượt thứ hai — rồi mới đổi cookie vừa nhận thành phiên.
 *
 * `bootstrapAfterNewCookie()` returning false means the cookie did not become a
 * session. There is no server error to classify in that case, so the failure is
 * an ordinary `Error` and `useAuthScreen` hands it to `describeError` — which is
 * the module that owns wording for anything the screen cannot explain itself.
 */
async function withSession(
  posted: Result<void, unknown>,
  transport?: SessionTransport,
): Promise<Result<void, unknown>> {
  if (!posted.ok) {
    return posted;
  }

  await configureAppSession(transport === undefined ? {} : { fetchImpl: transport });

  const established = await bootstrapAfterNewCookie();

  if (!established) {
    // Cookie accepted, session not opened: when the server is simply unreachable the
    // session layer retries on its own, and the screen says so instead of "failed".
    return {
      ok: false,
      error:
        getSession().serverUnreachable === true
          ? new SignedInOfflineError()
          : new Error('Sign-in succeeded but no session was established.'),
    };
  }

  return { ok: true, data: undefined };
}

/**
 * The two calls, over the plain client rather than the authenticated one.
 *
 * `createAuthHttpClient` attaches a token, and on a 401 it refreshes and
 * retries. Both are wrong here and the second is actively harmful: on
 * `ENDPOINTS.auth.login` a 401 *is* the answer — it means the password was
 * wrong — and a client that treats it as an expired token would retry a
 * rejected credential behind the visitor's back. A signed-out visitor has no
 * token to attach either. So the auth wrapper is used for its configuration
 * probe and nothing else, and the request itself goes over the ordinary client.
 */
export function createHttpAuthGateway(client: ApiClient, transport?: SessionTransport): AuthGateway {
  return {
    requestPasswordReset: async (input, signal): Promise<Result<void, unknown>> =>
      client.auth.requestPasswordReset({ body: input, ...(signal !== undefined ? { signal } : {}) }),
    signIn: async (input: SignInInput, signal?: AbortSignal): Promise<Result<void, unknown>> =>
      withSession(
        await client.auth.signIn({ body: input, ...(signal !== undefined ? { signal } : {}) }),
        transport,
      ),
  };
}

/** Chuyến đi mà lượt gia hạn dùng; vắng mặt nghĩa là `globalThis.fetch`. */
type SessionTransport = NonNullable<ConfigureAuthOptions['fetchImpl']>;

/**
 * The gateway. There is always one.
 *
 * An earlier version probed `src/lib/auth` here and returned `null` when
 * `configureAuth()` had not run, and the route then rendered a notice *instead
 * of the form*. That was wrong twice over. A sign-in form is static markup —
 * whether a server can be reached is not knowable until someone presses the
 * button — so hiding it locks the visitor out before they have typed anything.
 * And invariant A11 lists seven states; "the host has not configured auth" is
 * not one of them, because it is a deployment fault, not something a visitor
 * can act on.
 *
 * The probe was unnecessary anyway: `createHttpClient` needs a base URL and
 * nothing else. Only `bootstrapSession()` needs the auth layer configured, and
 * that runs *after* a successful post — where a failure is an ordinary rejected
 * attempt that `useAuthScreen` turns into a sentence in the strip, with every
 * field left exactly as it was typed.
 */
function useAuthGateway(): AuthGateway {
  return useMemo(() => {
    const client = createAppApiClient();

    // MỘT đường, hai chuyến đi. Dưới `VITE_USE_MOCK_API` cả lượt post lẫn lượt
    // gia hạn đều do bộ mẫu trả lời, nhưng thứ tự vẫn y hệt bản thật:
    // `signIn` → `bootstrapSession()` → `setAuthenticatedSession({ roles })`.
    // Trước đây nhánh mock đi vòng qua `withSession` và vì thế KHÔNG bao giờ
    // mở phiên, nên `useSession().roles` rỗng suốt ở dev.
    return createHttpAuthGateway(
      client,
      // Chữ `DEV` tại chỗ gọi: bản dựng bỏ nhánh này và cùng nó là client giả (`vite.config.ts`).
      import.meta.env.DEV && resolveUseMockApi() ? createMockAuthTransport() : undefined,
    );
  }, []);
}

/**
 * Thứ người dùng thấy thay cho màn đã sập.
 *
 * Cùng khuôn với `src/App.tsx` theo R-62: `ScreenErrorBoundary` cố ý không vẽ gì,
 * nên chỗ quyết định màn hỏng trông ra sao là ở đây. Chữ lấy thẳng từ
 * `report.description`, đã là tiếng Việt có dấu; nút "thử lại" chỉ hiện khi lỗi
 * thuộc loại đáng thử lại.
 */
function AuthCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** `location.state.notice`, if it is one of the two sentences this screen knows. */
function noticeOf(state: unknown): AuthInitialNotice | undefined {
  const notice =
    typeof state === 'object' && state !== null ? (state as { readonly notice?: unknown }).notice : undefined;

  return notice === 'passwordReset' || notice === 'sessionEnded' ? notice : undefined;
}

/**
 * The gateway, plus one memory: did THIS screen's own attempt end with the cookie
 * accepted but the session not yet open because the server was unreachable?
 *
 * Only then does a later `authenticated` mean "the sign-in the visitor just made
 * finished". A session that became `authenticated` at start-up (nothing sent yet)
 * must still show the form — mock mode opens `user-mock` on boot and the e2e then
 * fills the form in.
 */
function useWatchedGateway(): { gateway: AuthGateway; isAwaitingSession: boolean } {
  const inner = useAuthGateway();
  const [isAwaitingSession, setAwaiting] = useState(false);

  const gateway = useMemo<AuthGateway>(
    () => ({
      ...inner,
      signIn: async (input, signal) => {
        const result = await inner.signIn(input, signal);

        if (!result.ok && result.error instanceof SignedInOfflineError) {
          setAwaiting(true);
        }

        return result;
      },
    }),
    [inner],
  );

  return { gateway, isAwaitingSession };
}

/** The screen itself, inside the boundary rather than around it. */
function AuthRouteContent() {
  const { gateway, isAwaitingSession } = useWatchedGateway();
  const navigate = useNavigate();
  const session = useSession();
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  const destination = useMemo(() => {
    const fromState =
      typeof location.state === 'object' && location.state !== null
        ? (location.state as { readonly from?: unknown }).from
        : undefined;

    if (fromState !== undefined) {
      return safeDestination(fromState);
    }

    return safeDestination(new URLSearchParams(location.search).get('next'));
  }, [location.search, location.state]);

  const onAuthenticated = useCallback(() => {
    navigate(destination, { replace: true });
  }, [destination, navigate]);

  useEffect(() => {
    if (isAwaitingSession && session.status === 'authenticated') {
      onAuthenticated();
    }
  }, [isAwaitingSession, onAuthenticated, session.status]);

  const initialNotice = useMemo(() => noticeOf(location.state), [location.state]);

  return (
    <AuthScreen
      gateway={gateway}
      onAuthenticated={onAuthenticated}
      reducedMotion={reducedMotion}
      {...(initialNotice !== undefined ? { initialNotice } : {})}
    />
  );
}

/**
 * What the router mounts.
 *
 * The boundary is the outermost thing here, and it is the same one `src/App.tsx`
 * gates its screens with (R-62). Without it an exception anywhere below —
 * including inside `useAuthGateway`, which touches a module that throws on
 * purpose — takes the whole page white, the single failure invariant A11 exists
 * to prevent, and takes it white on the one screen a visitor cannot get past.
 */
export function AuthRoute() {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <AuthCrashFallback report={report} retry={retry} />}
    >
      <AuthRouteContent />
    </ScreenErrorBoundary>
  );
}

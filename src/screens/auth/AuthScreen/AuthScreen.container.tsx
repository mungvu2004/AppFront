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
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { createApiClient, type ApiClient } from '@/api/client';
import { API_BASE_PATH } from '@/api/endpoints';
import type { RegisterInput, SignInInput } from '@/api/schemas';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { bootstrapSession } from '@/lib/auth';
import { createHttpClient, type Result } from '@/lib/http';
import { ROUTES } from '@/routes/paths';

import { AuthScreen } from './AuthScreen';
import type { AuthGateway } from './useAuthScreen';

/** Names this screen to the error boundary, and to anything reading its report. */
const SCREEN_ID = 'auth';

/** Where the visitor lands when they arrived at `/login` directly. */
const DEFAULT_DESTINATION = ROUTES.dashboard;

/**
 * Where the API lives.
 *
 * `createHttpClient` resolves paths with `new URL(path, baseUrl)`, which needs
 * an absolute base, so the default from `src/api/endpoints.ts` is resolved
 * against the page's own origin rather than passed through as a bare path.
 */
function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;

  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }

  return new URL(API_BASE_PATH, globalThis.location?.origin ?? globalThis.origin).toString();
}

/**
 * A redirect target that cannot leave this origin.
 *
 * A single leading slash not followed by a second one is the whole test: a path
 * on this site stays, `//evil.example` and `https://evil.example` do not.
 * Anything rejected falls back to the dashboard rather than failing the sign-in
 * — the visitor asked to log in, not to go somewhere in particular.
 */
export function safeDestination(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  return candidate;
}

/**
 * The credential post, followed by the session it is worth nothing without.
 *
 * `bootstrapSession()` returning false means the cookie did not become a
 * session. There is no server error to classify in that case, so the failure is
 * an ordinary `Error` and `useAuthScreen` hands it to `describeError` — which is
 * the module that owns wording for anything the screen cannot explain itself.
 */
async function withSession(posted: Result<void, unknown>): Promise<Result<void, unknown>> {
  if (!posted.ok) {
    return posted;
  }

  const established = await bootstrapSession();

  if (!established) {
    return { ok: false, error: new Error('Sign-in succeeded but no session was established.') };
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
export function createHttpAuthGateway(client: ApiClient): AuthGateway {
  return {
    register: async (input: RegisterInput, signal?: AbortSignal): Promise<Result<void, unknown>> =>
      withSession(await client.auth.register({ body: input, ...(signal !== undefined ? { signal } : {}) })),
    signIn: async (input: SignInInput, signal?: AbortSignal): Promise<Result<void, unknown>> =>
      withSession(await client.auth.signIn({ body: input, ...(signal !== undefined ? { signal } : {}) })),
  };
}

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
  return useMemo(
    () => createHttpAuthGateway(createApiClient(createHttpClient({ baseUrl: resolveBaseUrl() }))),
    [],
  );
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

/** The screen itself, inside the boundary rather than around it. */
function AuthRouteContent() {
  const gateway = useAuthGateway();
  const navigate = useNavigate();
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

  return (
    <AuthScreen gateway={gateway} onAuthenticated={onAuthenticated} reducedMotion={reducedMotion} />
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

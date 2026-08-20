/* eslint-disable react-refresh/only-export-components -- file này xuất `AuthRoute`
 * bên cạnh ba thứ không phải component:
 * `safeDestination`, `createHttpAuthGateway` and the unavailable notice. Fast
 * refresh therefore reloads `/login` fully instead of preserving its state
 * while it is being edited — a real cost, and a small one on a screen whose
 * state is two text fields.
 *
 * The alternative is a fourth module beside this one, which the brief's
 * deliverable list does not have a slot for. `src/routes.tsx` disables the same
 * rule for the same reason. `safeDestination` is the open-redirect guard and is
 * the one piece here that must stay directly testable, which is what rules out
 * simply making these module-private.
 */

/**
 * `/login`, wired to the router, the session transport and the motion setting.
 *
 * The thinnest layer in the feature, and deliberately so: it builds the gateway,
 * works out where the visitor was heading before they were bounced here, and
 * hands both to {@link AuthScreen}. Everything else — validating, classifying a
 * failure, counting a lockout down, choosing which of the seven states the
 * screen is in — is below it in `useAuthScreen`, which is what lets the screen
 * be tested and storied without a router or a network.
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
 * ## What is missing upstream
 *
 * `src/api/endpoints.ts` has no auth entry and `src/lib/auth` has no sign-in
 * call; neither path is one this change may write. So the two paths are named
 * here and posted through the authenticated client from `src/lib/auth`, which
 * keeps the request inside `src/lib/http` where invariant `no-fetch-outside-http`
 * requires it. When the shared endpoints land, this constant is what moves.
 */

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { createAuthHttpClient, type AuthHttpClient } from '@/lib/auth';
import type { Result } from '@/lib/http';

import viMessages from '@/i18n/vi.json';

import { AuthScreen } from './AuthScreen';
import type { AuthGateway, RegisterInput, SignInInput } from './useAuthScreen';

/** The two paths this screen posts to. Belongs in `src/api/endpoints.ts`. */
const AUTH_ENDPOINTS = {
  register: '/auth/register',
  signIn: '/auth/login',
} as const;

/** Where the visitor lands when they arrived at `/login` directly. */
const DEFAULT_DESTINATION = '/';

/** What to say when the session layer has not been configured by the host yet. */
export const AUTH_GATEWAY_UNAVAILABLE = viMessages.auth.notices.gatewayUnavailable;

/**
 * Where the API lives.
 *
 * `createHttpClient` resolves paths with `new URL(path, baseUrl)`, which needs
 * an absolute base, so a relative default is resolved against the page's own
 * origin rather than passed through as `/api`.
 */
function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;

  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }

  return new URL('/api', globalThis.location?.origin ?? 'http://localhost').toString();
}

/**
 * A redirect target that cannot leave this origin.
 *
 * A single leading slash not followed by a second one is the whole test: `/qc`
 * stays, `//evil.example` and `https://evil.example` do not. Anything rejected
 * falls back to the dashboard rather than failing the sign-in — the visitor
 * asked to log in, not to go somewhere in particular.
 */
export function safeDestination(candidate: unknown): string {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return DEFAULT_DESTINATION;
  }

  return candidate;
}

/** The two calls, over the authenticated client. */
export function createHttpAuthGateway(client: AuthHttpClient): AuthGateway {
  return {
    register: async (input: RegisterInput, signal?: AbortSignal): Promise<Result<void, unknown>> => {
      const result = await client.post<unknown, RegisterInput>(AUTH_ENDPOINTS.register, {
        body: input,
        ...(signal !== undefined ? { signal } : {}),
      });

      return result.ok ? { ok: true, data: undefined } : result;
    },
    signIn: async (input: SignInInput, signal?: AbortSignal): Promise<Result<void, unknown>> => {
      const result = await client.post<unknown, SignInInput>(AUTH_ENDPOINTS.signIn, {
        body: input,
        ...(signal !== undefined ? { signal } : {}),
      });

      return result.ok ? { ok: true, data: undefined } : result;
    },
  };
}

/**
 * The gateway for this build, or `null` when there is no transport to use.
 *
 * `createAuthHttpClient` throws when `configureAuth()` has not run — which is
 * the truth in this build, where the auth layer is configured by the host
 * application rather than at import time. Throwing out of a route would take it
 * down with a white screen, which is the one failure invariant A11 exists to
 * prevent, so the failure is returned as a value and the route says so.
 */
function useAuthGateway(): AuthGateway | null {
  return useMemo(() => {
    try {
      return createHttpAuthGateway(createAuthHttpClient({ baseUrl: resolveBaseUrl() }));
    } catch {
      // Auth has not been configured yet. Not an error worth reporting: the
      // route says so in a sentence and offers nothing it cannot deliver.
      return null;
    }
  }, []);
}

export function AuthRoute() {
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

  if (gateway === null) {
    return (
      <div className="p-6">
        <InlineAlert level="attention" message={AUTH_GATEWAY_UNAVAILABLE} />
      </div>
    );
  }

  return (
    <AuthScreen gateway={gateway} onAuthenticated={onAuthenticated} reducedMotion={reducedMotion} />
  );
}

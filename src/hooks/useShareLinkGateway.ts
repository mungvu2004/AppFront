/**
 * The share feature's transport, wired to whatever session the app is in.
 *
 * `src/lib/export/shareLink.ts` ships `createHttpShareLinkGateway`, which wants
 * an `HttpClient`. The application's real client is an `AuthHttpClient` — the
 * same three verbs, plus one error kind of its own, `unauthenticated`, that
 * `HttpError` has no room for. Translating that one kind is the whole job of
 * this hook, and it lives here rather than in a screen because rule B of
 * `CLAUDE.md` keeps computation out of components, and rather than in
 * `src/lib/export` because a module about sharing has no business knowing how
 * this product authenticates.
 *
 * ## Why it can return `null`
 *
 * `createAuthHttpClient` throws when `configureAuth()` has not run — which is
 * the truth in this build, where the auth layer is configured by the host
 * application rather than at import time. Throwing out of a hook would take the
 * route down with a white screen, which is the one failure invariant A11 exists
 * to prevent, so the failure is returned as a value and the route renders a
 * sentence instead.
 */

import { useMemo } from 'react';

import { createAuthHttpClient, type AuthHttpClient, type AuthHttpError } from '@/lib/auth';
import type { ShareLinkGateway } from '@/lib/export/shareLink';
import { SHARE_LINK_ENDPOINTS } from '@/lib/export/shareLink';
import type { HttpError, Result } from '@/lib/http';

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
 * One error kind down to a kind the share module understands.
 *
 * `unauthenticated` means the same thing to a person as `auth` does — the
 * session is no longer good — and `transportMessage` already has the sentence
 * for it. Nothing is lost: the original stays in `raw`.
 */
function toHttpError(error: AuthHttpError): HttpError {
  return error.kind === 'unauthenticated' ? { ...error, kind: 'auth', retryable: false } : error;
}

function normalise<T>(result: Result<T, AuthHttpError>): Result<T, HttpError> {
  return result.ok ? result : { ok: false, error: toHttpError(result.error) };
}

/** The three calls, over an authenticated client. */
export function createAuthShareLinkGateway(client: AuthHttpClient): ShareLinkGateway {
  return {
    create: async ({ body, projectId, signal }) =>
      normalise(
        await client.post<unknown, typeof body>(SHARE_LINK_ENDPOINTS.collection(projectId), {
          body,
          ...(signal !== undefined ? { signal } : {}),
        }),
      ),
    list: async ({ projectId, signal }) =>
      normalise(
        await client.get<unknown>(
          SHARE_LINK_ENDPOINTS.collection(projectId),
          signal !== undefined ? { signal } : undefined,
        ),
      ),
    revoke: async ({ linkId, projectId, signal }) =>
      normalise(
        await client.delete<unknown>(
          SHARE_LINK_ENDPOINTS.item(projectId, linkId),
          signal !== undefined ? { signal } : {},
        ),
      ),
  };
}

/**
 * The gateway for this session, or `null` when there is no session to use.
 *
 * @example
 * const gateway = useShareLinkGateway();
 * if (gateway === null) {
 *   return <InlineAlert level="attention" message={SHARE_GATEWAY_UNAVAILABLE} />;
 * }
 */
export function useShareLinkGateway(): ShareLinkGateway | null {
  return useMemo(() => {
    try {
      return createAuthShareLinkGateway(createAuthHttpClient({ baseUrl: resolveBaseUrl() }));
    } catch {
      // Auth has not been configured yet. Not an error worth reporting: the
      // route says so in a sentence and offers nothing it cannot deliver.
      return null;
    }
  }, []);
}

/** What to say when there is no session to share from. */
export const SHARE_GATEWAY_UNAVAILABLE =
  'Chưa kết nối được phiên đăng nhập, nên chưa tải được liên kết chia sẻ. Hãy đăng nhập lại rồi mở lại trang này.';

/**
 * The one place the API's base URL and the mock-vs-real decision get made.
 *
 * Before this file, `AuthScreen.container.tsx` and `useShareLinkGateway.ts`
 * each carried their own copy of "resolve `VITE_API_BASE_URL`, or fall back to
 * the page origin" — and the two had already drifted: one fell back to
 * `globalThis.origin`, the other to a hardcoded `http://localhost`. A third
 * copy, for choosing between a real client and the fixture in
 * `src/api/__mocks__/client.ts`, would have made that worse. Every caller that
 * needs an `ApiClient` reaches for {@link createAppApiClient} here instead of
 * re-deriving either decision.
 */

import { createHttpClient } from '@/lib/http';

import { createMockApiClient } from './__mocks__/client';
import { createApiClient, type ApiClient } from './client';
import { API_BASE_PATH } from './endpoints';

/**
 * Where the API lives when the build does not say.
 *
 * `createHttpClient` resolves each path with `new URL(path, baseUrl)`, which
 * needs an absolute base, so a caller with no `VITE_API_BASE_URL` resolves this
 * against the page's own origin rather than passing `API_BASE_PATH` through as
 * a bare path.
 */
export function resolveApiBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_BASE_URL;

  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }

  return new URL(API_BASE_PATH, globalThis.location?.origin ?? globalThis.origin).toString();
}

/** Reading the environment must not be a way to crash at import time. */
function readUseMockApiFlag(): unknown {
  try {
    return import.meta.env.VITE_USE_MOCK_API;
  } catch {
    return undefined;
  }
}

/**
 * Is the app running against `src/api/__mocks__/client.ts` instead of a real server?
 *
 * Gated twice, the same way `DEV_ONLY_ROUTES` is in `src/routes/router.tsx`:
 * `import.meta.env.DEV` first, so a production build carries neither this
 * branch nor the mock client — both are dropped once Vite replaces the literal
 * with `false`. The flag itself is fail-closed the way `VITE_TELEMETRY_ENABLED`
 * is (`src/lib/telemetry/sender.ts`): only the exact string `'true'` (or a
 * boolean `true`) turns it on, so a missing or misspelt variable means the real
 * server.
 */
export function resolveUseMockApi(value: unknown = readUseMockApiFlag()): boolean {
  return import.meta.env.DEV && (value === true || value === 'true');
}

/**
 * The `ApiClient` a caller should talk to right now.
 *
 * Real by default; under `VITE_USE_MOCK_API` it is
 * `src/api/__mocks__/client.ts` instead, which answers every call from fixed,
 * in-memory data rather than a server. Swapping this one function back is the
 * whole migration once a real endpoint exists — nothing to search and delete.
 */
export function createAppApiClient(): ApiClient {
  return resolveUseMockApi()
    ? createMockApiClient()
    : createApiClient(createHttpClient({ baseUrl: resolveApiBaseUrl() }));
}

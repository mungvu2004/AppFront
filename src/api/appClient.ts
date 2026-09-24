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
 *
 * Cùng lý do đó, {@link createAppHttpClient} là nơi DUY NHẤT gắn phiên vào
 * transport: base URL, token lười, refresh và ghim chủ nằm chung một chỗ, nên
 * một màn cần `HttpClient` gọi nó chứ không tự dựng `createHttpClient` (F-01a
 * §4.5, §4.7).
 */

import { createAuthHttpClientOptions, getSession } from '@/lib/auth';
import { createHttpClient, requirePlatformFetch, type CreateHttpClientOptions, type HttpClient } from '@/lib/http';

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
 * Câu ném khi môi trường không có `fetch`.
 *
 * Tra transport ở MỖI lượt gửi, trong thân `fetchImpl`, chứ không một lần lúc
 * dựng: `createAppHttpClient()` phải dựng được cả khi chưa có gì (4.5), nên chỗ
 * duy nhất còn lại để hỏng là lượt gửi.
 */
const NO_FETCH_MESSAGE = 'Môi trường không có fetch. createAppHttpClient() cần một transport.';

/** Chủ ghim đã đổi: client xếp thành `aborted`, không gửi, không thử lại. */
const OWNER_CHANGED_MESSAGE = 'người dùng đã đổi';

/**
 * `HttpClient` của ứng dụng: gắn phiên kiểu **lười**, và ghim chủ của nó.
 *
 * Lười vì `configureAuth()` chạy ở `src/main.tsx` chứ không ở đây, nên một
 * client dựng sớm — hay dựng trong một bài kiểm chưa cấu hình phiên — vẫn phải
 * dựng được. `createAuthHttpClientOptions()` ném khi chưa cấu hình
 * (`src/lib/auth/session.ts`), nên ba móc dưới đọc nó **mỗi lượt gọi** và nuốt
 * câu ném: chưa có phiên thì không token, có phiên rồi thì tự nhiên có, không ai
 * phải dựng lại client.
 *
 * `fetchImpl` của cấu hình phiên **không** được lấy: nó là transport riêng của
 * đường refresh (ở chế độ mock nó chỉ biết trả lời `/auth/refresh`), không phải
 * transport chung của API.
 *
 * **Ghim chủ.** Một client sống qua nhiều lần vẽ; nếu giữa chừng người dùng đổi
 * (thẻ khác đăng nhập tài khoản khác, hoặc refresh trả về một người khác), thì
 * lượt gửi còn dở thuộc về người cũ và không được mang dữ liệu của người mới.
 * Lượt gửi đó bị chặn bằng một `AbortError`, thứ mà `src/lib/http/client.ts`
 * xếp thành `kind: 'aborted'` — không gửi, không thử lại, không gọi
 * `onAuthError`, nên nó cũng không kéo theo một lượt đăng xuất.
 */
export function createAppHttpClient(): HttpClient {
  const readAuthOptions = (): ReturnType<typeof createAuthHttpClientOptions> | null => {
    try {
      return createAuthHttpClientOptions();
    } catch {
      return null;
    }
  };

  const currentUserId = (): string | null => getSession().user?.id ?? null;

  // Chưa có ai lúc dựng thì ghim ở lượt gửi đầu tiên CÓ người dùng.
  let pinnedUserId = currentUserId();

  const fetchImpl: NonNullable<CreateHttpClientOptions['fetchImpl']> = async (input, init) => {
    const userId = currentUserId();

    if (pinnedUserId === null) {
      pinnedUserId = userId;
    } else if (userId !== pinnedUserId) {
      throw Object.assign(new Error(OWNER_CHANGED_MESSAGE), { name: 'AbortError' });
    }

    return requirePlatformFetch(NO_FETCH_MESSAGE)(input, init);
  };

  return createHttpClient({
    baseUrl: resolveApiBaseUrl(),
    fetchImpl,
    getToken: () => readAuthOptions()?.getToken?.() ?? null,
    onAuthError: async (error) => {
      await readAuthOptions()?.onAuthError?.(error);
    },
    onRefreshToken: () => readAuthOptions()?.onRefreshToken?.() ?? false,
  });
}

/**
 * The `ApiClient` a caller should talk to right now.
 *
 * Real by default; under `VITE_USE_MOCK_API` it is
 * `src/api/__mocks__/client.ts` instead, which answers every call from fixed,
 * in-memory data rather than a server. Swapping this one function back is the
 * whole migration once a real endpoint exists — nothing to search and delete.
 *
 * Hai client, không một: mọi nhóm đi qua {@link createAppHttpClient} (có token,
 * có refresh), riêng nhóm `auth` đi một client **trần**. Lý do ở docblock
 * `AuthApi` của `./client` — đăng nhập sai trả 401, và một 401 trên client có
 * refresh sẽ thành một lượt đăng xuất mọi thẻ (BE-00 W10).
 */
export function createAppApiClient(): ApiClient {
  return resolveUseMockApi()
    ? createMockApiClient()
    : createApiClient(createAppHttpClient(), {
        authHttp: createHttpClient({ baseUrl: resolveApiBaseUrl() }),
      });
}

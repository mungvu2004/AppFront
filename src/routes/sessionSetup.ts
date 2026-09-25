/**
 * Mở phiên, đúng một lần, trước khi màn nào kịp hỏi "tôi có quyền gì".
 *
 * Trước lượt này `configureAuth()` chỉ chạy khi ai đó bấm nút đăng nhập, nên
 * tải lại trang ở bất cứ màn nào cũng vào với `roles: []`: màn nháy trạng thái
 * "không có quyền" rồi mới có dữ liệu, hoặc không bao giờ có. Cấu hình phiên là
 * việc của lúc **tải trang**, không phải của một cái nút, nên nó ở đây — cạnh
 * router — chứ không ở trong một màn.
 *
 * ## `src/api` nạp muộn, và đó là điều kiện chứ không phải sở thích
 *
 * Module này bị route gốc nhập tĩnh, nên mọi thứ nó nhập tĩnh đều nằm trong
 * chunk vào. Nhập thẳng `@/api/appClient` là kéo cả tầng API (và, dưới cờ mock,
 * cả bộ mẫu) vào thứ người dùng tải về đầu tiên. `import()` động giữ chúng ở
 * chunk riêng, tải đúng lúc lượt cấu hình đầu tiên cần tới.
 */

import {
  bootstrapSession,
  configureAuth,
  getSession,
  type ConfigureAuthOptions,
} from '@/lib/auth';
import { isAuthConfigured } from '@/lib/auth/session';
import type { AuthFetch } from '@/lib/auth/types';
import { queryClient } from '@/lib/query/queryClient';
import { backgroundWatchRegistry } from '@/lib/realtime/backgroundWatch';
import { resetUserScopedState } from '@/store/resetUserScopedState';

/** Lượt cấu hình đang bay, để hai người gọi đồng thời không cấu hình hai lần. */
let configuring: Promise<void> | null = null;

/** Lượt khởi động đã nhớ; `null` nghĩa là lần sau thử lại từ đầu. */
let starting: Promise<boolean> | null = null;

/**
 * Cấu hình tầng phiên nếu nó chưa được cấu hình, và chỉ hỏi `resolve` một lần.
 *
 * Câu hỏi "đã cấu hình chưa" hỏi thẳng tầng phiên (`isAuthConfigured()`) chứ
 * không đọc một cờ riêng ở đây: một cờ sẽ nói dối ngay sau
 * `__resetAuthForTests()`, lúc tầng phiên vừa quên sạch còn cờ vẫn bảo là xong.
 */
export async function ensureAuthConfigured(
  resolve: () => Promise<ConfigureAuthOptions> | ConfigureAuthOptions,
): Promise<void> {
  if (isAuthConfigured()) {
    return;
  }

  configuring ??= (async () => {
    configureAuth(await resolve());
  })().finally(() => {
    configuring = null;
  });

  return configuring;
}

/** Dọn mọi thứ thuộc về người vừa rời đi: state của màn, và sổ theo dõi nền. */
function clearUserData(): void {
  resetUserScopedState();
  // Sổ chạy nền là module toàn cục, không phải state của một cây React: gắn lại
  // màn không nhả nó, nên chỗ nhả là đây.
  backgroundWatchRegistry.releaseAll();
}

/** Cấu hình tầng phiên bằng thứ ứng dụng thật dùng. */
export async function configureAppSession(
  overrides: { fetchImpl?: AuthFetch } = {},
): Promise<void> {
  return ensureAuthConfigured(async () => {
    const { resolveApiBaseUrl, resolveUseMockApi } = await import('@/api/appClient');
    const fetchImpl =
      overrides.fetchImpl ??
      (resolveUseMockApi() ? (await import('@/api/__mocks__/client')).createMockAuthTransport() : undefined);

    return {
      baseUrl: resolveApiBaseUrl(),
      clearQueryCache: () => queryClient.clear(),
      clearUserData,
      ...(fetchImpl === undefined ? {} : { fetchImpl }),
    };
  });
}

/**
 * Lượt mở phiên của cả ứng dụng — nhớ ở cấp module, chạy đúng một lần.
 *
 * Bị từ chối (ví dụ `import()` hỏng vì mất mạng giữa chừng) thì **quên** lượt
 * đã nhớ đi, để lần sau còn thử lại được, và để lời từ chối nổi lên cho
 * `SessionBootstrap` bắt — nuốt nó ở đây là để người dùng ngồi trước một khung
 * chờ không bao giờ hết.
 */
export function startAppSession(): Promise<boolean> {
  starting ??= (async () => {
    await configureAppSession();

    if (getSession().status !== 'unknown') {
      return getSession().status === 'authenticated';
    }

    return bootstrapSession();
  })().catch((error: unknown) => {
    starting = null;
    throw error;
  });

  return starting;
}

/** Thử lại lượt gia hạn sau khi nó hỏng vì máy chủ không trả lời. */
export function retryAppSession(): Promise<boolean> {
  return bootstrapSession();
}

/**
 * Máy chủ vừa đặt cookie mới (đăng nhập, nhận lời mời, đặt lại mật khẩu).
 *
 * Lượt khởi động có thể còn đang bay; `await` nó trước để không có hai đường
 * cùng cấu hình, rồi gọi `bootstrapSession()` để cookie mới thành phiên thật.
 * Lượt khởi động hỏng không phải chuyện của lượt này — cookie mới vẫn đáng được
 * thử — nên lỗi ở đó bị nuốt.
 *
 * ## Đúng một lượt, và đó là chỗ đã đổi
 *
 * Ở bản đầu, hàm này phải gọi lượt thứ hai qua `source: 'broadcast'`: mở phiên
 * lúc tải trang khiến người chưa đăng nhập mở `/login` nhận một `401`, tầng
 * phiên đặt cờ `refreshFailed`, và cờ ấy làm lượt đăng nhập ngay sau đó trả
 * `false` mà không gửi gì — hỏng oan, vì cookie vừa nhận chính là thứ làm cờ
 * hết đúng. Cổng `refreshFailed` nay cho `reason: 'bootstrap'` đi qua
 * (`lib/auth/refresh.ts`), nên `bootstrapSession()` một lượt là đủ và cửa thoát
 * đã được gỡ. Đừng dựng lại nó: hai lượt ở đây che mất lỗi nếu cổng kia hồi quy.
 */
export async function bootstrapAfterNewCookie(): Promise<boolean> {
  await startAppSession().catch(() => false);

  return bootstrapSession();
}

export function __resetAppSessionForTests(): void {
  configuring = null;
  starting = null;
}

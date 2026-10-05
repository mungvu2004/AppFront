/**
 * Nguồn dữ liệu của ba khối T3: mật khẩu, phiên đăng nhập, vùng nguy hiểm.
 *
 * ## Một việc có dây, hai việc chưa có (F-09b)
 *
 * - **Đổi mật khẩu** gọi N13 (`POST /me/password`). Máy chủ thu hồi các phiên
 *   KHÁC của người dùng. Lỗi được phân loại bằng {@link ChangePasswordFailure}.
 * - **Phiên đăng nhập** và **xoá tài khoản** chưa có điểm cuối ở v1 (kế hoạch §10,
 *   để v2). Không có bộ nhớ giả thay cho chúng: cổng thật báo
 *   `capabilities.sessions` và `capabilities.deleteAccount` đều `false`, và màn
 *   thì **rời khối đó khỏi DOM** (khuôn `exportPanelGateway.ts`). Ba hàm
 *   `listSessions`, `revokeSession`, `deleteAccount` giữ chữ ký cho v2 và trả
 *   `unavailable`.
 *
 * ## Vì sao `readIdentity` đứng riêng chứ không đi kèm `listSessions`
 *
 * Địa chỉ thư và cờ "tài khoản do công ty quản lý" nuôi hai khối khác nhau: khối
 * mật khẩu đọc cờ để vào trạng thái 6, vùng nguy hiểm đọc địa chỉ để dựng cửa
 * xác nhận của A9. Hai lượt đọc tách rời là cách giữ cho dải cảnh báo nằm đúng
 * trong khối của nó.
 *
 * ## Nạp LƯỜI client
 *
 * Tuỳ chọn tên `apiClient` giữ nguyên, nhưng mặc định nạp lười `appClient` (kéo
 * theo cả phiên đăng nhập) — nhập tĩnh thì chunk của màn vượt trần kích thước.
 */

import type { ApiClient } from '@/api/client';
import { getSession } from '@/lib/auth';
import { readWireError } from '@/lib/errors/wireError';
import type { Result } from '@/lib/http';

/* -------------------------------------------------------------------------- */
/* Kiểu dữ liệu.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Việc không làm được, đã phân loại.
 *
 * Trả `Result` chứ không ném: một mật khẩu bị từ chối là một giá trị mà hook xếp
 * loại, không phải một ngoại lệ phải bắt ở ba chỗ. Cùng lý do `AuthGateway` của
 * màn đăng nhập trả `Result` (`useAuthScreen.ts`).
 */
export type AccountAuthFailure =
  /** Mật khẩu hiện tại gõ sai — trạng thái 4, lỗi buộc vào đúng ô đó. */
  | 'wrong-current-password'
  /** Tài khoản đăng nhập một lần; máy chủ không nhận lượt đổi mật khẩu — trạng thái 6. */
  | 'managed-externally'
  /** Địa chỉ gõ để xác nhận không khớp — cửa của A9 không mở. */
  | 'email-mismatch'
  /** Phiên đã biến mất trước khi lượt thu hồi tới nơi. */
  | 'session-gone'
  /** Mạng, máy chủ, hoặc bất cứ thứ gì không phân loại được. */
  | 'unavailable';

/** Lỗi của N13. `retryAfterSeconds` chỉ có khi `rate-limited` mà máy chủ kèm số giây. */
export interface ChangePasswordFailure {
  readonly reason: 'wrong-current-password' | 'rate-limited' | 'unavailable';
  readonly retryAfterSeconds?: number;
}

/** Tài khoản đang đăng nhập, ở mức hai khối này cần biết. */
export interface AccountIdentity {
  /** Địa chỉ thư — thứ vùng nguy hiểm bắt gõ lại. */
  readonly email: string;
  /** Đăng nhập một lần do công ty quản lý: khối mật khẩu chỉ đọc. */
  readonly isManagedExternally: boolean;
}

/** Một phiên đang mở. `lastActiveAt` là mốc thô — định dạng xảy ra ở hook (A15). */
export interface AccountSession {
  readonly id: string;
  readonly device: string;
  readonly location: string;
  readonly lastActiveAt: number;
  /** Phiên của chính trình duyệt này. Không bày nút đăng xuất cho nó. */
  readonly isCurrent: boolean;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface RevokeSessionInput {
  readonly sessionId: string;
}

export interface DeleteAccountInput {
  /** Địa chỉ người dùng vừa gõ lại. Máy chủ đối chiếu lần nữa, không tin màn hình. */
  readonly confirmEmail: string;
}

/** Việc nào cổng làm được. Cờ `false` thì khối tương ứng rời khỏi DOM. */
export interface AccountAuthCapabilities {
  readonly sessions: boolean;
  readonly deleteAccount: boolean;
}

export interface AccountAuthGateway {
  readonly capabilities: AccountAuthCapabilities;
  readonly readIdentity: () => Promise<Result<AccountIdentity, AccountAuthFailure>>;
  readonly listSessions: () => Promise<Result<readonly AccountSession[], AccountAuthFailure>>;
  readonly changePassword: (input: ChangePasswordInput) => Promise<Result<void, ChangePasswordFailure>>;
  readonly revokeSession: (input: RevokeSessionInput) => Promise<Result<void, AccountAuthFailure>>;
  readonly deleteAccount: (input: DeleteAccountInput) => Promise<Result<void, AccountAuthFailure>>;
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

/** Địa chỉ dự phòng khi chưa có phiên nào — chỉ gặp ở story và test. */
const FALLBACK_EMAIL = 'ban@congty.vn';

export interface CreateAccountAuthGatewayOptions {
  /** Client tiêm vào, cho test. Vắng thì nạp lười `createAppApiClient()`. */
  readonly apiClient?: ApiClient;
}

const UNAVAILABLE: { readonly ok: false; readonly error: 'unavailable' } = {
  ok: false,
  error: 'unavailable',
};

/** Cổng thật của ứng dụng. */
export function createAccountAuthGateway(
  options: CreateAccountAuthGatewayOptions = {},
): AccountAuthGateway {
  let clientPromise: Promise<ApiClient> | null =
    options.apiClient === undefined ? null : Promise.resolve(options.apiClient);
  const getClient = (): Promise<ApiClient> => {
    clientPromise ??= import('@/api/appClient').then((module) => module.createAppApiClient());

    return clientPromise;
  };

  return {
    // v1: BE chưa có phiên và xoá tài khoản (kế hoạch §10). Hai khối rời khỏi DOM.
    capabilities: { sessions: false, deleteAccount: false },

    readIdentity: () => {
      const user = getSession().user;

      return Promise.resolve({
        ok: true,
        data: {
          email: user?.email ?? FALLBACK_EMAIL,
          // Không có trường nào trên dây nói tài khoản dùng đăng nhập một lần.
          isManagedExternally: false,
        },
      });
    },

    listSessions: () => Promise.resolve(UNAVAILABLE),

    changePassword: async (input) => {
      const result = await (await getClient()).me.changePassword({ body: input });

      if (result.ok) {
        return { ok: true, data: undefined };
      }

      const wire = readWireError(result.error);

      if (wire?.code === 'CURRENT_PASSWORD_INCORRECT') {
        return { ok: false, error: { reason: 'wrong-current-password' } };
      }

      if (wire?.code === 'RATE_LIMITED' || wire?.status === 429) {
        return {
          ok: false,
          error: {
            reason: 'rate-limited',
            ...(wire.retryAfterSeconds !== undefined ? { retryAfterSeconds: wire.retryAfterSeconds } : {}),
          },
        };
      }

      return { ok: false, error: { reason: 'unavailable' } };
    },

    revokeSession: () => Promise.resolve(UNAVAILABLE),

    deleteAccount: () => Promise.resolve(UNAVAILABLE),
  };
}

/**
 * Nguồn dữ liệu của ba khối T3: mật khẩu, phiên đăng nhập, vùng nguy hiểm.
 *
 * ## Vì sao đây là bộ nhớ trong chứ không phải một lời gọi mạng
 *
 * `src/api/endpoints.ts` có đúng sáu nhóm — `auth.{login,register}`, `drawings`,
 * `featureFlags.read`, `floors`, `projects`, `spatial`. **Không có** điểm cuối
 * đổi mật khẩu, không có điểm cuối liệt kê phiên, không có điểm cuối thu hồi
 * phiên, không có điểm cuối xoá tài khoản; `src/lib/mutations` cũng không giữ
 * mutation nào cho tài khoản. Mà `src/api/**` là thư mục màn này không được sửa.
 *
 * Bịa một đường dẫn ra rồi gọi vào đó cho "trông như thật" là cách chắc chắn
 * nhất để màn hình xanh trên máy người viết và đỏ ở mọi nơi khác. Nên bốn việc
 * đó được giữ trong bộ nhớ của chính module này, đúng khuôn mà
 * `screens/project/ProjectSettings/projectSettingsGateway.ts` đã đi trước với
 * bảy trường chưa có dây, và `accountSettingsGateway.ts` đi trước ngay trong thư
 * mục này. Người dùng bấm được, màn hình phản hồi được ngay, và mọi thứ trở về
 * mặc định khi tải lại trang. Đó là một khoản nợ đã ghi, không phải một lời hứa
 * đã giữ.
 *
 * ## Hình dạng dây khi mở, mã đề xuất T-09
 *
 * Chữ ký dưới đây cố ý mang đúng hình dạng của bốn yêu cầu thật, để lượt T-09
 * chỉ phải thay phần thân:
 *
 * | Việc | Yêu cầu | Thân | Trả về |
 * |---|---|---|---|
 * | đổi mật khẩu | `POST /account/password` | `{currentPassword, newPassword}` | 204, hoặc 422 khi mật khẩu hiện tại sai |
 * | đọc phiên | `GET /account/sessions` | — | `{sessions: [{id, device, location, lastActiveAt, isCurrent}]}` |
 * | thu hồi một phiên | `DELETE /account/sessions/{sessionId}` | — | 204 |
 * | xoá tài khoản | `DELETE /account` | `{confirmEmail}` | 204, hoặc 422 khi địa chỉ không khớp |
 *
 * Khi ấy `createAccountAuthGateway` gọi `src/api/client.ts` — mọi truy cập mạng
 * đi qua `src/lib/http`, `local/no-fetch-outside-http` không cho đường nào khác
 * — và đây là file duy nhất phải sửa: `useAccountAuth` cùng ba khối không đổi
 * một dòng nào.
 *
 * ## Vì sao `readIdentity` đứng riêng chứ không đi kèm `listSessions`
 *
 * Địa chỉ thư và cờ "tài khoản do công ty quản lý" nuôi hai khối khác nhau: khối
 * mật khẩu đọc cờ để vào trạng thái 6, vùng nguy hiểm đọc địa chỉ để dựng cửa
 * xác nhận của A9. Gộp chúng vào lượt đọc phiên thì một lượt đọc phiên hỏng —
 * trạng thái 3, thứ chỉ được phép làm hỏng **khối phiên** — sẽ kéo theo cả hai
 * khối kia. Hai lượt đọc tách rời là cách giữ cho dải cảnh báo nằm đúng trong
 * khối của nó.
 */

import { getSession } from '@/lib/auth';
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

export interface AccountAuthGateway {
  readonly readIdentity: () => Promise<Result<AccountIdentity, AccountAuthFailure>>;
  readonly listSessions: () => Promise<Result<readonly AccountSession[], AccountAuthFailure>>;
  readonly changePassword: (input: ChangePasswordInput) => Promise<Result<void, AccountAuthFailure>>;
  readonly revokeSession: (input: RevokeSessionInput) => Promise<Result<void, AccountAuthFailure>>;
  readonly deleteAccount: (input: DeleteAccountInput) => Promise<Result<void, AccountAuthFailure>>;
}

/* -------------------------------------------------------------------------- */
/* Bộ nhớ tạm của khoản nợ T-09.                                              */
/* -------------------------------------------------------------------------- */

/** Một phút, một giờ, một ngày — để mốc thời gian mẫu đọc được thành câu. */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Địa chỉ dự phòng khi chưa có phiên nào — chỉ gặp ở story và test. */
const FALLBACK_EMAIL = 'ban@congty.vn';

/**
 * Mật khẩu hiện tại mà bản đứng thay chấp nhận.
 *
 * Có đúng một giá trị đúng chứ không nhận mọi thứ, vì trạng thái 4 phải dựng
 * được: không có đường nào dựng ra "mật khẩu hiện tại sai" nếu mọi chuỗi đều
 * đúng. Máy chủ thật giữ băm mật khẩu; ở đây nó là một hằng, và nó biến mất cùng
 * lượt T-09.
 */
const STAND_IN_CURRENT_PASSWORD = 'matkhau123';

/**
 * Ba phiên mẫu, mốc tính lùi từ lúc đọc lần đầu để câu thời gian luôn có nghĩa.
 *
 * Chuỗi thiết bị viết bằng tiếng Việt chứ không phải `Chrome trên Windows`, và
 * đó không phải chuyện thẩm mỹ: `expectVietnamese` soát mọi chuỗi màn hình nói
 * ra, và một tên riêng tiếng Anh phải được kê tên qua `allowWords`. Bản đứng
 * thay thì không cần tên riêng nào — nó đứng thay. Khi T-09 nối dây thật, chuỗi
 * do máy chủ dựng từ user-agent sẽ mang tên riêng, và **bộ kiểm cấp màn khi ấy
 * truyền `expectVietnamese(container, { allowWords: ['Chrome', 'Safari',
 * 'Windows', 'macOS', 'Android'] })`**. Ghi ở đây để lượt đó không phải đi tìm.
 */
function seedSessions(now: number): AccountSession[] {
  return [
    {
      id: 'session-current',
      device: 'Trình duyệt trên máy tính để bàn',
      location: 'Hà Nội, Việt Nam',
      lastActiveAt: now,
      isCurrent: true,
    },
    {
      id: 'session-macbook',
      device: 'Trình duyệt trên máy tính xách tay',
      location: 'Đà Nẵng, Việt Nam',
      lastActiveAt: now - 12 * MINUTE_MS,
      isCurrent: false,
    },
    {
      id: 'session-phone',
      device: 'Ứng dụng trên điện thoại',
      location: 'Thành phố Hồ Chí Minh, Việt Nam',
      lastActiveAt: now - 3 * DAY_MS - 2 * HOUR_MS,
      isCurrent: false,
    },
  ];
}

let storedSessions: AccountSession[] | null = null;
let storedPassword = STAND_IN_CURRENT_PASSWORD;

function sessionsNow(now: () => number): AccountSession[] {
  storedSessions ??= seedSessions(now());

  return storedSessions;
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

export interface CreateAccountAuthGatewayOptions {
  /** Đồng hồ tiêm vào, cho `fakeClock`. */
  readonly now?: () => number;
}

/**
 * Cổng thật của ứng dụng.
 *
 * Mọi hàm trả `Promise` chứ không trả giá trị đồng bộ, và đó là chủ ý: lượt đọc
 * phiên phải có một nhịp "đang tải" thật để dải cảnh báo của trạng thái 3 không
 * phải là thứ chỉ tồn tại trong story. Khi T-09 nối dây thật, chữ ký này không
 * đổi.
 */
export function createAccountAuthGateway(
  options: CreateAccountAuthGatewayOptions = {},
): AccountAuthGateway {
  const now = options.now ?? Date.now;

  return {
    readIdentity: () => {
      const user = getSession().user;

      return Promise.resolve({
        ok: true,
        data: {
          email: user?.email ?? FALLBACK_EMAIL,
          // Không có trường nào trên dây nói tài khoản dùng đăng nhập một lần.
          // Bản đứng thay trả `false`; lượt T-09 đọc nó từ máy chủ.
          isManagedExternally: false,
        },
      });
    },

    listSessions: () => Promise.resolve({ ok: true, data: [...sessionsNow(now)] }),

    changePassword: ({ currentPassword, newPassword }) => {
      if (currentPassword !== storedPassword) {
        return Promise.resolve({ ok: false, error: 'wrong-current-password' });
      }

      storedPassword = newPassword;

      return Promise.resolve({ ok: true, data: undefined });
    },

    revokeSession: ({ sessionId }) => {
      const sessions = sessionsNow(now);
      const index = sessions.findIndex((session) => session.id === sessionId);

      if (index === -1) {
        return Promise.resolve({ ok: false, error: 'session-gone' });
      }

      sessions.splice(index, 1);

      return Promise.resolve({ ok: true, data: undefined });
    },

    deleteAccount: ({ confirmEmail }) => {
      const user = getSession().user;
      const expected = user?.email ?? FALLBACK_EMAIL;

      // Máy chủ đối chiếu lần thứ hai. Màn hình đã chặn ở nút, nhưng một cửa của
      // A9 chỉ có một lớp kiểm thì lớp đó là giao diện, không phải luật.
      if (confirmEmail.trim().toLowerCase() !== expected.toLowerCase()) {
        return Promise.resolve({ ok: false, error: 'email-mismatch' });
      }

      return Promise.resolve({ ok: true, data: undefined });
    },
  };
}

/** Đưa bộ nhớ tạm về rỗng. Dành cho test; sản phẩm không gọi. */
export function resetAccountAuthStore(): void {
  storedSessions = null;
  storedPassword = STAND_IN_CURRENT_PASSWORD;
}

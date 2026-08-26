/**
 * Nguồn dữ liệu của màn cài đặt tài khoản.
 *
 * ## Vì sao đây là bộ nhớ trong chứ không phải một lời gọi mạng
 *
 * `src/api/endpoints.ts` hiện có đúng sáu nhóm — `auth.{login,register}`,
 * `drawings`, `featureFlags.read`, `floors`, `projects`, `spatial`. **Không có**
 * điểm cuối nào cho hồ sơ, giao diện hay thông báo của một tài khoản, và
 * `src/api/**` là thư mục màn này không được sửa. Bịa một đường dẫn ra rồi gọi
 * vào đó cho "trông như thật" là cách chắc chắn nhất để màn hình xanh trên máy
 * người viết và đỏ ở mọi nơi khác.
 *
 * Nên cài đặt được giữ trong bộ nhớ của chính module này, đúng khuôn mà
 * `screens/project/ProjectSettings/projectSettingsGateway.ts` đã đi trước với
 * bảy trường chưa có dây: người dùng sửa được, màn hình đọc lại được ngay, và
 * mọi thứ trở về mặc định khi tải lại trang. Đó là một khoản nợ đã ghi, không
 * phải một lời hứa đã giữ.
 *
 * Mở dây thật là một lượt riêng ở tầng dữ liệu, mã đề xuất **T-08**: thêm nhóm
 * `account` vào `ENDPOINTS`, cho `createAccountSettingsGateway` gọi
 * `src/api/client.ts` (mọi truy cập mạng đi qua `src/lib/http` —
 * `local/no-fetch-outside-http` không cho đường nào khác), rồi xoá bộ nhớ dưới
 * đây. Khi ấy đây là file duy nhất phải sửa: `useAccountSettings` và cả bảy
 * khối không đổi một dòng nào.
 *
 * ## Không ghi thẳng localStorage
 *
 * Kể cả khi bộ nhớ này là tạm. Một khối tự gọi `localStorage.setItem` là một
 * đường lưu thứ hai mà `SaveIndicator` không nhìn thấy, tức A7 nói dối. Ngoại
 * lệ duy nhất trong màn là chủ đề sáng/tối: `useTheme` đã tự giữ
 * `localStorage['app-theme-mode']` từ trước, và đó là việc của store chứ không
 * của màn này.
 */

import { EMPTY_ACCOUNT_DRAFT, type AccountDraft } from './accountDraft';

export interface AccountSettingsGateway {
  /** Đọc cài đặt đã lưu. Ném lỗi khi đọc hỏng — tầng query bắt và vẽ trạng thái 4. */
  readonly read: () => Promise<AccountDraft>;
  /** Ghi trọn bản nháp. Ném lỗi khi ghi hỏng — `createAutosave` thử lại theo lịch 5/15/45 giây. */
  readonly save: (draft: AccountDraft) => Promise<void>;
}

/** Bộ nhớ tạm của khoản nợ T-08. Một tài khoản một bản, vì màn này chỉ nói về tài khoản đang đăng nhập. */
let storedDraft: AccountDraft = EMPTY_ACCOUNT_DRAFT;

/**
 * Cổng thật của ứng dụng.
 *
 * Trả về `Promise` chứ không phải giá trị đồng bộ, và đó là chủ ý: `useQuery`
 * phải có một lượt "đang tải" thật để trạng thái 2 của A11 không phải là thứ
 * chỉ tồn tại trong story. Khi T-08 nối dây thật, chữ ký này không đổi.
 */
export function createAccountSettingsGateway(): AccountSettingsGateway {
  return {
    read: () => Promise.resolve(storedDraft),
    save: (draft) => {
      storedDraft = draft;

      return Promise.resolve();
    },
  };
}

/** Đưa bộ nhớ tạm về rỗng. Dành cho test; sản phẩm không gọi. */
export function resetAccountSettingsStore(): void {
  storedDraft = EMPTY_ACCOUNT_DRAFT;
}

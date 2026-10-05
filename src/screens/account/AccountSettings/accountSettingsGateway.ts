/**
 * Nguồn dữ liệu của màn cài đặt tài khoản.
 *
 * ## Hồ sơ sống trên máy chủ: N11 đọc, N12 sửa, N14 thay ảnh (F-09b)
 *
 * - `read` gọi `GET /me` và ánh xạ ra khối `profile` của bản nháp. Hỏng thì
 *   **ném nguyên** lỗi của client: trang vẽ dải lỗi đọc.
 * - `save` so bốn khoá hồ sơ (`fullName`, `jobTitle`, `phone`, `language`) với bản
 *   đã lưu gần nhất và chỉ gửi khoá đổi qua `PATCH /me`. Không khoá nào đổi thì
 *   KHÔNG gọi mạng. Không bao giờ gửi `avatarUrl` hay `email`. Hỏng thì ném nguyên
 *   lỗi — `createAutosave` xếp loại (lỗi tạm thử lại, 4xx dừng ngay).
 * - `replaceAvatar` gọi `PUT /me/avatar`. Ảnh không đi qua bản nháp.
 *
 * ## Hai khối chưa có dây: giao diện và thông báo
 *
 * Hợp đồng v1 (HOP-DONG-MOI §10 AC1) không có điểm cuối cho chúng, nên chúng vẫn
 * nằm trong bộ nhớ của module này — một bản, gắn kèm id người dùng của phiên đã
 * ghi nó. `read` gặp id khác thì hai khối về mặc định: bộ nhớ này không bị xoá khi
 * đăng xuất, nên không có kiểm tra ấy thì người sau thấy cài đặt của người trước.
 * Chúng KHÔNG phải bộ nhớ giả của hồ sơ: hồ sơ không bao giờ được giữ ở đây.
 *
 * ## Nạp LƯỜI client
 *
 * `appClient` kéo theo cả phiên đăng nhập; nhập tĩnh thì chunk của màn vượt trần
 * kích thước (khuôn `ruleSettingsGateway.ts`). Chỉ `import type` ở đầu file.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import type { Me, UpdateMe, UploadAvatar } from '@/api/schemas/me';
import { getSession } from '@/lib/auth';

import { EMPTY_ACCOUNT_DRAFT, type AccountDraft, type AccountDraftFields } from './accountDraft';

export interface AccountSettingsGateway {
  /** Đọc cài đặt đã lưu. Ném lỗi khi đọc hỏng — tầng query bắt và vẽ trạng thái 4. */
  readonly read: () => Promise<AccountDraft>;
  /**
   * Ghi bản nháp. Ném lỗi khi ghi hỏng. Trả hồ sơ máy chủ vừa trả về khi đã gọi
   * N12, `null` khi lượt này không có khoá hồ sơ nào đổi.
   */
  readonly save: (draft: AccountDraft) => Promise<Me | null>;
  /** N14. Trả `ApiResult` chứ không ném: hook xếp loại theo mã lỗi dây. */
  readonly replaceAvatar: (input: UploadAvatar) => Promise<ApiResult<Me>>;
}

export interface CreateAccountSettingsGatewayOptions {
  /** Client tiêm vào, cho test. Vắng thì nạp lười `createAppApiClient()`. */
  readonly apiClient?: ApiClient;
}

/** Bốn khoá hồ sơ mà N12 nhận. */
const PROFILE_BODY_KEYS = ['fullName', 'jobTitle', 'language', 'phone'] as const;

type ProfileBodyKey = (typeof PROFILE_BODY_KEYS)[number];
type ProfileBaseline = Readonly<Record<ProfileBodyKey, string>>;

/** Hồ sơ máy chủ thành khối `profile` của bản nháp. Vắng `jobTitle`/`phone` thành `''`. */
export function profileDraftOf(me: Me): AccountDraftFields {
  return {
    fullName: me.fullName,
    jobTitle: me.jobTitle ?? '',
    phone: me.phone ?? '',
    language: me.language,
    ...(me.avatarUrl !== undefined ? { avatarUrl: me.avatarUrl } : {}),
  };
}

function textOf(fields: AccountDraftFields | undefined, key: ProfileBodyKey): string | undefined {
  const value = fields?.[key];

  return typeof value === 'string' ? value : undefined;
}

function isLanguage(value: string): value is Me['language'] {
  return value === 'vi' || value === 'en';
}

/** Chỉ hai khối chưa có dây, kèm id người dùng đã ghi chúng. */
interface LocalOnlyStore {
  readonly userId: string | null;
  readonly appearance: AccountDraftFields;
  readonly notifications: AccountDraftFields;
}

const EMPTY_LOCAL_ONLY: LocalOnlyStore = {
  userId: null,
  appearance: EMPTY_ACCOUNT_DRAFT.appearance,
  notifications: EMPTY_ACCOUNT_DRAFT.notifications,
};

/** Bộ nhớ của hai khối giao diện và thông báo; v1 chưa có dây cho chúng. */
let localOnly: LocalOnlyStore = EMPTY_LOCAL_ONLY;

function currentUserId(): string | null {
  return getSession().user?.id ?? null;
}

/** Cổng thật của ứng dụng. */
export function createAccountSettingsGateway(
  options: CreateAccountSettingsGatewayOptions = {},
): AccountSettingsGateway {
  let clientPromise: Promise<ApiClient> | null =
    options.apiClient === undefined ? null : Promise.resolve(options.apiClient);
  const getClient = (): Promise<ApiClient> => {
    clientPromise ??= import('@/api/appClient').then((module) => module.createAppApiClient());

    return clientPromise;
  };
  /** Bốn khoá hồ sơ ở lần đọc/ghi thành công gần nhất — thứ `save` so để biết khoá nào đổi. */
  let baseline: ProfileBaseline | null = null;

  return {
    read: async () => {
      const result = await (await getClient()).me.readProfile();

      if (!result.ok) {
        throw result.error;
      }

      const profile = profileDraftOf(result.data);

      baseline = {
        fullName: result.data.fullName,
        jobTitle: result.data.jobTitle ?? '',
        language: result.data.language,
        phone: result.data.phone ?? '',
      };

      if (localOnly.userId !== currentUserId()) {
        localOnly = EMPTY_LOCAL_ONLY;
      }

      return { appearance: localOnly.appearance, notifications: localOnly.notifications, profile };
    },

    save: async (draft) => {
      const body: UpdateMe = {};
      const changed: Partial<Record<ProfileBodyKey, string>> = {};

      for (const key of PROFILE_BODY_KEYS) {
        const value = textOf(draft.profile, key);

        if (value === undefined || value === baseline?.[key]) {
          continue;
        }

        changed[key] = value;

        if (key === 'language') {
          if (isLanguage(value)) {
            body.language = value;
          }
        } else {
          body[key] = value;
        }
      }

      localOnly = {
        userId: currentUserId(),
        appearance: draft.appearance,
        notifications: draft.notifications,
      };

      if (Object.keys(body).length === 0) {
        return null;
      }

      const result = await (await getClient()).me.updateProfile({ body });

      if (!result.ok) {
        throw result.error;
      }

      baseline = {
        fullName: changed.fullName ?? baseline?.fullName ?? result.data.fullName,
        jobTitle: changed.jobTitle ?? baseline?.jobTitle ?? '',
        language: changed.language ?? baseline?.language ?? result.data.language,
        phone: changed.phone ?? baseline?.phone ?? '',
      };

      return result.data;
    },

    replaceAvatar: async (input) => (await getClient()).me.replaceAvatar({ body: input }),
  };
}

/** Đưa bộ nhớ của hai khối giao diện và thông báo về rỗng. Dành cho test; sản phẩm không gọi. */
export function resetAccountSettingsStore(): void {
  localOnly = EMPTY_LOCAL_ONLY;
}

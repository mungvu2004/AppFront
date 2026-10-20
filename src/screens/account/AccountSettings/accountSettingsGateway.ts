/**
 * Nguồn dữ liệu của màn cài đặt tài khoản.
 *
 * ## Hồ sơ sống trên máy chủ: N11 đọc, N12 sửa, N14 thay ảnh (F-09b)
 *
 * - `read` gọi `GET /me` và ánh xạ ra khối `profile` của bản nháp. Hỏng thì
 *   **ném nguyên** lỗi của client: trang vẽ dải lỗi đọc.
 * - `save(draft, previous)` so bốn khoá hồ sơ (`fullName`, `jobTitle`, `phone`, `language`)
 *   với bản đã lưu `previous` mà HOOK đang giữ (cổng không giữ trạng thái: cổng dựng lại mỗi
 *   lần mount, còn query có thể trả từ bộ đệm mà không gọi `read`) và chỉ gửi khoá đổi qua `PATCH /me`. Không khoá nào đổi thì
 *   KHÔNG gọi mạng. Không bao giờ gửi `avatarUrl` hay `email`. Hỏng thì ném nguyên
 *   lỗi — `createAutosave` xếp loại (lỗi tạm thử lại, 4xx dừng ngay).
 * - `replaceAvatar` gọi `PUT /me/avatar`. Ảnh không đi qua bản nháp.
 *
 * ## Giao diện và thông báo: `preferences` của N11/N12 (FE3D-FIX-003 W4c)
 *
 * `read` dựng hai khối từ `me.preferences` (khoá `themeChoice` của dây là `theme` của
 * bản nháp). `save` gửi bản vá gộp sâu: khoá đổi → giá trị mới, khoá bị bỏ (hoàn tác về
 * bản chưa có khoá ấy) → `null` để BE xoá. Chỉ ba loại thông báo BE nhận
 * (`NOTIFICATION_PREFERENCE_EVENTS`); hàng khác của bản nháp không đi lên dây.
 *

 * ## Nạp LƯỜI client
 *
 * `appClient` kéo theo cả phiên đăng nhập; nhập tĩnh thì chunk của màn vượt trần
 * kích thước (khuôn `ruleSettingsGateway.ts`). Chỉ `import type` ở đầu file.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import type { Me, PreferencesPatch, UpdateMe, UploadAvatar } from '@/api/schemas/me';
import { toAppError } from '@/lib/errors';

import type { AccountDraft, AccountDraftFields } from './accountDraft';

export interface AccountSettingsGateway {
  /** Đọc cài đặt đã lưu. Ném lỗi khi đọc hỏng — tầng query bắt và vẽ trạng thái 4. */
  readonly read: () => Promise<AccountDraft>;
  /**
   * Ghi bản nháp. Ném lỗi khi ghi hỏng. Trả hồ sơ máy chủ vừa trả về khi đã gọi
   * N12, `null` khi lượt này không có khoá nào (hồ sơ hay preferences) đổi.
   */
  readonly save: (draft: AccountDraft, previous: AccountDraft | null) => Promise<Me | null>;
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

/**
 * Viết thẳng `'vi' | 'en'` thay vì nhập `ACCOUNT_LANGUAGES`: giá trị của `schemas/me` mà nhập vào đây
 * thì kéo schema vào chunk của màn. Lệch khi schema thêm ngôn ngữ do `accountSettingsGateway.test.ts`
 * bắt (`satisfies` trên danh sách ngôn ngữ).
 */
function isLanguage(value: string): value is Me['language'] {
  return value === 'vi' || value === 'en';
}

/** Khoá giao diện của bản nháp → khoá `preferences.appearance` của dây. */
const APPEARANCE_KEYS = {
  density: 'density',
  reducedMotion: 'reducedMotion',
  showGrid: 'showGrid',
  theme: 'themeChoice',
  viewportDark: 'viewportDark',
} as const satisfies Record<string, keyof NonNullable<PreferencesPatch['appearance']>>;

type NotificationEvent = keyof NonNullable<PreferencesPatch['notifications']>;

/**
 * Ba loại thông báo BE nhận. Viết thẳng thay vì nhập `NOTIFICATION_PREFERENCE_EVENTS` (cùng lý do
 * `isLanguage`); lệch do `accountSettingsGateway.test.ts` bắt.
 */
export const PREFERENCE_EVENTS: readonly NotificationEvent[] = ['aiCompleted', 'violationFound', 'projectInvite'];

/** `me.preferences` thành hai khối giao diện và thông báo của bản nháp. */
export function preferenceDraftsOf(me: Me): Pick<AccountDraft, 'appearance' | 'notifications'> {
  const wire = me.preferences?.appearance ?? {};
  const appearance: Record<string, unknown> = {};

  for (const [draftKey, wireKey] of Object.entries(APPEARANCE_KEYS)) {
    if (wire[wireKey] !== undefined) {
      appearance[draftKey] = wire[wireKey];
    }
  }

  return { appearance, notifications: { ...me.preferences?.notifications } };
}

function channelsOf(value: unknown): { inApp: boolean; email: boolean } | null {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return typeof record['inApp'] === 'boolean' && typeof record['email'] === 'boolean'
    ? { inApp: record['inApp'], email: record['email'] }
    : null;
}

/** Bản vá `preferences` từ hai khối đổi so với `previous`; `undefined` khi không khoá nào đổi. */
export function preferencesPatchOf(draft: AccountDraft, previous: AccountDraft | null): PreferencesPatch | undefined {
  const appearance: Record<string, unknown> = {};

  for (const [draftKey, wireKey] of Object.entries(APPEARANCE_KEYS)) {
    const next = draft.appearance[draftKey];

    if (next !== previous?.appearance[draftKey]) {
      appearance[wireKey] = next ?? null;
    }
  }

  const notifications: Record<string, { inApp: boolean; email: boolean } | null> = {};

  for (const event of PREFERENCE_EVENTS) {
    const next = channelsOf(draft.notifications[event]);

    if (JSON.stringify(next) !== JSON.stringify(channelsOf(previous?.notifications[event]))) {
      notifications[event] = next;
    }
  }

  const patch: PreferencesPatch = {
    ...(Object.keys(appearance).length > 0 ? { appearance: appearance as PreferencesPatch['appearance'] } : {}),
    ...(Object.keys(notifications).length > 0 ? { notifications } : {}),
  };

  return Object.keys(patch).length > 0 ? patch : undefined;
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

  return {
    read: async () => {
      const result = await (await getClient()).me.readProfile();

      if (!result.ok) {
        throw result.error;
      }

      return { ...preferenceDraftsOf(result.data), profile: profileDraftOf(result.data) };
    },

    save: async (draft, previous) => {
      const body: UpdateMe = {};

      for (const key of PROFILE_BODY_KEYS) {
        const value = textOf(draft.profile, key);

        if (value === undefined || value === textOf(previous?.profile, key)) {
          continue;
        }

        if (key === 'language') {
          if (isLanguage(value)) {
            body.language = value;
          }
        } else {
          body[key] = value;
        }
      }

      const preferences = preferencesPatchOf(draft, previous);

      if (preferences !== undefined) {
        body.preferences = preferences;
      }

      if (Object.keys(body).length === 0) {
        return null;
      }

      const result = await (await getClient()).me.updateProfile({ body });

      if (!result.ok) {
        throw result.error;
      }

      return result.data;
    },

    replaceAvatar: async (input) => {
      try {
        // BUG-P07-016: người bấm "Đặt ảnh" nhận ngay câu hạn mức, không chờ thang thử lại 429 của client.
        return await (await getClient()).me.replaceAvatar({ body: input, failFastOnRateLimit: true });
      } catch (error) {
        // Nạp lười client hỏng: vẫn là một kết quả, không ném trôi.
        return { ok: false, error: toAppError(error) };
      }
    },
  };
}

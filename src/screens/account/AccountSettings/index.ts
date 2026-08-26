/**
 * Màn `/tai-khoan` — cài đặt tài khoản. Đường nhập duy nhất của thư mục này.
 *
 * - {@link AccountSettingsRoute} là thứ router mount.
 * - {@link AccountSettingsContainer} là màn đã nối, cho một chủ đã có provider.
 * - {@link AccountSettings} là markup thuần, cho story và test.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng màn này song song. Ranh giới dưới đây tồn tại để không ai phải
 * chờ ai, và để không ai phải sửa file của người khác:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `index.ts` | T2 | bảng này, và đường nhập |
 * | `AccountSettings.tsx` | T2 | view thuần: bảy khung thẻ, tiêu đề, trạng thái 2 |
 * | `AccountSettings.container.tsx` | T2 | ranh giới lỗi, `Toast.Provider`, route |
 * | `useAccountSettings.ts` | T2 | đọc, tự lưu 800 ms, `AutosaveState`→`SaveState`, ghép ba mô hình |
 * | `accountDraft.ts` | T2 | mối nối `AccountDraftPort` mà ba hook con dùng |
 * | `accountSettingsGateway.ts` | T2 | nguồn dữ liệu cấp trang (nợ T-08) |
 * | `ProfileSection.tsx` · `AppearanceSection.tsx` · `useAccountPreferences.ts` | T4 | hồ sơ, giao diện |
 * | `PasswordSection.tsx` · `SessionsSection.tsx` · `DangerZone.tsx` · `useAccountAuth.ts` | T3 | mật khẩu, phiên, vùng nguy hiểm |
 * | `NotificationsSection.tsx` · `ShortcutsSection.tsx` · `useAccountTables.ts` | T5 | thông báo, phím tắt |
 *
 * Sáu file của T2 đã xong và **không cần sửa nữa**. Nếu một khối tưởng như phải
 * sửa file của T2 để làm được việc của nó thì mối nối sai, không phải file sai —
 * nói ra trước khi sửa.
 *
 * Chuỗi tiếng Việt viết thẳng vào TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát. T2 đã thêm mục `account` cho từ vựng
 * của khung và bảy tiêu đề. Ba người còn lại viết mảnh
 * `_i18n.<khối>.json` của riêng mình trong thư mục này; lượt cuối gộp lại.
 */

export { AccountSettings } from './AccountSettings';
export type { AccountSettingsProps } from './AccountSettings';
export { AccountSettingsContainer, AccountSettingsRoute } from './AccountSettings.container';
export type { AccountSettingsContainerProps } from './AccountSettings.container';
export {
  ACCOUNT_AUTOSAVE_DEBOUNCE_MS,
  accountSettingsQueryKey,
  toSaveState,
  useAccountSettings,
} from './useAccountSettings';
export type { AccountSettingsViewModel, UseAccountSettingsOptions } from './useAccountSettings';
export {
  EMPTY_ACCOUNT_DRAFT,
  isSameAccountDraft,
  mergeAccountDraft,
} from './accountDraft';
export type {
  AccountDraft,
  AccountDraftFields,
  AccountDraftPort,
  AccountDraftSection,
} from './accountDraft';
export { createAccountSettingsGateway, resetAccountSettingsStore } from './accountSettingsGateway';
export type { AccountSettingsGateway } from './accountSettingsGateway';
export { useAccountAuth } from './useAccountAuth';
export type { AccountAuthModel } from './useAccountAuth';
export { useAccountPreferences } from './useAccountPreferences';
export type { AccountPreferencesModel } from './useAccountPreferences';
export { useAccountTables } from './useAccountTables';
export type { AccountTablesModel } from './useAccountTables';

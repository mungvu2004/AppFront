/**
 * Hai khối của T4: hồ sơ và giao diện.
 *
 * Cả hai đều có thứ để lưu, nên hook nhận `AccountDraftPort` và báo lên
 * bằng `port.stage('profile', …)` / `port.stage('appearance', …)`.
 * Không dựng `createAutosave` riêng: bộ đếm 800 ms của A7 nằm đúng một
 * chỗ, ở `useAccountSettings.ts`.
 *
 * Hai trạng thái màn hình thuộc về T4: **1 rỗng** (chưa có ảnh đại diện thì vẽ
 * chữ cái đầu trên nền `--bg-sunken`; chưa có chức danh thì không vẽ dòng
 * chức danh) và **nửa của 3 một phần** (ảnh đại diện đang tải lên).
 *
 * Chủ đề: `useTheme()` chỉ cho `{theme, toggle}` và `ThemeMode`
 * không có `'system'`. Chủ đề tường minh đặt bằng action `setTheme`
 * của store; "theo hệ thống" giải ra bằng `matchMedia` trong màn, rồi lựa
 * chọn đó lưu qua `port.stage('appearance', …)` chứ không ghi thẳng
 * localStorage (R2, R5).
 *
 * ## Mối nối, và vì sao nó chỉ có một chiều
 *
 * `useAccountSettings.ts` (T2) gọi hook này đúng một lần và cắm kết quả
 * thẳng vào view. Hook này **không** nhập ngược lại `useAccountSettings`:
 * làm thế là khép một vòng import mà `pnpm cycles` từ chối. Thứ dùng chung
 * nằm ở `accountDraft.ts`, module thấp nhất của thư mục màn.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `AccountPreferencesModel` và `useAccountPreferences` — cùng các khoá của
 *   `AccountPreferencesModel` đã có nơi nhập theo. **Không đổi tên, không đổi khoá.**
 *   Mọi thứ bên dưới các khoá đó là của T4.
 * - Thân hàm dưới đây là chỗ giữ chỗ của T2. T4 thay trọn nó, và không
 *   phải sửa file nào của T2 để làm việc đó.
 */

import type { AppearanceSectionProps } from './AppearanceSection';
import type { ProfileSectionProps } from './ProfileSection';
import type { AccountDraftPort } from './accountDraft';

export interface AccountPreferencesModel {
  readonly profile: ProfileSectionProps;
  readonly appearance: AppearanceSectionProps;
}

export function useAccountPreferences(port: AccountDraftPort): AccountPreferencesModel {
  // Khung xương chỉ chứng minh mối nối chạy được: khi trang còn đang đọc,
  // `port.saved` là `undefined`. T4 thay cả thân hàm này.
  const isReady = port.saved !== undefined;

  return {
    profile: { stubNote: isReady ? 'Khối hồ sơ đang được dựng.' : 'Đang đọc hồ sơ…' },
    appearance: { stubNote: isReady ? 'Khối giao diện đang được dựng.' : 'Đang đọc giao diện…' },
  };
}

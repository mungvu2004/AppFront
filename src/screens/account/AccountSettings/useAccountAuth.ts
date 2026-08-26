/**
 * Ba khối của T3: mật khẩu, phiên đăng nhập, vùng nguy hiểm.
 *
 * **Hook này cố ý KHÔNG nhận `AccountDraftPort`.** Đó không phải chuyện quên:
 * [CẤM TUYỆT ĐỐI] nói không tự lưu mật khẩu, và cách chắc chắn nhất để giữ lời
 * đó là không đưa cho khối mật khẩu cái cửa dẫn tới bộ tự lưu. Đổi mật khẩu,
 * thu hồi phiên và việc trong vùng nguy hiểm đều là hành động chủ động, có nút
 * bấm và — với hai việc cuối — có hộp thoại xác nhận của A9.
 *
 * Ba trạng thái màn hình thuộc về T3, ghi lại ở đây để không ai dựng trùng:
 * **4 lỗi** (mật khẩu cũ sai, lỗi buộc vào đúng ô đó), **6 không có quyền**
 * (tài khoản SSO, khối mật khẩu chỉ đọc kèm câu "Do quản trị viên công ty quản
 * lý."), và **nửa của 3 một phần** (đọc phiên hỏng, dải cảnh báo nằm trong
 * khối phiên chứ không phải trên đầu trang).
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
 * - Hai tên xuất — `AccountAuthModel` và `useAccountAuth` — cùng các khoá của
 *   `AccountAuthModel` đã có nơi nhập theo. **Không đổi tên, không đổi khoá.**
 *   Mọi thứ bên dưới các khoá đó là của T3.
 * - Thân hàm dưới đây là chỗ giữ chỗ của T2. T3 thay trọn nó, và không
 *   phải sửa file nào của T2 để làm việc đó.
 */

import type { DangerZoneProps } from './DangerZone';
import type { PasswordSectionProps } from './PasswordSection';
import type { SessionsSectionProps } from './SessionsSection';

export interface AccountAuthModel {
  readonly password: PasswordSectionProps;
  readonly sessions: SessionsSectionProps;
  readonly danger: DangerZoneProps;
}

export function useAccountAuth(): AccountAuthModel {
  return {
    password: { stubNote: 'Khối đổi mật khẩu đang được dựng.' },
    sessions: { stubNote: 'Khối phiên đăng nhập đang được dựng.' },
    danger: { stubNote: 'Vùng nguy hiểm đang được dựng.' },
  };
}

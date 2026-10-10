/** BUG-083 — ô mời: một lời báo cho địa chỉ sai (kèm dạng đúng), và nút khoá luôn có lý do. */
import { describe, expect, it } from 'vitest';

import { inviteFeedback } from './useUserManagement';

describe('inviteFeedback (BUG-083)', () => {
  it('địa chỉ sai: một câu nêu địa chỉ và dạng đúng, nút khoá vì phải sửa', () => {
    const feedback = inviteFeedback({ validEmails: [], invalidEmails: ['khong-hop-le'] });
    expect(feedback.errorLabel).toBe('Chưa đúng dạng địa chỉ thư: khong-hop-le. Viết theo dạng ten@congty.vn');
    expect(feedback.submitBlockedReason).toBe('Sửa địa chỉ chưa đúng dạng rồi mới gửi được');
  });

  it('ô trống: không báo lỗi, nút khoá vì chưa có địa chỉ', () => {
    expect(inviteFeedback({ validEmails: [], invalidEmails: [] })).toEqual({
      errorLabel: null,
      submitBlockedReason: 'Nhập ít nhất một địa chỉ thư để gửi lời mời',
    });
  });

  it('toàn địa chỉ đúng: không lỗi, không lý do khoá', () => {
    expect(inviteFeedback({ validEmails: ['an@vi-du.vn'], invalidEmails: [] })).toEqual({
      errorLabel: null,
      submitBlockedReason: null,
    });
  });
});

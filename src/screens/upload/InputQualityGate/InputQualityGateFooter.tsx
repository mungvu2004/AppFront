/**
 * Chân trang của Cổng chất lượng đầu vào — hộp xác nhận, nút phụ, nút chính.
 *
 * ## `canContinue === false` không khoá nút (mục [CẤM TUYỆT ĐỐI])
 *
 * Nút chính luôn bấm được, ở mọi giá trị của `footer.canContinue`. Lúc `false`,
 * một câu giải thích hiện ngay cạnh nút (không phải hộp thoại — đặc tả cấm
 * tuyệt đối), và `aria-describedby` trỏ tới câu đó để trình đọc màn hình đọc
 * luôn lý do khi tiêu điểm rơi vào nút. `InputQualityFooterModel` chỉ mang hai
 * cờ liên quan (`requiresAcknowledgement`/`isAcknowledged`) — không có
 * `remainingFindingCount` ở tầng props này — nên câu giải thích tách hai
 * nhánh: nhánh xác nhận (nêu đúng việc còn thiếu) và nhánh còn lại (phát hiện
 * còn treo, đúng ghi chú tại chính `InputQualityFooterModel`).
 *
 * Ngoại lệ duy nhất: `footer.continueDisabledReason` (đang đọc, lỗi đọc, chưa có bản vẽ) chặn
 * hẳn lượt bấm — không có gì để đi tiếp. Chặn bằng `aria-disabled` cộng bỏ
 * `onClick`, KHÔNG bằng `disabled`: nút `disabled` rơi khỏi thứ tự Tab, nên
 * người dùng bàn phím không bao giờ nghe được câu lý do nối bằng
 * `aria-describedby`.
 *
 * ## `areActionsHidden` ẩn hẳn, không mờ đi
 *
 * Trạng thái thứ sáu (`'forbidden'`) không có quyền hành động: hai nút biến
 * mất khỏi cây DOM, không phải `disabled` hay `opacity-50`. Lỗi đọc cũng ẩn
 * chúng: dải lỗi đã mang lối ra của nó (BUG-074).
 */

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';

import type { InputQualityFooterProps } from './types';

const CONTINUE_BLOCKED_ACKNOWLEDGEMENT = 'Đánh dấu ô xác nhận bên trên rồi thử lại.';
const CONTINUE_BLOCKED_GENERIC = 'Vẫn còn phát hiện cần xử lý trước khi qua bước tiếp theo.';
const CONTINUE_BLOCKED_NOTE_ID = 'input-quality-gate-continue-note';

export function InputQualityGateFooter({ actions, footer }: InputQualityFooterProps) {
  const disabledReason = footer.continueDisabledReason ?? null;
  const isDisabled = disabledReason !== null;
  const showBlockedNote = isDisabled || !footer.canContinue;
  const blockedText = isDisabled
    ? disabledReason
    : footer.requiresAcknowledgement && !footer.isAcknowledged
      ? CONTINUE_BLOCKED_ACKNOWLEDGEMENT
      : CONTINUE_BLOCKED_GENERIC;

  return (
    <footer aria-label="Hành động tiếp theo" className="flex flex-col gap-3">
      {footer.requiresAcknowledgement && (
        <Checkbox
          checked={footer.isAcknowledged}
          label={footer.acknowledgementLabel}
          onChange={actions.onToggleAcknowledgement}
        />
      )}

      {!footer.areActionsHidden && (
        // Dưới 640px: chữ căn trái, hai nút xếp dọc đủ bề ngang, nút chính trên cùng (BUG-074).
        <div className="flex flex-col gap-2 sm:items-end">
          {showBlockedNote && (
            <p className="text-[13px] text-state-attention-text" id={CONTINUE_BLOCKED_NOTE_ID}>
              {blockedText}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button onClick={actions.onUploadAnother} variant="secondary">
              {footer.secondaryLabel}
            </Button>
            <Button
              {...(showBlockedNote ? { 'aria-describedby': CONTINUE_BLOCKED_NOTE_ID } : {})}
              {...(isDisabled ? { 'aria-disabled': true } : {})}
              onClick={isDisabled ? undefined : actions.onContinue}
              variant="primary"
            >
              {footer.primaryLabel}
            </Button>
          </div>
        </div>
      )}
    </footer>
  );
}

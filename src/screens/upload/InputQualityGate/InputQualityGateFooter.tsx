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
 * ## `areActionsHidden` ẩn hẳn, không mờ đi
 *
 * Trạng thái thứ sáu (`'forbidden'`) không có quyền hành động: hai nút biến
 * mất khỏi cây DOM, không phải `disabled` hay `opacity-50`.
 */

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';

import type { InputQualityFooterProps } from './types';

const CONTINUE_BLOCKED_ACKNOWLEDGEMENT = 'Đánh dấu ô xác nhận bên trên rồi thử lại.';
const CONTINUE_BLOCKED_GENERIC = 'Vẫn còn phát hiện cần xử lý trước khi qua bước tiếp theo.';
const CONTINUE_BLOCKED_NOTE_ID = 'input-quality-gate-continue-note';

export function InputQualityGateFooter({ actions, footer }: InputQualityFooterProps) {
  const showBlockedNote = !footer.canContinue;
  const blockedText =
    footer.requiresAcknowledgement && !footer.isAcknowledged
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
        <div className="flex flex-col items-end gap-2">
          {showBlockedNote && (
            <p className="text-[13px] text-state-attention-text" id={CONTINUE_BLOCKED_NOTE_ID}>
              {blockedText}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button onClick={actions.onUploadAnother} variant="secondary">
              {footer.secondaryLabel}
            </Button>
            <Button
              {...(showBlockedNote ? { 'aria-describedby': CONTINUE_BLOCKED_NOTE_ID } : {})}
              onClick={actions.onContinue}
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

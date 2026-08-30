/**
 * Giai đoạn 1: hộp thoại 560 chốt nhánh CAD/AI. View thuần (R-60) — nhận toàn
 * bộ dữ liệu qua `CadBranchConfirmDialogProps`, không chạm store/mạng/tệp CAD.
 *
 * `Modal.Root` tự lo bẫy tiêu điểm, Esc, và hoạt ảnh mở/đóng — hộp thoại này
 * không tự bắt phím hay tự gọi `.focus()`.
 *
 * **Nút chính KHÔNG tự nhận tiêu điểm, và ở đây không có `autoFocus`.** Đặc tả
 * đòi nút chính nhận tiêu điểm lúc mở, nhưng `Modal.Root` chưa có đường nào
 * nhận lấy mong muốn đó: `createFocusTrap(...).activate()` chạy trong
 * `requestAnimationFrame` (`Modal.tsx:66-67`) và luôn lấy phần tử focus được
 * ĐẦU TIÊN trong khung hộp thoại — nút "Đóng hộp thoại" của `Modal.Header`.
 * Một `autoFocus` đặt ở đây vì thế không bao giờ giữ được tiêu điểm; tệ hơn,
 * nó đẩy tiêu điểm vào trong hộp thoại TRƯỚC lượt `activate()`, nên bẫy ghi
 * nhớ nhầm "nơi đã mở" là chính nút bên trong, và lúc đóng thì tiêu điểm rơi
 * về `body` thay vì quay lại nút đã mở màn — hỏng đúng lời hứa của A12.
 * Bản sửa đúng còn thiếu: thêm prop `initialFocus` cho `Modal.Root` rồi chuyển
 * thẳng xuống `createFocusTrap`. Việc đó đụng component dùng chung nên nằm
 * ngoài lượt này. Test `[NGHIEM-5]` của màn khẳng định đúng phần đang đạt: tiêu
 * điểm nằm TRONG hộp thoại, Tab vòng trong đó, Esc đóng, và đóng thì tiêu điểm
 * quay về đúng nút đã mở.
 *
 * Không hộp thoại nào được mở từ trong hộp thoại này (cấm tuyệt đối của đặc tả).
 */
import { useId } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';

import { CadBranchCompareTable } from './CadBranchCompareTable';
import { CAD_BRANCH_CONFIRM_TEXT } from './cadBranchConfirmText';
import { CadFloorAvailabilityTable } from './CadFloorAvailability';
import type { CadBranchConfirmDialogProps } from './types';

const TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;

export function CadBranchConfirmDialog({ model, actions }: CadBranchConfirmDialogProps) {
  const rememberNoteId = useId();

  return (
    <Modal.Root isOpen={model.isOpen} onClose={actions.onDismiss} width={560}>
      <Modal.Header>{TEXT.dialogStates.normal.title}</Modal.Header>

      <Modal.Body className="flex flex-col gap-5 pb-6">
        <p className="text-text-secondary">{TEXT.dialogStates.normal.description}</p>

        {model.isCadChoiceDisabled && model.cadChoiceDisabledReason !== null && (
          <InlineAlert level="violation" message={model.cadChoiceDisabledReason} />
        )}

        <CadBranchCompareTable rows={model.comparisonRows} />

        <CadFloorAvailabilityTable floors={model.floorAvailability} />

        {model.unitWarningMessage !== null && (
          <InlineAlert
            level="attention"
            title={TEXT.unitDeclarationWarning.title}
            message={model.unitWarningMessage}
          />
        )}
      </Modal.Body>

      <Modal.Footer className="items-start justify-between">
        <div className="flex flex-col gap-1">
          <Checkbox
            checked={model.isRememberChoiceChecked}
            onChange={actions.onToggleRemember}
            label={TEXT.rememberChoice}
            aria-describedby={rememberNoteId}
          />
          <p id={rememberNoteId} className="pl-[26px] text-[13px] text-text-tertiary">
            {TEXT.rememberChoiceSessionNote}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button variant="ghost" onClick={actions.onDismiss}>
            {TEXT.buttons.dismiss}
          </Button>
          <Button variant="secondary" onClick={() => actions.onChooseBranch('ai')}>
            {TEXT.buttons.secondary}
          </Button>
          <Button
            variant="primary"
            disabled={model.isCadChoiceDisabled}
            onClick={() => actions.onChooseBranch('cad')}
          >
            {TEXT.buttons.primary}
          </Button>
        </div>
      </Modal.Footer>
    </Modal.Root>
  );
}

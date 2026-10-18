/**
 * Giai đoạn 1: hộp thoại 560 chốt nhánh CAD/AI. View thuần (R-60) — nhận toàn
 * bộ dữ liệu qua `CadBranchConfirmDialogProps`, không chạm store/mạng/tệp CAD.
 *
 * `Modal.Root` tự lo bẫy tiêu điểm, Esc, và hoạt ảnh mở/đóng — hộp thoại này
 * không tự bắt phím hay tự gọi `.focus()`.
 *
 * **Nút chính nhận tiêu điểm lúc mở qua `data-autofocus`, không qua `autoFocus`.**
 * `createFocusTrap(...).activate()` chạy trong `requestAnimationFrame` và ưu tiên
 * phần tử focus được mang `data-autofocus` (`focusTrap.ts`). Một `autoFocus` sẽ
 * đẩy tiêu điểm vào TRƯỚC lượt `activate()`, bẫy ghi nhớ nhầm "nơi đã mở", và lúc
 * đóng tiêu điểm rơi về `body` — hỏng lời hứa của A12. Khi nhánh CAD bị khoá, nút
 * chính `disabled` không nhận được tiêu điểm, nên dấu chuyển sang nút "AI" (nợ B #6).
 *
 * Không hộp thoại nào được mở từ trong hộp thoại này (cấm tuyệt đối của đặc tả).
 */
import { useEffect, useId, useRef } from 'react';

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
  const aiButtonRef = useRef<HTMLButtonElement>(null);
  const wasCadChoiceDisabledRef = useRef(model.isCadChoiceDisabled);

  // Nhánh CAD bị khoá SAU khi bẫy đã kích hoạt (đọc xong mới biết lỗi): `data-autofocus` dời sang
  // nút AI không còn tác dụng và nút CAD vừa `disabled` làm tiêu điểm rơi mất — đưa nó về nút AI
  // (BUG-560). Chỉ khi cờ ĐỔI: lúc mở, `data-autofocus` vẫn là đường đúng (xem đầu file).
  useEffect(() => {
    if (model.isOpen && model.isCadChoiceDisabled && !wasCadChoiceDisabledRef.current) {
      aiButtonRef.current?.focus();
    }

    wasCadChoiceDisabledRef.current = model.isCadChoiceDisabled;
  }, [model.isCadChoiceDisabled, model.isOpen]);

  const copy = model.hasCadFile ? TEXT.dialogStates.normal : TEXT.dialogStates.noCadFile;

  return (
    <Modal.Root isOpen={model.isOpen} onClose={actions.onDismiss} width={560}>
      <Modal.Header>{copy.title}</Modal.Header>

      <Modal.Body className="flex flex-col gap-5 pb-6">
        <p className="text-text-secondary">{copy.description}</p>

        {model.isCadChoiceDisabled && model.cadChoiceDisabledReason !== null && (
          <InlineAlert
            level={model.hasCadFile ? 'violation' : 'attention'}
            message={model.cadChoiceDisabledReason}
          />
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

      {/* Modal.Footer wraps, and so does the button group: at 375 px the three buttons do not fit one
          279 px line, and `shrink-0` used to push "Dùng đường từ CAD" past the dialog's edge (BUG-255). */}
      <Modal.Footer className="items-start justify-between">
        {model.canRememberChoice && (
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
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={actions.onDismiss}>
            {TEXT.buttons.dismiss}
          </Button>
          <Button
            ref={aiButtonRef}
            variant={model.isCadChoiceDisabled ? 'primary' : 'secondary'}
            data-autofocus={model.isCadChoiceDisabled ? true : undefined}
            onClick={() => actions.onChooseBranch('ai')}
          >
            {TEXT.buttons.secondary}
          </Button>
          <Button
            variant={model.isCadChoiceDisabled ? 'secondary' : 'primary'}
            data-autofocus={model.isCadChoiceDisabled ? undefined : true}
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

/**
 * Hai hộp thoại hỏi trước của thanh tra: GỘP phòng và TÁCH phòng.
 *
 * ## Vì sao hai thao tác này phải hỏi (A9)
 *
 * Đổi tên và đổi công năng ghi đè đúng một trường và hoàn tác được trọn vẹn
 * (A8) — chúng đi thẳng, không hỏi. Gộp và tách thì đổi CHÍNH TẬP HỢP phòng
 * của tầng: gộp xoá một phòng khỏi danh sách, tách sinh thêm một phòng mới có
 * mã mới. A9 nói rõ hành động mà hoàn tác không trả lại được nguyên trạng thì
 * phải hỏi trước bằng hộp thoại, nên hai nút này mở `Modal.Root` chứ không
 * gọi thẳng callback.
 *
 * `Modal.Root` (`src/components/overlay/Modal.tsx`) đã có sẵn bẫy tiêu điểm
 * (`createFocusTrap`) và Esc đóng qua `useShortcut` scope `dialog` — đúng
 * A12, và là lý do màn KHÔNG tự dựng một lớp phủ mới ("không tạo component
 * mới").
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

import type { RoomLabelMergeCandidate, RoomLabelViewModel } from './roomLabelTypes';

const MERGE_TITLE = 'Gộp hai phòng';
const MERGE_SELECT_LABEL = 'Phòng sẽ gộp vào';
const MERGE_PLACEHOLDER = 'Chọn phòng';
const MERGE_EMPTY = 'Không còn phòng nào khác ở tầng này để gộp.';
const MERGE_CONFIRM = 'Gộp hai phòng';
const CANCEL_LABEL = 'Huỷ';
const SPLIT_TITLE = 'Tách phòng';
const SPLIT_CONFIRM = 'Tách phòng';

const mergeQuestion = (codeLabel: string) =>
  `Phòng ${codeLabel} và phòng được chọn sẽ thành một phòng. Ranh giữa hai phòng biến mất và một trong hai mã phòng không còn nữa.`;

const splitQuestion = (codeLabel: string) =>
  `Phòng ${codeLabel} sẽ cắt làm hai tại điểm đã chọn trên ranh phòng, và một mã phòng mới được sinh ra.`;

export interface RoomLabelMergeDialogProps {
  readonly isOpen: boolean;
  readonly roomCodeLabel: string;
  readonly candidates: readonly RoomLabelMergeCandidate[];
  readonly selectedCandidateId: RoomLabelViewModel['id'] | null;
  readonly onSelectCandidate: (roomId: RoomLabelViewModel['id']) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RoomLabelMergeDialog({
  isOpen,
  roomCodeLabel,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onConfirm,
  onCancel,
}: RoomLabelMergeDialogProps) {
  const options = candidates.map((candidate) => ({
    label: `${candidate.codeLabel} · ${candidate.name}`,
    value: candidate.id,
  }));

  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>{MERGE_TITLE}</Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-[14px] text-text-primary">{mergeQuestion(roomCodeLabel)}</p>
          {candidates.length === 0 ? (
            <p className="text-[13px] text-text-secondary">{MERGE_EMPTY}</p>
          ) : (
            <Select
              label={MERGE_SELECT_LABEL}
              onChange={(value) => onSelectCandidate(value as RoomLabelViewModel['id'])}
              options={options}
              placeholder={MERGE_PLACEHOLDER}
              /* Chuỗi rỗng = chưa chọn phòng nào, `Select` hiện `placeholder`. */
              value={selectedCandidateId ?? ''}
            />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} variant="ghost">
          {CANCEL_LABEL}
        </Button>
        <Button disabled={selectedCandidateId === null} onClick={onConfirm} variant="primary">
          {MERGE_CONFIRM}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}

export interface RoomLabelSplitDialogProps {
  readonly isOpen: boolean;
  readonly roomCodeLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RoomLabelSplitDialog({ isOpen, roomCodeLabel, onConfirm, onCancel }: RoomLabelSplitDialogProps) {
  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>{SPLIT_TITLE}</Modal.Header>
      <Modal.Body>
        <p className="pb-2 text-[14px] text-text-primary">{splitQuestion(roomCodeLabel)}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} variant="ghost">
          {CANCEL_LABEL}
        </Button>
        <Button onClick={onConfirm} variant="primary">
          {SPLIT_CONFIRM}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}

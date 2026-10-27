/**
 * K51: "Sang Xuất" khi còn luật nghiêm trọng thì hỏi trước (A9), không im lặng và không khoá
 * cứng — màn Xuất vẫn cho xuất bản nháp khi còn lỗi. Thuần props: số luật đã đếm ở hook.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

export interface RuleReportExportConfirmProps {
  readonly isOpen: boolean;
  /** Số luật nghiêm trọng còn mở, đã viết thành chữ (A15). */
  readonly violationsText: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function RuleReportExportConfirm({ isOpen, violationsText, onCancel, onConfirm }: RuleReportExportConfirmProps) {
  return (
    <Modal.Root isOpen={isOpen} onClose={onCancel} width={480}>
      <Modal.Header>Sang Xuất khi còn lỗi nghiêm trọng?</Modal.Header>
      <Modal.Body>
        <p className="pb-2">
          {`Còn ${violationsText} luật nghiêm trọng chưa xử lý. Vẫn xuất được, nhưng hồ sơ sẽ còn các lỗi này.`}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} variant="ghost">
          Ở lại sửa
        </Button>
        <Button onClick={onConfirm} variant="primary">
          Vẫn sang Xuất
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}

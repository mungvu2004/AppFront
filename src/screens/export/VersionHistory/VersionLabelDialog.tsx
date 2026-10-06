/**
 * Hộp thoại gắn nhãn một phiên bản (N20). View thuần: chỉ nhận props, không chạm store/mạng.
 *
 * Ô nhập không kiểm soát (`defaultValue`) — giá trị được đọc một lần lúc gửi, nên view không
 * giữ state nào. Nhập rỗng là gỡ nhãn; `maxLength` 60 khớp `LabelVersionSchema`.
 */
import type { FormEvent } from 'react';

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Trần của `LabelVersionSchema` (đơn vị UTF-16, như `maxLength`). */
const MAX_LABEL_LENGTH = 60;
const FIELD_NAME = 'label';

export interface VersionLabelDialogProps {
  readonly isOpen: boolean;
  /** "v12" — phiên bản đang gắn nhãn. */
  readonly versionLabel: string;
  readonly initialValue: string;
  readonly onSubmit: (label: string) => void;
  readonly onClose: () => void;
}

export function VersionLabelDialog({ initialValue, isOpen, onClose, onSubmit, versionLabel }: VersionLabelDialogProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get(FIELD_NAME);

    onSubmit(typeof value === 'string' ? value : '');
  };

  return (
    <Modal.Root isOpen={isOpen} onClose={onClose} width={480}>
      <form onSubmit={handleSubmit}>
        <Modal.Header>{`Gắn nhãn phiên bản ${versionLabel}`}</Modal.Header>
        <Modal.Body className="flex flex-col gap-2 pb-6">
          <Input
            name={FIELD_NAME}
            label="Nhãn"
            hint="Để trống rồi bấm Gắn nhãn là gỡ nhãn."
            defaultValue={initialValue}
            maxLength={MAX_LABEL_LENGTH}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="primary">
            Gắn nhãn
          </Button>
        </Modal.Footer>
      </form>
    </Modal.Root>
  );
}

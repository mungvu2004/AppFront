/**
 * Hộp xem trước "Thay thế tất cả" — thứ chắn giữa một cú bấm và một thao tác
 * hàng loạt.
 *
 * A9: hành động mà A8 không hoàn tác được thì phải hỏi trước bằng hộp thoại, và
 * luật cứng của màn này nói rõ hơn nữa — người dùng PHẢI thấy danh sách những
 * gì sắp đổi TRƯỚC khi bất cứ thay đổi nào xảy ra. Nên hộp này không áp gì cả:
 * nó vẽ `items` rồi gọi lại đúng `onConfirm` hoặc `onCancel` của hợp đồng.
 *
 * ## Vì sao mượn `Modal` chứ không tự dựng một `div role="dialog"`
 *
 * Đặc tả đòi hộp thoại đúng nghĩa: `role="dialog"`, `aria-modal`, tiêu đề liên
 * kết bằng `aria-labelledby`. `components/overlay/Modal.tsx` đã có cả ba, cộng
 * bẫy tiêu điểm dùng chung (`lib/input/focusTrap`) và Esc đi qua trọng tài phím
 * tắt với `scope: 'dialog'` — nghĩa là A12 ("Esc đóng lớp trên cùng") được giữ
 * mà file này không tự gắn một `keydown` nào, đúng R-54. Tự dựng lại sẽ là một
 * hộp thoại thứ hai trong sản phẩm có bẫy tiêu điểm riêng, và phạm vi task này
 * cấm tạo component mới.
 *
 * LƯU Ý CHO BÀI KIỂM: `Modal.Root` đặt `tabIndex={-1}` cộng `outline-none` lên
 * chính khung hộp thoại để bẫy tiêu điểm nhận được tiêu điểm lập trình mà không
 * vẽ hai vòng viền. `expectAccessible` đọc đó là "điều khiển bàn phím không tới
 * được", nên lượt soát bỏ qua đúng phần tử ấy bằng
 * `ignoreSelector: '[role="dialog"]'` — khuôn đã chốt ở
 * `CreateProjectModal.test.tsx:202` và `CadBranchConfirm.test.tsx:304`. Mọi thứ
 * BÊN TRONG hộp thoại vẫn được soát đủ.
 */
import type { ReactNode } from 'react';

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { ReplaceAllPreview } from './furnitureLibraryPanelTypes';

const PREVIEW_HINT =
  'Xem lại danh sách dưới đây trước khi áp. Chưa có thay đổi nào được thực hiện.';
const CONFIRM_LABEL = 'Thay thế tất cả';
const CANCEL_LABEL = 'Huỷ';
const ITEM_LIST_LABEL = 'Danh sách mô hình sẽ được thay thế';

export interface FurnitureReplaceAllDialogProps {
  /** `null` khi không có hộp xem trước nào đang mở — khi đó không dựng gì. */
  readonly preview: ReplaceAllPreview | null;
}

export function FurnitureReplaceAllDialog({ preview }: FurnitureReplaceAllDialogProps): ReactNode {
  if (preview === null) {
    return null;
  }

  return (
    <Modal.Root isOpen onClose={preview.onCancel} width={480}>
      <Modal.Header>{preview.groupLabel}</Modal.Header>
      <Modal.Body>
        <p className="mb-3 text-[14px] leading-[20px] text-text-secondary">{PREVIEW_HINT}</p>
        <ul aria-label={ITEM_LIST_LABEL} className="flex flex-col gap-1">
          {preview.items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg bg-bg-sunken px-3 py-2 text-[14px] leading-[20px] text-text-primary"
            >
              {item.description}
            </li>
          ))}
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={preview.onCancel}>
          {CANCEL_LABEL}
        </Button>
        <Button variant="primary" onClick={preview.onConfirm}>
          {CONFIRM_LABEL}
        </Button>
      </Modal.Footer>
    </Modal.Root>
  );
}

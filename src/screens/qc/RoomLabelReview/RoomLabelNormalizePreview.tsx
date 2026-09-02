/**
 * Hộp thoại XEM TRƯỚC của thao tác hàng loạt "Chuẩn hoá tên".
 *
 * ## Không có đường nào áp mà bỏ qua bước xem trước (CẤM TUYỆT ĐỐI)
 *
 * Hộp thoại này chỉ mở khi `preview !== null`, và nút áp gọi ĐÚNG
 * `onApply()` — không tham số, không một đường tắt nào khác trong file. Nút
 * "Chuẩn hoá tên" ở panel trái gọi `onOpenNormalizePreview`, tức chỉ TÍNH
 * bảng xem trước; việc áp thật và vệt hoàn tác đi kèm là của hook (A8).
 *
 * ## Không dòng nào cần đổi thì nói ra, không hiện bảng rỗng
 *
 * `changedCount === 0` là một câu trả lời hợp lệ ("mọi tên đã đúng kiểu
 * câu"), không phải một trạng thái rỗng cần khắc phục — hộp thoại nói đúng
 * điều đó và chỉ còn một nút đóng.
 *
 * ## Bàn phím (A12)
 *
 * `Modal.Root` giữ tiêu điểm trong hộp thoại (`createFocusTrap`) và đóng bằng
 * Esc qua trọng tài phím tắt ở scope `dialog` — màn KHÔNG tự gắn `keydown`
 * lên `window`, và không tự dựng một lớp phủ mới.
 *
 * Bảng dựng bằng `<table>` thuần chứ không bằng `Table.Row`: bảng "component
 * nào KHÔNG dùng được với `expectAccessible`" của hợp đồng giao diện đánh dấu
 * `Table.Row` không dùng được (vòng tiêu điểm vẽ theo prop, không theo
 * `focus-visible:`). Ở đây các dòng không nhận tiêu điểm, và một `<table>`
 * trần giữ đúng ngữ nghĩa hàng/cột cho trình đọc màn hình.
 */

import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';

import type { RoomLabelNormalizePreviewProps } from './roomLabelTypes';

const DIALOG_TITLE = 'Xem trước chuẩn hoá tên';
const TABLE_CAPTION = 'Những tên sẽ đổi khi áp';
const COLUMN_CODE = 'Mã phòng';
const COLUMN_FROM = 'Tên hiện tại';
const COLUMN_TO = 'Tên sẽ thành';
const NO_CHANGE_MESSAGE = 'Không có tên nào cần chuẩn hoá — mọi tên phòng đã đúng kiểu câu.';
const CANCEL_LABEL = 'Huỷ';
const CLOSE_LABEL = 'Đóng';
const APPLY_LABEL = 'Áp dụng';
const EMPTY_NAME_PLACEHOLDER = 'chưa đặt tên';

const changedSummary = (changedCount: number) => `${changedCount} tên sẽ đổi khi bấm áp dụng.`;

export function RoomLabelNormalizePreview({ preview, onApply, onCancel }: RoomLabelNormalizePreviewProps) {
  const hasChanges = preview !== null && preview.changedCount > 0;

  return (
    <Modal.Root isOpen={preview !== null} onClose={onCancel} width={560}>
      <Modal.Header>{DIALOG_TITLE}</Modal.Header>
      <Modal.Body>
        {preview === null || !hasChanges ? (
          <p className="pb-2 text-[14px] text-text-primary">{NO_CHANGE_MESSAGE}</p>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            <p className="text-[14px] text-text-primary">{changedSummary(preview.changedCount)}</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <caption className="pb-2 text-left text-text-secondary">{TABLE_CAPTION}</caption>
                <thead>
                  <tr className="border-b border-border-default text-text-secondary">
                    <th className="py-1.5 pr-3 font-medium" scope="col">
                      {COLUMN_CODE}
                    </th>
                    <th className="py-1.5 pr-3 font-medium" scope="col">
                      {COLUMN_FROM}
                    </th>
                    <th className="py-1.5 font-medium" scope="col">
                      {COLUMN_TO}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr className="border-b border-border-default/60" key={row.roomId}>
                      <td className="py-1.5 pr-3 font-mono text-text-secondary">{row.codeLabel}</td>
                      <td className="py-1.5 pr-3 text-text-secondary">
                        {row.from === '' ? EMPTY_NAME_PLACEHOLDER : row.from}
                      </td>
                      <td className="py-1.5 text-text-primary">{row.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onCancel} variant="ghost">
          {hasChanges ? CANCEL_LABEL : CLOSE_LABEL}
        </Button>
        {hasChanges && (
          <Button onClick={onApply} variant="primary">
            {APPLY_LABEL}
          </Button>
        )}
      </Modal.Footer>
    </Modal.Root>
  );
}

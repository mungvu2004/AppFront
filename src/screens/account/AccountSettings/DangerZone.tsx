/**
 * Khối "vùng nguy hiểm" của màn `/tai-khoan` — xoá tài khoản, và chỉ thế.
 *
 * ## Vì sao ở đây có hộp thoại còn khối phiên thì không
 *
 * A8 nói mọi thay đổi hoàn tác được và kèm một toast hoàn tác; A9 nói việc mà A8
 * **không** phủ được thì phải hỏi trước bằng hộp thoại. Trên màn này đúng một
 * việc rơi vào vế sau: xoá tài khoản. Đăng xuất một phiên thì hoàn tác được, nên
 * nó nhận vé hoàn tác 8 giây và **không** nhận hộp thoại — bày hộp thoại cho một
 * việc rút lại được là dạy người dùng bấm "Đồng ý" mà không đọc, đúng lúc câu
 * chữ bắt đầu quan trọng.
 *
 * Cửa xác nhận là **gõ lại chính địa chỉ thư của mình**. Một nút "Đồng ý" thứ hai
 * chỉ thêm một nhịp bấm; gõ lại địa chỉ bắt người dùng đọc xem đây là tài khoản
 * nào trước khi xoá nó.
 *
 * ## Lớp phủ nằm trong khối, không nằm ở gốc màn
 *
 * `ProjectSettings.tsx` giữ hộp thoại của nó ở gốc màn vì mỗi màn chỉ nên có một
 * chủ sở hữu lớp phủ. Ở đây thì không: `AccountSettings.tsx` do T2 giữ và bảng
 * chủ sở hữu ở `index.ts` nói sáu file của T2 không cần sửa nữa. Nên khối tự giữ
 * lớp phủ của mình, và điều đó không tốn gì — vùng nguy hiểm là khối duy nhất
 * của màn có lớp phủ, nên "một chủ sở hữu" vẫn đúng, chỉ là chủ đó ở đây.
 *
 * Esc đóng hộp thoại qua `onClose` của `Modal.Root` (A12) — file này không nghe
 * `keydown` ở đâu cả.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `DangerZone` và `DangerZoneProps` — đã có nơi nhập theo, nên
 *   không đổi tên.
 * - Khung thẻ, kể cả viền `--danger-border`, do `AccountSettings.tsx` vẽ sẵn;
 *   file này chỉ vẽ **ruột**.
 * - View thuần: mọi quyết định — địa chỉ đã gõ khớp chưa, có đang xoá không —
 *   vào bằng props. `useAccountAuth` tính, file này vẽ.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface DangerZoneProps {
  /** Địa chỉ thư của tài khoản đang mở — thứ người dùng phải gõ lại. */
  readonly email: string;
  readonly isDialogOpen: boolean;
  readonly onRequestDelete: () => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
  readonly confirmValue: string;
  readonly onConfirmValueChange: (value: string) => void;
  /** Địa chỉ đã gõ khớp với {@link DangerZoneProps.email}. */
  readonly canConfirm: boolean;
  readonly isDeleting: boolean;
  readonly errorMessage: string | null;
}

export function DangerZone(props: DangerZoneProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[14px] font-medium text-text-primary">xoá tài khoản</span>
          <p className="text-[13px] text-text-secondary">
            Xoá vĩnh viễn tài khoản này cùng mọi dự án chỉ mình bạn giữ. Việc này không hoàn tác
            được.
          </p>
        </div>
        <Button variant="danger" onClick={props.onRequestDelete} disabled={props.isDeleting}>
          Xoá tài khoản
        </Button>
      </div>

      <Modal.Root isOpen={props.isDialogOpen} onClose={props.onCancelDelete} width={480}>
        <Modal.Header>Xoá tài khoản này?</Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-4 pb-2">
            <p>
              Mọi dự án, bản vẽ và mô hình chỉ mình bạn giữ sẽ mất theo, và không có đường lấy lại.
            </p>
            {/* Địa chỉ nằm trong <code> chứ không nằm trong nhãn của ô: một địa
                chỉ thư không phải tiếng Việt, và `expectVietnamese` bỏ qua
                <code>/<pre>/<kbd> đúng cho những thứ như thế. Đọc lên cũng rõ
                hơn — câu là câu, địa chỉ là địa chỉ. */}
            <p>
              Gõ lại <code className="font-mono text-[13px] text-text-primary">{props.email}</code>{' '}
              để xác nhận.
            </p>
            <Input
              label="địa chỉ thư"
              type="email"
              autoComplete="off"
              value={props.confirmValue}
              onChange={(event) => props.onConfirmValueChange(event.target.value)}
              disabled={props.isDeleting}
            />
            {props.errorMessage === null ? null : (
              <InlineAlert level="violation" message={props.errorMessage} />
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={props.onCancelDelete} disabled={props.isDeleting}>
            Để sau
          </Button>
          <Button
            variant="danger"
            onClick={props.onConfirmDelete}
            disabled={!props.canConfirm}
            loading={props.isDeleting}
          >
            Xoá vĩnh viễn
          </Button>
        </Modal.Footer>
      </Modal.Root>
    </div>
  );
}

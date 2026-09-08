/**
 * Vỏ hộp thoại chia sẻ — ba mục xếp dọc trong `Modal.Body`, một nút "xong" ở chân.
 *
 * View thuần (R-60): mọi dữ liệu tới từ props, không store, không mạng. `Modal.Root`
 * tự bẫy tiêu điểm và tự xử Esc (`Modal.tsx:59-80`) — màn không đăng ký thêm phím tắt
 * nào, không tự vẽ lớp phủ nào khác (nó đã dùng `bg-bg-overlay`, đúng token A1 đòi).
 * `width` chỉ nhận 480/560/720; đặc tả đòi 640 không tồn tại nên dùng 720 (chú thích
 * đầu `types.ts`).
 *
 * Bảy trạng thái (A11): `loading` thay ba mục bằng một khung xương thay vì để trống.
 * `error` thêm một băng cảnh báo phía trên ba mục nhưng không gỡ mục nào — giữ nguyên
 * mọi lựa chọn đang có, đúng tinh thần "thử lại không xoá những gì đã chọn" của
 * `ExportPanel`. `collapsed` không cần xử ở đây: `model.embed.previewHidden` đã mang
 * đúng quyết định đó xuống `ShareDialogEmbed`. Sáu trạng thái còn lại render đủ ba mục
 * và chân trang nên container không khi nào trống — đúng điều `expectSevenStates` đòi.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Modal } from '@/components/overlay/Modal';

import { ShareDialogEmbed } from './ShareDialogEmbed';
import { ShareDialogFooter } from './ShareDialogFooter';
import { ShareDialogLink } from './ShareDialogLink';
import { ShareDialogPeople } from './ShareDialogPeople';
import { EMBED_COPY_TARGET_ID } from './types';
import type { ShareDialogProps } from './types';

export function ShareDialog({ isOpen, model, actions, titleId }: ShareDialogProps) {
  return (
    <Modal.Root
      isOpen={isOpen}
      onClose={actions.dismiss}
      width={720}
      {...(titleId !== undefined ? { titleId } : {})}
    >
      <Modal.Header>chia sẻ bản vẽ</Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-6 pb-8">
          {model.savedAtLabel !== null && <p className="text-xs text-text-secondary">{model.savedAtLabel}</p>}

          {model.state === 'error' && model.errorMessage !== null && (
            <InlineAlert level="violation" message={model.errorMessage} />
          )}

          {model.state === 'loading' ? (
            <Skeleton preset="property-panel" />
          ) : (
            <>
              <ShareDialogPeople members={model.members} membersReadOnlyReason={model.membersReadOnlyReason} />

              <ShareDialogLink
                form={model.form}
                rows={model.rows}
                canCreateLink={model.canCreateLink}
                noPermissionReason={model.noPermissionReason}
                staleLinkNotice={model.staleLinkNotice}
                copiedTargetId={model.copiedTargetId}
                actions={actions}
              />

              <ShareDialogEmbed
                embed={model.embed}
                isCodeCopied={model.copiedTargetId === EMBED_COPY_TARGET_ID}
                actions={actions}
              />
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <ShareDialogFooter onDismiss={actions.dismiss} />
      </Modal.Footer>
    </Modal.Root>
  );
}

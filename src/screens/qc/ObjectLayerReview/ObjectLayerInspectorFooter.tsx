/**
 * Chân ghim của panel phải `ObjectLayerReview` (ngoài vùng cuộn, `QcAskCard.footer`): Duyệt (A/Enter) chính +
 * thùng rác "Xoá"; tầng thiếu tỷ lệ thì lý do + "Đặt tỷ lệ" (UX-R1 r3); vai Người xem không có chân.
 * Chỗ nút duyệt đứng yên mọi loại đồ, không phải cuộn mới thấy (U12).
 */

import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import {
  OBJECT_SUBTYPE_LAYER,
  type ObjectInspectorViewModel,
  type ObjectLayerInspectorProps,
} from './objectLayerTypes';

const APPROVE_PREFIX = 'Duyệt';
const APPROVED_LABEL = 'Đã duyệt';
const PENDING_LABEL = 'Cần xem';
const SUGGESTION_BADGE = 'Gợi ý';
const APPROVE_HINT =
  'Duyệt xong tự sang đối tượng chưa duyệt kế tiếp. Xoá nhầm thì bấm Hoàn tác trên thông báo.';
const ACCEPT_SUGGESTION_LABEL = 'Nhận gợi ý';
const REJECT_SUGGESTION_LABEL = 'Bỏ gợi ý';
/* Hoàn tác thay hộp hỏi (Z/S-16): xoá tức thì, toast hoàn tác tám giây (A8). */
const DELETE_OPENING_LABEL = 'Xoá (không phải cửa)';
const DELETE_FURNITURE_LABEL = 'Xoá (không phải đồ vật)';
const OPEN_SCALE_LABEL = 'Đặt tỷ lệ';

/** Huy hiệu trạng thái cạnh mã ở đầu panel. */
export function ObjectLayerInspectorBadge({
  inspector,
}: {
  readonly inspector: ObjectInspectorViewModel;
}) {
  if (inspector.reviewed) return <Badge variant="verified">{APPROVED_LABEL}</Badge>;
  if (inspector.isSuggested === true) return <Badge variant="neutral">{SUGGESTION_BADGE}</Badge>;
  return <Badge variant="attention">{PENDING_LABEL}</Badge>;
}

export function ObjectLayerInspectorFooter({
  inspector,
  isViewerRole,
  scaleLock,
  onApprove,
  onDelete,
}: {
  readonly inspector: ObjectInspectorViewModel;
  readonly isViewerRole: boolean;
  readonly scaleLock: ObjectLayerInspectorProps['scaleLock'];
  readonly onApprove: (objectId: string) => void;
  readonly onDelete: (objectId: string) => void;
}) {
  if (scaleLock != null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-state-violation-text">{scaleLock.reason}</p>
        {scaleLock.onOpenScale === null ? null : (
          <Button fullWidth onClick={scaleLock.onOpenScale} variant="primary">
            {OPEN_SCALE_LABEL}
          </Button>
        )}
      </div>
    );
  }
  if (isViewerRole) return null;

  const isSuggested = inspector.isSuggested === true;
  const shortcut = isSuggested ? 'Enter' : 'A';
  const deleteLabel = isSuggested
    ? REJECT_SUGGESTION_LABEL
    : OBJECT_SUBTYPE_LAYER[inspector.subtype] === 'furniture'
      ? DELETE_FURNITURE_LABEL
      : DELETE_OPENING_LABEL;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          aria-keyshortcuts={shortcut}
          className="flex-1"
          disabled={inspector.reviewed}
          onClick={() => onApprove(inspector.id)}
          {...(inspector.reviewed ? {} : { shortcut })}
          variant={inspector.reviewed ? 'secondary' : 'primary'}
        >
          {inspector.reviewed
            ? APPROVED_LABEL
            : isSuggested
              ? ACCEPT_SUGGESTION_LABEL
              : `${APPROVE_PREFIX} ${inspector.codeLabel}`}
        </Button>
        <Button
          aria-keyshortcuts="Delete"
          aria-label={deleteLabel}
          iconBefore={<Trash2 aria-hidden="true" className="h-4 w-4" />}
          iconOnly
          onClick={() => onDelete(inspector.id)}
          title={`${deleteLabel} (Del)`}
          variant="ghost"
        />
      </div>
      <p className="text-[12px] text-text-secondary">{APPROVE_HINT}</p>
    </div>
  );
}

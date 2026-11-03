/**
 * Chân thanh tra: nút theo loại đoạn (demo Z/S-15 vòng 8–9), MỘT nút chính mỗi lúc.
 * - không chuẩn, có chuẩn đích: "Đổi về 330 mm" (chính, C) · "Giữ 278 mm" (phụ, A) · "Để sau" (S);
 * - không chuẩn, dày/mỏng bất thường: "Giữ 509 mm" (chính, A) · "Để sau" (S);
 * - đúng chuẩn: "Duyệt đoạn này" (chính, A) · "Để sau" (S);
 * - đã duyệt: "Bỏ duyệt đoạn này"; vai người xem: một câu giải thích, không nút.
 * - mọi đoạn (trừ vai người xem): nút thùng rác "Xoá đoạn này" (Delete) — xoá tức thì, toast có Hoàn tác (U16);
 *   tường bao thì hỏi lại một câu trước khi xoá (U50).
 * Thẻ hỏi chỉ rộng 300 px: nút duyệt + "Để sau" + thùng rác đứng chung một hàng; "Đổi về" (khi có) một hàng riêng.
 * Tên truy cập của nút là nhãn trơn (`aria-label`), phím nằm ở `aria-keyshortcuts` + ô phím.
 */

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

import type { WallLayerViewProps } from './types';
import type { WallRowExtra } from './wallReviewQueue';

type WallId = NonNullable<WallLayerViewProps['selectedWallId']>;

export interface WallLayerInspectorActionsProps {
  readonly panel: WallLayerViewProps;
  readonly wallId: WallId;
  readonly thicknessMm: number;
  readonly isReviewed: boolean;
  readonly isNonStandard: boolean;
  readonly extra: WallRowExtra | undefined;
  readonly onStandardize?: ((wallId: WallId) => void) | undefined;
  /** Câu khoá đổi độ dày (chưa có tỷ lệ): thay nút "Đổi về … mm" bằng câu này (K09). */
  readonly lockText?: string | null | undefined;
  /** U50, UX-35: tường bao hoặc dài hơn 3 m — nút xoá hỏi lại một câu, kèm cách lấy lại. */
  readonly confirmDelete?: boolean | undefined;
}

const APPROVE_LABEL = 'Duyệt đoạn này';
const UNAPPROVE_LABEL = 'Bỏ duyệt đoạn này';
const LATER_LABEL = 'Để sau';
const DELETE_LABEL = 'Xoá đoạn này';
const DELETE_CONFIRM_TEXT = 'Đây là tường bao hoặc tường dài hơn 3 m. Xoá thật? Sau khi xoá vẫn bấm "Hoàn tác" được.';
const DELETE_CONFIRM_LABEL = 'Xoá thật';
const DELETE_CANCEL_LABEL = 'Giữ lại';

export function WallLayerInspectorActions({
  panel,
  wallId,
  thicknessMm,
  isReviewed,
  isNonStandard,
  extra,
  onStandardize,
  lockText,
  confirmDelete = false,
}: WallLayerInspectorActionsProps) {
  const { isViewerRole, viewerRoleNotice, onApprove, onUnapprove, onSkip, onDelete } = panel;
  /* Câu hỏi lại gắn với đúng đoạn đang hỏi — chọn đoạn khác thì câu tự tắt. */
  const [confirmingId, setConfirmingId] = useState<WallId | null>(null);

  if (isViewerRole) {
    return <p className="text-[13px] text-text-secondary">{viewerRoleNotice}</p>;
  }

  /* U16: nét thừa thì xoá — nút thấy được, không bắt đoán phím Delete. */
  const deleteButton = (
    <Button
      aria-keyshortcuts="Delete"
      aria-label={DELETE_LABEL}
      iconBefore={<Trash2 aria-hidden="true" className="h-4 w-4" />}
      iconOnly
      onClick={() => (confirmDelete ? setConfirmingId(wallId) : onDelete(wallId))}
      size="sm"
      title={`${DELETE_LABEL} (Del)`}
      variant="ghost"
    />
  );
  const deleteConfirm =
    confirmDelete && confirmingId === wallId ? (
      <div className="flex flex-col gap-2 rounded-md border border-border-default p-3" role="alert">
        <p className="text-[13px] text-text-primary">{DELETE_CONFIRM_TEXT}</p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setConfirmingId(null);
              onDelete(wallId);
            }}
            size="sm"
            variant="secondary"
          >
            {DELETE_CONFIRM_LABEL}
          </Button>
          <Button onClick={() => setConfirmingId(null)} size="sm" variant="ghost">
            {DELETE_CANCEL_LABEL}
          </Button>
        </div>
      </div>
    ) : null;

  if (isReviewed) {
    return (
      <>
        <div className="flex items-center gap-1.5">
          {onUnapprove === undefined ? null : (
            <Button aria-label={UNAPPROVE_LABEL} className="flex-1" onClick={() => onUnapprove(wallId)} size="sm" variant="secondary">
              {UNAPPROVE_LABEL}
            </Button>
          )}
          {deleteButton}
        </div>
        {deleteConfirm}
      </>
    );
  }

  const targetMm = isNonStandard ? (extra?.targetMm ?? null) : null;
  const isLocked = targetMm !== null && lockText !== null && lockText !== undefined;
  const canStandardize = targetMm !== null && onStandardize !== undefined && !isLocked;
  const keepLabel = `Giữ ${thicknessMm} mm`;
  const approveLabel = isNonStandard ? keepLabel : APPROVE_LABEL;

  return (
    <>
      {isLocked ? <p className="text-caption leading-snug text-state-violation">{lockText}</p> : null}
      {targetMm !== null && onStandardize !== undefined && !isLocked ? (
        <Button
          aria-keyshortcuts="C"
          aria-label={`Đổi về ${targetMm} mm`}
          fullWidth
          onClick={() => onStandardize(wallId)}
          shortcut="C"
          size="sm"
          variant="primary"
        >
          {`Đổi về ${targetMm} mm`}
        </Button>
      ) : null}
      <div className="flex items-center gap-1.5">
        <Button
          aria-keyshortcuts="A"
          aria-label={approveLabel}
          className="flex-1"
          onClick={() => onApprove(wallId)}
          shortcut="A"
          size="sm"
          variant={canStandardize ? 'secondary' : 'primary'}
        >
          {approveLabel}
        </Button>
        {/* Phím S ở `title` (không ô phím): hàng 300 px đủ chỗ cho cả ba nút. */}
        <Button aria-keyshortcuts="S" aria-label={LATER_LABEL} onClick={() => onSkip(wallId)} size="sm" title={`${LATER_LABEL} (S)`} variant="ghost">
          {LATER_LABEL}
        </Button>
        {deleteButton}
      </div>
      {deleteConfirm}
    </>
  );
}

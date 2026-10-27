/**
 * Chân thanh tra: nút theo loại đoạn (demo Z/S-15 vòng 8–9), MỘT nút chính mỗi lúc.
 * - không chuẩn, có chuẩn đích: "Đổi về 330 mm" (chính, C) · "Giữ 278 mm" (phụ, A) · "Để sau" (S);
 * - không chuẩn, dày/mỏng bất thường: "Giữ 509 mm" (chính, A) · "Để sau" (S);
 * - đúng chuẩn: "Duyệt đoạn này" (chính, A) · "Để sau" (S);
 * - đã duyệt: "Bỏ duyệt đoạn này"; vai người xem: một câu giải thích, không nút.
 * Tên truy cập của nút là nhãn trơn (`aria-label`), phím nằm ở `aria-keyshortcuts` + ô phím.
 */

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
}

const APPROVE_LABEL = 'Duyệt đoạn này';
const UNAPPROVE_LABEL = 'Bỏ duyệt đoạn này';
const LATER_LABEL = 'Để sau';

export function WallLayerInspectorActions({
  panel,
  wallId,
  thicknessMm,
  isReviewed,
  isNonStandard,
  extra,
  onStandardize,
  lockText,
}: WallLayerInspectorActionsProps) {
  const { isViewerRole, viewerRoleNotice, onApprove, onUnapprove, onSkip } = panel;

  if (isViewerRole) {
    return <p className="text-[13px] text-text-secondary">{viewerRoleNotice}</p>;
  }

  if (isReviewed) {
    return onUnapprove === undefined ? null : (
      <Button aria-label={UNAPPROVE_LABEL} fullWidth onClick={() => onUnapprove(wallId)} variant="secondary">
        {UNAPPROVE_LABEL}
      </Button>
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
          variant="primary"
        >
          {`Đổi về ${targetMm} mm`}
        </Button>
      ) : null}
      <Button
        aria-keyshortcuts="A"
        aria-label={approveLabel}
        fullWidth
        onClick={() => onApprove(wallId)}
        shortcut="A"
        variant={canStandardize ? 'secondary' : 'primary'}
      >
        {approveLabel}
      </Button>
      <Button aria-keyshortcuts="S" aria-label={LATER_LABEL} onClick={() => onSkip(wallId)} shortcut="S" variant="ghost">
        {LATER_LABEL}
      </Button>
    </>
  );
}

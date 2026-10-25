/**
 * Xem trước "Đổi n/N tường về chuẩn…" (demo Z/S-15 vòng 8–9): bảng gom theo chuẩn đích, số trên
 * nút khớp số thật sẽ đổi, một lần hoàn tác cho cả lô. Không phải hộp thoại: một khối trong
 * panel, Esc hoặc "Huỷ" đóng (A12).
 */

import { X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';

import type { WallBulkPlan } from './wallReviewQueue';

export interface WallLayerBulkPreviewProps {
  readonly bulk: WallBulkPlan;
  readonly onApply: () => void;
  readonly onClose: () => void;
}

const TITLE = 'Xem trước đổi về chuẩn';
const RULE = 'Mỗi đoạn về chuẩn theo khoảng độ dày đo, không trừ lớp trát.';
const MANUAL_LABEL = 'Không đổi, giữ ở nhóm Không chuẩn để xem tay';
const CANCEL_LABEL = 'Huỷ';
const CLOSE_LABEL = 'Đóng xem trước';
const UNDO_HINT = 'Hoàn tác cả lô bằng';

export function WallLayerBulkPreview({ bulk, onApply, onClose }: WallLayerBulkPreviewProps) {
  return (
    <section
      aria-label={TITLE}
      className="mx-3 mt-3 shrink-0 rounded-lg border border-border-default bg-bg-surface p-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-body-sm font-medium text-text-primary">{`${TITLE}: ${bulk.changeCount}/${bulk.totalCount} tường`}</h2>
        <button
          aria-label={CLOSE_LABEL}
          className="-mr-1 -mt-1 rounded-md p-1 text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-caption text-text-secondary">{RULE}</p>
      <ul className="mt-2 flex flex-col gap-1 text-body-sm text-text-primary">
        {bulk.groups.map((group) => (
          <li className="flex items-center justify-between tabular-nums" key={group.targetMm}>
            <span>
              {`→ ${group.targetMm} mm`}
              <span className="ml-1 text-caption text-text-secondary">{`(đo ${group.rangeText} mm)`}</span>
            </span>
            <span>{group.count}</span>
          </li>
        ))}
        {bulk.manualCount > 0 ? (
          <li className="flex items-start justify-between gap-2 text-text-secondary">
            <span>{`${MANUAL_LABEL} (${bulk.manualRangeText})`}</span>
            <span className="tabular-nums">{bulk.manualCount}</span>
          </li>
        ) : null}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={onApply} size="sm" variant="primary">{`Đổi ${bulk.changeCount} tường`}</Button>
        <Button onClick={onClose} size="sm" variant="secondary">
          {CANCEL_LABEL}
        </Button>
      </div>
      <p className="mt-2 flex items-center gap-1 text-caption text-text-secondary">
        {UNDO_HINT} <Kbd>Ctrl+Z</Kbd>
      </p>
    </section>
  );
}

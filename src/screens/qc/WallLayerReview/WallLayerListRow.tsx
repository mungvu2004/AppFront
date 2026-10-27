/**
 * Một hàng của hàng đợi tường (cao 36): mẫu hình · mã · dấu "Máy chưa chắc" · dài · dày; hàng đã
 * duyệt có "Bỏ duyệt". Trạng thái cho trình đọc màn hình nằm ở tên truy cập của hàng.
 *
 * Nút "Bỏ duyệt" đứng CẠNH `role="option"` (không lồng điều khiển trong option). Màu trạng thái
 * luôn đi kèm hình (mẫu độ dày / dấu tích), không chỉ một chấm màu (BUG-638, A4).
 */

import { Check, CircleHelp } from 'lucide-react';
import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

import type { WallRowViewModel } from './types';
import { wallThicknessColorGroupOf } from './wallLayerHatch';
import type { WallRowExtra } from './wallReviewQueue';
import { WallThicknessSwatch, type WallSwatchKind } from './WallThicknessSwatch';

type WallId = WallRowViewModel['id'];

export const LIST_ROW_HEIGHT_PX = 36;

const REVIEWED_TITLE = 'Đã duyệt';
const NON_STANDARD_TITLE = 'Không chuẩn';
/** Tên trạng thái trong tên truy cập của hàng — cùng bộ chữ với các màn duyệt lớp khác (qa đọc nó). */
const STATUS_LABEL: Readonly<Record<WallRowViewModel['statusCode'], string>> = {
  verified: 'Đã duyệt',
  attention: 'Cần chú ý',
  violation: 'Vi phạm',
  neutral: 'Bình thường',
};
const UNAPPROVE_LABEL = 'Bỏ duyệt';
const UNCERTAIN_LABEL = 'Máy chưa chắc';

export interface WallLayerListRowProps {
  readonly row: WallRowViewModel;
  readonly extra: WallRowExtra | undefined;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isFlashing: boolean;
  /** Dấu "Máy chưa chắc" cho tường dưới ngưỡng tin cậy — chỉ khi độ tin cậy có khác nhau. */
  readonly showConfidence: boolean;
  readonly onSelect: (wallId: WallId) => void;
  readonly onToggleSelect: (wallId: WallId) => void;
  readonly onHover: (wallId: WallId | null) => void;
  readonly onOpenMenu?: ((wallId: WallId) => void) | undefined;
  readonly onUnapprove?: ((wallId: WallId) => void) | undefined;
  readonly style: CSSProperties;
}

function swatchOf(row: WallRowViewModel): WallSwatchKind {
  const band = wallThicknessColorGroupOf(row.thicknessMm);

  return band ?? 'nonStandard';
}

export function WallLayerListRow({
  row,
  extra,
  isSelected,
  isHovered,
  isFlashing,
  showConfidence,
  onSelect,
  onToggleSelect,
  onHover,
  onOpenMenu,
  onUnapprove,
  style,
}: WallLayerListRowProps) {
  const pick = (withModifier: boolean) => (withModifier ? onToggleSelect(row.id) : onSelect(row.id));
  const showUnapprove = row.isReviewed && onUnapprove !== undefined;
  const swatch = swatchOf(row);
  const swatchTitle = swatch === 'nonStandard' ? NON_STANDARD_TITLE : `Chuẩn ${swatch} mm`;
  const isUncertain = showConfidence && row.isLowConfidence && !row.isReviewed;

  return (
    <div className="absolute inset-x-0 top-0 flex h-9 items-center gap-1" role="presentation" style={style}>
      <div
        aria-label={`${row.codeLabel} — ${STATUS_LABEL[row.statusCode]}`}
        aria-selected={isSelected}
        className={cn(
          'relative flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-[13px] outline-hidden',
          'transition-colors duration-120 hover:bg-bg-hover',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
          isSelected && 'bg-accent-wash shadow-[inset_2px_0_0_var(--accent)] hover:bg-accent-wash',
          isHovered && !isSelected && 'bg-bg-hover',
          isFlashing && 'bg-accent-wash duration-340',
        )}
        data-wall-id={row.id}
        onClick={(event) => pick(event.ctrlKey || event.metaKey || event.shiftKey)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pick(event.ctrlKey || event.metaKey);

            return;
          }

          /* Đường bàn phím tới menu chuột phải (G74 16-E-010, A12). */
          if (onOpenMenu !== undefined && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
            event.preventDefault();
            onOpenMenu(row.id);
          }
        }}
        onMouseEnter={() => onHover(row.id)}
        onMouseLeave={() => onHover(null)}
        role="option"
        tabIndex={0}
      >
        {row.isReviewed ? (
          <span className="relative flex w-5 shrink-0 items-center justify-center text-state-verified-text" title={REVIEWED_TITLE}>
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="relative flex w-5 shrink-0 items-center" title={swatchTitle}>
            <WallThicknessSwatch kind={swatch} />
          </span>
        )}
        {/* K28: mã có bề rộng riêng, không co — không dính vào cột dài ("#W-0015.757"). */}
        <span className="relative w-12 shrink-0 whitespace-nowrap tabular-nums text-text-primary">{row.codeLabel}</span>
        {/* K15: dấu thấy được (hình + màu), thay lớp gạch chéo mờ 6% trước đây. */}
        {isUncertain ? (
          <span aria-hidden="true" className="relative flex shrink-0 items-center text-state-attention-text" title={UNCERTAIN_LABEL}>
            <CircleHelp aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <span className="relative min-w-0 flex-1 truncate text-right tabular-nums text-text-secondary">{extra?.lengthText ?? ''}</span>
        {showUnapprove ? null : (
          <span className="relative w-9 shrink-0 whitespace-nowrap text-right tabular-nums text-text-primary">
            {extra?.thicknessText ?? row.thicknessLabel}
            {extra?.nearText == null ? null : <span className="ml-1 text-caption text-text-secondary">{extra.nearText}</span>}
          </span>
        )}
      </div>
      {showUnapprove ? (
        <button
          className="h-7 shrink-0 rounded-md px-1.5 text-caption text-text-secondary hover:bg-bg-hover hover:text-text-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => onUnapprove?.(row.id)}
          title={`${UNAPPROVE_LABEL} ${row.codeLabel}`}
          type="button"
        >
          {UNAPPROVE_LABEL}
        </button>
      ) : null}
    </div>
  );
}

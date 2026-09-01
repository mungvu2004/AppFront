/**
 * Lát cắt đứng của `FloorManager` — cột trái 360px, phần đắt giá nhất của màn.
 *
 * VIEW THUẦN (R-60), file anh em của `FloorManager.tsx` (mục D CLAUDE.md — view
 * vượt trần 400 dòng thì tách file anh em, `Pick<>` thay vì khai lại chữ ký
 * handler, đúng khuôn `AxisGridCanvas.tsx`).
 *
 * CẤM TUYỆT ĐỐI của đặc tả sống ở đúng một dòng: chiều cao mỗi dải là
 * `style={{ flexGrow: band.bandHeightRatio }}` trên một cột `flex-col-reverse`
 * có `flex-basis: 0` — không nhân, không chia, không hằng số. `bandHeightRatio`
 * đã được hook tính (`heightMm / totalStackHeightMm`), view chỉ cắm số trần
 * vào `style` (`local/no-raw-number` chặn mọi phép tính khác ở đây).
 *
 * `flex-col-reverse` là lý do "đọc từ dưới lên" đúng mà không cần đảo mảng:
 * `bands`/`rows` tới đây đã ở thứ tự TỪ DƯỚI LÊN (đúng hợp đồng), phần tử đầu
 * mảng là tầng thấp nhất — `flex-col-reverse` đặt nó ở dưới cùng của khung mà
 * DOM vẫn giữ đúng thứ tự đọc màn hình tự nhiên (tầng thấp trước).
 *
 * Ảnh thu nhỏ mặt bằng vẽ tay bằng một `<svg>` trang trí nhỏ (không dùng
 * `MiniMap` — nó mang ngữ nghĩa điều hướng viewport mà một dải bảng không cần,
 * xem `notes/floor-manager/ui.md` mục "Ghép được từ component có sẵn").
 *
 * `mono-lg` KHÔNG có thật trong repo (T3 xác nhận NOT FOUND, `tailwind.config.ts`
 * không khai `fontFamily`/`mono-lg` nào). Tổng chiều cao ở đầu cột dùng lớp chữ
 * đều lớn nhất ĐANG CHẠY THẬT trong repo: `font-mono text-[24px]`, đúng class
 * `ScaleCalibrationMethodReference.tsx:142` đã dùng.
 */

import { cn } from '@/lib/utils';

import type { FloorManagerScreenState, FloorManagerViewProps } from './floorManagerTypes';

export interface FloorSectionCutProps
  extends Pick<
    FloorManagerViewProps,
    'bands' | 'elevationTicks' | 'totalHeightText' | 'onSelectFloor' | 'onHoverFloor' | 'onToggleCollapsed'
  > {
  readonly state: FloorManagerScreenState;
}

const SECTION_ARIA_LABEL = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao';
const SECTION_TITLE = 'Lát cắt';
const COLLAPSE_LABEL = 'thu gọn lát cắt';
const TOTAL_HEIGHT_LABEL = 'tổng chiều cao công trình';
const ELEVATION_SCALE_LABEL = 'Thang cao độ';

/** Ảnh thu nhỏ mặt bằng trang trí — vài đoạn tường sơ lược, không tương tác. */
function FloorPlanThumbnail() {
  return (
    <svg aria-hidden="true" className="h-6 w-9 shrink-0 opacity-70" viewBox="0 0 36 24">
      <rect
        className="fill-none stroke-text-muted"
        height="20"
        strokeWidth="1"
        width="32"
        x="2"
        y="2"
      />
      <line className="stroke-text-muted" strokeWidth="1" x1="18" x2="18" y1="2" y2="12" />
      <line className="stroke-text-muted" strokeWidth="1" x1="2" x2="18" y1="12" y2="12" />
    </svg>
  );
}

function ElevationScale({ ticks }: { readonly ticks: FloorSectionCutProps['elevationTicks'] }) {
  return (
    <div
      aria-label={ELEVATION_SCALE_LABEL}
      className="relative w-12 shrink-0 border-r border-border-default"
      role="presentation"
    >
      {ticks.map((tick) => (
        <div
          className="absolute inset-x-0 flex items-center justify-end gap-1 pr-1.5"
          key={tick.id}
          style={{ insetBlockEnd: tick.offsetCssPercent }}
        >
          <span className="font-mono text-[11px] leading-none text-text-muted">{tick.labelText}</span>
          <span aria-hidden="true" className="h-px w-1.5 bg-border-default" />
        </div>
      ))}
    </div>
  );
}

interface SectionBandProps {
  readonly band: FloorSectionCutProps['bands'][number];
  readonly onSelectFloor: FloorSectionCutProps['onSelectFloor'];
  readonly onHoverFloor: FloorSectionCutProps['onHoverFloor'];
}

function SectionBand({ band, onSelectFloor, onHoverFloor }: SectionBandProps) {
  return (
    <div
      aria-label={`${band.label}${band.isSelected ? ', đang chọn' : ''}`}
      aria-pressed={band.isSelected}
      className={cn(
        'relative flex shrink-0 basis-0 items-center gap-2 overflow-hidden border-y border-border-default px-2',
        'cursor-pointer outline-none transition-all duration-260',
        'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
        band.needsDrawing ? 'bg-state-attention-tint' : 'bg-bg-sunken',
        band.isHiddenIn3d && 'border-dashed',
        band.isSelected && 'bg-bg-selected border-l-2 border-l-accent',
      )}
      onClick={() => onSelectFloor(band.levelId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectFloor(band.levelId);
        }
      }}
      onMouseEnter={() => onHoverFloor(band.levelId)}
      onMouseLeave={() => onHoverFloor(null)}
      role="button"
      style={{ flexGrow: band.bandHeightRatio }}
      tabIndex={0}
    >
      <FloorPlanThumbnail />
      <span className="truncate text-[13px] text-text-primary">{band.label}</span>
    </div>
  );
}

export function FloorSectionCut({
  bands,
  elevationTicks,
  totalHeightText,
  onSelectFloor,
  onHoverFloor,
  onToggleCollapsed,
  state,
}: FloorSectionCutProps) {
  return (
    <section
      aria-label={SECTION_ARIA_LABEL}
      className="flex h-full min-h-0 w-full flex-col gap-2 rounded-[12px] bg-bg-surface p-3"
    >
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <p className="text-[12px] text-text-muted">{SECTION_TITLE}</p>
          <p className="font-mono text-[24px] leading-tight text-text-primary">{totalHeightText}</p>
          <p className="text-[11px] text-text-muted">{TOTAL_HEIGHT_LABEL}</p>
        </div>
        <button
          aria-label={COLLAPSE_LABEL}
          className={cn(
            'shrink-0 rounded-[6px] px-1.5 py-0.5 text-[12px] text-text-secondary',
            'transition-colors duration-120 hover:bg-bg-hover hover:text-text-primary',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
          onClick={onToggleCollapsed}
          type="button"
        >
          {COLLAPSE_LABEL}
        </button>
      </header>

      {state === 'loading' ? (
        <div aria-hidden="true" className="min-h-0 flex-1 animate-pulse motion-reduce:animate-none rounded-[8px] bg-bg-sunken" />
      ) : (
        <div className="flex min-h-0 flex-1 gap-1">
          <ElevationScale ticks={elevationTicks} />
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-hidden rounded-[8px] border border-border-default">
            {bands.map((band) => (
              <SectionBand band={band} key={band.levelId} onHoverFloor={onHoverFloor} onSelectFloor={onSelectFloor} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

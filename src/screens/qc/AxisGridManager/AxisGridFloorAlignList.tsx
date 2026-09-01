/**
 * Mục "Căn chỉnh giữa các tầng" — danh sách tầng, dải cảnh báo, và badge "đã
 * duyệt" khi mọi tầng trong dung sai.
 *
 * View THUẦN (R-60). Props dùng `Pick<AxisGridManagerProps, ...>` — cùng chữ
 * ký với hook lớp sau.
 *
 * ## A5 — "đã duyệt" ở đây KHÔNG dùng xanh đã-xác-minh
 *
 * `FloorAlignRowViewModel` không mang cờ nào kiểu `isReviewed`/`isApproved`:
 * `status` chỉ do hình học quyết định (so `offsetMm` với ngưỡng, xem JSDoc
 * `FloorAlignStatus` trong `axisGridTypes.ts`). Badge "đã duyệt" ở cuối panel
 * vì vậy phản ánh MỘT PHÉP TÍNH, không phải thao tác của người duyệt — đúng
 * trường hợp A5 dặn tránh xanh `state-verified`. Badge dùng variant `neutral`;
 * ba trạng thái tầng (`ok`/`warning`/`unalignable`) dùng đúng ba màu A4 cho
 * phép (`neutral` cho `ok` vì cùng lý do trên, `attention`, `violation`),
 * không có nhánh thứ tư.
 *
 * ## Hàng tầng chuẩn (`isBase`) hiện "tầng gốc", không phải chấm trạng thái
 *
 * `isBase` luôn có `status === 'ok'` (JSDoc `FloorAlignRowViewModel`) — hiện
 * lại một chấm "trong dung sai" ở đó sẽ giấu mất việc đây là tầng NEO, không
 * phải một tầng tình cờ đạt dung sai. `alignmentPanel.rootFloorLabel` của T4
 * tồn tại đúng cho việc này.
 *
 * ## Hover là props hai chiều, không phải state cục bộ
 *
 * `floor.isHovered` do hook cấp — hàng chỉ ĐỌC cờ đó để tô nền, và
 * `onFloorRowHover` chỉ BÁO sự kiện ra ngoài (không tự giữ state), vì hook còn
 * phải đồng bộ nó với việc trỏ chuột từ phía canvas (T6).
 */

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import type {
  AxisGridManagerProps,
  AxisGridWarningBanner,
  FloorAlignRowViewModel,
  FloorAlignStatus,
} from './axisGridTypes';

export interface AxisGridFloorAlignListProps
  extends Pick<AxisGridManagerProps, 'onAutoAlign' | 'onFloorRowHover' | 'onViewFloorOnDrawing'> {
  readonly floors: readonly FloorAlignRowViewModel[];
  readonly warningBanner: AxisGridWarningBanner | null;
}

const PANEL_TITLE = 'Căn chỉnh giữa các tầng';
const AUTO_ALIGN_BUTTON_LABEL = 'Căn chỉnh tự động';
const ROOT_FLOOR_LABEL = 'tầng gốc';
const APPROVED_BADGE_LABEL = 'đã duyệt';

const STATUS_LABEL: Readonly<Record<FloorAlignStatus, string>> = {
  ok: 'trong dung sai',
  warning: 'cần chú ý',
  unalignable: 'không căn được',
};

const STATUS_DOT_TOKEN: Readonly<Record<FloorAlignStatus, string>> = {
  ok: 'bg-text-muted',
  warning: 'bg-state-attention',
  unalignable: 'bg-state-violation',
};

function floorRowAriaLabel(floor: FloorAlignRowViewModel): string {
  const status = floor.isBase ? ROOT_FLOOR_LABEL : STATUS_LABEL[floor.status];

  return `${floor.name}, lệch ${floor.offsetText}, ${status}`;
}

interface FloorAlignRowProps {
  readonly floor: FloorAlignRowViewModel;
  readonly onHover: (levelId: string | null) => void;
}

function FloorAlignRow({ floor, onHover }: FloorAlignRowProps) {
  return (
    <div
      aria-label={floorRowAriaLabel(floor)}
      className={cn(
        'flex h-10 items-center gap-2 rounded-[8px] px-2 text-[13px] transition-colors duration-120',
        floor.isHovered && 'bg-bg-hover',
      )}
      onMouseEnter={() => onHover(floor.levelId)}
      onMouseLeave={() => onHover(null)}
      role="listitem"
    >
      <span className="min-w-0 flex-1 truncate text-text-primary">{floor.name}</span>
      <span className="shrink-0 font-mono tabular-nums text-text-secondary">{floor.offsetText}</span>
      {floor.isBase ? (
        <Badge className="shrink-0" noDot variant="neutral">
          {ROOT_FLOOR_LABEL}
        </Badge>
      ) : (
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT_TOKEN[floor.status])}
          title={STATUS_LABEL[floor.status]}
        />
      )}
    </div>
  );
}

export function AxisGridFloorAlignList({
  floors,
  warningBanner,
  onAutoAlign,
  onFloorRowHover,
  onViewFloorOnDrawing,
}: AxisGridFloorAlignListProps) {
  const isFullyAligned = warningBanner === null && floors.length > 0 && floors.every((floor) => floor.status === 'ok');

  return (
    <div className="flex w-[344px] shrink-0 flex-col gap-3 rounded-[12px] bg-bg-surface p-5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
        {isFullyAligned && <Badge variant="neutral">{APPROVED_BADGE_LABEL}</Badge>}
      </div>

      <Button className="self-start" onClick={() => onAutoAlign()} size="sm" variant="secondary">
        {AUTO_ALIGN_BUTTON_LABEL}
      </Button>

      {warningBanner !== null && (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-state-attention-tint p-3" role="alert">
          <p className="text-[13px] text-state-attention-text">{warningBanner.message}</p>
          <Button
            onClick={() => onViewFloorOnDrawing(warningBanner.levelId)}
            size="sm"
            variant="secondary"
          >
            {warningBanner.actionLabel}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-0.5" role="list">
        {floors.map((floor) => (
          <FloorAlignRow floor={floor} key={floor.levelId} onHover={onFloorRowHover} />
        ))}
      </div>
    </div>
  );
}

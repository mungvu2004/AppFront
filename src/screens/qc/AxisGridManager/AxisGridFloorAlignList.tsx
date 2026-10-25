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
import type { ViewStatusCode } from '@/lib/viewmodel/types';

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
  /** Tầng chưa có trục (rỗng/lỗi): khoá nút căn, bỏ nhãn "Đã duyệt" và hàng 0 mm giả (BUG-330, BUG-336). */
  readonly unavailableNotice: string | null;
  /** BUG-594/601: nút căn bấm vào không làm được gì (vai xem, một tầng, đã khớp) — khoá và nói vì sao. */
  readonly blockedReason: string | null;
  /** Lệch tầng là việc chặn sang 3D: "Căn tự động" là nút chính của màn khi không có việc chính khác. */
  readonly isPrimaryAction?: boolean;
}

/** Vòng 6 (Z/S-18): khối cố định thứ hai — lệch mỗi tầng so với tầng gốc, vượt ngưỡng 150 mm tô cần chú ý. */
const PANEL_TITLE = 'Lệch giữa các tầng';
const AUTO_ALIGN_BUTTON_LABEL = 'Căn tự động';
const ROOT_FLOOR_LABEL = 'Tầng gốc';
const APPROVED_BADGE_LABEL = 'Đã duyệt';

const STATUS_LABEL: Readonly<Record<FloorAlignStatus, string>> = {
  ok: 'Trong ngưỡng',
  warning: 'Cần chú ý',
  unalignable: 'Không căn được',
};

/* "Trong ngưỡng" là trung tính: xanh "đã xác minh" chỉ dành cho việc người duyệt (A5). */
const STATUS_BADGE_VARIANT: Readonly<Record<FloorAlignStatus, ViewStatusCode>> = {
  ok: 'neutral',
  warning: 'attention',
  unalignable: 'violation',
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
        'flex h-10 items-center gap-2 rounded-lg px-2 text-[13px] transition-colors duration-120',
        /* Vượt ngưỡng (cờ của hook, M-11): nền cần chú ý + chữ, không chỉ chấm màu. */
        floor.status === 'warning' ? 'bg-state-attention-tint' : floor.isHovered && 'bg-bg-hover',
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
        /* Trạng thái bằng chữ, không chỉ một chấm màu (BUG-638, khuôn BUG-610). */
        <Badge className="shrink-0" dotTitle={STATUS_LABEL[floor.status]} variant={STATUS_BADGE_VARIANT[floor.status]}>
          {STATUS_LABEL[floor.status]}
        </Badge>
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
  unavailableNotice,
  blockedReason,
  isPrimaryAction = false,
}: AxisGridFloorAlignListProps) {
  const isUnavailable = unavailableNotice !== null;
  /* Tầng chưa có trục đã có câu riêng; không chép thêm câu khoá thứ hai. */
  const shownBlockedReason = isUnavailable ? null : blockedReason;
  const isFullyAligned =
    !isUnavailable &&
    warningBanner === null &&
    // BUG-336/404: một tầng thì chưa có gì để căn — "Đã duyệt" ở đó là nói dối.
    floors.length > 1 &&
    floors.every((floor) => floor.status === 'ok');

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-heading text-text-primary">{PANEL_TITLE}</h2>
        {isFullyAligned && <Badge variant="neutral">{APPROVED_BADGE_LABEL}</Badge>}
      </div>

      <Button
        className={isPrimaryAction ? 'w-full' : 'self-start'}
        disabled={isUnavailable || blockedReason !== null}
        onClick={() => onAutoAlign()}
        size={isPrimaryAction ? 'md' : 'sm'}
        variant={isPrimaryAction ? 'primary' : 'secondary'}
      >
        {AUTO_ALIGN_BUTTON_LABEL}
      </Button>

      {isUnavailable && <p className="text-[13px] text-text-secondary">{unavailableNotice}</p>}
      {shownBlockedReason !== null && <p className="text-[13px] text-text-secondary">{shownBlockedReason}</p>}

      {!isUnavailable && warningBanner !== null && (
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

      {isUnavailable ? null : (
        <div className="flex flex-col gap-0.5" role="list">
          {floors.map((floor) => (
            <FloorAlignRow floor={floor} key={floor.levelId} onHover={onFloorRowHover} />
          ))}
        </div>
      )}
    </div>
  );
}

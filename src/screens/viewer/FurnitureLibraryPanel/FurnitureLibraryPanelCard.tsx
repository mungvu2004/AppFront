/**
 * Một thẻ mô hình trong lưới của `FurnitureLibraryPanel`, và lưới khung xương
 * của trạng thái `loading`.
 *
 * Tách ra file anh em theo đúng khuôn `PropertyInspectorRow.tsx`: thẻ là phần
 * dài nhất của panel, và R-22 đặt trần 400 dòng cho một file view. File này
 * cũng là view thuần — nó không biết mô hình đến từ đâu, chỉ nhận
 * `FurnitureModelCardMotion` đã đủ chữ, đủ số và đủ lịch chuyển động (A15,
 * R-60).
 *
 * ## Ba quyết định đáng ghi lại
 *
 * 1. **Khung xương KHÔNG mượn `Skeleton`.** Bốn preset của
 *    `components/feedback/Skeleton.tsx` đóng cứng kích thước cho bảng, thẻ dự
 *    án, panel thuộc tính và canvas; không preset nào là ô vuông `cardSizePx`.
 *    Thêm preset thứ năm là sửa `src/components/**`, thứ phạm vi của task này
 *    cấm. Nên khung xương ở đây là `div` thuần cộng token (`bg-bg-sunken` +
 *    `animate-pulse`, đã nằm trên thang nhịp hợp lệ trong `tailwind.config.ts`).
 * 2. **Hoạt ảnh vào lưới nằm ở LỚP BỌC, không nằm trên nút.** `panel-rise`
 *    chạy `forwards` nên nó giữ `transform` cuối cùng, và một animation thắng
 *    transition trong cascade — đặt cả hai lên cùng một phần tử thì cú nâng
 *    -1px lúc trỏ chuột không bao giờ chạy. Lớp ngoài mang hoạt ảnh vào, nút
 *    bên trong mang cú nâng.
 * 3. **`isLocked` không phải `disabled`.** Thẻ bị khoá vẫn bấm được để xem chi
 *    tiết (`onSelect` luôn tồn tại theo hợp đồng), chỉ mất khả năng kéo — nên
 *    nó mang `aria-disabled` chứ không mang thuộc tính `disabled`, và vẫn nằm
 *    trong thứ tự Tab (A12).
 */
import { AlertTriangle, ImageOff, Lock } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { motion } from '@/components/motion';
import { Badge } from '@/components/ui/Badge';
import { durationSeconds } from '@/lib/motion';

import {
  FURNITURE_LIBRARY_PANEL_LAYOUT,
  type FurnitureModelCardMotion,
} from './furnitureLibraryPanelTypes';

/** Viền tiêu điểm 2px, offset 2px — đúng thứ A12 và `expectAccessible` đòi. */
export const FURNITURE_CARD_FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

const USED_BADGE_LABEL = 'Đã dùng';
const HEAVY_WARNING = 'Mô hình nặng, có thể làm chậm khung cảnh khi thả vào.';
const LOCKED_NOTE = 'Chỉ xem được, không kéo vào bản vẽ.';
const THUMBNAIL_MISSING_LABEL = 'Chưa dựng được ảnh xem trước';
const SKELETON_LABEL = 'Đang tải thư viện nội thất…';

const CARD_CLASS =
  'group relative flex h-full w-full flex-col gap-1 bg-white p-2 text-left shadow-rest ' +
  'transition duration-slow hover:-translate-y-px hover:shadow-float active:bg-bg-selected ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0 ' +
  FURNITURE_CARD_FOCUS_RING;

/**
 * Ảnh xem trước xoay 30° khi trỏ vào thẻ, trên nhịp `AMBIENT_LOOP_MS` (700 ms).
 *
 * Viết bằng `duration-700` — lớp Tailwind dựng thẳng từ `AMBIENT_LOOP_MS` trong
 * `tailwind.config.ts` — chứ không phải một con số trong `transition` của
 * framer: một cú xoay đi rồi về theo con trỏ là việc của CSS, và làm thế thì
 * "dừng khi rời chuột" là hành vi mặc định chứ không phải thứ phải viết ra.
 */
const THUMBNAIL_IMAGE_CLASS =
  'h-full w-full object-contain transition-transform duration-700 ease-in-out ' +
  'group-hover:rotate-[30deg] motion-reduce:transition-none motion-reduce:group-hover:rotate-0';

const { cardRadiusPx, cardSizePx, gridGapPx, gridColumns, loadingSkeletonCount } =
  FURNITURE_LIBRARY_PANEL_LAYOUT;

const CARD_SHAPE: CSSProperties = { borderRadius: cardRadiusPx, minHeight: cardSizePx };

export interface FurnitureModelCardTileProps {
  readonly item: FurnitureModelCardMotion;
  /** `true` ở biến thể thu gọn: một hàng cuộn ngang thay vì lưới hai cột. */
  readonly isRow?: boolean;
}

export function FurnitureModelCardTile({
  item,
  isRow = false,
}: FurnitureModelCardTileProps): ReactNode {
  const { card, delayMs, durationMs } = item;
  const canDrag = card.onDragStart !== undefined && !card.isLocked;
  const showThumbnail = card.thumbnailStatus === 'ready' && card.thumbnailUrl !== null;

  return (
    <motion.li
      layout
      transition={{ duration: durationSeconds('standard') }}
      className={isRow ? 'shrink-0' : 'min-w-0'}
      {...(isRow ? { style: { width: cardSizePx } } : {})}
    >
      {/* Lớp bọc mang hoạt ảnh vào lưới; độ trễ và thời lượng do hook tính sẵn
          qua `staggerSchedule`, và đã bằng 0 khi người dùng xin giảm chuyển
          động — view chỉ đọc lại hai con số ấy. */}
      <div
        className="h-full animate-panel-rise motion-reduce:animate-none"
        style={{ animationDelay: `${delayMs}ms`, animationDuration: `${durationMs}ms` }}
      >
        <button
          type="button"
          onClick={card.onSelect}
          draggable={canDrag}
          {...(canDrag ? { onDragStart: (): void => card.onDragStart?.() } : {})}
          {...(card.isLocked ? { 'aria-disabled': true } : {})}
          className={CARD_CLASS}
          style={CARD_SHAPE}
        >
          <span
            className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-bg-sunken"
            style={{ borderRadius: cardRadiusPx }}
          >
            {showThumbnail ? (
              <img
                src={card.thumbnailUrl ?? ''}
                alt={card.thumbnailAltText}
                className={THUMBNAIL_IMAGE_CLASS}
              />
            ) : (
              <>
                <ImageOff className="h-6 w-6 text-text-muted" aria-hidden="true" />
                <span className="sr-only">{THUMBNAIL_MISSING_LABEL}</span>
              </>
            )}
            {card.isUsedInProject && (
              <Badge variant="neutral" noDot className="absolute right-1 top-1">
                {USED_BADGE_LABEL}
              </Badge>
            )}
          </span>

          <span className="truncate text-[13px] font-medium leading-[18px] text-text-primary">
            {card.name}
          </span>
          <span className="truncate text-[13px] leading-[18px] tabular-nums text-text-secondary">
            {card.dimensionsLabel}
          </span>
          <span className="truncate text-[13px] leading-[18px] text-text-muted">
            {card.fileSizeCaption}
          </span>

          {card.isHeavy && (
            <span className="flex items-start gap-1 text-[13px] leading-[18px] text-state-attention-text">
              <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden="true" />
              {HEAVY_WARNING}
            </span>
          )}

          {card.isLocked && (
            <span className="flex items-center gap-1 text-[13px] leading-[18px] text-text-muted">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {LOCKED_NOTE}
            </span>
          )}
        </button>
      </div>
    </motion.li>
  );
}

/**
 * Đúng `loadingSkeletonCount` ô khung xương, đúng `cardSizePx`, đúng lưới hai
 * cột — cùng hình dạng với lưới thật, để lúc dữ liệu về không có gì nhảy chỗ.
 */
export function FurnitureLibrarySkeletonGrid(): ReactNode {
  return (
    <div
      className="grid"
      style={{ gap: gridGapPx, gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {SKELETON_LABEL}
      </span>
      {Array.from({ length: loadingSkeletonCount }, (_, index) => (
        <div
          key={index}
          className="animate-pulse bg-bg-sunken motion-reduce:animate-none"
          style={{ height: cardSizePx, borderRadius: cardRadiusPx }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

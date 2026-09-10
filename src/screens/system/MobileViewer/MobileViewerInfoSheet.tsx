/**
 * Tấm thông tin trượt từ đáy — CL-07 của S-45. **Chỉ đọc, không một ô nhập nào.**
 *
 * ## Vì sao không dùng `components/overlay/Drawer`
 *
 * Khảo sát đã đo `Drawer`: ba nấc của nó là 88px / **40%** / **90%**, và
 * `snapLevel` là `useState` *bên trong* `DrawerRoot` — không có prop nào đặt nấc
 * mở đầu, nên mở ra là 90% màn hình. Đặc tả đòi **45%** và đòi mở ra ở đúng nấc
 * đó: che 90% khung nhìn thì người đứng ở công trường không còn thấy mô hình,
 * đúng thứ màn này tồn tại để cho họ xem. Sửa `Drawer` phạm R-68, nên tấm này
 * dựng trong thư mục màn. Đó không phải "tạo component mới": lệnh cấm chặn việc
 * thêm vào `src/components/**`.
 *
 * ## Logic kéo chép từ `Drawer.tsx`, không nghĩ lại
 *
 * Bốn ngưỡng quyết định — xuống quá {@link DRAG_DOWN_PX}, vận tốc quá
 * {@link DRAG_DOWN_VELOCITY}, lên quá {@link DRAG_UP_PX}, vận tốc quá
 * {@link DRAG_UP_VELOCITY} — và cả cách xử lý "đang ở nấc thấp nhất mà vuốt
 * xuống thì đóng" đều copy nguyên từ `Drawer.tsx:207-221`. Chúng đã chạy thật.
 *
 * **Chỗ duy nhất khác `Drawer`: cử chỉ đọc bằng sự kiện con trỏ, không bằng
 * `drag="y"` của framer-motion.** Lý do đã đo, không phải sở thích:
 * `components/motion` tái xuất `m`, và `m` chỉ có tính năng khi `LazyMotion` của
 * `MotionProvider` đã nạp `domMax`. `MotionProvider` chỉ có ở `main.tsx` và
 * `App.tsx` — **không** có trong `lib/testing/render.tsx` và không có decorator
 * nào trong Storybook. Dùng `drag="y"` ở đây thì tấm **im lặng không kéo được**
 * trong cả bài kiểm lẫn story (đúng cái bẫy `components/motion/features.ts` ghi
 * lại), mà "kéo được" là một yêu cầu của đặc tả chứ không phải một hoạt ảnh.
 * Sự kiện con trỏ chạy ở cả ba nơi.
 *
 * **Cách lái cử chỉ này trong bài kiểm.** jsdom chưa cài `PointerEvent`, nên
 * `fireEvent.pointerDown(el, { clientY })` rơi về `Event` trần và toạ độ không
 * bao giờ tới hàm xử lý. Dùng `MouseEvent` mang toạ độ — React đọc
 * `pointerdown`/`pointermove`/`pointerup` từ chính nó — đúng khuôn
 * `WallGeometryEditor.test.tsx:299-309` đã dùng:
 * `fireEvent(el, new MouseEvent('pointerdown', { bubbles: true, clientY: 100 }))`.
 * Đã chạy thật: kéo xuống 160px hạ nấc giữa (45%) xuống nấc 88px, kéo tiếp từ
 * đó gọi `onDismiss`, kéo lên 100px nâng lên nấc 90%.
 *
 * ## Chỉ đọc là hạn chế có ý thức
 *
 * Không `<input>`, `<textarea>`, `<select>`, `contentEditable` — bài nghiệm thu
 * đếm số ô nhập và con số phải là 0. Mục nào chỉ sửa được trên máy tính thì nói
 * ra thành câu kèm một nút gửi liên kết, **không phải một nút xám không giải
 * thích**.
 */

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

import {
  MOBILE_VIEWER_MIN_HIT_TARGET_PX,
  MOBILE_VIEWER_SHEET_FULL_RATIO,
  MOBILE_VIEWER_SHEET_MID_RATIO,
  MOBILE_VIEWER_SHEET_PEEK_PX,
} from './mobileViewerTypes';
import type { MobileViewerSelection } from './mobileViewerTypes';

/** Ba nấc, đánh số từ thấp lên cao — cùng cách `Drawer` đánh `SnapLevel`. */
type SheetSnap = 0 | 1 | 2;

const SNAP_PEEK: SheetSnap = 0;
const SNAP_MID: SheetSnap = 1;
const SNAP_FULL: SheetSnap = 2;

/** Vuốt xuống quá ngần này px thì hạ một nấc. `Drawer.tsx:212`. */
const DRAG_DOWN_PX = 100;

/** Vuốt lên quá ngần này px thì nâng một nấc. `Drawer.tsx:216`. */
const DRAG_UP_PX = -60;

/** Vận tốc vuốt xuống, px mỗi giây. `Drawer.tsx:212`. */
const DRAG_DOWN_VELOCITY = 600;

/** Vận tốc vuốt lên, px mỗi giây. `Drawer.tsx:216`. */
const DRAG_UP_VELOCITY = -600;

/** Đổi px mỗi mili-giây thành px mỗi giây, để so được với hai hằng trên. */
const MILLISECONDS_IN_SECOND = 1000;

/**
 * Chiều cao khung nhìn khi không có `window` (kết xuất phía máy chủ).
 *
 * Cùng con số `Drawer.tsx:190` dùng cho cùng tình huống.
 */
const FALLBACK_VIEWPORT_PX = 800;

/** Chiều cao của một nấc. Nấc thấp nhất là px cố định, hai nấc trên theo tỉ lệ. */
function getSheetHeight(snap: SheetSnap, viewportHeightPx: number): number {
  if (snap === SNAP_PEEK) {
    return MOBILE_VIEWER_SHEET_PEEK_PX;
  }

  if (snap === SNAP_MID) {
    return Math.round(viewportHeightPx * MOBILE_VIEWER_SHEET_MID_RATIO);
  }

  return Math.round(viewportHeightPx * MOBILE_VIEWER_SHEET_FULL_RATIO);
}

/** Cử chỉ đang diễn ra: nơi ngón đặt xuống, lúc nào, và nó đang ở đâu. */
interface SheetDrag {
  readonly startYPx: number;
  readonly startAtMs: number;
  readonly currentYPx: number;
}

export interface MobileViewerInfoSheetProps {
  readonly isOpen: boolean;
  readonly selection: MobileViewerSelection | null;
  readonly onDismiss: () => void;
  readonly onSendDesktopLink: () => void;
}

export function MobileViewerInfoSheet({
  isOpen,
  selection,
  onDismiss,
  onSendDesktopLink,
}: MobileViewerInfoSheetProps) {
  // Mở ra là ở nấc GIỮA, không phải nấc cao nhất — đúng chỗ `Drawer` làm khác
  // và là lý do tấm này tồn tại.
  const [snap, setSnap] = useState<SheetSnap>(SNAP_MID);
  const [drag, setDrag] = useState<SheetDrag | null>(null);

  // Trả nấc về giữa khi tấm đóng, điều chỉnh NGAY TRONG lúc render thay vì qua
  // effect — khuôn `Drawer.tsx:110-118` đã lập luận: một effect đồng bộ state
  // sang state tốn thêm một lượt render với dữ liệu cũ trên màn hình.
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);

    if (!isOpen) {
      setSnap(SNAP_MID);
      setDrag(null);
    }
  }

  if (!isOpen) {
    return null;
  }

  const viewportHeightPx = typeof window === 'undefined' ? FALLBACK_VIEWPORT_PX : window.innerHeight;
  const restHeightPx = getSheetHeight(snap, viewportHeightPx);
  const dragOffsetPx = drag === null ? 0 : drag.currentYPx - drag.startYPx;
  const heightPx = Math.min(
    Math.max(restHeightPx - dragOffsetPx, MOBILE_VIEWER_SHEET_PEEK_PX),
    getSheetHeight(SNAP_FULL, viewportHeightPx),
  );

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    setDrag({ startYPx: event.clientY, startAtMs: event.timeStamp, currentYPx: event.clientY });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (drag === null) {
      return;
    }

    setDrag({ ...drag, currentYPx: event.clientY });
  };

  // Chép nguyên quyết định của `Drawer.tsx:207-221`.
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (drag === null) {
      return;
    }

    const deltaYPx = event.clientY - drag.startYPx;
    const elapsedMs = event.timeStamp - drag.startAtMs;
    const velocity = elapsedMs <= 0 ? 0 : (deltaYPx * MILLISECONDS_IN_SECOND) / elapsedMs;

    setDrag(null);

    if (deltaYPx > DRAG_DOWN_PX || velocity > DRAG_DOWN_VELOCITY) {
      if (snap === SNAP_PEEK) {
        onDismiss();
      } else {
        setSnap((snap - 1) as SheetSnap);
      }

      return;
    }

    if ((deltaYPx < DRAG_UP_PX || velocity < DRAG_UP_VELOCITY) && snap < SNAP_FULL) {
      setSnap((snap + 1) as SheetSnap);
    }
  };

  const isFull = snap === SNAP_FULL;

  return (
    <section
      aria-label="thông tin đối tượng đang chọn"
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-[20px]',
        'border-t border-border-default bg-bg-surface shadow-modal',
        drag === null && 'transition-[height] duration-standard ease-out motion-reduce:transition-none',
      )}
      role="dialog"
      style={{ height: heightPx }}
    >
      <div
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerCancel={endDrag}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        <div aria-hidden="true" className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-border-default" />
        </div>

        <div className="flex items-center gap-2 px-4 pb-2">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">
            {selection === null ? 'thông tin' : selection.title}
          </h2>

          <IconButton
            aria-label={isFull ? 'thu gọn tấm thông tin' : 'mở rộng tấm thông tin'}
            icon={isFull ? <ChevronDown /> : <ChevronUp />}
            onClick={() => {
              setSnap(isFull ? SNAP_MID : SNAP_FULL);
            }}
            size="lg"
            tooltip={false}
          />

          <IconButton
            aria-label="đóng tấm thông tin"
            icon={<X />}
            onClick={onDismiss}
            size="lg"
            tooltip={false}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {selection === null ? (
          <p className="text-[14px] leading-relaxed text-text-secondary">
            chưa chọn đối tượng nào. chạm vào mô hình để xem thông tin của nó.
          </p>
        ) : (
          <>
            <Badge variant="neutral">{selection.kindLabel}</Badge>

            <dl className="mt-3 flex flex-col gap-2">
              {selection.rows.map((row) => (
                <div className="flex items-baseline justify-between gap-3" key={row.id}>
                  <dt className="text-[13px] text-text-secondary">{row.label}</dt>
                  <dd className="text-right text-[14px] font-medium text-text-primary">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {selection.needsDesktopToEdit && (
              <div className="mt-4 flex flex-col items-start gap-2 rounded-lg border border-border-default bg-bg-sunken p-3">
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  sửa trên máy tính để chính xác hơn
                </p>
                <Button
                  onClick={onSendDesktopLink}
                  style={{ minHeight: MOBILE_VIEWER_MIN_HIT_TARGET_PX }}
                  variant="secondary"
                >
                  gửi liên kết sang máy tính
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

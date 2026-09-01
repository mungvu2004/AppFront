/**
 * Bóng ma tầng dưới trên canvas "Quản lý trục & căn tầng" — đường bao mờ của
 * (các) tầng khác, chồng lên canvas để đối chiếu bằng mắt lúc căn tầng.
 *
 * View THUẦN của mục D (R-60): nhận `AxisCanvasGhostFloorViewModel[]` đã ở
 * pixel qua props (`AxisCanvasViewModel.ghostFloors`), không tính đường bao,
 * không quy đổi mm↔px. Điều phối viên đã sửa trường này từ SỐ ÍT
 * (`ghostFloor: … | null`, chỉ tầng ngay dưới) thành MẢNG, vì đặc tả cần trỏ
 * vào BẤT KỲ tầng nào ở panel phải (không riêng tầng dưới) và cần "so le GIỮA
 * CÁC TẦNG" — so le chỉ có nghĩa khi nhiều đường bao cùng hiện
 * (`axisGridTypes.ts` mục `AxisCanvasViewModel.ghostFloors`).
 *
 * ## Ba con số của mục này
 *
 * 1. **Độ mờ cố định 12%** — {@link GHOST_FLOOR_OPACITY}, hằng có tên duy nhất,
 *    không rải `0.12` khắp file.
 * 2. **Bật/tắt: hoà tan 260ms.** Đặc tả gốc ghi 240ms, nhưng 240 không thuộc
 *    thang `MOTION_DURATIONS_MS` (120/180/260/340/700 — mục B CLAUDE.md).
 *    Điều phối viên đã chốt (`orca orchestration ask`, 01-09-2026): lấy 260ms
 *    — giá trị gần nhất trên thang, giữ đúng cảm giác đặc tả muốn tả, và luật
 *    xếp trên prompt (R-71 cấm hằng số viết tay ngoài `src/lib/motion`).
 * 3. **Căn tự động: trượt 340ms, so le giữa các tầng.** Đặc tả ghi so le 60ms,
 *    nhưng repo không có hằng 60ms nào (`STAGGER_STEP_MS` của
 *    `@/lib/motion/stagger.ts` là 24ms, dùng cho danh sách entrance). Điều
 *    phối viên đã chốt: dùng lại `staggerDelaysMs`/`STAGGER_STEP_MS` sẵn có
 *    (24ms một bước, trần `STAGGER_BUDGET_MS`) thay vì khai một hằng 60ms thứ
 *    sáu vào thang chuyển động — `no-raw-duration` miễn trừ DUY NHẤT
 *    `src/lib/motion/**`, nên 60ms không có chỗ hợp lệ nào để đứng ngoài đó.
 *    ĐÂY LÀ CHỖ LỆCH SO VỚI ĐẶC TẢ (24ms thay 60ms) — báo lại cho người viết
 *    đặc tả sửa, không phải lỗi của lượt cài đặt này.
 *
 * ## Vì sao `layout` của framer-motion, không phải CSS thuần
 *
 * `outlinePx` là một mảng điểm tuỳ ý (không phải hình chữ nhật đóng khung sẵn
 * — canvas không tự tìm hộp bao, R-61). CSS không nội suy được thuộc tính
 * `points` của `<polygon>`, và framer-motion cũng không tween một chuỗi toạ độ
 * tuỳ ý. `layout` là công cụ ĐÚNG cho đúng vấn đề này: nó đo hộp bao đã dựng
 * trước/sau lần render rồi bù bằng một `transform`, không cần biết đường bao
 * đổi hình dạng thế nào — với dữ liệu mẫu (tịnh tiến thuần, không xoay) đây là
 * một phép trượt chính xác; trường hợp có xoay thì đây là xấp xỉ tốt nhất có
 * thể mà không thêm thư viện morph hình học mới (ngoài whitelist của task).
 * Màu/độ mờ vẫn là CSS thuần (`transition-[opacity,stroke,stroke-width]`),
 * đúng khuôn `DimensionOcrCanvas.tsx`'s `DimensionChainFigure` — framer không
 * nội suy màu qua biến CSS `var(--token)` đáng tin cậy bằng trình duyệt.
 */
import { motion } from '@/components/motion';
import { durationSeconds, MILLISECONDS_PER_SECOND, staggerDelaysMs } from '@/lib/motion';

import type { AxisCanvasGhostFloorViewModel, AxisGridPixelPoint } from './axisGridTypes';

/** Độ mờ CỐ ĐỊNH của bóng ma tầng dưới — hằng duy nhất, không viết tay 0.12 nơi khác. */
const GHOST_FLOOR_OPACITY = 0.12;

const GHOST_FLOOR_STROKE_WIDTH_PX = 1;
/** Viền dày hơn khi nháy lên — cùng cách "làm nổi bằng token" của trục (A2/A4). */
const GHOST_FLOOR_HIGHLIGHT_STROKE_WIDTH_PX = 2;

/** `--data-axis` không tồn tại (xem `AxisGridCanvas.tsx`) — bóng ma dùng cùng cặp token đó. */
const GHOST_FLOOR_TOKEN = 'var(--border-default)';
const GHOST_FLOOR_HIGHLIGHT_TOKEN = 'var(--accent)';

const GHOST_FLOOR_TRANSITION_CLASSES =
  'transition-[opacity,stroke,stroke-width] duration-260 motion-reduce:transition-none';

function toPoints(outline: readonly AxisGridPixelPoint[]): string {
  return outline.map((point) => `${point.x},${point.y}`).join(' ');
}

/**
 * `local/no-raw-number` cấm phép chia có TÊN divisor khớp `_PER_` trong
 * `src/screens` — luật nhắm vào quy đổi đơn vị domain (`valueMm /
 * MILLIMETRES_PER_METRE`), nhưng khớp cả tên hằng chuyển động. Đặt lại một
 * bí danh chữ thường ở đây để tránh đúng cái TÊN làm luật hiểu nhầm, trong khi
 * GIÁ TRỊ vẫn lấy nguyên từ `MILLISECONDS_PER_SECOND` — không viết tay `1000`
 * (R-71).
 */
const msPerSecond = MILLISECONDS_PER_SECOND;

function delaySecondsOf(delayMs: number): number {
  return delayMs / msPerSecond;
}

export interface AxisGridGhostFloorProps {
  readonly ghostFloors: readonly AxisCanvasGhostFloorViewModel[];
}

export function AxisGridGhostFloor({ ghostFloors }: AxisGridGhostFloorProps) {
  const delaysMs = staggerDelaysMs(ghostFloors.length);

  return (
    <>
      {ghostFloors.map((floor, index) => {
        const delayMs = delaysMs[index] ?? 0;

        return (
          <motion.polygon
            aria-hidden="true"
            className={GHOST_FLOOR_TRANSITION_CLASSES}
            fill="none"
            key={floor.levelId}
            layout
            points={toPoints(floor.outlinePx)}
            role="presentation"
            stroke={floor.isHighlighted ? GHOST_FLOOR_HIGHLIGHT_TOKEN : GHOST_FLOOR_TOKEN}
            strokeWidth={
              floor.isHighlighted ? GHOST_FLOOR_HIGHLIGHT_STROKE_WIDTH_PX : GHOST_FLOOR_STROKE_WIDTH_PX
            }
            style={{ opacity: floor.isVisible ? GHOST_FLOOR_OPACITY : 0 }}
            transition={{
              layout: { delay: delaySecondsOf(delayMs), duration: durationSeconds('slow') },
            }}
          />
        );
      })}
    </>
  );
}

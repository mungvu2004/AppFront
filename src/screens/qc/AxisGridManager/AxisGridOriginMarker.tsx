/**
 * Điểm gốc toạ độ (0,0) trên canvas "Quản lý trục & căn tầng" — vòng tròn 10px
 * với chữ thập ở tâm, kèm nhãn "0,0".
 *
 * View THUẦN của mục D (R-60): nhận `AxisCanvasOriginViewModel` đã ở pixel qua
 * props, không tính toạ độ, không quy đổi mm↔px — `origin.pointPx` tới từ
 * `AxisGridCanvas.tsx` nguyên vẹn từ `AxisCanvasViewModel.origin`.
 *
 * ## Vì sao vẫn `--accent` dù dấu gốc không kéo trực tiếp trên canvas
 *
 * A2 dành `--accent` cho thứ tương tác được. Dấu gốc ở màn này không kéo bằng
 * chuột trên canvas (không có `onOriginDrag` nào trong hợp đồng), nhưng nó vẫn
 * là một điểm neo NGƯỜI DÙNG đổi được — qua Select "Chọn giao trục neo"
 * (`originPanel.selectLabel`) ở panel phải. Khác đường vào, cùng bản chất
 * tương tác, nên A2 không bị phá.
 *
 * ## Chuyển động 340ms
 *
 * "Đổi giao trục neo: dấu gốc CHẠY tới vị trí mới trong 340ms" — con số 340 lấy
 * từ `MOTION_DURATIONS_MS.slow` qua `durationSeconds('slow')` (R-71). Vị trí
 * chuyển bằng `x`/`y` của framer-motion (`@/components/motion`, R-39): framer
 * tự nội suy giữa lần render trước và lần render sau, không có phép hình học
 * viết tay nào ở đây. `MotionProvider` đã đặt `reducedMotion="user"` một lần ở
 * vỏ ứng dụng nên "giảm chuyển động" tự áp dụng, không cần lặp lại ở đây.
 */
import { motion } from '@/components/motion';
import { durationSeconds } from '@/lib/motion';

import type { AxisCanvasOriginViewModel } from './axisGridTypes';

const ORIGIN_DIAMETER_PX = 10;
const ORIGIN_RADIUS_PX = ORIGIN_DIAMETER_PX / 2;
const ORIGIN_STROKE_WIDTH_PX = 1;
const ORIGIN_CROSS_HALF_LENGTH_PX = ORIGIN_RADIUS_PX;
const ORIGIN_LABEL_FONT_SIZE_PX = 12;
const ORIGIN_LABEL_OFFSET_PX = 8;

/** Đúng A2: điểm neo đổi được qua Select ở panel phải (xem JSDoc đầu file). */
const ORIGIN_TOKEN = 'var(--accent)';
const ORIGIN_LABEL_TOKEN = 'var(--text-primary)';

/** `canvas.originLabel` của bảng đối chiếu S15-T4-copy.md. */
const ORIGIN_ARIA_LABEL = 'gốc toạ độ 0,0';

export interface AxisGridOriginMarkerProps {
  readonly origin: AxisCanvasOriginViewModel;
}

export function AxisGridOriginMarker({ origin }: AxisGridOriginMarkerProps) {
  return (
    <motion.g
      animate={{ x: origin.pointPx.x, y: origin.pointPx.y }}
      aria-label={ORIGIN_ARIA_LABEL}
      role="img"
      transition={{ duration: durationSeconds('slow') }}
    >
      <circle
        cx={0}
        cy={0}
        fill="var(--bg-surface)"
        r={ORIGIN_RADIUS_PX}
        stroke={ORIGIN_TOKEN}
        strokeWidth={ORIGIN_STROKE_WIDTH_PX}
      />
      <line
        stroke={ORIGIN_TOKEN}
        strokeWidth={ORIGIN_STROKE_WIDTH_PX}
        x1={-ORIGIN_CROSS_HALF_LENGTH_PX}
        x2={ORIGIN_CROSS_HALF_LENGTH_PX}
        y1={0}
        y2={0}
      />
      <line
        stroke={ORIGIN_TOKEN}
        strokeWidth={ORIGIN_STROKE_WIDTH_PX}
        x1={0}
        x2={0}
        y1={-ORIGIN_CROSS_HALF_LENGTH_PX}
        y2={ORIGIN_CROSS_HALF_LENGTH_PX}
      />
      <text
        className="select-none tabular-nums"
        dominantBaseline="middle"
        fill={ORIGIN_LABEL_TOKEN}
        fontSize={ORIGIN_LABEL_FONT_SIZE_PX}
        x={ORIGIN_RADIUS_PX + ORIGIN_LABEL_OFFSET_PX}
        y={0}
      >
        {origin.label}
      </text>
    </motion.g>
  );
}

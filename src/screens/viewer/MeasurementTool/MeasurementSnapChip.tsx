/**
 * Chip bắt điểm — con trỏ đang bắt vào cái gì, ngay lúc này.
 *
 * Đặc tả của màn đo có một điều khoản gắt hơn phần còn lại: **loại bắt điểm
 * hiện tại luôn phải được gọi tên trên màn**. Nên chip này không có nhánh nào
 * ẩn nó đi. `snap.kind === null` — con trỏ đang ở trên bề mặt trống, không bắt
 * vào đỉnh, trung điểm hay giao trục nào — vẫn hiện chip và vẫn đọc ra tình
 * trạng đó bằng `snap.label`. Chỗ duy nhất người dùng phải đoán là chỗ không có
 * chip, và đó là chỗ đặc tả cấm.
 *
 * View KHÔNG tự ghép chuỗi: `SNAP_KIND_LABELS` sống trong `measurementToolTypes.ts`
 * và hook đã tra sẵn ra `snap.label`. Ba loại (`đỉnh` · `trung điểm` ·
 * `giao trục`) là ba loại `src/domain/units/snap.ts` thật sự dò được — quyết
 * định Q1 của hợp đồng, không phải chỗ để màn này nới thêm.
 *
 * ## Chuyển động
 *
 * Khi loại bắt điểm đổi, chip **hoà tan để gọi tên loại mới** ở thời lượng
 * `instant` (120 ms). Thực hiện bằng `key` đổi theo `snap.kind`: React tháo
 * nhãn cũ và gắn nhãn mới, nên `animate-selection-enter` chạy lại từ đầu mỗi
 * lần loại đổi và không chạy khi chỉ có toạ độ con trỏ nhúc nhích.
 * `selection-enter` là `dropdown-open` ở đúng nhịp `instant` trong
 * `tailwind.config.ts` — không có con số thời lượng nào viết ở đây (R-71, mục B).
 *
 * ## Màu
 *
 * Chấm dẫn dùng `--accent` khi đang bắt được vào một loại, và `--text-muted`
 * khi không — A2 giữ màu nhấn cho thứ có ý nghĩa thao tác, còn "trên bề mặt
 * trống" là tình trạng trung tính chứ không phải một trạng thái cảnh báo, nên
 * nó không được mượn một trong ba màu trạng thái của A4.
 */
import { cn } from '@/lib/utils';

import type { SnapIndicator } from './measurementToolTypes';

/**
 * Khoá `key` khi không bắt được vào loại nào.
 *
 * `null` không dùng làm `key` được, và dùng chuỗi rỗng thì hai lần "không bắt
 * được" liên tiếp sẽ tháo–gắn lại nhãn một cách vô cớ.
 */
const NO_SNAP_KEY = 'none';

export interface MeasurementSnapChipProps {
  readonly snap: SnapIndicator;
  readonly className?: string | undefined;
}

export function MeasurementSnapChip({ snap, className }: MeasurementSnapChipProps) {
  return (
    <div
      className={cn(
        'pointer-events-none flex items-center gap-2 rounded-full bg-bg-surface/90 px-3 py-1.5 shadow-float',
        className,
      )}
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn(
          'block h-2 w-2 shrink-0 rounded-full transition-colors duration-instant',
          snap.kind === null ? 'bg-text-muted' : 'bg-accent',
        )}
      />
      <span
        className="animate-selection-enter whitespace-nowrap text-[12px] leading-none text-text-secondary"
        key={snap.kind ?? NO_SNAP_KEY}
      >
        {snap.label}
      </span>
    </div>
  );
}

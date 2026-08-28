/**
 * STUB — dãy chip tầng của màn Xử lý. Nhiệm vụ V5 thay ruột file này; chữ ký
 * giữ nguyên từ `ProcessingFloorChipsProps` (`types.ts`) để nhánh của V5 biên
 * dịch được ngay từ đầu.
 *
 * Chỉ đọc — không có hành động chọn tầng, xem ghi chú "Vì sao chưa có
 * `onSelectFloor`" ở đầu `types.ts`.
 */

import type { ProcessingFloorChipsProps } from './types';

export function ProcessingFloorChips({ floors }: ProcessingFloorChipsProps) {
  return (
    <ul aria-label="Tiến độ theo tầng" className="flex flex-wrap gap-2">
      {floors.map((floor) => (
        <li aria-current={floor.isActive ? 'true' : undefined} key={floor.id}>
          <span>{floor.label}</span> — <span>{floor.statusLabel}</span>
          {floor.objectCountLabel !== undefined ? <span> · {floor.objectCountLabel}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Dãy chip tầng của màn Xử lý — một hàng chip ngang trên đầu hai cột.
 *
 * CHỈ ĐỌC. Không có `onSelectFloor` và sẽ không có: ở màn này tầng nào đang
 * chạy là do hệ thống quyết, không phải người dùng bấm chọn (xem ghi chú "Vì
 * sao chưa có `onSelectFloor`" ở đầu `types.ts`). Vì vậy mỗi chip là một `<li>`,
 * không phải một `<button>` — và không chip nào mang màu nhấn, đúng A2: màu nhấn
 * dành cho thứ tương tác được, và chỉ nhờ nó mà biết là tương tác được.
 *
 * Chấm trạng thái lấy màu từ `processingStatusTokens.ts` (A1, A4). `statusLabel`
 * là câu chữ cho trình đọc màn hình và cho mắt thường đọc cùng lúc — chấm màu
 * không bao giờ là kênh thông tin duy nhất.
 */

import { clsx } from 'clsx';

import { STAGE_DOT_CLASS } from './processingStatusTokens';
import type { ProcessingFloorChipsProps } from './types';

const FLOORS_ARIA_LABEL = 'Tiến độ theo tầng';

export function ProcessingFloorChips({ floors }: ProcessingFloorChipsProps) {
  if (floors.length === 0) {
    return null;
  }

  return (
    <ul aria-label={FLOORS_ARIA_LABEL} className="flex flex-wrap items-center gap-2">
      {floors.map((floor) => (
        <li
          aria-current={floor.isActive ? 'true' : undefined}
          className={clsx(
            'flex items-center gap-2 rounded-[8px] border border-border-default px-3 py-1.5 text-[13px]',
            'transition-colors duration-standard',
            floor.isActive ? 'bg-bg-sunken' : 'bg-bg-surface',
          )}
          key={floor.id}
        >
          <span aria-hidden="true" className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_DOT_CLASS[floor.status])} />
          <span className="font-medium text-text-primary">{floor.label}</span>
          <span className="text-text-secondary">{floor.statusLabel}</span>
          {floor.objectCountLabel !== undefined ? (
            <>
              <span aria-hidden="true" className="text-text-muted">
                ·
              </span>
              <span className="text-text-secondary">{floor.objectCountLabel}</span>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

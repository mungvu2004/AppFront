/**
 * Tầng chưa có tỷ lệ đúng (`useScaleLock`): lý do + lối sang bước Tỷ lệ. Danh sách và thanh tra
 * cùng hiện câu này; bản vẽ và danh sách vẫn xem được, chỉ sửa/duyệt bị khoá.
 */
import { Button } from '@/components/ui/Button';

import type { WallLayerViewProps } from './types';

const OPEN_SCALE_LABEL = 'Đặt tỷ lệ';

export function WallScaleLockNotice({ lock }: { readonly lock: NonNullable<WallLayerViewProps['scaleLock']> }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-state-violation-tint px-3 py-2" role="note">
      <p className="text-caption leading-snug text-state-violation-text">{lock.reason}</p>
      <Button onClick={lock.onOpenScale} size="sm" variant="secondary">
        {OPEN_SCALE_LABEL}
      </Button>
    </div>
  );
}

/**
 * Câu 3 của màn (HOP-DONG-V6): cổng chung của tầng (`FloorReviewGate`) ở đáy cột việc.
 *
 * Màn này chỉ thêm việc của lớp đang đứng: còn tường chưa duyệt thì nút "Xem tiếp #W-xxx" mở
 * đoạn kế trong hàng đợi (cùng thứ tự danh sách và phím J — Tab không gán được: sổ phím chặn Tab,
 * bất biến A12). Lớp lỗi đọc / chưa biết tầng: không vẽ cổng.
 */

import type { QcFloorNavProps } from '../shared/QcFloorNav';
import { FloorReviewGate } from '../shared/FloorReviewGate.container';

import type { WallLayerViewProps } from './types';
import type { WallReviewQueue } from './wallReviewQueue';

/** U13: nút chỉ MỞ đoạn kế, không duyệt — chữ nói đúng việc đó (duyệt là A / "Duyệt đoạn này"). */
const NEXT_WALL_PREFIX = 'Xem tiếp';

export interface WallLayerGateProps {
  readonly panel: Pick<WallLayerViewProps, 'state' | 'onSelect'>;
  readonly queue?: WallReviewQueue | undefined;
  readonly floorNav?: Omit<QcFloorNavProps, 'layer'> | undefined;
}

export function WallLayerGate({ panel, queue, floorNav }: WallLayerGateProps) {
  if (floorNav == null || panel.state === 'error' || panel.state === 'loading') {
    return null;
  }

  const nextId = queue?.nextWallId ?? null;
  const nextLabel = queue?.nextWallLabel ?? null;

  return (
    <FloorReviewGate
      floorId={floorNav.floorId}
      inline
      projectId={floorNav.projectId}
      {...(nextId === null || nextLabel === null
        ? {}
        : { nextLabel: `${NEXT_WALL_PREFIX} ${nextLabel}`, onNext: () => panel.onSelect(nextId) })}
    />
  );
}

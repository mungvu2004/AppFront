import { Badge } from '@/components/ui/Badge';

import { QcPanelHead } from '../shared/QcPanelHead';

import type { RoomLabelReviewProps } from './roomLabelTypes';

/*
 * Ba câu của màn (HOP-DONG-V6, demo Z/S-20): đầu panel trái nói làm gì + đang ở đâu, cổng
 * trên thanh bước nói sang Mô hình 3D bằng cách nào. Cả ba đọc CÙNG `roomProgress` và
 * `layerGate` của hook. Vòng tường hở là CẢNH BÁO (đặc tả), không phải điều kiện của cổng.
 */

/* Thanh bước đã nói "3 Kiểm tra tầng": eyebrow ngắn để một dòng trong panel 280. */
const TITLE = 'Duyệt phòng';
const BADGE_DONE = 'Đã duyệt xong';
const BADGE_TODO = 'Chưa xong';
const BADGE_EMPTY = 'Chưa có phòng';
const NO_ROOM_SENTENCE = 'Tầng chưa có phòng khép kín';

type HeadProps = Pick<RoomLabelReviewProps, 'roomProgress' | 'saveStatus' | 'state' | 'summary'>;

export function RoomLabelPanelHead({ roomProgress, saveStatus, state, summary }: HeadProps) {
  const reviewed = roomProgress?.reviewed ?? 0;
  const total = roomProgress?.total ?? summary.roomCount;

  return (
    <QcPanelHead
      eyebrow={null}
      status={
        state === 'loading' ? null : (
          <>
            <Badge variant={total === 0 ? 'neutral' : reviewed === total ? 'verified' : 'attention'}>
              {total === 0 ? BADGE_EMPTY : reviewed === total ? BADGE_DONE : BADGE_TODO}
            </Badge>
            <span className="text-text-secondary">
              {total === 0 ? NO_ROOM_SENTENCE : `${reviewed}/${total} phòng đã duyệt, sàn ${summary.totalAreaText}`}
            </span>
            {saveStatus == null ? null : <span className="text-text-muted">{saveStatus}</span>}
          </>
        )
      }
      title={TITLE}
    />
  );
}

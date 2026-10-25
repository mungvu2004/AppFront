import { ArrowRight } from 'lucide-react';

import { FlowGate } from '@/components/shell/FlowGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { QcPanelHead } from '../shared/QcPanelHead';

import type { RoomLabelReviewProps } from './roomLabelTypes';

/*
 * Ba câu của màn (HOP-DONG-V6, demo Z/S-20): đầu panel trái nói làm gì + đang ở đâu, cổng
 * trên thanh bước nói sang Mô hình 3D bằng cách nào. Cả ba đọc CÙNG `roomProgress` và
 * `layerGate` của hook. Vòng tường hở là CẢNH BÁO (đặc tả), không phải điều kiện của cổng.
 */

/* Thanh bước đã nói "3 Kiểm tra tầng": eyebrow ngắn để một dòng trong panel 280. */
const EYEBROW = 'Kiểm tra tầng · lớp 3/3';
const TITLE = 'Duyệt tên phòng';
const BADGE_DONE = 'Đã duyệt xong';
const BADGE_TODO = 'Chưa xong';
const BADGE_EMPTY = 'Chưa có phòng';
const PROGRESS_LABEL = 'Phòng đã duyệt';
const NO_ROOM_SENTENCE = 'Tầng chưa có phòng khép kín';
const NEXT_LABEL = 'Duyệt tiếp';
const OPEN_WALLS_LABEL = 'Duyệt nốt tường';
const OPEN_OBJECTS_LABEL = 'Duyệt nốt cửa';
const OPEN_VIEWER_LABEL = 'Sang Mô hình 3D';

type HeadProps = Pick<RoomLabelReviewProps, 'roomProgress' | 'saveStatus' | 'state' | 'summary'>;

export function RoomLabelPanelHead({ roomProgress, saveStatus, state, summary }: HeadProps) {
  const reviewed = roomProgress?.reviewed ?? 0;
  const total = roomProgress?.total ?? summary.roomCount;

  return (
    <QcPanelHead
      eyebrow={EYEBROW}
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

type GateProps = Pick<
  RoomLabelReviewProps,
  'layerGate' | 'nextPendingRoom' | 'onNavigateToWalls' | 'onOpenLayer' | 'onSelect' | 'roomProgress' | 'state'
>;

/** Cổng: Tường · Cửa · Phòng + MỘT nút. Thiếu gì thì nút phụ dẫn tới đó; đủ thì nút chính sang Mô hình 3D. */
export function RoomLabelGate({ layerGate, nextPendingRoom, onNavigateToWalls, onOpenLayer, onSelect, roomProgress, state }: GateProps) {
  if (state === 'loading' || roomProgress === undefined) {
    return null;
  }

  const { reviewed, total } = roomProgress;
  const roomsDone = total > 0 && reviewed === total;
  const wallsDone = layerGate?.walls ?? false;
  const objectsDone = layerGate?.objects ?? false;
  const openLayer = onOpenLayer ?? null;

  return (
    <FlowGate
      conditions={[
        { label: 'Tường', done: wallsDone },
        { label: 'Cửa', done: objectsDone },
        { label: 'Phòng', done: roomsDone },
      ]}
      done={reviewed}
      progressLabel={PROGRESS_LABEL}
      total={total}
    >
      {!roomsDone && nextPendingRoom != null ? (
        <Button aria-keyshortcuts="J" onClick={() => onSelect(nextPendingRoom.id)} shortcut="J" size="sm" variant="secondary">
          {`${NEXT_LABEL} ${nextPendingRoom.codeLabel}`}
        </Button>
      ) : !wallsDone || !roomsDone ? (
        /* Chưa có phòng nào: phòng sinh ra từ vòng tường kín, nên việc còn thiếu nằm ở lớp tường. */
        <Button onClick={() => onNavigateToWalls()} size="sm" variant="secondary">
          {OPEN_WALLS_LABEL}
        </Button>
      ) : openLayer === null ? null : !objectsDone ? (
        <Button onClick={() => openLayer('objects')} size="sm" variant="secondary">
          {OPEN_OBJECTS_LABEL}
        </Button>
      ) : (
        <Button iconAfter={<ArrowRight aria-hidden="true" size={16} />} onClick={() => openLayer('viewer')} size="sm" variant="primary">
          {OPEN_VIEWER_LABEL}
        </Button>
      )}
    </FlowGate>
  );
}

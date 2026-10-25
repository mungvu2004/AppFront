import { ArrowRight } from 'lucide-react';

import { FlowGate } from '@/components/shell/FlowGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import { QcPanelHead } from '../shared/QcPanelHead';

import type { ObjectLayerReviewModel } from './objectLayerTypes';

/*
 * Ba câu của màn (HOP-DONG-V6, demo Z/S-16): đầu panel trái nói làm gì + đang ở đâu,
 * cổng trên thanh bước nói sang Phòng bằng cách nào. Cả ba đọc CÙNG `reviewCounter`
 * và `layerGate` của hook (một nguồn trạng thái, NGUYEN-TAC-BO-CUC §1).
 */

/* Thanh bước đã nói "3 Kiểm tra tầng": eyebrow ngắn để một dòng trong panel 280. */
const EYEBROW = 'Kiểm tra tầng · lớp 2/3';
const TITLE = 'Duyệt cửa và nội thất';
const BADGE_DONE = 'Đã duyệt xong';
const BADGE_TODO = 'Chưa xong';
const BADGE_EMPTY = 'Chưa có đối tượng';
const LOADING_LABEL = 'Đang đọc lớp đối tượng…';
const PROGRESS_LABEL = 'Đối tượng đã duyệt';
const NEXT_LABEL = 'Duyệt tiếp';
const OPEN_ROOMS_LABEL = 'Xong cửa, sang Phòng';
const OPEN_WALLS_LABEL = 'Duyệt nốt tường';

export function ObjectLayerPanelHead({ model }: { readonly model: ObjectLayerReviewModel }) {
  const { reviewed, total } = model.reviewCounter;
  const isLoading = model.state === 'loading';

  return (
    <QcPanelHead
      eyebrow={EYEBROW}
      status={
        isLoading ? (
          <span>{LOADING_LABEL}</span>
        ) : (
          <>
            <Badge variant={total === 0 ? 'neutral' : reviewed === total ? 'verified' : 'attention'}>
              {total === 0 ? BADGE_EMPTY : reviewed === total ? BADGE_DONE : BADGE_TODO}
            </Badge>
            <span className="text-text-secondary">
              <span aria-label={model.reviewProgressLabel}>{model.reviewProgressLabel}</span>
              {model.partialNotice === null ? null : `, ${model.partialNotice}`}
            </span>
            {model.saveLabel == null ? null : <span className="text-text-muted">{model.saveLabel}</span>}
          </>
        )
      }
      title={TITLE}
    />
  );
}

/** Cổng: Tường · Cửa · Phòng + MỘT nút. Chưa xong → nút phụ dẫn tới mục còn thiếu; xong → nút chính sang Phòng. */
export function ObjectLayerGate({ model }: { readonly model: ObjectLayerReviewModel }) {
  const { reviewed, total } = model.reviewCounter;
  const objectsDone = reviewed === total;
  const wallsDone = model.layerGate?.walls ?? false;
  const roomsDone = model.layerGate?.rooms ?? false;
  const openLayer = model.onOpenLayer ?? null;
  const next = model.nextPending ?? null;

  if (model.state === 'loading') {
    return null;
  }

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
      {!objectsDone && next !== null ? (
        <Button aria-keyshortcuts="J" onClick={() => model.onSelect(next.id)} shortcut="J" size="sm" variant="secondary">
          {`${NEXT_LABEL} ${next.codeLabel}`}
        </Button>
      ) : openLayer === null ? null : !wallsDone ? (
        <Button onClick={() => openLayer('walls')} size="sm" variant="secondary">
          {OPEN_WALLS_LABEL}
        </Button>
      ) : (
        <Button iconAfter={<ArrowRight aria-hidden="true" size={16} />} onClick={() => openLayer('rooms')} size="sm" variant="primary">
          {OPEN_ROOMS_LABEL}
        </Button>
      )}
    </FlowGate>
  );
}

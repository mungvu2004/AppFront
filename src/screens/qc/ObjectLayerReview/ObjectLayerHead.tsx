import { Badge } from '@/components/ui/Badge';

import { FloorReviewGate } from '../shared/FloorReviewGate.container';
import { QcPanelHead } from '../shared/QcPanelHead';

import type { ObjectLayerReviewViewProps } from './ObjectLayerReview';
import type { ObjectLayerReviewModel } from './objectLayerTypes';

/*
 * Ba câu của màn (HOP-DONG-V6, demo Z/S-16): đầu panel trái nói làm gì + đang ở đâu,
 * cổng chung của tầng (`FloorReviewGate`) nói bước tiếp. Cả hai đọc CÙNG `reviewCounter`
 * của hook (một nguồn trạng thái, NGUYEN-TAC-BO-CUC §1).
 */

const TITLE = 'Duyệt cửa và nội thất';
const BADGE_DONE = 'Đã duyệt xong';
const BADGE_TODO = 'Chưa xong';
const BADGE_EMPTY = 'Chưa có đối tượng';
const LOADING_LABEL = 'Đang đọc lớp đối tượng…';
const NEXT_LABEL = 'Duyệt tiếp';

export function ObjectLayerPanelHead({ model }: { readonly model: ObjectLayerReviewModel }) {
  const { reviewed, total } = model.reviewCounter;
  const isLoading = model.state === 'loading';

  return (
    <QcPanelHead
      eyebrow={null}
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

/** Cổng chung của tầng; nút "Duyệt tiếp" mở mục kế tiếp của lớp này. */
export function ObjectLayerGate({ model }: { readonly model: ObjectLayerReviewViewProps }) {
  const next = model.nextPending ?? null;
  const nav = model.floorNav;

  if (model.state === 'loading' || nav == null) {
    return null;
  }

  return (
    <FloorReviewGate
      floorId={nav.floorId}
      projectId={nav.projectId}
      {...(next === null ? {} : { nextLabel: `${NEXT_LABEL} ${next.codeLabel}`, onNext: () => model.onSelect(next.id) })}
    />
  );
}

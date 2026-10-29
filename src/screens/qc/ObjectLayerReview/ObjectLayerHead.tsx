import { FloorReviewGate } from '../shared/FloorReviewGate.container';

import type { ObjectLayerReviewViewProps } from './ObjectLayerReview';

/* Cổng chung của tầng (`FloorReviewGate`) ở đáy cột việc nói bước tiếp (HOP-DONG-V6). */

const NEXT_LABEL = 'Duyệt tiếp';

/** Cổng chung của tầng; nút "Duyệt tiếp" mở mục kế tiếp của lớp này. */
export function ObjectLayerGate({ model }: { readonly model: ObjectLayerReviewViewProps }) {
  const next = model.nextPending ?? null;
  const nav = model.floorNav;

  if (model.state === 'loading') {
    return null;
  }

  return (
    <FloorReviewGate
      floorId={nav.floorId}
      inline
      projectId={nav.projectId}
      {...(next === null ? {} : { nextLabel: `${NEXT_LABEL} ${next.codeLabel}`, onNext: () => model.onSelect(next.id) })}
    />
  );
}

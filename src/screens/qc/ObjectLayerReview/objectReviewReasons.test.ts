import { describe, expect, it } from 'vitest';

import { objectReasonOf, objectReasonRank } from './objectReviewReasons';

const row = (patch: Partial<{ isReviewed: boolean; isLowConfidence: boolean; isOrphan: boolean }>) => ({
  isReviewed: false,
  isLowConfidence: false,
  isOrphan: false,
  ...patch,
});

describe('Bố cục L23: lý do máy nghi của cửa và nội thất', () => {
  it('chưa chắc loại đứng trước chưa gắn tường; đã duyệt không còn lý do', () => {
    expect(objectReasonOf(row({ isLowConfidence: true, isOrphan: true }))).toBe('uncertain');
    expect(objectReasonOf(row({ isOrphan: true }))).toBe('orphan');
    expect(objectReasonOf(row({ isReviewed: true, isOrphan: true }))).toBeNull();
  });

  it('hạng: chưa chắc < chưa gắn < không lý do < đã duyệt', () => {
    const ranks = [row({ isReviewed: true }), row({}), row({ isOrphan: true }), row({ isLowConfidence: true })].map(objectReasonRank);
    expect(ranks).toEqual([3, 2, 1, 0]);
  });
});

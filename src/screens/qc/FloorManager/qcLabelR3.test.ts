import { describe, expect, it } from 'vitest';

import { FLOOR_COLUMN_LABELS, FLOOR_QC_SCORE_HINT } from './floorManagerTypes';

describe('R-5: cột điểm không trùng tên "chất lượng"', () => {
  it('nhãn là điểm luật và có chú thích công thức', () => {
    expect(FLOOR_COLUMN_LABELS.qc).not.toMatch(/chất lượng/i);
    expect(FLOOR_QC_SCORE_HINT).toContain('100 − 8');
  });
});

import { describe, expect, it } from 'vitest';

import { summaryOf } from './thicknessStandardizationGateway';
import type { ThicknessSegmentRow } from './thicknessTypes';

const row = (measuredMm: number, exceedsTolerance: boolean): ThicknessSegmentRow =>
  ({ normalizedGroup: 110, measuredMm, exceedsTolerance }) as unknown as ThicknessSegmentRow;

describe('R-3: ô "Trong dung sai nhóm chuẩn" + "Lệch quá dung sai" + cột = tổng', () => {
  it('tường 116 mm (chuẩn 110, lệch 6 ≤ 30) được đếm, không rơi khỏi mọi ô', () => {
    const summary = summaryOf([row(116, false), row(110, false), row(185, true)]);

    expect(summary.normalizedCount).toBe(2);
    expect(summary.exceedingToleranceCount).toBe(1);
    expect(summary.normalizedCount + summary.exceedingToleranceCount + summary.concreteColumnCount).toBe(
      summary.segmentCount,
    );
  });
});

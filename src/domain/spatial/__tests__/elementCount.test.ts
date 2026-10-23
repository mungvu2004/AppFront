import { describe, expect, it } from 'vitest';

import { countElements, hasElements } from '../elementCount';
import type { NormalizedSpatial } from '../normalize';

const graphWith = (byKind: Partial<Record<string, readonly string[]>>): NormalizedSpatial =>
  ({ byKind: { level: [], wall: [], opening: [], furniture: [], room: [], axis: [], dimension: [], ...byKind } }) as unknown as NormalizedSpatial;

describe('countElements (R-1, S-3)', () => {
  it('đếm tường + ô mở + đồ đạc + phòng, bỏ tầng/trục/kích thước', () => {
    const graph = graphWith({ level: ['l1'], wall: ['w1', 'w2'], opening: ['o1'], furniture: ['f1'], room: ['r1'], axis: ['a1'], dimension: ['d1'] });
    expect(countElements(graph)).toBe(5);
    expect(hasElements(graph)).toBe(true);
  });

  it('dự án chỉ có tầng, chưa có bản vẽ: 0 đối tượng', () => {
    expect(countElements(graphWith({ level: ['l1', 'l2'] }))).toBe(0);
    expect(hasElements(graphWith({ level: ['l1'] }))).toBe(false);
    expect(hasElements(null)).toBe(false);
  });
});

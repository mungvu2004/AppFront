import { describe, expect, it } from 'vitest';

import { fixTargetOf } from './fixPath';

describe('fixTargetOf (N3-08)', () => {
  it('đưa phòng tới lớp Phòng, tường tới lớp Tường, trên đúng tầng', () => {
    expect(fixTargetOf('p1', 'L-1', 'R-000001ABCD')).toEqual({
      path: '/projects/p1/floors/L-1/layers/rooms?select=R-000001ABCD',
      layerLabel: 'Phòng',
    });
    expect(fixTargetOf('p1', 'L-1', 'W-000005ABCD')?.path).toBe('/projects/p1/floors/L-1/layers/walls?wall=W-000005ABCD');
  });

  it('không biết tầng hoặc loại thì không có lối', () => {
    expect(fixTargetOf('p1', null, 'R-000001ABCD')).toBeNull();
    expect(fixTargetOf('p1', 'L-1', 'xyz')).toBeNull();
  });
});

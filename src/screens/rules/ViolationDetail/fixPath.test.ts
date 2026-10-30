import { describe, expect, it } from 'vitest';

import { fixActionLabelOf, fixTargetOf } from './fixPath';

describe('fixTargetOf (N3-08)', () => {
  it('đưa phòng tới lớp Phòng, tường tới lớp Tường, trên đúng tầng', () => {
    expect(fixTargetOf('p1', 'L-1', 'R-000001ABCD')).toEqual({
      path: '/projects/p1/floors/L-1/layers/rooms?select=R-000001ABCD',
      layerLabel: 'Phòng',
    });
    expect(fixTargetOf('p1', 'L-1', 'W-000005ABCD')?.path).toBe('/projects/p1/floors/L-1/layers/walls?wall=W-000005ABCD');
  });

  it('tên lớp lấy từ FLOOR_LAYERS; lớp không đọc ?select= thì chỉ mở lớp (RV5 #5, #6)', () => {
    expect(fixTargetOf('p1', 'L-1', 'A-000001ABCD')).toEqual({ path: '/projects/p1/floors/L-1/layers/grids', layerLabel: 'Trục' });
    expect(fixTargetOf('p1', 'L-1', 'M-000001ABCD')?.path).toBe('/projects/p1/floors/L-1/layers/dimensions');
  });

  it('không biết tầng hoặc loại thì không có lối', () => {
    expect(fixTargetOf('p1', null, 'R-000001ABCD')).toBeNull();
    expect(fixTargetOf('p1', 'L-1', 'xyz')).toBeNull();
  });

  it('phòng thiếu cửa đi: nút nói "Thêm cửa đi" và mở lớp Cửa và nội thất (P03)', () => {
    expect(fixActionLabelOf('ROOM-NO-DOOR')).toBe('Thêm cửa đi');
    expect(fixActionLabelOf('WALL-X')).toBe('Sửa');
    expect(fixTargetOf('p1', 'L-1', 'R-000001ABCD', 'ROOM-NO-DOOR')?.path).toBe('/projects/p1/floors/L-1/layers/objects');
  });
});

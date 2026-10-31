import { describe, expect, it } from 'vitest';

import { CUT_HEIGHT_M, cutPlaneY, isCutFaceMesh, lowCutActive, WALL_BATCH_MESH_NAME } from './cut';

describe('cut', () => {
  it('chỉ chế độ "cắt" bật cắt thấp; "cao đủ" và "thấp" giữ nguyên', () => {
    expect(lowCutActive('cutaway')).toBe(true);
    expect(lowCutActive('up')).toBe(false);
    expect(lowCutActive('down')).toBe(false);
    expect(lowCutActive('translucent')).toBe(false);
  });

  it('mặt cắt ở 1,0 m trên sàn tầng', () => {
    expect(CUT_HEIGHT_M).toBe(1);
    expect(cutPlaneY(0)).toBe(1);
    expect(cutPlaneY(3.2)).toBeCloseTo(4.2);
  });

  it('tô mặt cắt cho tường lẻ (kể cả vách) và lưới gộp tường, không cho cửa/đồ', () => {
    const walls = new Set(['w1', 'partition']);
    expect(isCutFaceMesh('partition', '', walls)).toBe(true);
    expect(isCutFaceMesh(undefined, WALL_BATCH_MESH_NAME, walls)).toBe(true);
    expect(isCutFaceMesh('door1', 'door', walls)).toBe(false);
    expect(isCutFaceMesh(undefined, 'item', walls)).toBe(false);
  });
});

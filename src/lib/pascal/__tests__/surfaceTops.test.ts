import { afterEach, describe, expect, it } from 'vitest';

import { CATALOG_MODELS, setRealismModels, topFractionOf } from '../furnitureCatalog';
import SURFACE_TOPS from '../surfaceTops.json';

/** Mặt đặt đồ (mét trên đáy mẫu) = tỉ lệ đo × chiều cao catalog. */
const topM = (folder: string): number => (topFractionOf(folder) ?? NaN) * (CATALOG_MODELS[folder]?.dimensions[1] ?? NaN);

describe('surfaceTops.json (scripts/realism-assets/surface-tops.mjs)', () => {
  afterEach(() => setRealismModels(false));

  it('mặt đo của các mẫu chủ đã biết nằm trong khoảng hợp lý', () => {
    expect(topM('dining-table')).toBeGreaterThan(0.65);
    expect(topM('dining-table')).toBeLessThan(0.75);
    expect(topM('coffee-table')).toBeGreaterThan(0.25);
    expect(topM('coffee-table')).toBeLessThan(0.31);
    // Nệm giường thấp hơn đỉnh đầu giường; đệm ngồi sofa thấp hơn tựa lưng.
    expect(topM('double-bed')).toBeGreaterThan(0.35);
    expect(topM('double-bed')).toBeLessThan(0.5);
    expect(topM('sofa')).toBeGreaterThan(0.3);
    expect(topM('sofa')).toBeLessThan(0.5);
  });

  it('swap realism dùng số đo của file thật; khớp ±2 cm số tay cũ (bàn ăn 0,63, tủ bếp 0,9)', () => {
    setRealismModels(true);
    expect(Math.abs(topM('dining-table') - 0.63)).toBeLessThan(0.02);
    expect(Math.abs(topM('kitchen-cabinet') - 0.9)).toBeLessThan(0.02);
    expect(Math.abs(topM('kitchen') - 0.9)).toBeLessThan(0.02);
    expect(topM('coffee-table')).toBeGreaterThan(0.38);
    expect(topM('sofa')).toBeGreaterThan(0.3);
    expect(topM('sofa')).toBeLessThan(0.5);
  });

  it('`topY` tay vẫn thắng số đo (tủ bếp Pascal)', () => {
    expect(topM('kitchen-cabinet')).toBeCloseTo(0.9, 3);
    expect((SURFACE_TOPS as Record<string, number>)['kitchen-cabinet']).toBeGreaterThan(0.95);
  });
});

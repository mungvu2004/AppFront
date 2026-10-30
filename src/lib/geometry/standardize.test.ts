import { describe, expect, it } from 'vitest';

import { STANDARD_THICKNESSES_MM } from '../../domain/walls/cleanup';
import { CONCRETE_COLUMN_THRESHOLD_MM, standardTierRangeOf, standardizeThickness } from './standardize';

/* Bậc gần nhất của danh mục máy chủ, hoà lấy số nhỏ hơn (AppBack geometry.py:199-200). */
describe('standardize.ts', () => {
  it('mỗi bậc danh mục giữ nguyên', () => {
    for (const mm of STANDARD_THICKNESSES_MM) expect(standardizeThickness(mm).standardized).toBe(mm);
  });

  it('bắt về bậc gần nhất, hoà lấy số nhỏ hơn', () => {
    expect(standardizeThickness(110).standardized).toBe(100);
    expect(standardizeThickness(125).standardized).toBe(100);
    expect(standardizeThickness(195).standardized).toBe(200);
    expect(standardizeThickness(210).standardized).toBe(200);
    expect(standardizeThickness(330).standardized).toBe(300);
    expect(standardizeThickness(350).standardized).toBe(300);
  });

  it('trên ngưỡng là cột BTCT', () => {
    expect(standardizeThickness(CONCRETE_COLUMN_THRESHOLD_MM).standardized).toBe(400);
    expect(standardizeThickness(CONCRETE_COLUMN_THRESHOLD_MM + 1).standardized).toBe('CONCRETE_COLUMN');
  });

  it('giữ số đo gốc', () => {
    expect(standardizeThickness(200).original_mm).toBe(200);
  });
});

describe('standardTierRangeOf', () => {
  it('khoảng của mỗi bậc khớp đúng standardizeThickness ở hai biên', () => {
    for (const tier of STANDARD_THICKNESSES_MM) {
      const { fromMm, toMm } = standardTierRangeOf(tier);
      expect(standardizeThickness(toMm).standardized).toBe(tier);
      expect(standardizeThickness(toMm + 1).standardized).not.toBe(tier);
      if (fromMm !== null) {
        expect(standardizeThickness(fromMm).standardized).toBe(tier);
        expect(standardizeThickness(fromMm - 1).standardized).not.toBe(tier);
      }
    }
  });

  it('bậc nhỏ nhất không có biên dưới, bậc lớn nhất dừng ở ngưỡng cột', () => {
    expect(standardTierRangeOf(100)).toEqual({ fromMm: null, toMm: 125 });
    expect(standardTierRangeOf(150)).toEqual({ fromMm: 126, toMm: 175 });
    expect(standardTierRangeOf(400)).toEqual({ fromMm: 351, toMm: CONCRETE_COLUMN_THRESHOLD_MM });
  });
});

/* U19: tường máy đo dư một nét vẽ — lấy bậc lớn nhất không vượt số đo + 15 mm. */
describe("standardizeThickness(source: 'ai')", () => {
  it('261 → 220, 330 → 300, 240 → 220 (không còn 261 → 300)', () => {
    expect(standardizeThickness(261, 'ai').standardized).toBe(220);
    expect(standardizeThickness(330, 'ai').standardized).toBe(300);
    expect(standardizeThickness(240, 'ai').standardized).toBe(220);
    expect(standardizeThickness(285, 'ai').standardized).toBe(300);
    expect(standardizeThickness(70, 'ai').standardized).toBe(100);
    expect(standardizeThickness(CONCRETE_COLUMN_THRESHOLD_MM + 1, 'ai').standardized).toBe('CONCRETE_COLUMN');
  });

  it('khoảng của mỗi bậc khớp đúng luật máy đo ở hai biên', () => {
    expect(standardTierRangeOf(220, 'ai')).toEqual({ fromMm: 205, toMm: 284 });
    for (const tier of STANDARD_THICKNESSES_MM) {
      const { fromMm, toMm } = standardTierRangeOf(tier, 'ai');
      expect(standardizeThickness(toMm, 'ai').standardized).toBe(tier);
      expect(standardizeThickness(toMm + 1, 'ai').standardized).not.toBe(tier);
      if (fromMm !== null) {
        expect(standardizeThickness(fromMm, 'ai').standardized).toBe(tier);
        expect(standardizeThickness(fromMm - 1, 'ai').standardized).not.toBe(tier);
      }
    }
  });
});

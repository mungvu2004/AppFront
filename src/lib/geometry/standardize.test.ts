import { describe, expect, it } from 'vitest';

import { STANDARD_THICKNESSES_MM } from '../../domain/walls/cleanup';
import { CONCRETE_COLUMN_THRESHOLD_MM, standardizeThickness } from './standardize';

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

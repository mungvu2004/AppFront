import { describe, expect, it } from 'vitest';

import { STANDARD_THICKNESSES_MM } from '@/domain/walls/cleanup';

import { WALL_THICKNESS_CHOICES } from './types';
import { countWallBands, wallThicknessBandOf, wallThicknessFillToken } from './wallLayerHatch';
import { isStandardThickness } from './wallLayerReviewGateway';

/* Một thang độ dày với máy chủ (AppBack `pipeline_build/constants.py:5` = `cleanup.ts:70`). */
describe('thang độ dày màn rà soát tường = danh mục máy chủ', () => {
  it('nút chọn nhanh đúng sáu bậc của danh mục', () => {
    expect([...WALL_THICKNESS_CHOICES]).toEqual([...STANDARD_THICKNESSES_MM]);
  });

  it.each([100, 150, 200, 220, 300, 400])('%i mm không bị lọc là "không chuẩn"', (mm) => {
    expect(isStandardThickness(mm)).toBe(true);
    expect(wallThicknessBandOf(mm)).toBe(mm);
  });

  it('độ dày ngoài danh mục vẫn bị báo không chuẩn', () => {
    expect(isStandardThickness(40)).toBe(false);
    expect(isStandardThickness(600)).toBe(false);
    expect(wallThicknessBandOf(600)).toBeNull();
  });

  it('[BUG-416] tường 260 mm ngoài danh mục được đếm vào mục "Khác" của chú giải', () => {
    const { bands, unbanded } = countWallBands([100, 200, 260, 400]);
    expect(unbanded).toBe(1);
    expect([...bands.keys()]).toEqual([110, 220, 330]);
  });

  it('chú giải màu: sáu bậc gộp vào ba token mỏng / vừa / dày', () => {
    expect(wallThicknessFillToken(100)).toBe(wallThicknessFillToken(150));
    expect(wallThicknessFillToken(200)).toBe(wallThicknessFillToken(220));
    expect(wallThicknessFillToken(300)).toBe(wallThicknessFillToken(400));
    expect(new Set([100, 200, 400].map(wallThicknessFillToken)).size).toBe(3);
  });
});

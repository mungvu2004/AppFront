import { STANDARD_THICKNESSES_MM } from '../../domain/walls/cleanup';
import type { WallThickness } from '../../types/spatial';

export interface StandardizeResult {
  original_mm: number;
  standardized: WallThickness;
}

/**
 * Trên ngưỡng này là cột BTCT. Ngưỡng cũ 350 nằm dưới bậc 400 của danh mục, nên dời lên
 * 400 + 50 (nửa bước 300→400) để bậc 400 vẫn bắt được.
 */
export const CONCRETE_COLUMN_THRESHOLD_MM = 450;

/**
 * Bắt độ dày đo về bậc gần nhất của `STANDARD_THICKNESSES_MM`; hoà lấy số nhỏ hơn — đúng
 * như máy chủ (AppBack `apps/worker/pipeline_build/geometry.py:199-200`). Trên
 * {@link CONCRETE_COLUMN_THRESHOLD_MM} là `CONCRETE_COLUMN`.
 */
export function standardizeThickness(rawThicknessMm: number): StandardizeResult {
  const standardized: WallThickness =
    rawThicknessMm > CONCRETE_COLUMN_THRESHOLD_MM
      ? 'CONCRETE_COLUMN'
      : STANDARD_THICKNESSES_MM.reduce((best, value) =>
          Math.abs(value - rawThicknessMm) < Math.abs(best - rawThicknessMm) ? value : best,
        );

  return { original_mm: rawThicknessMm, standardized };
}

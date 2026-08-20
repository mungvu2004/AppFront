import type { WallThickness } from '../../types/spatial';

export interface StandardizeResult {
  original_mm: number;
  standardized: WallThickness;
}

/**
 * Standardizes a raw thickness to the nearest domain-allowed thickness:
 * 110, 220, 330, or CONCRETE_COLUMN (if > 330).
 * Thresholds:
 * - < 165: 110
 * - 165 to < 275: 220
 * - 275 to <= 350: 330
 * - > 350: CONCRETE_COLUMN
 */
export function standardizeThickness(rawThicknessMm: number): StandardizeResult {
  let standardized: WallThickness;

  if (rawThicknessMm < 165) {
    standardized = 110;
  } else if (rawThicknessMm < 275) {
    standardized = 220;
  } else if (rawThicknessMm <= 350) {
    standardized = 330;
  } else {
    standardized = 'CONCRETE_COLUMN';
  }

  return {
    original_mm: rawThicknessMm,
    standardized,
  };
}

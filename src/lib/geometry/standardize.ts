import { roundWallThickness } from '../../domain/walls/thicknessTolerance';
import type { WallThickness } from '../../types/spatial';

export interface StandardizeResult {
  original_mm: number;
  standardized: WallThickness;
}

/**
 * Standardizes a raw thickness to a domain-allowed thickness, following
 * `roundWallThickness` (src/domain/walls/thicknessTolerance.ts):
 * - < 166: 110 (below 80 mm the domain flags manual review; the type has no slot for that)
 * - 166 to < 276: 220
 * - 276 to < 400: 330
 * - >= 400: CONCRETE_COLUMN (manual review)
 */
export function standardizeThickness(rawThicknessMm: number): StandardizeResult {
  const rounded = roundWallThickness(rawThicknessMm);
  const standardized: WallThickness =
    rounded === 'tooThick' ? 'CONCRETE_COLUMN' : rounded === 'tooThin' ? 110 : rounded;

  return {
    original_mm: rawThicknessMm,
    standardized,
  };
}

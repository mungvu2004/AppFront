/**
 * Computes the scale ratio in mm/px given a known length in mm and its measured length in px.
 * Target is 12 mm/px with 4800 / 400.
 */
export function computeScaleRatio(knownMm: number, measuredPx: number): number {
  if (measuredPx <= 0) return 0;
  return Number((knownMm / measuredPx).toFixed(2));
}

/**
 * Converts pixels to millimeters using the given scale ratio.
 */
export function pxToMm(px: number, scaleRatioMmPerPx: number): number {
  return px * scaleRatioMmPerPx;
}

/**
 * Converts millimeters to pixels using the given scale ratio.
 */
export function mmToPx(mm: number, scaleRatioMmPerPx: number): number {
  if (scaleRatioMmPerPx <= 0) return 0;
  return mm / scaleRatioMmPerPx;
}

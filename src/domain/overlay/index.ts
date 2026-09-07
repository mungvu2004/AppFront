/**
 * Comparing a scanned drawing against the model it was traced into.
 *
 * Three steps, in order, and each one is a separate module because each answers
 * a separate question:
 *
 * 1. `transform.ts` — where does the scan sit in the model's space?
 * 2. `deviation.ts` — once it sits there, where do the two disagree?
 * 3. `metrics.ts` — reduced to the three numbers a reviewer signs off against.
 *
 * Everything here is domain-facing: lengths are labelled `Millimetres`,
 * coordinates are `PointMm`, and there is not one reader-facing string or one
 * formatted number in the whole folder. The screen's own `types.ts` is the other
 * half of that split — strings already in Vietnamese, coordinates as `0..1`
 * ratios (A15, R-60) — and `overlayComparisonGateway.ts` is the one place the
 * two meet.
 */

export { createOverlayTransform, imagePixelToModelMm, modelMmToImagePixel } from './transform';
export type { OverlayTransform, OverlayTransformInput, PointPx } from './transform';

export { compareDrawingToModel } from './deviation';
export type { DeviationRegion, DeviationSubjectId, DrawingToModelInput } from './deviation';

export { countOverTolerance, summariseDeviations } from './metrics';
export type { MatchMetrics } from './metrics';

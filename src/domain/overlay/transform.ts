/**
 * Placing a scanned drawing into the model's own space.
 *
 * The comparison screen exists so a team lead can see the scan and the model at
 * the same time and judge whether they agree. That is only meaningful once both
 * live in one coordinate space, and this module is the conversion that gets
 * them there — the ONE piece of new geometry in the overlay work. Everything
 * downstream (`deviation.ts`) measures with `measureDistance` (M-15) instead of
 * writing arithmetic of its own.
 *
 * ## Why not `alignFloors`
 *
 * `axes/alignFloors.ts` already aligns one plan to another, and it is the wrong
 * tool here: its `FloorTransform.scale` is declared as the literal `1`, with the
 * comment "Always 1. Floors are never stretched to fit". Two storeys of one
 * building are drawn at one scale by construction, so that literal is correct
 * there. A scan is not: its scale is a mm-per-pixel ratio read off a dimension
 * string (M-02), never 1. The literal type cannot hold it, so this is a separate
 * transform rather than a widening of that one.
 *
 * ## What the transform is, and what it deliberately is not
 *
 * It is a **similarity**: one uniform scale, one rotation, one translation, in
 * that order. That is exactly what placing a photograph of a drawing needs —
 * the camera or scanner changes how big the sheet is and which way up it sits,
 * and nothing else.
 *
 * It is **not** a mirroring, and not a per-axis scale. Both are excluded on
 * purpose:
 *
 * - A mirrored plan is a different building, not a differently-placed one; a
 *   flip that arrives silently through an alignment would turn a left-handed
 *   flat into a right-handed one with no dialogue anywhere. The three fields of
 *   {@link OverlayTransform} cannot express one, which is the point.
 * - Two different scales per axis would stretch the sheet, and a stretched
 *   drawing no longer measures anything: a 3 000 mm wall would read 3 000 across
 *   and 3 100 up. One ratio, from M-02, or none.
 *
 * The image's pixel axes are therefore carried through as they are: `x` to the
 * right, `y` in the same sense the image itself uses. Rotation is measured
 * anticlockwise from the image's `x` axis, matching `units/types.ts`'s degrees
 * and `measure.ts`'s angles, so an angle read anywhere in the domain means the
 * same thing here.
 *
 * Both conversions are exact inverses of each other, and `__tests__` proves it
 * by round-tripping through `nearlyEqualPoint`.
 */

import type { PointMm } from '../units/compare';
import { millimetresPerPixel, pixels, type Scale } from '../units/scale';
import {
  degreesToRadians,
  millimetres,
  normaliseDegrees,
  type Degrees,
  type MillimetresPerPixel,
  type Pixels,
} from '../units/types';

/**
 * Decimals kept on a converted coordinate.
 *
 * A rotation multiplies by a sine and a cosine, so a coordinate that went
 * through one lands a few ulps away from itself and a round trip would fail an
 * exact comparison for no physical reason. Six decimals is a nanometre at
 * building scale: far below anything a scan can resolve, far above the noise the
 * arithmetic leaves behind. The same figure `measure.ts` and `compare.ts` each
 * keep for the same reason; neither exports it, so it is restated here.
 */
const RESULT_PRECISION = 1e6;

/** A point on the scanned image, in its own pixel grid. */
export interface PointPx {
  readonly x: Pixels;
  readonly y: Pixels;
}

/**
 * Where a scanned drawing sits in the model's space.
 *
 * Read it as three steps applied in order to an image pixel: scale it into
 * millimetres, rotate it, then move it to where the image's origin belongs.
 */
export interface OverlayTransform {
  /** Image scale, millimetres per pixel — the ratio M-02's `Scale` carries. */
  readonly scale: MillimetresPerPixel;
  /**
   * Rotation of the image against the model, in degrees, anticlockwise.
   *
   * Not restricted to 0/90/180/270: a sheet photographed on a site table is a
   * degree and a half out, and rounding that to zero is the misalignment the
   * screen was built to show.
   */
  readonly rotationDeg: Degrees;
  /** Where the image's own origin lands in the model's space. */
  readonly originMm: PointMm;
}

/** What is needed to place an image. */
export interface OverlayTransformInput {
  /** The drawing scale, from M-02. Only its ratio is used. */
  readonly scale: Scale;
  readonly rotationDeg: Degrees;
  readonly originMm: PointMm;
}

/** Snap a converted coordinate back onto the precision grid. */
function roundResult(value: number): number {
  return Math.round(value * RESULT_PRECISION) / RESULT_PRECISION;
}

/**
 * Build a placement from a scale, a rotation and an origin.
 *
 * The angle is folded into `[0, 360)` so that two transforms describing the same
 * placement compare equal whether the caller said `-90°` or `270°`; the fold
 * changes no geometry, only the label on it.
 *
 * @throws RangeError when the scale is not a positive finite ratio, or when the
 *   angle or the origin is not finite.
 */
export function createOverlayTransform(input: OverlayTransformInput): OverlayTransform {
  const ratio = input.scale.millimetresPerPixel;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`Overlay scale must be a positive ratio: ${String(ratio)}`);
  }

  return {
    scale: millimetresPerPixel(ratio),
    rotationDeg: normaliseDegrees(input.rotationDeg),
    originMm: { x: millimetres(input.originMm.x), y: millimetres(input.originMm.y) },
  };
}

/** Sine and cosine of a transform's rotation, computed once per conversion. */
function turnOf(transform: OverlayTransform): readonly [number, number] {
  const angle = degreesToRadians(transform.rotationDeg);
  return [Math.sin(angle), Math.cos(angle)];
}

/**
 * Where a pixel of the scan lands in the model.
 *
 * Scale, then rotate, then translate:
 *
 * ```
 * dx = px.x * scale                    dy = px.y * scale
 * x  = origin.x + dx·cos θ − dy·sin θ
 * y  = origin.y + dx·sin θ + dy·cos θ
 * ```
 */
export function imagePixelToModelMm(transform: OverlayTransform, point: PointPx): PointMm {
  const [sin, cos] = turnOf(transform);
  const dx = point.x * transform.scale;
  const dy = point.y * transform.scale;

  return {
    x: millimetres(roundResult(transform.originMm.x + dx * cos - dy * sin)),
    y: millimetres(roundResult(transform.originMm.y + dx * sin + dy * cos)),
  };
}

/**
 * Which pixel of the scan a point of the model falls on.
 *
 * The exact inverse of {@link imagePixelToModelMm}: undo the translation, rotate
 * back by the same angle, then divide the scale out. A rotation's inverse is its
 * transpose, which is why the same sine and cosine serve both directions with
 * only the signs swapped — no second angle is computed and the two can never
 * drift apart.
 */
export function modelMmToImagePixel(transform: OverlayTransform, point: PointMm): PointPx {
  const [sin, cos] = turnOf(transform);
  const dx = point.x - transform.originMm.x;
  const dy = point.y - transform.originMm.y;

  return {
    x: pixels(roundResult((dx * cos + dy * sin) / transform.scale)),
    y: pixels(roundResult((dy * cos - dx * sin) / transform.scale)),
  };
}

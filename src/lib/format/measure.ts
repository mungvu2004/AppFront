/**
 * Measurements, written the way the drawing writes them.
 *
 * The storage units are fixed by the spatial graph — lengths in millimetres,
 * areas in square metres, angles in degrees — but the *reading* units are not.
 * A wall is 220 mm and a corridor is 12,40 m, and writing either in the other's
 * unit ("0,22 m", "12400 mm") makes a QC sheet slower to scan, so
 * {@link formatLength} picks the unit from the magnitude and lets the caller
 * override when a column has to stay in one unit.
 *
 * The choice of unit is made on the value the caller passed, and the decimals
 * are applied afterwards by `Intl`. Nothing here rounds the stored number: a
 * wall shown as `3,45 m` is still 3450 mm — or 3449,7 mm — in the model, and
 * the next calculation sees the full value. See `./number` for why.
 */

import { MILLIMETRES_PER_METRE } from '@/domain/units/types';

import {
  formatNumber,
  isFormattable,
  MISSING_VALUE,
  type MaybeNumber,
  type NumberFormatOptions,
} from './number';

/** The units a length may be shown in. */
export type LengthDisplayUnit = 'mm' | 'm';

/**
 * At and above this many millimetres a length reads in metres.
 *
 * One metre is the point where the millimetre count stops being a single
 * glanceable group: `850` is read at once, `12400` is counted digit by digit.
 * The test is on the magnitude, so `-1200` reads in metres too.
 */
export const METRE_THRESHOLD_MM = MILLIMETRES_PER_METRE;

/** Decimals shown on a length in millimetres — walls are drawn to whole millimetres. */
const MILLIMETRE_FRACTION_DIGITS = 0;

/** Decimals shown on a length in metres, so a metre value keeps millimetre resolution. */
const METRE_FRACTION_DIGITS = 2;

/** Decimals shown on an area. Matches the 248,60 m² of the standard sample set. */
const AREA_FRACTION_DIGITS = 2;

/** Decimals shown on an angle — a tenth of a degree is finer than any plan is drawn. */
const ANGLE_FRACTION_DIGITS = 1;

const MILLIMETRE_SUFFIX = ' mm';
const METRE_SUFFIX = ' m';
const SQUARE_METRE_SUFFIX = ' m²';
const DEGREE_SUFFIX = '°';

export interface LengthFormatOptions {
  /**
   * Force the reading unit instead of choosing it from the magnitude.
   *
   * Pass `'mm'` for a column of wall thicknesses that must line up, or `'m'`
   * for a column of elevations.
   */
  readonly unit?: LengthDisplayUnit;
  /** Override the decimals for the chosen unit: 0 for millimetres, 2 for metres. */
  readonly fractionDigits?: number;
}

export interface MeasureFormatOptions {
  /** Override the decimals: 2 for an area, 1 for an angle. */
  readonly fractionDigits?: number;
}

/**
 * Short edge of an A3 sheet, in millimetres of paper.
 *
 * The one anchor {@link formatDrawingScaleRatio} is built on — see
 * `src/domain/quality/thresholds.ts:16`: "Cạnh ngắn A3 = 297 mm giấy. Ở 1:100,
 * đó là 29.700 mm công trình." That file already owns the three other quality
 * thresholds derived from the same anchor and is out of scope for this change,
 * so the number is named here rather than left as a bare `297` in the formula
 * below — the citation is what keeps it from being a fabricated constant.
 */
export const A3_SHORT_EDGE_MM = 297;

/** The unit a length of this magnitude reads in. */
function chooseUnit(valueMm: number): LengthDisplayUnit {
  return Math.abs(valueMm) < METRE_THRESHOLD_MM ? 'mm' : 'm';
}

/**
 * Write a length held in millimetres.
 *
 * Under one metre the value stays in millimetres and whole: `formatLength(850)`
 * is `"850 mm"`. From one metre it converts and keeps two decimals:
 * `formatLength(3450)` is `"3,45 m"`. `null`, `undefined`, `NaN` and `±Infinity`
 * all give {@link MISSING_VALUE}.
 *
 * @param valueMm Length in millimetres — a `Millimetres` quantity or a bare number.
 *
 * @example
 * formatLength(850)                      // "850 mm"
 * formatLength(3450)                     // "3,45 m"
 * formatLength(12400)                    // "12,40 m"
 * formatLength(850, { unit: 'm' })       // "0,85 m"
 * formatLength(3450, { unit: 'mm' })     // "3.450 mm"
 * formatLength(null)                     // "—"
 */
export function formatLength(valueMm: MaybeNumber, options: LengthFormatOptions = {}): string {
  if (!isFormattable(valueMm)) {
    return MISSING_VALUE;
  }

  const unit = options.unit ?? chooseUnit(valueMm);
  if (unit === 'mm') {
    const digits = options.fractionDigits ?? MILLIMETRE_FRACTION_DIGITS;
    return `${formatNumber(valueMm, { fractionDigits: digits })}${MILLIMETRE_SUFFIX}`;
  }

  const digits = options.fractionDigits ?? METRE_FRACTION_DIGITS;
  return `${formatNumber(valueMm / MILLIMETRES_PER_METRE, { fractionDigits: digits })}${METRE_SUFFIX}`;
}

/**
 * Write an area held in square metres, to two decimals.
 *
 * @example
 * formatArea(248.6)    // "248,60 m²"
 * formatArea(1234.5)   // "1.234,50 m²"
 * formatArea(undefined) // "—"
 */
export function formatArea(areaM2: MaybeNumber, options: MeasureFormatOptions = {}): string {
  if (!isFormattable(areaM2)) {
    return MISSING_VALUE;
  }
  const digits = options.fractionDigits ?? AREA_FRACTION_DIGITS;
  return `${formatNumber(areaM2, { fractionDigits: digits })}${SQUARE_METRE_SUFFIX}`;
}

/**
 * Write an angle held in degrees, to one decimal.
 *
 * The value is written as given: an angle outside `[0, 360)` is not folded,
 * because `-90°` and `270°` mean different things to a person reading a
 * rotation.
 *
 * @example
 * formatAngle(90)      // "90,0°"
 * formatAngle(-45.25)  // "-45,3°"
 * formatAngle(null)    // "—"
 */
export function formatAngle(angleDeg: MaybeNumber, options: MeasureFormatOptions = {}): string {
  if (!isFormattable(angleDeg)) {
    return MISSING_VALUE;
  }
  const digits = options.fractionDigits ?? ANGLE_FRACTION_DIGITS;
  return `${formatNumber(angleDeg, { fractionDigits: digits })}${DEGREE_SUFFIX}`;
}

const MILLIMETRES_PER_PIXEL_SUFFIX = ' mm/px';

/**
 * Write a drawing's scale density: how many real millimetres one pixel of the
 * image is worth.
 *
 * The number part is whatever {@link formatNumber}'s own options produce —
 * this function does not pick a decimal count of its own, it only supplies the
 * unit. `formatScaleDensity(12)` is `"12 mm/px"`; a caller that wants decimals
 * asks for them the same way it would from `formatNumber`.
 *
 * @param millimetresPerPixel A `MillimetresPerPixel` quantity (see
 * `src/domain/units/scale.ts`) or a bare number.
 *
 * @example
 * formatScaleDensity(12)                              // "12 mm/px"
 * formatScaleDensity(12.4, { maxFractionDigits: 1 })  // "12,4 mm/px"
 * formatScaleDensity(null)                            // "—"
 */
export function formatScaleDensity(
  millimetresPerPixel: MaybeNumber,
  options: NumberFormatOptions = {},
): string {
  if (!isFormattable(millimetresPerPixel)) {
    return MISSING_VALUE;
  }
  return `${formatNumber(millimetresPerPixel, options)}${MILLIMETRES_PER_PIXEL_SUFFIX}`;
}

/**
 * Write a drawing's print scale as `"1:N"`, from its density and the short
 * edge of the source image.
 *
 * Anchored on {@link A3_SHORT_EDGE_MM}, the one reference point the whole
 * quality-threshold system is built on. At `shortEdgePx` pixels for that same
 * paper edge, one pixel covers `A3_SHORT_EDGE_MM / shortEdgePx` millimetres of
 * *paper* — the same shape of quantity as `millimetresPerPixel`, but measured
 * on the sheet instead of on the built structure. The ratio of the two is how
 * many real millimetres one paper millimetre stands for, which is exactly what
 * `N` means in `1:N`. `formatNumber` does the rounding (to a whole number, so
 * the figure reads as a round scale like `1:100`); nothing here rounds by hand.
 *
 * @param millimetresPerPixel A `MillimetresPerPixel` quantity or a bare number.
 * @param shortEdgePx The image's short edge, in pixels — a `Pixels` quantity
 * or a bare number.
 *
 * @example
 * formatDrawingScaleRatio(12, 2475)   // "1:100" — the spec's own worked example
 * formatDrawingScaleRatio(null, 2475) // "—"
 */
export function formatDrawingScaleRatio(
  millimetresPerPixel: MaybeNumber,
  shortEdgePx: MaybeNumber,
): string {
  if (
    !isFormattable(millimetresPerPixel) ||
    millimetresPerPixel <= 0 ||
    !isFormattable(shortEdgePx) ||
    shortEdgePx <= 0
  ) {
    return MISSING_VALUE;
  }

  const paperMillimetresPerPixel = A3_SHORT_EDGE_MM / shortEdgePx;
  const ratio = millimetresPerPixel / paperMillimetresPerPixel;

  return `1:${formatNumber(ratio, { fractionDigits: 0 })}`;
}

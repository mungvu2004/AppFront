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

import { formatNumber, isFormattable, MISSING_VALUE, type MaybeNumber } from './number';

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

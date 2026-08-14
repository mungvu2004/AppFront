/**
 * Vietnamese number formatting.
 *
 * Every string a person reads in this product is produced here or by
 * `./measure`, for two reasons:
 *
 * - **One notation.** Vietnamese writes `1.234.567,89`: a dot groups thousands
 *   and a comma marks decimals — the mirror image of English. Getting that
 *   backwards on a dimension turns 3,45 m into 345 m, so the separators are
 *   never assembled by hand. `Intl.NumberFormat('vi-VN')` places them, and a
 *   change of ICU data changes every number in the app at once.
 * - **One answer for "no value".** A missing measurement is a normal state in
 *   QC — a wall the pipeline could not read, a room with no area yet. Those
 *   arrive as `null`, `undefined`, `NaN`, or `Infinity` depending on which
 *   layer produced them, and all four render as {@link MISSING_VALUE}. No
 *   caller has to guard, and the strings `"NaN"` and `"undefined"` cannot reach
 *   the screen.
 *
 * Nothing here rounds a stored value. `fractionDigits` decides how many
 * decimals the *string* shows; the number the caller passed is untouched and
 * still carries its full precision for the next calculation. A measurement
 * displayed as `3,45 m` may well be 3449,7 mm in the model, and that is
 * deliberate: quietly rounding a surveyed dimension would make the model
 * disagree with the drawing it came from.
 */

/**
 * Shown wherever a value is missing, unusable, or not yet known.
 *
 * An em dash rather than `"-"` (a minus sign, which a reader takes for a
 * negative measurement) or `"N/A"` (English, and noisy in a dense table).
 */
export const MISSING_VALUE = '—';

/** The one locale every formatter in this module is built with. */
const LOCALE = 'vi-VN';

/** Decimals kept when the caller asks for no particular number. */
const DEFAULT_MAX_FRACTION_DIGITS = 3;

/** Decimals kept on a percentage when the caller asks for no particular number. */
const DEFAULT_PERCENT_MAX_FRACTION_DIGITS = 1;

/** The range `Intl.NumberFormat` accepts for fraction digits in every runtime. */
const MIN_ALLOWED_FRACTION_DIGITS = 0;
const MAX_ALLOWED_FRACTION_DIGITS = 20;

/**
 * What a formatter accepts: a number, or one of the ways a number goes missing
 * between the pipeline and the screen.
 *
 * Branded quantities (`Millimetres`, `SquareMetres`, …) are `number` at runtime
 * and assignable here without a cast.
 */
export type MaybeNumber = number | null | undefined;

export interface NumberFormatOptions {
  /**
   * Show exactly this many decimals, padding with zeros: `2` turns `3.5` into
   * `"3,50"`. Use it to keep a column of numbers aligned on the comma.
   */
  readonly fractionDigits?: number;
  /**
   * Show *up to* this many decimals, dropping trailing zeros. Ignored when
   * {@link NumberFormatOptions.fractionDigits} is given.
   */
  readonly maxFractionDigits?: number;
  /**
   * Group thousands with a dot. On by default; turn it off for values that are
   * identifiers rather than magnitudes, such as a year or a drawing number.
   */
  readonly grouping?: boolean;
}

/** How to read the number handed to {@link formatPercent}. */
export type PercentSource = 'ratio' | 'percent';

export interface PercentFormatOptions {
  /** Show exactly this many decimals, padding with zeros. */
  readonly fractionDigits?: number;
  /** Show up to this many decimals. Ignored when `fractionDigits` is given. */
  readonly maxFractionDigits?: number;
  /**
   * Whether the input is already scaled.
   *
   * `'ratio'` (the default) reads `0.125` as `"12,5%"` — the convention used by
   * confidence scores and the scale checks. `'percent'` reads `12.5` as
   * `"12,5%"`, for values that arrive pre-scaled from the API, such as
   * `progressPercent`.
   */
  readonly source?: PercentSource;
}

/** Fraction digits after clamping, ready to hand to `Intl`. */
interface ResolvedFractionDigits {
  readonly minimum: number;
  readonly maximum: number;
}

/**
 * Building an `Intl.NumberFormat` costs far more than using one, and a plan
 * redraws thousands of labels per frame, so each distinct shape is built once.
 * The set of shapes is bounded by the option combinations in the codebase.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function cachedFormatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = formatterCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const created = build();
  formatterCache.set(key, created);
  return created;
}

/**
 * Fold a caller's digit count into the range `Intl` accepts.
 *
 * Clamped rather than thrown on: a formatter sits in a render path, where a
 * bad argument should degrade to a slightly wrong string, not blank the screen.
 */
function clampFractionDigits(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_ALLOWED_FRACTION_DIGITS;
  }
  const whole = Math.trunc(value);
  return Math.min(Math.max(whole, MIN_ALLOWED_FRACTION_DIGITS), MAX_ALLOWED_FRACTION_DIGITS);
}

function resolveFractionDigits(
  fixed: number | undefined,
  maximum: number | undefined,
  fallbackMaximum: number,
): ResolvedFractionDigits {
  if (fixed !== undefined) {
    const exact = clampFractionDigits(fixed);
    return { minimum: exact, maximum: exact };
  }
  return {
    minimum: MIN_ALLOWED_FRACTION_DIGITS,
    maximum: clampFractionDigits(maximum ?? fallbackMaximum),
  };
}

/**
 * Drop the sign from negative zero.
 *
 * `-0` is what arithmetic produces from `0 * -1` or a mirrored coordinate, and
 * it is the same quantity as `0`; `Intl` would print `"-0"`, which reads as a
 * measurement error. A genuinely small negative value such as `-0.0001` keeps
 * its sign and renders as `"-0,00"`, because it really is below zero.
 */
function withoutNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

/**
 * Whether a value can be turned into a number a person can read.
 *
 * `NaN` and `±Infinity` are excluded alongside `null` and `undefined`: all four
 * mean "no usable measurement", and the caller should show the same placeholder
 * for each.
 */
export function isFormattable(value: MaybeNumber): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function decimalFormatter(digits: ResolvedFractionDigits, grouping: boolean): Intl.NumberFormat {
  return cachedFormatter(`d:${String(digits.minimum)}:${String(digits.maximum)}:${String(grouping)}`, () =>
    new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits.minimum,
      maximumFractionDigits: digits.maximum,
      useGrouping: grouping,
    }),
  );
}

function percentFormatter(digits: ResolvedFractionDigits): Intl.NumberFormat {
  return cachedFormatter(`p:${String(digits.minimum)}:${String(digits.maximum)}`, () =>
    new Intl.NumberFormat(LOCALE, {
      style: 'percent',
      minimumFractionDigits: digits.minimum,
      maximumFractionDigits: digits.maximum,
    }),
  );
}

/**
 * Write a number in Vietnamese notation: `1234567.89` becomes `"1.234.567,89"`.
 *
 * Never throws and never returns `"NaN"`; anything unreadable comes back as
 * {@link MISSING_VALUE}.
 *
 * @example
 * formatNumber(1234567.891)                     // "1.234.567,891"
 * formatNumber(3.5, { fractionDigits: 2 })      // "3,50"
 * formatNumber(2026, { grouping: false })       // "2026"
 * formatNumber(null)                            // "—"
 */
export function formatNumber(value: MaybeNumber, options: NumberFormatOptions = {}): string {
  if (!isFormattable(value)) {
    return MISSING_VALUE;
  }
  const digits = resolveFractionDigits(
    options.fractionDigits,
    options.maxFractionDigits,
    DEFAULT_MAX_FRACTION_DIGITS,
  );
  return decimalFormatter(digits, options.grouping ?? true).format(withoutNegativeZero(value));
}

/**
 * Write a proportion as a percentage: `0.125` becomes `"12,5%"`.
 *
 * The percent sign comes from `Intl`, not from string concatenation, so a
 * locale that spaces or precedes it stays correct.
 *
 * @example
 * formatPercent(0.125)                             // "12,5%"
 * formatPercent(0.8, { fractionDigits: 0 })        // "80%"
 * formatPercent(50, { source: 'percent' })         // "50%"
 * formatPercent(undefined)                         // "—"
 */
export function formatPercent(value: MaybeNumber, options: PercentFormatOptions = {}): string {
  if (!isFormattable(value)) {
    return MISSING_VALUE;
  }
  const digits = resolveFractionDigits(
    options.fractionDigits,
    options.maxFractionDigits,
    DEFAULT_PERCENT_MAX_FRACTION_DIGITS,
  );
  // `Intl` multiplies by 100, so a pre-scaled input is put back on the 0–1
  // scale first. The division is exact enough that the digits `Intl` prints are
  // the digits the caller passed.
  const ratio = (options.source ?? 'ratio') === 'percent' ? value / 100 : value;
  return percentFormatter(digits).format(withoutNegativeZero(ratio));
}

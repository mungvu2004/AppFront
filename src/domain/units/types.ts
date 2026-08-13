/**
 * Labelled (branded) quantity types.
 *
 * Mixing millimetres with metres is a fatal class of bug in engineering
 * software, so the type system — not a naming convention — is what keeps them
 * apart. Every quantity below is a `number` carrying a phantom unit tag, which
 * means:
 *
 * - `Metres` can never be passed where `Millimetres` is expected, and vice
 *   versa; the compiler rejects it.
 * - The tag is erased at runtime, so there is no boxing cost.
 *
 * The constructors at the bottom of the "boundary" section are the ONLY
 * functions in the units module that accept a bare `number`. They are the
 * single, explicit gate where an untyped value becomes a typed quantity.
 * Everything downstream — conversion, rounding, arithmetic — takes tagged
 * quantities only.
 *
 * Storage conventions match the spatial graph: lengths in millimetres, areas in
 * square metres, angles in degrees.
 */

declare const UNIT_BRAND: unique symbol;

/** Phantom tag attached to a numeric quantity. Never exists at runtime. */
interface UnitBrand<TUnit extends string> {
  readonly [UNIT_BRAND]: TUnit;
}

/** A `number` labelled with the unit it is measured in. */
export type Quantity<TUnit extends string> = number & UnitBrand<TUnit>;

/** A length in millimetres. */
export type Millimetres = Quantity<'mm'>;

/** A length in metres. */
export type Metres = Quantity<'m'>;

/** An area in square metres. */
export type SquareMetres = Quantity<'m2'>;

/** An angle in degrees. */
export type Degrees = Quantity<'deg'>;

/** An angle in radians. */
export type Radians = Quantity<'rad'>;

/** Millimetres in one metre. */
export const MILLIMETRES_PER_METRE = 1000;

/** Millimetres in one decimetre. */
export const MILLIMETRES_PER_DECIMETRE = 100;

/** Millimetres in one centimetre. */
export const MILLIMETRES_PER_CENTIMETRE = 10;

/** Square millimetres in one square metre. */
export const SQUARE_MILLIMETRES_PER_SQUARE_METRE = MILLIMETRES_PER_METRE * MILLIMETRES_PER_METRE;

/** A full turn, in degrees. */
export const DEGREES_PER_TURN = 360;

/** A full turn, in radians. */
export const RADIANS_PER_TURN = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/* Boundary: the only functions that accept a bare number.                     */
/* -------------------------------------------------------------------------- */

/** Thrown when a raw value cannot become a quantity. */
function assertFinite(value: number, unit: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite ${unit} value: ${String(value)}`);
  }
}

/** Tag a raw number as millimetres. */
export function millimetres(value: number): Millimetres {
  assertFinite(value, 'millimetre');
  return value as Millimetres;
}

/** Tag a raw number as metres. */
export function metres(value: number): Metres {
  assertFinite(value, 'metre');
  return value as Metres;
}

/** Tag a raw number as square metres. */
export function squareMetres(value: number): SquareMetres {
  assertFinite(value, 'square metre');
  return value as SquareMetres;
}

/** Tag a raw number as degrees. */
export function degrees(value: number): Degrees {
  assertFinite(value, 'degree');
  return value as Degrees;
}

/** Tag a raw number as radians. */
export function radians(value: number): Radians {
  assertFinite(value, 'radian');
  return value as Radians;
}

/* -------------------------------------------------------------------------- */
/* Conversions between labelled quantities.                                     */
/* -------------------------------------------------------------------------- */

/** Convert metres to millimetres. */
export function metresToMillimetres(value: Metres): Millimetres {
  return millimetres(value * MILLIMETRES_PER_METRE);
}

/** Convert millimetres to metres. */
export function millimetresToMetres(value: Millimetres): Metres {
  return metres(value / MILLIMETRES_PER_METRE);
}

/** Convert degrees to radians. */
export function degreesToRadians(value: Degrees): Radians {
  return radians((value / DEGREES_PER_TURN) * RADIANS_PER_TURN);
}

/** Convert radians to degrees. */
export function radiansToDegrees(value: Radians): Degrees {
  return degrees((value / RADIANS_PER_TURN) * DEGREES_PER_TURN);
}

/** Fold an angle into the `[0, 360)` range. */
export function normaliseDegrees(value: Degrees): Degrees {
  const folded = value % DEGREES_PER_TURN;
  return degrees(folded < 0 ? folded + DEGREES_PER_TURN : folded);
}

/** Area of an axis-aligned rectangle given in millimetres. */
export function rectangleArea(width: Millimetres, height: Millimetres): SquareMetres {
  return squareMetres((width * height) / SQUARE_MILLIMETRES_PER_SQUARE_METRE);
}

/* -------------------------------------------------------------------------- */
/* Rounding.                                                                    */
/* -------------------------------------------------------------------------- */

/** The default rounding step: one millimetre. */
export const DEFAULT_ROUNDING_STEP: Millimetres = millimetres(1);

/**
 * Floating-point products such as `3 * 0.1` land a few ulps away from the exact
 * value. Measurements never need more than six decimals of a millimetre, so the
 * result is snapped back onto that grid.
 */
const RESULT_PRECISION = 1e6;

/**
 * Round a measurement onto a grid of `step` millimetres.
 *
 * Halfway values round away from zero, so `2.5` and `-2.5` become `3` and `-3`;
 * `Math.round` alone would bias negatives towards zero and make a mirrored plan
 * round differently from its original.
 *
 * @throws RangeError when the step is not a positive finite length.
 */
export function roundMeasurement(
  value: Millimetres,
  step: Millimetres = DEFAULT_ROUNDING_STEP,
): Millimetres {
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError(`Rounding step must be a positive length: ${String(step)}`);
  }
  const ratio = value / step;
  const rounded = ratio < 0 ? -Math.round(-ratio) : Math.round(ratio);
  return millimetres(Math.round(rounded * step * RESULT_PRECISION) / RESULT_PRECISION);
}

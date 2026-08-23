/**
 * The colour vocabulary a colouring mode is allowed to speak, and the maths that
 * turns a column of numbers into at most five steps of it.
 *
 * In a digital-twin viewer colour carries information rather than decoration: a
 * room is dark because it is large, not because dark looks good. That only works
 * if two rules hold, and this module exists to make both of them true by
 * construction rather than by care.
 *
 * **Nothing here ever produces a colour.** Every function returns a
 * {@link ColorTokenName} — the name of a CSS custom property declared in
 * `src/styles/globals.css` — and the type is a closed union of the names that
 * file actually declares. A hex value cannot be returned because a hex value does
 * not typecheck, and a token that was renamed out of the stylesheet fails the
 * build here rather than painting a model transparent. The name is the CSS
 * variable (`'--wall-220'`) rather than a Tailwind class, because the same answer
 * has to serve a 2D canvas, a 3D material and a DOM legend, and the variable is
 * the one form all three can resolve.
 *
 * **A scale is at most five steps.** Beyond five, neighbouring steps stop being
 * separable at a glance and a reader starts guessing which band a room is in,
 * which is worse than not colouring it at all. {@link MAX_SCALE_STEPS} is the
 * ceiling and {@link createQuantileScale} clamps to it.
 *
 * ## Why quantiles and not equal widths
 *
 * Floor areas are not spread evenly. A typical level has two dozen rooms between
 * 4 and 20 m² and one hall of 248,60 m², and cutting that range into five equal
 * slices puts every room in the first slice and the hall in the fifth: four of
 * the five steps go unused and the drawing reads as two colours. Cutting at the
 * quantiles of *the data actually on screen* instead gives every band roughly a
 * fifth of the rooms, so the steps stay populated and the eye gets a real
 * ranking. The cost is that a band boundary is not a fixed number — filter the
 * view down to one level and the boundaries move — which is why
 * {@link QuantileScale.breaks} is exported: a legend must show the numbers this
 * view was cut at, never numbers from a previous one.
 *
 * ## The ramp
 *
 * {@link SEQUENTIAL_RAMP} is five existing tokens ordered by lightness and drawn
 * from one warm-neutral family, so the ordering is visible without a legend and
 * no second hue is introduced. Invariant A2 allows one accent and A4 allows three
 * state colours; a quantitative ramp is neither, so it is built from neutrals and
 * leaves the accent free to keep meaning "selected" and the state colours free to
 * keep meaning verified, attention and violation. Five discrete tokens is also
 * what keeps this a scale rather than a gradient, which the brief forbids
 * outright: there is no interpolation anywhere in this file.
 */

/* -------------------------------------------------------------------------- */
/* The token vocabulary.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Every colour token declared in `src/styles/globals.css`, by CSS variable name.
 *
 * The list is restated here rather than parsed out of the stylesheet, because a
 * union type has to exist at compile time. The test file reads `globals.css` and
 * compares the two both ways, so a token added, renamed or removed there fails
 * this module's tests instead of drifting.
 */
export const COLOR_TOKEN_NAMES = [
  '--accent',
  '--accent-hover',
  '--accent-active',
  '--accent-wash',
  '--bg-app',
  '--bg-surface',
  '--bg-sunken',
  '--bg-hover',
  '--bg-overlay',
  '--bg-selected',
  '--bg-flash',
  '--border-default',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--danger-tint',
  '--danger-border',
  '--state-verified',
  '--state-verified-text',
  '--state-verified-tint',
  '--state-attention',
  '--state-attention-text',
  '--state-attention-tint',
  '--state-violation',
  '--state-violation-text',
  '--state-violation-tint',
  '--wall-110',
  '--wall-220',
  '--wall-330',
  '--wall-idle',
  '--canvas-2d',
  '--canvas-2d-grid',
  '--canvas-3d',
  '--canvas-3d-ground',
  '--canvas-3d-horizon',

  // Phong cảnh của màn đăng nhập — sàn gỗ, gạch, cây, kính, đèn, nền tối của
  // khối mô hình. Là màu thật nên vào đây để `ColorTokenName` khép kín với
  // `globals.css`, nhưng không mode tô màu nào được cầm tới: chúng không nói gì
  // về trạng thái của một bức tường.
  '--scene-backdrop',
  '--scene-wood',
  '--scene-wood-dark',
  '--scene-tile',
  '--scene-tile-grout',
  '--scene-textile',
  '--scene-foliage',
  '--scene-clay',
  '--scene-glass',
  '--scene-lamp',

  // Hai màu tuyệt đối và năm màu bóng đổ, vào đây khi R-41 gỡ giá trị cứng khỏi
  // `tailwind.config.ts`. Chúng là MÀU thật — `--shadow-color-rest` là
  // `rgba(0,0,0,0.1)`, không phải cả câu `0 1px 3px rgba(0,0,0,0.1)` — nên chúng
  // ở đúng chỗ và `ColorTokenName` vẫn chỉ chứa được tên của một màu.
  '--white',
  '--black',
  '--shadow-color-rest',
  '--shadow-color-float',
  '--shadow-color-overlay',
  '--shadow-color-panel',
  '--shadow-color-modal',
] as const;

/**
 * The name of one colour token. Never a class, never a hex value, never an
 * `rgb()` or `hsl()` string — those cannot inhabit this type.
 */
export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];

/** Whether a string is one of the declared tokens. */
export function isColorTokenName(value: string): value is ColorTokenName {
  return (COLOR_TOKEN_NAMES as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* The scale.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The most steps any scale may have.
 *
 * Five is the limit of what a reader separates at a glance on a plan without
 * checking each one against the legend.
 */
export const MAX_SCALE_STEPS = 5;

/**
 * Five neutrals, lightest first, for any scale that ranks a quantity.
 *
 * One hue family and a monotone drop in lightness, so "darker means more"
 * survives being printed, being seen by a colour-blind reader, and being scaled
 * down to a thumbnail. These are five discrete tokens, evaluated by lookup: no
 * step is interpolated from its neighbours, so no gradient can arise.
 */
export const SEQUENTIAL_RAMP = [
  '--bg-sunken',
  '--wall-idle',
  '--wall-110',
  '--wall-220',
  '--wall-330',
] as const satisfies readonly ColorTokenName[];

/**
 * What a mode paints something it has no reading for: a room with no area, an
 * object on a level that is not in the stack.
 *
 * Deliberately *not* the lightest step of {@link SEQUENTIAL_RAMP}. "No value"
 * and "the smallest value" are different facts, and painting them the same token
 * would let a room with a missing area read as the smallest room in the model.
 * This token sits outside the ramp, so it is never mistaken for a rank.
 */
export const UNPAINTED_TOKEN: ColorTokenName = '--border-default';

/**
 * Which end of the data gets the strongest step.
 *
 * `ascending` gives the darkest step to the largest value, which is what an area
 * scale wants. `descending` gives it to the smallest, which is what a confidence
 * scale wants: the reviewer is hunting for what the model is *least* sure of, so
 * that is what has to be visible from across the room.
 */
export type ScaleDirection = 'ascending' | 'descending';

/** A quantity scale, already cut against one particular set of readings. */
export interface QuantileScale {
  /**
   * The cut points, ascending, one fewer than {@link QuantileScale.bandCount}.
   *
   * Empty when there were no readings to cut. A legend shows these and nothing
   * else — they are the boundaries of *this* view.
   */
  readonly breaks: readonly number[];
  /** How many bands the readings support: `breaks.length + 1`, at most five. */
  readonly bandCount: number;
  /** The tokens in use, band order — reversed already when descending. */
  readonly tokens: readonly ColorTokenName[];
  /** Which band a reading falls in, from `0` to `bandCount - 1`. */
  readonly bandOf: (value: number) => number;
  /** The token for a reading. {@link UNPAINTED_TOKEN} when it is not a number. */
  readonly tokenOf: (value: number) => ColorTokenName;
}

export interface QuantileScaleOptions {
  /** How many bands to cut. Clamped to `[1, MAX_SCALE_STEPS]`. */
  readonly bandCount?: number;
  /** Which end gets the strongest step. Defaults to `ascending`. */
  readonly direction?: ScaleDirection;
  /** The tokens to spend, lightest first. Defaults to {@link SEQUENTIAL_RAMP}. */
  readonly ramp?: readonly ColorTokenName[];
}

/**
 * One quantile of an already-sorted, already-finite list.
 *
 * Linear interpolation between the two order statistics either side of the
 * position — the definition `numpy.quantile` and R's type 7 use — so a list of
 * five distinct readings cut into five bands puts exactly one reading in each.
 */
function quantileOf(sorted: readonly number[], fraction: number): number {
  const lastIndex = sorted.length - 1;
  const position = lastIndex * Math.min(Math.max(fraction, 0), 1);
  const lowerIndex = Math.floor(position);
  // `noUncheckedIndexedAccess` needs the fallbacks; `sorted` is non-empty by the
  // time this is reached, and `lowerIndex + 1` runs past the end only when the
  // position sits exactly on the last reading, where the answer is that reading.
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[lowerIndex + 1] ?? lower;

  return lower + (upper - lower) * (position - lowerIndex);
}

/**
 * Where to cut a set of readings into `bandCount` equally-populated bands.
 *
 * Returns `bandCount - 1` boundaries, ascending, or an empty list when there is
 * nothing to cut. Values that are not finite are dropped rather than sorted to
 * one end, where a single `NaN` would drag every boundary with it.
 *
 * Duplicated boundaries are left as they are: thirty rooms of the same area
 * genuinely cannot be split into five ranks, and collapsing the bands is the
 * honest answer rather than inventing spread that the data does not have.
 *
 * @example
 * quantileBreaks([1, 2, 3, 4, 5], 5)   // [1.8, 2.6, 3.4, 4.2]
 * quantileBreaks([7, 7, 7], 5)         // [7, 7, 7, 7]
 * quantileBreaks([], 5)                // []
 */
export function quantileBreaks(values: readonly number[], bandCount: number): number[] {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((first, second) => first - second);
  const bands = clampBandCount(bandCount);

  if (sorted.length === 0 || bands < 2) {
    return [];
  }

  const breaks: number[] = [];

  for (let step = 1; step < bands; step += 1) {
    breaks.push(quantileOf(sorted, step / bands));
  }

  return breaks;
}

/**
 * Which band a reading falls in, given ascending boundaries.
 *
 * A reading sitting exactly on a boundary belongs to the lower band, so the
 * bands read as `(…, break]` and every reading has exactly one home.
 */
export function bandIndexOf(value: number, breaks: readonly number[]): number {
  let index = 0;

  for (const boundary of breaks) {
    if (boundary < value) {
      index += 1;
    }
  }

  return index;
}

function clampBandCount(bandCount: number): number {
  if (!Number.isFinite(bandCount)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(bandCount), 1), MAX_SCALE_STEPS);
}

/**
 * Cut a set of readings into bands and hand back the token for each.
 *
 * The readings are the ones **currently in view**, not the ones in the project:
 * that is the whole point of a quantile scale, and it is why this takes a list
 * rather than reading a store. Give it a different list and every boundary moves.
 *
 * Pure: the same readings and options always give the same scale, and the input
 * list is never written to.
 */
export function createQuantileScale(
  values: readonly number[],
  options: QuantileScaleOptions = {},
): QuantileScale {
  const ramp = options.ramp ?? SEQUENTIAL_RAMP;
  const requested = clampBandCount(options.bandCount ?? MAX_SCALE_STEPS);
  const breaks = quantileBreaks(values, requested);
  const bandCount = breaks.length + 1;

  // Only as many tokens as there are bands, so a one-band scale spends the
  // lightest token whichever direction it runs in.
  const spent = ramp.slice(0, bandCount);
  const tokens = options.direction === 'descending' ? [...spent].reverse() : spent;

  const bandOf = (value: number): number => bandIndexOf(value, breaks);

  return {
    breaks,
    bandCount,
    tokens,
    bandOf,
    tokenOf: (value) =>
      Number.isFinite(value) ? (tokens[bandOf(value)] ?? UNPAINTED_TOKEN) : UNPAINTED_TOKEN,
  };
}

/* -------------------------------------------------------------------------- */
/* Categorical scales.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A scale over a fixed set of cases rather than a range of numbers.
 *
 * The table must be a complete `Record`, so adding a case to the union it is
 * keyed by fails the build here instead of quietly painting the new case with
 * the fallback.
 */
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName {
  return (key) => (key === null || key === undefined ? UNPAINTED_TOKEN : table[key]);
}

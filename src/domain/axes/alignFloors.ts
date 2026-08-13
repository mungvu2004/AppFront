/**
 * Stacking the floors of one building on top of each other.
 *
 * A multi-level model is only worth having if the levels sit where they really
 * sit. Each floor plan is traced from its own sheet, and each sheet was
 * scanned, deskewed and scaled on its own, so two floors of the same building
 * arrive a few centimetres apart and sometimes a quarter turn round. Left
 * alone, the model shows columns that miss the columns below and a stair that
 * lands in a wall.
 *
 * The grid recovered by `detect.ts` is what makes the levels comparable: the
 * axes are the one thing every floor of a building shares. Alignment therefore
 * matches axes to axes, and it is allowed exactly two freedoms:
 *
 * - **A translation**, any amount.
 * - **A quarter turn**, one of 0°, 90°, 180° or 270° — the four ways a sheet
 *   gets fed into a scanner.
 *
 * It is **never allowed to scale**. A floor that only fits after being stretched
 * 2% is not a floor that fits; the stretch would silently rewrite every
 * dimension on it, and the drawing would stop measuring what the surveyor
 * signed. `FloorTransform.scale` is the literal `1` so that the constraint is
 * visible in the type and cannot drift. When a floor does not fit, this module
 * says so and leaves it where it is.
 *
 * What is left over after the best transform is the **residual**, and it is
 * reported rather than absorbed. Past `ALIGNMENT_WARNING_THRESHOLD_MM` a floor
 * gets a warning naming it and the millimetres, because at that point somebody
 * has to look at the two sheets and decide which one is wrong.
 *
 * The vertical stack is checked here too — clear heights inside the range a
 * storey can actually have, and no two floors occupying the same air — since a
 * plan that lines up perfectly is still useless if the storeys interpenetrate.
 *
 * Every function is pure: the same floors always give the same report, the same
 * base floor and the same issues in the same order.
 */

import type { LevelId } from '../spatial/types';
import { compareNearly, type PointMm } from '../units/compare';
import { millimetres, MILLIMETRES_PER_METRE, type Millimetres } from '../units/types';
import { axisLine, type DetectedAxis } from './detect';

/* -------------------------------------------------------------------------- */
/* Public types and thresholds.                                                */
/* -------------------------------------------------------------------------- */

/** The quarter turns a scanned sheet can arrive at. */
export type FloorRotation = 0 | 90 | 180 | 270;

/** Every rotation tried, in the order they are tried. */
export const FLOOR_ROTATIONS: readonly FloorRotation[] = [0, 90, 180, 270];

/**
 * Residual past which a floor is not quietly accepted.
 *
 * A hundred and fifty millimetres is about the width of a partition: below it
 * the floors disagree by less than the things they are made of, above it a wall
 * upstairs is standing next to the wall below rather than on it.
 */
export const ALIGNMENT_WARNING_THRESHOLD_MM: Millimetres = millimetres(150);

/** How far apart two axes may be and still be taken for the same axis. */
export const AXIS_MATCH_CAPTURE_MM: Millimetres = millimetres(500);

/** Fewest matched axes that make an alignment mean anything. */
export const MIN_MATCHED_AXES = 2;

/** Lowest clear height a storey can be built to. */
export const MIN_CLEAR_HEIGHT_MM: Millimetres = millimetres(2400);

/** Highest clear height treated as one storey rather than a void. */
export const MAX_CLEAR_HEIGHT_MM: Millimetres = millimetres(6000);

/**
 * One floor, as alignment needs to see it.
 *
 * `floorElevationMm` is the finished floor level measured from the project
 * datum, and `clearHeightMm` is floor to ceiling — not floor to floor, which
 * would hide the slab and make two storeys look as if they touched.
 */
export interface FloorPlan {
  readonly levelId: LevelId;
  readonly name: string;
  readonly floorElevationMm: Millimetres;
  readonly clearHeightMm: Millimetres;
  readonly axes: readonly DetectedAxis[];
}

/**
 * How a floor is moved onto the base floor.
 *
 * The rotation is taken about the plan origin and the translation is applied
 * after it. Any rotation about any other centre is the same movement as one of
 * these, because the translation absorbs the difference, so the two fields
 * describe every placement a floor can have.
 */
export interface FloorTransform {
  readonly rotationDeg: FloorRotation;
  readonly translationMm: PointMm;
  /** Always `1`. Floors are never stretched to fit. */
  readonly scale: 1;
}

/** The identity placement: a floor already where it belongs. */
export const IDENTITY_TRANSFORM: FloorTransform = {
  rotationDeg: 0,
  translationMm: { x: millimetres(0), y: millimetres(0) },
  scale: 1,
};

/** What a floor cannot be quietly accepted for. */
export type FloorIssueKind = 'alignment' | 'unalignable' | 'clearHeight' | 'overlap';

/**
 * One thing wrong with the stack.
 *
 * `severity` uses the two non-green status words of the interface: `attention`
 * for a floor that still builds but wants looking at, `violation` for a stack
 * that cannot be built at all. Nothing here is ever green — approval belongs to
 * a person.
 */
export interface FloorIssue {
  readonly kind: FloorIssueKind;
  readonly levelId: LevelId;
  /** The other floor involved, for an issue about a pair. */
  readonly relatedLevelId: LevelId | null;
  readonly severity: 'attention' | 'violation';
  /** How much is wrong, in millimetres. */
  readonly amountMm: Millimetres;
  /** Vietnamese sentence naming the floor and the millimetres. */
  readonly message: string;
}

/** Where one floor ended up, and how well it got there. */
export interface FloorAlignment {
  readonly levelId: LevelId;
  readonly name: string;
  readonly isBase: boolean;
  readonly transform: FloorTransform;
  /** Worst distance left between a matched axis and its partner. */
  readonly maxResidualMm: Millimetres;
  /** Axes that found a partner on the base floor. */
  readonly matchedAxisCount: number;
  /** Axes the floor has in total. */
  readonly axisCount: number;
  /** The floor's axes moved onto the base floor. */
  readonly alignedAxes: readonly DetectedAxis[];
}

/** The whole stack, checked. */
export interface FloorAlignmentReport {
  /** The floor everything else was matched to; `null` when there are none. */
  readonly baseLevelId: LevelId | null;
  /** One entry per input floor, in the order they were given. */
  readonly floors: readonly FloorAlignment[];
  /** Alignment issues first, then the vertical stack, both by floor order. */
  readonly issues: readonly FloorIssue[];
}

export interface AlignFloorsOptions {
  /** Force the base floor instead of letting the best-surveyed one win. */
  readonly baseLevelId?: LevelId;
  /** How far apart two axes may be and still be paired. */
  readonly captureMm?: Millimetres;
  /** Residual past which a warning is raised. */
  readonly warningThresholdMm?: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Formatting, in the units the interface reads them in.                       */
/* -------------------------------------------------------------------------- */

/** Millimetres, whole where they can be, with a comma for the decimal. */
function millimetreText(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded === 0 ? 0 : rounded).replace('.', ',');
}

/** Elevations and heights read in metres, as the interface shows them. */
function metreText(valueMm: number): string {
  return (valueMm / MILLIMETRES_PER_METRE).toFixed(3).replace('.', ',');
}

/* -------------------------------------------------------------------------- */
/* Moving a floor.                                                             */
/* -------------------------------------------------------------------------- */

/** A coordinate with its sign settled, so `-0` never reaches a comparison. */
function coordinate(value: number): Millimetres {
  return millimetres(value === 0 ? 0 : value);
}

/** Turn a point a quarter at a time about the plan origin. */
function rotatePoint(point: PointMm, rotationDeg: FloorRotation): PointMm {
  switch (rotationDeg) {
    case 90:
      return { x: coordinate(-point.y), y: coordinate(point.x) };
    case 180:
      return { x: coordinate(-point.x), y: coordinate(-point.y) };
    case 270:
      return { x: coordinate(point.y), y: coordinate(-point.x) };
    default:
      return { x: coordinate(point.x), y: coordinate(point.y) };
  }
}

/** Move a plan coordinate the way the floor it belongs to was moved. */
export function applyFloorTransform(point: PointMm, transform: FloorTransform): PointMm {
  const turned = rotatePoint(point, transform.rotationDeg);
  return {
    x: coordinate(turned.x + transform.translationMm.x),
    y: coordinate(turned.y + transform.translationMm.y),
  };
}

/**
 * Move an axis with its floor.
 *
 * The axis is moved by its two ends rather than by its coordinate, so a quarter
 * turn swaps the direction, the coordinate and the span together and no case
 * has to be spelled out twice.
 */
export function transformAxis(axis: DetectedAxis, transform: FloorTransform): DetectedAxis {
  const line = axisLine(axis);
  const start = applyFloorTransform(line.start, transform);
  const end = applyFloorTransform(line.end, transform);
  const isVertical = compareNearly(start.x, end.x) === 0;

  return {
    direction: isVertical ? 'vertical' : 'horizontal',
    coordinateMm: isVertical ? start.x : start.y,
    startMm: coordinate(Math.min(isVertical ? start.y : start.x, isVertical ? end.y : end.x)),
    endMm: coordinate(Math.max(isVertical ? start.y : start.x, isVertical ? end.y : end.x)),
    spreadMm: axis.spreadMm,
    wallIds: axis.wallIds,
  };
}

/* -------------------------------------------------------------------------- */
/* Finding the transform.                                                      */
/* -------------------------------------------------------------------------- */

/** How well one offset lines two sets of axis coordinates up. */
interface Fit {
  readonly offsetMm: number;
  readonly matched: number;
  readonly totalResidualMm: number;
  readonly maxResidualMm: number;
}

const NO_FIT: Fit = { offsetMm: 0, matched: 0, totalResidualMm: 0, maxResidualMm: 0 };

function coordinatesOf(axes: readonly DetectedAxis[], direction: 'vertical' | 'horizontal'): number[] {
  return axes.filter((axis) => axis.direction === direction).map((axis) => axis.coordinateMm);
}

/** Distance from one moved coordinate to the nearest base coordinate. */
function nearestGap(value: number, base: readonly number[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const candidate of base) {
    const gap = Math.abs(value - candidate);
    if (gap < smallest) {
      smallest = gap;
    }
  }
  return smallest;
}

/** Score one candidate offset. */
function scoreOffset(
  moving: readonly number[],
  base: readonly number[],
  offsetMm: number,
  captureMm: number,
): Fit {
  let matched = 0;
  let totalResidualMm = 0;
  let maxResidualMm = 0;

  for (const value of moving) {
    const gap = nearestGap(value + offsetMm, base);
    if (compareNearly(gap, captureMm) <= 0) {
      matched += 1;
      totalResidualMm += gap;
      maxResidualMm = Math.max(maxResidualMm, gap);
    }
  }

  return { offsetMm, matched, totalResidualMm, maxResidualMm };
}

/**
 * Is this fit the one to keep?
 *
 * Matches first: an offset that brings four axes home beats one that brings two
 * home very precisely, because the floors of a building agree on their grid or
 * they are not the same building. Residual separates equals, and the smaller
 * shift wins after that, so a floor is never moved further than the evidence
 * asks for. The last two steps cannot depend on floating point noise, which is
 * what makes the answer repeatable.
 */
function isBetterFit(candidate: Fit, incumbent: Fit): boolean {
  if (candidate.matched !== incumbent.matched) {
    return candidate.matched > incumbent.matched;
  }
  const byResidual = compareNearly(candidate.totalResidualMm, incumbent.totalResidualMm);
  if (byResidual !== 0) {
    return byResidual < 0;
  }
  const byShift = compareNearly(Math.abs(candidate.offsetMm), Math.abs(incumbent.offsetMm));
  if (byShift !== 0) {
    return byShift < 0;
  }
  return compareNearly(candidate.offsetMm, incumbent.offsetMm) < 0;
}

/**
 * The shift that lines one direction up best.
 *
 * Every difference between a moving coordinate and a base one is tried, plus
 * leaving the floor alone. One of those is always the best shift there is: the
 * best alignment must land at least one axis exactly on a partner, otherwise it
 * could be nudged towards the nearest one and improve.
 */
function fitOffset(
  moving: readonly number[],
  base: readonly number[],
  captureMm: number,
): Fit {
  if (moving.length === 0 || base.length === 0) {
    return NO_FIT;
  }

  let best = scoreOffset(moving, base, 0, captureMm);
  for (const target of base) {
    for (const value of moving) {
      const candidate = scoreOffset(moving, base, target - value, captureMm);
      if (isBetterFit(candidate, best)) {
        best = candidate;
      }
    }
  }
  return best;
}

/** How well a whole floor fits at one rotation. */
interface RotationFit {
  readonly rotationDeg: FloorRotation;
  readonly transform: FloorTransform;
  readonly matched: number;
  readonly totalResidualMm: number;
  readonly maxResidualMm: number;
}

function fitRotation(
  floor: FloorPlan,
  baseAxes: readonly DetectedAxis[],
  rotationDeg: FloorRotation,
  captureMm: number,
): RotationFit {
  const turned = floor.axes.map((axis) =>
    transformAxis(axis, { rotationDeg, translationMm: { x: millimetres(0), y: millimetres(0) }, scale: 1 }),
  );

  const alongX = fitOffset(coordinatesOf(turned, 'vertical'), coordinatesOf(baseAxes, 'vertical'), captureMm);
  const alongY = fitOffset(
    coordinatesOf(turned, 'horizontal'),
    coordinatesOf(baseAxes, 'horizontal'),
    captureMm,
  );

  return {
    rotationDeg,
    transform: {
      rotationDeg,
      translationMm: { x: coordinate(alongX.offsetMm), y: coordinate(alongY.offsetMm) },
      scale: 1,
    },
    matched: alongX.matched + alongY.matched,
    totalResidualMm: alongX.totalResidualMm + alongY.totalResidualMm,
    maxResidualMm: Math.max(alongX.maxResidualMm, alongY.maxResidualMm),
  };
}

/**
 * Is this rotation the one to keep?
 *
 * Ties keep the incumbent, and the rotations are tried starting at 0°, so a
 * floor is only turned when turning it genuinely fits more axes.
 *
 * The tie-break matters more than it looks. An axis is a line, not an arrow,
 * and a line cannot tell a half turn from none: a grid whose spacings read the
 * same backwards fits equally well at 0° and 180°, and one that is square fits
 * at all four. There is no geometry that resolves it, so the earliest rotation
 * wins and the floor is left the way round it arrived — the answer a person
 * would have to confirm anyway, reached without scrambling the plan first.
 */
function isBetterRotation(candidate: RotationFit, incumbent: RotationFit): boolean {
  if (candidate.matched !== incumbent.matched) {
    return candidate.matched > incumbent.matched;
  }
  return compareNearly(candidate.totalResidualMm, incumbent.totalResidualMm) < 0;
}

/* -------------------------------------------------------------------------- */
/* Choosing the base floor.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The floor everything else is matched to.
 *
 * The one with the most axes wins, because it carries the most evidence of what
 * the building was set out on; the lowest floor breaks a tie, since the ground
 * floor is what a building is measured from. `null` for an empty list.
 */
export function pickBaseFloor(floors: readonly FloorPlan[]): FloorPlan | null {
  let best: FloorPlan | null = null;

  for (const floor of floors) {
    if (best === null) {
      best = floor;
      continue;
    }
    if (floor.axes.length !== best.axes.length) {
      if (floor.axes.length > best.axes.length) {
        best = floor;
      }
      continue;
    }
    const byElevation = compareNearly(floor.floorElevationMm, best.floorElevationMm);
    if (byElevation !== 0) {
      if (byElevation < 0) {
        best = floor;
      }
      continue;
    }
    if (floor.levelId < best.levelId) {
      best = floor;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Checking the vertical stack.                                                */
/* -------------------------------------------------------------------------- */

/** Top of the air a floor occupies: its floor level plus its clear height. */
export function ceilingElevationMm(floor: FloorPlan): Millimetres {
  return millimetres(floor.floorElevationMm + floor.clearHeightMm);
}

function clearHeightIssues(floors: readonly FloorPlan[]): FloorIssue[] {
  const issues: FloorIssue[] = [];

  for (const floor of floors) {
    const height = floor.clearHeightMm;
    const tooLow = compareNearly(height, MIN_CLEAR_HEIGHT_MM) < 0;
    const tooHigh = compareNearly(height, MAX_CLEAR_HEIGHT_MM) > 0;
    if (!tooLow && !tooHigh) {
      continue;
    }
    const limit = tooLow ? MIN_CLEAR_HEIGHT_MM : MAX_CLEAR_HEIGHT_MM;
    issues.push({
      kind: 'clearHeight',
      levelId: floor.levelId,
      relatedLevelId: null,
      severity: 'violation',
      amountMm: millimetres(Math.abs(height - limit)),
      message:
        `Tầng ${floor.name} có chiều cao thông thuỷ ${metreText(height)} m, ` +
        `ngoài khoảng ${metreText(MIN_CLEAR_HEIGHT_MM)}–${metreText(MAX_CLEAR_HEIGHT_MM)} m ` +
        `(lệch ${millimetreText(Math.abs(height - limit))} mm).`,
    });
  }

  return issues;
}

/**
 * Floors that occupy the same air.
 *
 * The check runs on the floors sorted by elevation and compares each with the
 * one below, so a stack of any size costs one pass and every overlap is
 * reported once, against the upper floor of the pair.
 */
function overlapIssues(floors: readonly FloorPlan[]): FloorIssue[] {
  const stacked = [...floors].sort((first, second) => {
    const byElevation = compareNearly(first.floorElevationMm, second.floorElevationMm);
    if (byElevation !== 0) {
      return byElevation;
    }
    return first.levelId < second.levelId ? -1 : first.levelId > second.levelId ? 1 : 0;
  });

  const issues: FloorIssue[] = [];

  for (let index = 1; index < stacked.length; index += 1) {
    const upper = stacked[index];
    const lower = stacked[index - 1];
    if (upper === undefined || lower === undefined) {
      continue;
    }
    const ceiling = ceilingElevationMm(lower);
    const overlapMm = ceiling - upper.floorElevationMm;
    if (compareNearly(overlapMm, 0) <= 0) {
      continue;
    }
    issues.push({
      kind: 'overlap',
      levelId: upper.levelId,
      relatedLevelId: lower.levelId,
      severity: 'violation',
      amountMm: millimetres(overlapMm),
      message:
        `Tầng ${upper.name} bắt đầu ở cao độ ${metreText(upper.floorElevationMm)} m, ` +
        `thấp hơn trần tầng ${lower.name} ở ${metreText(ceiling)} m: ` +
        `hai tầng chồng lấn ${millimetreText(overlapMm)} mm.`,
    });
  }

  return issues;
}

/* -------------------------------------------------------------------------- */
/* Aligning the stack.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Put every floor onto the grid of the base floor.
 *
 * Each floor is tried at all four quarter turns; for each turn the best
 * translation along `x` and along `y` is found independently, which is exact
 * because a translation moves the two directions separately. The turn that
 * brings the most axes home wins, and 0° wins any tie, so a floor is never
 * rotated without cause.
 *
 * No floor is ever scaled, so a floor that does not fit stays not fitting and
 * says how far out it is. Three things earn an entry in `issues`: a residual
 * past the threshold, a floor with too few axes to align at all, and a vertical
 * stack whose storeys are the wrong height or occupy the same air.
 *
 * `floors` comes back in the order it was given, base floor included, so the
 * caller can zip the result straight onto its own list.
 */
export function alignFloors(
  floors: readonly FloorPlan[],
  options: AlignFloorsOptions = {},
): FloorAlignmentReport {
  const captureMm = options.captureMm ?? AXIS_MATCH_CAPTURE_MM;
  const thresholdMm = options.warningThresholdMm ?? ALIGNMENT_WARNING_THRESHOLD_MM;

  const forced =
    options.baseLevelId === undefined
      ? null
      : (floors.find((floor) => floor.levelId === options.baseLevelId) ?? null);
  const base = forced ?? pickBaseFloor(floors);

  if (base === null) {
    return { baseLevelId: null, floors: [], issues: [] };
  }

  const alignments: FloorAlignment[] = [];
  const alignmentIssues: FloorIssue[] = [];

  for (const floor of floors) {
    if (floor.levelId === base.levelId) {
      alignments.push({
        levelId: floor.levelId,
        name: floor.name,
        isBase: true,
        transform: IDENTITY_TRANSFORM,
        maxResidualMm: millimetres(0),
        matchedAxisCount: floor.axes.length,
        axisCount: floor.axes.length,
        alignedAxes: floor.axes,
      });
      continue;
    }

    let best = fitRotation(floor, base.axes, 0, captureMm);
    for (const rotationDeg of FLOOR_ROTATIONS) {
      if (rotationDeg === 0) {
        continue;
      }
      const candidate = fitRotation(floor, base.axes, rotationDeg, captureMm);
      if (isBetterRotation(candidate, best)) {
        best = candidate;
      }
    }

    alignments.push({
      levelId: floor.levelId,
      name: floor.name,
      isBase: false,
      transform: best.transform,
      maxResidualMm: millimetres(best.maxResidualMm),
      matchedAxisCount: best.matched,
      axisCount: floor.axes.length,
      alignedAxes: floor.axes.map((axis) => transformAxis(axis, best.transform)),
    });

    if (best.matched < MIN_MATCHED_AXES) {
      alignmentIssues.push({
        kind: 'unalignable',
        levelId: floor.levelId,
        relatedLevelId: base.levelId,
        severity: 'attention',
        amountMm: millimetres(0),
        message:
          `Tầng ${floor.name} chỉ khớp được ${String(best.matched)} trục với tầng chuẩn ` +
          `${base.name}, chưa đủ căn cứ để chồng tầng.`,
      });
      continue;
    }

    if (compareNearly(best.maxResidualMm, thresholdMm) > 0) {
      alignmentIssues.push({
        kind: 'alignment',
        levelId: floor.levelId,
        relatedLevelId: base.levelId,
        severity: 'attention',
        amountMm: millimetres(best.maxResidualMm),
        message:
          `Tầng ${floor.name} còn lệch ${millimetreText(best.maxResidualMm)} mm so với tầng chuẩn ` +
          `${base.name}, vượt ngưỡng ${millimetreText(thresholdMm)} mm.`,
      });
    }
  }

  return {
    baseLevelId: base.levelId,
    floors: alignments,
    issues: [...alignmentIssues, ...clearHeightIssues(floors), ...overlapIssues(floors)],
  };
}

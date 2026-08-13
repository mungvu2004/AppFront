/**
 * Measuring the drawing by hand.
 *
 * Nobody signs off a traced model because the software says it is right. The
 * paper set is on the desk, and the engineer checks it the way the sheet was
 * checked before there was any software: pick two points, read the number,
 * compare it with the one printed next to the dimension line, move on. This
 * module is that tape measure and nothing else — it recovers no geometry,
 * changes no entity, and writes nothing back into the spatial graph.
 *
 * Three properties keep it usable from the plan and the 3D view alike:
 *
 * - **One point type.** `MeasurePoint` carries an optional elevation, so a plan
 *   coordinate is already a valid argument and a 3D pick is the same call with a
 *   `z`. Every length below is the true straight-line distance through all three
 *   axes, which means the plan and the model can never report different numbers
 *   for the same pair of points.
 * - **Numbers out, never text.** Results are labelled quantities in millimetres
 *   (areas in square millimetres, with the square-metre value alongside because
 *   that is how the graph stores areas). The decimal comma, the unit suffix and
 *   the rounding shown to the reader belong to the presentation layer, which is
 *   the only place that knows who is reading.
 * - **An unanswerable measurement is `null`, not zero.** A chain of one point and
 *   an angle with a zero-length arm have no value; reporting `0` for them would
 *   put a number on the sheet that the drawing never contained.
 *
 * Every function is pure and deterministic, including note creation: the id of a
 * saved measurement comes from a sequence number the caller supplies or from the
 * notes already saved, never from a hidden counter or the clock.
 */

import type { LevelId } from '../spatial/types';
import { isNearlyZero } from '../units/compare';
import {
  DEGREES_PER_TURN,
  SQUARE_MILLIMETRES_PER_SQUARE_METRE,
  degrees,
  millimetres,
  radians,
  radiansToDegrees,
  squareMetres,
  type Degrees,
  type Millimetres,
  type Quantity,
  type SquareMetres,
} from '../units/types';

/** An area in square millimetres, the unit lengths are measured in. */
export type SquareMillimetres = Quantity<'mm2'>;

/**
 * A point picked on the drawing, in millimetres.
 *
 * `z` is the vertical axis: elevation above the project datum, the same
 * convention the levels use. It is optional so that a plan coordinate — the
 * units module's `PointMm`, a wall centreline end, a room outline vertex — can
 * be passed straight in; an absent elevation reads as `0`, which makes a plan
 * measurement the flat special case of the general one rather than a separate
 * code path.
 */
export interface MeasurePoint {
  readonly x: Millimetres;
  readonly y: Millimetres;
  /** Elevation above the datum; absent means the point sits on the datum. */
  readonly z?: Millimetres;
}

/** What was measured. */
export type MeasurementKind = 'distance' | 'chain' | 'angle' | 'area' | 'height';

/**
 * Decimals kept on a length so a result compares cleanly.
 *
 * A distance is a square root, so it is irrational far more often than not and
 * arrives a few ulps away from itself depending on the order of the subtraction.
 * A millionth of a millimetre is far below anything a drawing can express and
 * far above that noise.
 */
const LENGTH_PRECISION = 1e6;

/**
 * Decimals kept on an area.
 *
 * Coarser than the length precision on purpose: a floor plate of a few thousand
 * square metres is already hundreds of millions of square millimetres, and
 * asking for six more decimals of that would push the intermediate product past
 * what a double holds exactly.
 */
const AREA_PRECISION = 1e3;

function roundLength(value: number): Millimetres {
  return millimetres(Math.round(value * LENGTH_PRECISION) / LENGTH_PRECISION);
}

function roundAngle(value: number): Degrees {
  return degrees(Math.round(value * LENGTH_PRECISION) / LENGTH_PRECISION);
}

/** Tag a raw number as square millimetres. The one gate for this unit. */
export function squareMillimetres(value: number): SquareMillimetres {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite square millimetre value: ${String(value)}`);
  }
  return value as SquareMillimetres;
}

/** Elevation of a point; a point without one sits on the datum. */
export function elevationOf(point: MeasurePoint): Millimetres {
  return point.z ?? millimetres(0);
}

/** Difference between two points, per axis, as plain numbers. */
function deltaOf(from: MeasurePoint, to: MeasurePoint): readonly [number, number, number] {
  return [to.x - from.x, to.y - from.y, elevationOf(to) - elevationOf(from)];
}

/* -------------------------------------------------------------------------- */
/* The five measurements.                                                      */
/* -------------------------------------------------------------------------- */

/** Straight-line distance between two picked points. */
export interface DistanceMeasurement {
  readonly kind: 'distance';
  readonly points: readonly [MeasurePoint, MeasurePoint];
  readonly lengthMm: Millimetres;
}

/**
 * Distance between two points, through all three axes.
 *
 * Always defined: two coincident points are zero apart, which is a real answer
 * and a useful one when checking that two traced corners actually meet.
 */
export function measureDistance(from: MeasurePoint, to: MeasurePoint): DistanceMeasurement {
  const [dx, dy, dz] = deltaOf(from, to);
  return {
    kind: 'distance',
    points: [from, to],
    lengthMm: roundLength(Math.hypot(dx, dy, dz)),
  };
}

/** A run of consecutive points, with every leg kept. */
export interface ChainMeasurement {
  readonly kind: 'chain';
  readonly points: readonly MeasurePoint[];
  /** Leg `i` runs from `points[i]` to `points[i + 1]`. One shorter than `points`. */
  readonly segmentsMm: readonly Millimetres[];
  /** Sum of `segmentsMm`, so the parts always add up to the total on screen. */
  readonly totalMm: Millimetres;
}

/**
 * Measure a chain of consecutive points.
 *
 * The legs are kept alongside the total because that is how a dimension string
 * is checked on paper: the sheet prints the parts and the overall, and a
 * disagreement between them is exactly what the engineer is looking for. The
 * total is the sum of the reported legs rather than an independently computed
 * figure, so the two can never contradict each other by a rounding step.
 *
 * `null` for fewer than two points: one point is not a chain.
 */
export function measureChain(points: readonly MeasurePoint[]): ChainMeasurement | null {
  if (points.length < 2) {
    return null;
  }

  const segmentsMm: Millimetres[] = [];
  for (let index = 0; index + 1 < points.length; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (from === undefined || to === undefined) {
      continue;
    }
    segmentsMm.push(measureDistance(from, to).lengthMm);
  }

  const total = segmentsMm.reduce<number>((sum, length) => sum + length, 0);

  return {
    kind: 'chain',
    points: [...points],
    segmentsMm,
    totalMm: roundLength(total),
  };
}

/** The angle three picked points make at the middle one. */
export interface AngleMeasurement {
  readonly kind: 'angle';
  /** Start, vertex, end — the vertex is the middle point, where the angle is. */
  readonly points: readonly [MeasurePoint, MeasurePoint, MeasurePoint];
  /** The angle at the vertex, within `[0, 180]`. */
  readonly angleDeg: Degrees;
  /** The other way round the vertex, within `[180, 360]`. */
  readonly reflexDeg: Degrees;
  /** Length of each arm, in the order start-to-vertex, vertex-to-end. */
  readonly armsMm: readonly [Millimetres, Millimetres];
}

/**
 * Measure the angle at `vertex` between the arms reaching `start` and `end`.
 *
 * Taken from the dot product of the two arms, which needs no plane and so gives
 * the same answer for a plan pick and a 3D pick of the same corner. The result
 * is therefore unsigned: which side of the corner is "inside" is a question
 * about the room, not about the three points, so both readings are returned and
 * the caller says which one the sheet wants.
 *
 * `null` when an arm has no length: an angle to a point on top of the vertex
 * does not exist.
 */
export function measureAngle(
  start: MeasurePoint,
  vertex: MeasurePoint,
  end: MeasurePoint,
): AngleMeasurement | null {
  const [ax, ay, az] = deltaOf(vertex, start);
  const [bx, by, bz] = deltaOf(vertex, end);
  const firstArm = Math.hypot(ax, ay, az);
  const secondArm = Math.hypot(bx, by, bz);

  if (isNearlyZero(firstArm) || isNearlyZero(secondArm)) {
    return null;
  }

  // Rounding can push the quotient a hair outside the domain of `acos`, which
  // would answer `NaN` for two arms that are simply parallel.
  const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by + az * bz) / (firstArm * secondArm)));
  const angleDeg = roundAngle(radiansToDegrees(radians(Math.acos(cosine))));

  return {
    kind: 'angle',
    points: [start, vertex, end],
    angleDeg,
    reflexDeg: roundAngle(DEGREES_PER_TURN - angleDeg),
    armsMm: [roundLength(firstArm), roundLength(secondArm)],
  };
}

/** The area of a ring of points the user drew themselves. */
export interface AreaMeasurement {
  readonly kind: 'area';
  /** The ring; the first point is not repeated at the end. */
  readonly points: readonly MeasurePoint[];
  readonly areaMm2: SquareMillimetres;
  /** The same area in the unit the graph stores areas in. */
  readonly areaM2: SquareMetres;
  /** Once round the ring, including the leg that closes it. */
  readonly perimeterMm: Millimetres;
}

/**
 * Measure the area of a polygon drawn point by point.
 *
 * The ring is closed implicitly, so the caller must not repeat the first point.
 * The area is the magnitude of the summed cross products of the edges taken from
 * the first vertex, which is the shoelace formula lifted out of the plane: on a
 * plan pick, where every `z` is the same, it reduces to the shoelace sum exactly;
 * on a 3D pick of a planar ring it gives that plane's true area rather than its
 * shadow on the floor. Winding direction does not change the answer, because a
 * ring drawn clockwise is the same room as one drawn anticlockwise.
 *
 * A ring that crosses itself is measured as drawn, cancellation and all — the
 * fix for a crossed outline is to redraw it, not to have the tape quietly report
 * a number for a shape nobody meant.
 *
 * `null` for fewer than three points: two points bound no area.
 */
export function measurePolygonArea(points: readonly MeasurePoint[]): AreaMeasurement | null {
  if (points.length < 3) {
    return null;
  }

  const origin = points[0];
  if (origin === undefined) {
    return null;
  }

  let crossX = 0;
  let crossY = 0;
  let crossZ = 0;
  let perimeter = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) {
      continue;
    }

    perimeter += measureDistance(current, next).lengthMm;

    const [ax, ay, az] = deltaOf(origin, current);
    const [bx, by, bz] = deltaOf(origin, next);
    crossX += ay * bz - az * by;
    crossY += az * bx - ax * bz;
    crossZ += ax * by - ay * bx;
  }

  const areaMm2 = Math.round((Math.hypot(crossX, crossY, crossZ) / 2) * AREA_PRECISION) / AREA_PRECISION;

  return {
    kind: 'area',
    points: [...points],
    areaMm2: squareMillimetres(areaMm2),
    areaM2: squareMetres(
      Math.round((areaMm2 / SQUARE_MILLIMETRES_PER_SQUARE_METRE) * LENGTH_PRECISION) / LENGTH_PRECISION,
    ),
    perimeterMm: roundLength(perimeter),
  };
}

/** How far apart two points are up the vertical axis. */
export interface HeightMeasurement {
  readonly kind: 'height';
  readonly points: readonly [MeasurePoint, MeasurePoint];
  /** The vertical gap, never negative. */
  readonly heightMm: Millimetres;
  /** The same gap with a sign: positive when the second point is higher. */
  readonly riseMm: Millimetres;
  /** How far apart the two points are on the floor, which the height ignores. */
  readonly planDistanceMm: Millimetres;
}

/**
 * Measure the vertical distance between two points.
 *
 * This is the measurement a section drawing asks for — floor to soffit, sill to
 * floor, level to level — and it deliberately ignores how far apart the picks are
 * on the plan. That horizontal gap is reported alongside so the caller can see
 * what was ignored: two picks that are metres apart on the floor probably belong
 * to different parts of the building and the height between them means little.
 *
 * The signed rise is kept because a drop and a rise are not the same annotation,
 * and the sign is the only thing that tells them apart.
 */
export function measureHeight(from: MeasurePoint, to: MeasurePoint): HeightMeasurement {
  const [dx, dy, dz] = deltaOf(from, to);
  return {
    kind: 'height',
    points: [from, to],
    heightMm: roundLength(Math.abs(dz)),
    riseMm: roundLength(dz),
    planDistanceMm: roundLength(Math.hypot(dx, dy)),
  };
}

/* -------------------------------------------------------------------------- */
/* Saving a measurement as a note.                                             */
/* -------------------------------------------------------------------------- */

/** Any of the five measurements, told apart by `kind`. */
export type Measurement =
  | DistanceMeasurement
  | ChainMeasurement
  | AngleMeasurement
  | AreaMeasurement
  | HeightMeasurement;

/**
 * Id of a saved measurement, prefixed `MS-`.
 *
 * Two letters rather than one, because every single-letter prefix belongs to the
 * spatial graph's entity table and `M-` is already the dimension prefix. A
 * measurement note is not a graph entity: it records what a person checked, so
 * it carries no review metadata and points at no entity, and it must never be
 * mistaken for the dimension strings that are part of the drawing.
 */
export type MeasurementNoteId = `MS-${string}`;

/** Prefix every measurement note id carries. */
export const MEASUREMENT_NOTE_PREFIX = 'MS';

/** Digits in the sequence part of a note id, so ids sort as they were made. */
const SEQUENCE_LENGTH = 4;

const NOTE_ID_PATTERN = /^MS-(\d+)$/;

/**
 * The Vietnamese name shown for each measurement.
 *
 * Sentence case, no unit and no number: the note tells the reader which tape was
 * used, and the presentation layer formats the value next to it.
 */
export const MEASUREMENT_LABELS: Readonly<Record<MeasurementKind, string>> = {
  distance: 'Khoảng cách hai điểm',
  chain: 'Chuỗi điểm liên tiếp',
  angle: 'Góc ba điểm',
  area: 'Diện tích đa giác',
  height: 'Chiều cao theo trục đứng',
};

/** A measurement kept on the sheet, with its code, its name and its level. */
export interface MeasurementNote {
  readonly id: MeasurementNoteId;
  /** The level the measurement was taken on. */
  readonly levelId: LevelId;
  /** Vietnamese name shown in the list; defaults to the kind's label. */
  readonly label: string;
  readonly measurement: Measurement;
}

/** Build the id for a given sequence number. */
export function createMeasurementNoteId(sequence: number): MeasurementNoteId {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Note sequence must be a positive integer: ${String(sequence)}`);
  }
  return `${MEASUREMENT_NOTE_PREFIX}-${String(sequence).padStart(SEQUENCE_LENGTH, '0')}`;
}

/** Read the sequence number back out of an id; `null` when it is not one. */
export function readMeasurementNoteSequence(id: string): number | null {
  const match = NOTE_ID_PATTERN.exec(id);
  const digits = match?.[1];
  if (digits === undefined) {
    return null;
  }
  const sequence = Number.parseInt(digits, 10);
  return Number.isInteger(sequence) && sequence >= 1 ? sequence : null;
}

export interface CreateMeasurementNoteOptions {
  /** The level the measurement belongs to. */
  readonly levelId: LevelId;
  /** Position in the list; decides the id. */
  readonly sequence: number;
  /** Overrides the default Vietnamese label, for a measurement worth naming. */
  readonly label?: string;
}

/**
 * Turn a measurement into a note.
 *
 * The sequence number is an argument rather than a counter hidden in the module,
 * which is what lets the whole module stay pure: the same measurement saved as
 * the same sequence on the same level is always the same note, so a test, an
 * undo and a reload all produce identical data. `appendMeasurementNote` is the
 * everyday way in and works the sequence out from the notes already saved.
 */
export function createMeasurementNote(
  measurement: Measurement,
  options: CreateMeasurementNoteOptions,
): MeasurementNote {
  return {
    id: createMeasurementNoteId(options.sequence),
    levelId: options.levelId,
    label: options.label ?? MEASUREMENT_LABELS[measurement.kind],
    measurement,
  };
}

export interface AppendMeasurementNoteOptions {
  readonly levelId: LevelId;
  readonly label?: string;
}

/**
 * Save a measurement onto the end of the list.
 *
 * The next sequence is one past the highest already in the list — across every
 * level, so the codes on screen never repeat even when the engineer is measuring
 * two floors at once. Ids are never reused after a deletion, because a note that
 * was discussed as `MS-0003` must not come back as a different measurement.
 */
export function appendMeasurementNote(
  notes: readonly MeasurementNote[],
  measurement: Measurement,
  options: AppendMeasurementNoteOptions,
): readonly MeasurementNote[] {
  const highest = notes.reduce<number>(
    (highestSoFar, note) => Math.max(highestSoFar, readMeasurementNoteSequence(note.id) ?? 0),
    0,
  );

  const sequence = highest + 1;
  const note =
    options.label === undefined
      ? createMeasurementNote(measurement, { levelId: options.levelId, sequence })
      : createMeasurementNote(measurement, {
          levelId: options.levelId,
          sequence,
          label: options.label,
        });

  return [...notes, note];
}

/** The empty list, shared so a cleared board is always the same value. */
const NO_MEASUREMENT_NOTES: readonly MeasurementNote[] = Object.freeze([]);

/**
 * Throw every saved measurement away.
 *
 * A named operation rather than an inline `[]` at the call site, so the store
 * commits it under one label and the single undo toast can put the whole board
 * back.
 */
export function clearMeasurementNotes(): readonly MeasurementNote[] {
  return NO_MEASUREMENT_NOTES;
}

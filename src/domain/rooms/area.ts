/**
 * Measuring a room, and being able to show the working.
 *
 * The area is the number a client reads first and argues about longest. When
 * two people disagree about a room, they are never really disagreeing about
 * arithmetic — they are disagreeing about which line was measured, or about
 * where a rounding happened. So this module is built so that both can be shown:
 * `explainArea` hands back every term that went into the sum, and `explainRoom`
 * renders it as a sentence a person can check against a scale rule.
 *
 * Two rules make that possible, and neither is negotiable:
 *
 * - **Add up in square millimetres, convert once.** A plan sits on the
 *   millimetre grid, so every cross product in the shoelace sum is a whole
 *   number, and whole numbers of that size add exactly in a double. Convert to
 *   square metres first and the same sum drifts in the last decimal — the
 *   fourteenth room comes out at 248,5999 and someone has to explain why.
 * - **Round once, at the end, to two decimals.** Never in the middle, and never
 *   twice. `totalArea` therefore sums the raw square millimetres of every room
 *   and rounds the total, rather than adding up figures that have each already
 *   been rounded.
 *
 * The rest of the module is about placing the label. The area centroid is the
 * honest centre of a room but it falls outside a U-shaped one, so it cannot be
 * where the name is drawn; `computeLargestInnerRectangle` finds the biggest
 * empty box that genuinely fits, which can be.
 *
 * Every function is pure: no argument is written to, and the same outline always
 * gives the same answer, down to the last digit.
 */

import { compareNearly, isNearlyZero, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import {
  millimetres,
  squareMetres,
  SQUARE_MILLIMETRES_PER_SQUARE_METRE,
  type Millimetres,
  type SquareMetres,
} from '../units/types';
import { formatNumber } from '../../lib/format/number';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Decimals a published area carries. Two, everywhere, always. */
export const AREA_DECIMALS = 2;

/** What one edge of the outline contributed to the shoelace sum. */
export interface AreaTerm {
  readonly from: PointMm;
  readonly to: PointMm;
  /** `from.x × to.y − to.x × from.y`, in square millimetres. */
  readonly crossMm2: number;
}

/** Everything that went into an area, so the number can be defended. */
export interface AreaBreakdown {
  /** One term per edge, in the order the outline lists them. */
  readonly terms: readonly AreaTerm[];
  /** The terms added up: twice the signed area, in square millimetres. */
  readonly doubleAreaMm2: number;
  /** Half of that, unsigned, still in square millimetres and still unrounded. */
  readonly areaMm2: number;
  /** The published figure: square metres, rounded once, to two decimals. */
  readonly areaM2: SquareMetres;
  readonly perimeterMm: Millimetres;
  readonly centroid: PointMm;
  /** Were the vertices counter-clockwise? Clockwise ones sum negative. */
  readonly counterClockwise: boolean;
  /** Did every vertex sit on the millimetre grid, making the sum exact? */
  readonly onMillimetreGrid: boolean;
}

/** The biggest empty box inside a room; where its name can be drawn. */
export interface LabelRectangle {
  readonly min: PointMm;
  readonly max: PointMm;
  readonly widthMm: Millimetres;
  readonly heightMm: Millimetres;
  readonly areaM2: SquareMetres;
}

/** The least a room has to be for its area to be explained. */
export interface ExplainableRoom {
  /** Closed outline, first vertex not repeated at the end. */
  readonly outline: readonly PointMm[];
  /** Shown at the head of the explanation, when the room has a name yet. */
  readonly name?: string;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** Fewer corners than this and a shape encloses nothing at all. */
const MIN_POLYGON_VERTICES = 3;

/** Ten to the power of `AREA_DECIMALS`; the grid a published area lands on. */
const AREA_ROUNDING = 100;

function itemAt<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(
      `Index ${String(index)} falls outside a list of ${String(items.length)} items.`,
    );
  }
  return item;
}

/** Read a list cyclically, so `-1` is the last item and `length` the first. */
function cyclicAt<TItem>(items: readonly TItem[], index: number): TItem {
  const count = items.length;
  return itemAt(items, ((index % count) + count) % count);
}

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

/**
 * Round an area onto two decimals, halfway values away from zero.
 *
 * The rounding repeats `roundMeasurement` rather than calling it, because that
 * function takes millimetres; letting an area through it is exactly the unit
 * mix-up the labelled types exist to prevent.
 */
function roundArea(valueM2: number): SquareMetres {
  const scaled = valueM2 * AREA_ROUNDING;
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  // `-0` is the same area as `0` but a different value to `Object.is`, and it
  // prints with a minus sign. Callers get the positive form.
  return squareMetres(rounded === 0 ? 0 : rounded / AREA_ROUNDING);
}

/**
 * The shoelace sum, in square millimetres.
 *
 * Whole millimetres give whole cross products, and whole numbers this size add
 * exactly in a double — up to the safe-integer limit, past which they silently
 * stop doing so. A building would have to be tens of kilometres across to get
 * there, but a corrupt coordinate gets there immediately, so the limit is
 * checked rather than assumed.
 *
 * @throws RangeError when the running sum leaves the range doubles count in.
 */
function doubleSignedAreaMm2(outline: readonly PointMm[]): number {
  let total = 0;

  for (let index = 0; index < outline.length; index += 1) {
    const from = itemAt(outline, index);
    const to = cyclicAt(outline, index + 1);
    total += from.x * to.y - to.x * from.y;

    if (!Number.isFinite(total) || Math.abs(total) > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(
        `Outline area left the range whole millimetres add up exactly in: ${String(total)} mm².`,
      );
    }
  }

  return total;
}

/* -------------------------------------------------------------------------- */
/* Area.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Signed area in square millimetres, unrounded.
 *
 * Negative when the outline runs clockwise, which is how a caller tells the
 * outside of a building from the inside of a room. This is the primitive to
 * reach for when several areas have to be added: sum these, and round once at
 * the end, rather than rounding each one and adding the results.
 */
export function signedAreaMm2(outline: readonly PointMm[]): number {
  if (outline.length < MIN_POLYGON_VERTICES) {
    return 0;
  }
  return doubleSignedAreaMm2(outline) / 2;
}

/**
 * The area of a room, in square metres, rounded once to two decimals.
 *
 * The winding does not matter: a room has an area whichever way round its
 * corners were listed, so the sign is dropped.
 */
export function computeArea(outline: readonly PointMm[]): SquareMetres {
  return roundArea(Math.abs(signedAreaMm2(outline)) / SQUARE_MILLIMETRES_PER_SQUARE_METRE);
}

/**
 * The area of several rooms together.
 *
 * The whole point of this function is that it is not the sum of `computeArea`
 * over the same outlines: it adds up square millimetres and rounds the total
 * once. Rounding fourteen rooms and then adding them can land a centimetre away
 * from the truth, and that centimetre is what gets argued about.
 */
export function totalArea(outlines: readonly (readonly PointMm[])[]): SquareMetres {
  const totalMm2 = outlines.reduce((sum, outline) => sum + Math.abs(signedAreaMm2(outline)), 0);
  return roundArea(totalMm2 / SQUARE_MILLIMETRES_PER_SQUARE_METRE);
}

/* -------------------------------------------------------------------------- */
/* Perimeter, centroid, label box.                                             */
/* -------------------------------------------------------------------------- */

/** The distance round the outline, closing back to the first vertex. */
export function computePerimeter(outline: readonly PointMm[]): Millimetres {
  if (outline.length < 2) {
    return millimetres(0);
  }

  let total = 0;
  for (let index = 0; index < outline.length; index += 1) {
    total += distanceBetween(itemAt(outline, index), cyclicAt(outline, index + 1));
  }
  return millimetres(total);
}

/**
 * The centre of area of the outline.
 *
 * This is the balance point of the floor, not the average of the corners: a
 * room with four corners bunched at one end would have its vertex average
 * dragged over there, while the area centroid stays where the floor actually
 * is. A shape enclosing nothing has no balance point, so that case falls back
 * to the vertex average rather than dividing by zero.
 */
export function computeCentroid(outline: readonly PointMm[]): PointMm {
  if (outline.length === 0) {
    return pointAt(0, 0);
  }

  const vertexAverage = (): PointMm => {
    const total = outline.reduce((sum, corner) => ({ x: sum.x + corner.x, y: sum.y + corner.y }), {
      x: 0,
      y: 0,
    });
    return pointAt(total.x / outline.length, total.y / outline.length);
  };

  if (outline.length < MIN_POLYGON_VERTICES) {
    return vertexAverage();
  }

  const doubleArea = doubleSignedAreaMm2(outline);
  if (isNearlyZero(doubleArea)) {
    return vertexAverage();
  }

  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const from = itemAt(outline, index);
    const to = cyclicAt(outline, index + 1);
    const cross = from.x * to.y - to.x * from.y;
    weightedX += (from.x + to.x) * cross;
    weightedY += (from.y + to.y) * cross;
  }

  return pointAt(weightedX / (3 * doubleArea), weightedY / (3 * doubleArea));
}

/**
 * Is this point inside the outline?
 *
 * A ray is cast east from the point and the crossings are counted: odd means
 * inside. Points exactly on an edge are not promised either answer, because
 * there is no answer — an outline is a line, and a point on it is on the
 * boundary of both sides.
 */
export function outlineContains(outline: readonly PointMm[], point: PointMm): boolean {
  let inside = false;

  for (let index = 0; index < outline.length; index += 1) {
    const from = itemAt(outline, index);
    const to = cyclicAt(outline, index + 1);
    if (from.y > point.y === to.y > point.y) {
      continue;
    }
    const crossingX = from.x + ((point.y - from.y) / (to.y - from.y)) * (to.x - from.x);
    if (point.x < crossingX) {
      inside = !inside;
    }
  }

  return inside;
}

/** The unique coordinates a set of vertices sits on, in order. */
function gridLines(values: readonly number[]): number[] {
  const sorted = [...values].sort((first, second) => first - second);
  const lines: number[] = [];
  for (const value of sorted) {
    const last = lines[lines.length - 1];
    if (last === undefined || !isNearlyZero(value - last)) {
      lines.push(value);
    }
  }
  return lines;
}

/**
 * Does this edge cut through the inside of the box?
 *
 * The segment is clipped against the box a side at a time; if anything of it
 * survives with length to spare, it passed through. Running along a side does
 * not count, which is what keeps a wall from disqualifying the cell it bounds.
 */
function crossesBox(from: PointMm, to: PointMm, min: PointMm, max: PointMm): boolean {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  let entry = 0;
  let exit = 1;

  const clip = (edge: number, room: number): boolean => {
    if (isNearlyZero(edge)) {
      // Parallel to this pair of sides: it is either inside them or nowhere.
      return room > 0 && !isNearlyZero(room);
    }
    const at = room / edge;
    if (edge < 0) {
      if (at > exit) {
        return false;
      }
      entry = Math.max(entry, at);
    } else {
      if (at < entry) {
        return false;
      }
      exit = Math.min(exit, at);
    }
    return true;
  };

  const survives =
    clip(-runX, from.x - min.x) &&
    clip(runX, max.x - from.x) &&
    clip(-runY, from.y - min.y) &&
    clip(runY, max.y - from.y);

  return survives && (exit - entry) * Math.hypot(runX, runY) > 0;
}

/** Is the whole of this cell inside the outline? */
function isCellInside(outline: readonly PointMm[], min: PointMm, max: PointMm): boolean {
  const centre = pointAt((min.x + max.x) / 2, (min.y + max.y) / 2);
  if (!outlineContains(outline, centre)) {
    return false;
  }

  for (let index = 0; index < outline.length; index += 1) {
    const from = itemAt(outline, index);
    const to = cyclicAt(outline, index + 1);
    // A wall on a grid line bounds cells without entering any, and every grid
    // line passes through a vertex, so only a sloping edge can cut a cell.
    if (isNearlyZero(from.x - to.x) || isNearlyZero(from.y - to.y)) {
      continue;
    }
    if (crossesBox(from, to, min, max)) {
      return false;
    }
  }

  return true;
}

/** Is this box a better home for the label than the one in hand? */
function isBetterLabelBox(candidate: LabelRectangle, incumbent: LabelRectangle): boolean {
  const byArea = compareNearly(candidate.areaM2, incumbent.areaM2);
  if (byArea !== 0) {
    return byArea > 0;
  }
  const byX = compareNearly(candidate.min.x, incumbent.min.x);
  if (byX !== 0) {
    return byX < 0;
  }
  return compareNearly(candidate.min.y, incumbent.min.y) < 0;
}

function labelRectangle(min: PointMm, max: PointMm): LabelRectangle {
  const widthMm = millimetres(max.x - min.x);
  const heightMm = millimetres(max.y - min.y);
  return {
    min,
    max,
    widthMm,
    heightMm,
    areaM2: squareMetres((widthMm * heightMm) / SQUARE_MILLIMETRES_PER_SQUARE_METRE),
  };
}

/**
 * The largest axis-aligned rectangle that fits inside the outline.
 *
 * This is where a room label goes. The centroid will not do: in a U-shaped
 * room it lands in the notch, outside the floor, and the name is drawn over a
 * wall. The biggest box that genuinely fits is always somewhere a reader would
 * accept, and it comes with the room it has to fit in.
 *
 * The search works on the grid the vertices already define: every corner of a
 * maximal box lies on one of those lines, so a rectilinear room — which is what
 * almost every room is — gets the exact answer. A room with a sloping wall gets
 * a box that is inside for certain, at the cost of being a little smaller than
 * the true maximum. Ties go to the box nearest the origin, so two runs never
 * disagree.
 *
 * `null` when nothing fits: fewer than three corners, or an outline so thin it
 * has no inside.
 */
export function computeLargestInnerRectangle(outline: readonly PointMm[]): LabelRectangle | null {
  if (outline.length < MIN_POLYGON_VERTICES) {
    return null;
  }

  const xs = gridLines(outline.map((corner) => corner.x));
  const ys = gridLines(outline.map((corner) => corner.y));
  const columns = xs.length - 1;
  const rows = ys.length - 1;
  if (columns < 1 || rows < 1) {
    return null;
  }

  const inside = Array.from({ length: rows }, (_unused, row) =>
    Array.from({ length: columns }, (_ignored, column) =>
      isCellInside(
        outline,
        pointAt(itemAt(xs, column), itemAt(ys, row)),
        pointAt(itemAt(xs, column + 1), itemAt(ys, row + 1)),
      ),
    ),
  );

  let best: LabelRectangle | null = null;

  for (let top = 0; top < rows; top += 1) {
    const usable = new Array<boolean>(columns).fill(true);

    for (let bottom = top; bottom < rows; bottom += 1) {
      const row = itemAt(inside, bottom);
      for (let column = 0; column < columns; column += 1) {
        usable[column] = itemAt(usable, column) && itemAt(row, column);
      }

      // Every unbroken run of usable columns is one candidate box.
      let runStart = -1;
      for (let column = 0; column <= columns; column += 1) {
        if (column < columns && itemAt(usable, column)) {
          runStart = runStart < 0 ? column : runStart;
          continue;
        }
        if (runStart < 0) {
          continue;
        }
        const candidate = labelRectangle(
          pointAt(itemAt(xs, runStart), itemAt(ys, top)),
          pointAt(itemAt(xs, column), itemAt(ys, bottom + 1)),
        );
        if (best === null || isBetterLabelBox(candidate, best)) {
          best = candidate;
        }
        runStart = -1;
      }
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Explaining the number.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every step of the area calculation, ready to be shown.
 *
 * The interface can render this however it likes; `explainRoom` renders one
 * particular way. What matters is that the terms are the ones actually added,
 * not a retelling, so a reader who checks the arithmetic finds it correct.
 */
export function explainArea(outline: readonly PointMm[]): AreaBreakdown {
  const terms: AreaTerm[] = outline.map((from, index) => {
    const to = cyclicAt(outline, index + 1);
    return { from, to, crossMm2: from.x * to.y - to.x * from.y };
  });

  const doubleAreaMm2 = outline.length < MIN_POLYGON_VERTICES ? 0 : doubleSignedAreaMm2(outline);
  const areaMm2 = Math.abs(doubleAreaMm2) / 2;

  return {
    terms,
    doubleAreaMm2,
    areaMm2,
    areaM2: roundArea(areaMm2 / SQUARE_MILLIMETRES_PER_SQUARE_METRE),
    perimeterMm: computePerimeter(outline),
    centroid: computeCentroid(outline),
    counterClockwise: doubleAreaMm2 > 0,
    onMillimetreGrid: outline.every(
      (corner) => Number.isInteger(corner.x) && Number.isInteger(corner.y),
    ),
  };
}

/** Whole numbers read as whole numbers; the rest keep two decimals. */
function formatLength(value: number): string {
  return Number.isInteger(value) ? formatNumber(value, { fractionDigits: 0 }) : formatNumber(value, { fractionDigits: AREA_DECIMALS });
}

function formatPoint(point: PointMm): string {
  return `(${formatLength(point.x)}; ${formatLength(point.y)})`;
}

/**
 * Why the area is the number it is, in Vietnamese, for the reader who asked.
 *
 * The text names every edge, gives every cross product, and shows the two
 * divisions at the end, so the answer to "vì sao ra số này" is the calculation
 * itself rather than a promise that it was done properly.
 */
export function explainRoom(room: ExplainableRoom): string {
  const breakdown = explainArea(room.outline);
  const heading = room.name ?? 'Phòng chưa đặt tên';

  if (room.outline.length < MIN_POLYGON_VERTICES) {
    return (
      `${heading} — chưa có diện tích.\n\n` +
      `Ranh phòng mới có ${formatNumber(room.outline.length, { fractionDigits: 0 })} đỉnh. ` +
      'Dưới ba đỉnh thì hình chưa khép, nên chưa bao lấy mặt sàn nào để đo.'
    );
  }

  const lines: string[] = [
    `${heading} — ${formatNumber(breakdown.areaM2, { fractionDigits: AREA_DECIMALS })} m²`,
    '',
    `Diện tích lấy theo công thức dây giày trên ${formatNumber(room.outline.length, { fractionDigits: 0 })} đỉnh ` +
      'của mép thông thuỷ. Mỗi cạnh góp một tích chéo x1 × y2 − x2 × y1; các tích chéo ' +
      'cộng dồn ở đơn vị mm², chia đôi, rồi mới đổi sang m².',
    '',
  ];

  if (!breakdown.onMillimetreGrid) {
    lines.push(
      'Có đỉnh không nằm trọn trên lưới milimét, nên các số dưới đây được hiển thị làm ' +
        'tròn để dễ đọc; phép cộng vẫn dùng giá trị đầy đủ.',
      '',
    );
  }

  breakdown.terms.forEach((term, index) => {
    lines.push(
      `Cạnh ${formatNumber(index + 1, { fractionDigits: 0 })}: ${formatPoint(term.from)} → ${formatPoint(term.to)}` +
        ` — tích chéo ${formatLength(term.crossMm2)} mm²`,
    );
  });

  lines.push(
    '',
    `Tổng tích chéo: ${formatLength(breakdown.doubleAreaMm2)} mm²`,
    `Chia đôi: ${formatLength(breakdown.areaMm2)} mm²`,
    `Đổi sang mét vuông: ${formatLength(breakdown.areaMm2)} ÷ ` +
      `${formatNumber(SQUARE_MILLIMETRES_PER_SQUARE_METRE, { fractionDigits: 0 })} = ` +
      `${formatNumber(breakdown.areaM2, { fractionDigits: AREA_DECIMALS })} m²`,
  );

  if (!breakdown.counterClockwise) {
    lines.push(
      '',
      'Các đỉnh đang liệt kê theo chiều kim đồng hồ nên tổng mang dấu âm; diện tích lấy ' +
        'trị tuyệt đối, không đổi kết quả.',
    );
  }

  lines.push(
    '',
    `Chu vi ${formatLength(breakdown.perimeterMm)} mm. ` +
      `Trọng tâm tại ${formatPoint(breakdown.centroid)} mm.`,
    `Chỉ làm tròn đúng một lần, ở bước cuối, lấy ${formatNumber(AREA_DECIMALS, { fractionDigits: 0 })} chữ số thập phân.`,
  );

  return lines.join('\n');
}

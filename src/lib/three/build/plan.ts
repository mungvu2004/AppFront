/**
 * What a storey is made of, worked out before any of it becomes geometry.
 *
 * Between the model and the meshes there is a layer that is neither: which
 * openings can be cut into a wall, where the wall's face has to step up and over
 * a doorway, which stretch of it is left solid, and how thick a slab is. None of
 * that needs three.js — it is arithmetic on millimetres — and **that is why this
 * file exists**.
 *
 * The geometry is built in two places that cannot share a line of three.js
 * between them. `wall.ts` and `floor.ts` run on the main thread and extrude with
 * `THREE.Shape`; `build.worker.ts` runs on a worker, where importing three would
 * drag a renderer into a context with nothing to render on, and so writes its own
 * triangles. Two builders, one plan: everything they must agree about lives here,
 * so that agreeing is not something either of them has to remember.
 *
 * What that buys, concretely: a wall rebuilt incrementally in the worker cuts the
 * same openings, refuses the same ones, and refuses them with the same Vietnamese
 * sentence as the same wall rebuilt on the main thread. Not "checked to be the
 * same" — the same function produced both.
 *
 * Everything here is pure, takes millimetres and returns millimetres, and the one
 * thing it never does is decide how a triangle is made.
 */

import { compareNearly } from '@/domain/units/compare';
import { millimetres, type Millimetres } from '@/domain/units/types';
import { openingSpan } from '@/domain/openings/validate';
import {
  describeOpeningKind,
  isAttached,
  type AttachedOpening,
  type Opening,
} from '@/domain/openings/types';
import type { OpeningId } from '@/domain/spatial/types';
import type { Wall } from '@/domain/walls/types';

/* -------------------------------------------------------------------------- */
/* Dimensions.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How thick a generated slab is, floor and ceiling alike.
 *
 * Defined here rather than in `floor.ts`, which re-exports it, so that the worker
 * can read the number without reaching through a module that imports three. One
 * definition; a slab built either side of the thread boundary is the same slab.
 */
export const SLAB_THICKNESS_MM: Millimetres = millimetres(150);

/**
 * How thick the panel hung in an opening is.
 *
 * A door leaf and a sealed unit are not the same thickness in life, but the panel
 * is a handle to click and a surface to shade, not a joinery drawing, and one
 * number keeps it from pretending to be more than that. Forty millimetres always
 * fits: the thinnest wall the model accepts is 60 mm.
 */
export const OPENING_PANEL_THICKNESS_MM: Millimetres = millimetres(40);

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Why an opening was left uncut. */
export type CutRefusalReason =
  /** A width or a height that is not a positive length. */
  | 'sizeNotPositive'
  /** The opening reaches past one of the wall ends. */
  | 'pastWallEnd'
  /** The head sits above the top of the wall. */
  | 'aboveWallTop'
  /** The sill sits below the base of the wall. */
  | 'belowWallBase'
  /** Another opening already occupies that stretch of the wall. */
  | 'overlapsAnother';

/**
 * An opening the wall could not be built with, and the sentence explaining it.
 *
 * The sentence is composed here, not by whichever builder happened to run: it is
 * plain string work over `describeOpeningKind` and a number format, so a worker
 * can produce it as well as the main thread can, and a reviewer reading a refusal
 * cannot tell — or need to care — which thread built the wall.
 *
 * Every field is a string or a number, so the whole thing survives a
 * `postMessage` unchanged.
 */
export interface CutRefusal {
  readonly openingId: OpeningId;
  readonly reason: CutRefusalReason;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

/** One rectangle to be taken out of the wall elevation, in the wall's own frame. */
export interface OpeningCut {
  readonly openingId: OpeningId;
  /** Along the centreline from the `start` end. */
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
  /** Above the base of the wall. */
  readonly sillMm: Millimetres;
  readonly headMm: Millimetres;
  readonly standsOnBase: boolean;
  readonly reachesTop: boolean;
}

/** A corner of the flat elevation, still in millimetres. */
export interface Corner {
  readonly alongMm: Millimetres;
  readonly heightMm: Millimetres;
}

/** An axis-aligned piece of the flat elevation, in millimetres. */
export interface FaceRect {
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
  readonly bottomMm: Millimetres;
  readonly topMm: Millimetres;
}

/** A stretch of wall between two full-height openings, with what is cut from it. */
export interface Panel {
  readonly fromMm: Millimetres;
  readonly toMm: Millimetres;
  readonly cuts: readonly OpeningCut[];
}

/** What `planCuts` worked out about one wall. */
export interface WallCutPlan {
  readonly cuts: readonly OpeningCut[];
  readonly refusals: readonly CutRefusal[];
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** No length at all, as a labelled quantity. */
const ZERO_MM: Millimetres = millimetres(0);

/**
 * One unbroken stretch of the top or bottom edge, at one height.
 *
 * The edges of a wall elevation are staircases: the bottom runs along the base
 * except where a doorway lifts it to a head, the top runs along the wall top
 * except where a clerestory drops it to a sill. Building each edge as runs first
 * and turning the runs into corners afterwards is what keeps an opening that
 * lands exactly on a wall end from producing a zero-length spike, which is the
 * one input that makes a triangulator give up.
 */
interface EdgeRun {
  readonly fromMm: Millimetres;
  readonly toMm: Millimetres;
  readonly levelMm: Millimetres;
}

/** A length with the Vietnamese decimal comma; whole values keep no decimal. */
function formatLength(valueMm: Millimetres): string {
  const rounded = Math.round(valueMm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} mm`;
}

/** "Cửa đi D-3", for the start of a sentence. */
function nameOf(opening: AttachedOpening): string {
  return `${describeOpeningKind(opening.kind)} ${opening.id}`;
}

/** The sentence every refusal ends with, so all of them read the same way. */
const REFUSAL_TAIL = 'nên tường được dựng mà không khoét lỗ này.';

/** The staircase one edge of a panel draws, as runs at their own heights. */
function edgeRuns(
  fromMm: Millimetres,
  toMm: Millimetres,
  plainLevelMm: Millimetres,
  notches: readonly OpeningCut[],
  levelOf: (notch: OpeningCut) => Millimetres,
): readonly EdgeRun[] {
  const runs: EdgeRun[] = [];
  let cursorMm = fromMm;

  for (const notch of notches) {
    if (compareNearly(notch.lowMm, cursorMm) > 0) {
      runs.push({ fromMm: cursorMm, toMm: notch.lowMm, levelMm: plainLevelMm });
    }
    runs.push({ fromMm: notch.lowMm, toMm: notch.highMm, levelMm: levelOf(notch) });
    cursorMm = notch.highMm;
  }

  if (compareNearly(toMm, cursorMm) > 0) {
    runs.push({ fromMm: cursorMm, toMm, levelMm: plainLevelMm });
  }

  return runs;
}

/** Walk a staircase of runs and emit its corners, in the direction given. */
function runCorners(runs: readonly EdgeRun[], leftToRight: boolean): readonly Corner[] {
  const walk = leftToRight ? runs : [...runs].reverse();
  const corners: Corner[] = [];

  walk.forEach((run, index) => {
    const entryMm = leftToRight ? run.fromMm : run.toMm;
    const previous = walk[index - 1];

    if (previous !== undefined) {
      corners.push({ alongMm: entryMm, heightMm: previous.levelMm });
    }
    corners.push({ alongMm: entryMm, heightMm: run.levelMm });
  });

  const last = walk[walk.length - 1];
  if (last !== undefined) {
    corners.push({ alongMm: leftToRight ? last.toMm : last.fromMm, heightMm: last.levelMm });
  }

  return corners;
}

/** Drop corners that repeat the one before, and the one that closes the loop. */
function dropRepeatedCorners(corners: readonly Corner[]): readonly Corner[] {
  const same = (first: Corner, second: Corner): boolean =>
    compareNearly(first.alongMm, second.alongMm) === 0 &&
    compareNearly(first.heightMm, second.heightMm) === 0;

  const kept: Corner[] = [];

  for (const corner of corners) {
    const previous = kept[kept.length - 1];
    if (previous === undefined || !same(previous, corner)) {
      kept.push(corner);
    }
  }

  const first = kept[0];
  const last = kept[kept.length - 1];
  if (kept.length > 1 && first !== undefined && last !== undefined && same(first, last)) {
    kept.pop();
  }

  return kept;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/** The openings on this wall, in a fixed order, whatever order they arrived in. */
export function openingsOnWall(
  wall: Wall,
  openings: readonly Opening[],
): readonly AttachedOpening[] {
  return openings
    .filter(
      (opening): opening is AttachedOpening => isAttached(opening) && opening.wallId === wall.id,
    )
    .slice()
    .sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
}

/**
 * Which openings can be cut into a wall, and why the rest cannot.
 *
 * The order of the checks is the order a reader needs them: a size that is not a
 * length is wrong before anything else can be asked about it, a hole outside the
 * wall body is wrong before it can be compared with its neighbours, and only then
 * does an overlap mean anything. An opening is compared against those already
 * accepted, so of two openings in the same place the earlier id keeps its hole.
 *
 * Nothing is repaired. An opening that does not fit comes back in `refusals` with
 * a sentence naming it, and the wall is built without it — shrinking it to fit
 * would build a model that disagrees with the drawing somebody measured.
 */
export function planCuts(
  wall: Wall,
  openings: readonly AttachedOpening[],
  lengthMm: Millimetres,
  heightMm: Millimetres,
): WallCutPlan {
  const cuts: OpeningCut[] = [];
  const refusals: CutRefusal[] = [];

  const refuse = (opening: AttachedOpening, reason: CutRefusalReason, detail: string): void => {
    refusals.push({
      openingId: opening.id,
      reason,
      message: `${nameOf(opening)} ${detail} ${REFUSAL_TAIL}`,
    });
  };

  for (const opening of openings) {
    if (
      compareNearly(opening.widthMm, ZERO_MM) <= 0 ||
      compareNearly(opening.heightMm, ZERO_MM) <= 0
    ) {
      refuse(
        opening,
        'sizeNotPositive',
        `có kích thước ${formatLength(opening.widthMm)} × ${formatLength(opening.heightMm)} ` +
          'không phải chiều dài dương',
      );
      continue;
    }

    const span = openingSpan(wall, opening);
    const sillMm = opening.sillHeightMm;
    const headMm = millimetres(sillMm + opening.heightMm);

    if (compareNearly(span.lowMm, ZERO_MM) < 0 || compareNearly(span.highMm, lengthMm) > 0) {
      refuse(
        opening,
        'pastWallEnd',
        `trải từ ${formatLength(span.lowMm)} đến ${formatLength(span.highMm)} trên tường ` +
          `${wall.id} dài ${formatLength(lengthMm)}`,
      );
      continue;
    }

    if (compareNearly(sillMm, ZERO_MM) < 0) {
      refuse(
        opening,
        'belowWallBase',
        `có bệ thấp hơn chân tường ${formatLength(millimetres(-sillMm))}`,
      );
      continue;
    }

    if (compareNearly(headMm, heightMm) > 0) {
      refuse(
        opening,
        'aboveWallTop',
        `có đỉnh ở cao độ ${formatLength(headMm)} so với chân tường, vượt chiều cao ` +
          `${formatLength(heightMm)}`,
      );
      continue;
    }

    const clash = cuts.find(
      (taken) =>
        compareNearly(span.lowMm, taken.highMm) < 0 && compareNearly(span.highMm, taken.lowMm) > 0,
    );
    if (clash !== undefined) {
      refuse(opening, 'overlapsAnother', `chồng lên ${clash.openingId} trên cùng một đoạn tường`);
      continue;
    }

    cuts.push({
      openingId: opening.id,
      lowMm: span.lowMm,
      highMm: span.highMm,
      sillMm,
      headMm,
      standsOnBase: compareNearly(sillMm, ZERO_MM) === 0,
      reachesTop: compareNearly(headMm, heightMm) === 0,
    });
  }

  cuts.sort((first, second) => compareNearly(first.lowMm, second.lowMm));

  return { cuts, refusals };
}

/**
 * Split the wall at every full-height opening and hand each cut to its panel.
 *
 * An opening that reaches both the base and the top leaves no wall above or below
 * it, so there is nothing to hold a hole together: the wall is two panels with a
 * gap between them, which the builders extrude into one geometry so the wall
 * stays one mesh with one id.
 */
export function planPanels(cuts: readonly OpeningCut[], lengthMm: Millimetres): readonly Panel[] {
  const splitters = cuts.filter((cut) => cut.standsOnBase && cut.reachesTop);
  const bounds: Millimetres[] = [ZERO_MM];

  for (const splitter of splitters) {
    bounds.push(splitter.lowMm, splitter.highMm);
  }
  bounds.push(lengthMm);

  const panels: Panel[] = [];

  for (let index = 0; index + 1 < bounds.length; index += 2) {
    const fromMm = bounds[index];
    const toMm = bounds[index + 1];
    if (fromMm === undefined || toMm === undefined || compareNearly(toMm, fromMm) <= 0) {
      continue;
    }

    panels.push({
      fromMm,
      toMm,
      cuts: cuts.filter(
        (cut) =>
          !(cut.standsOnBase && cut.reachesTop) &&
          compareNearly(cut.lowMm, fromMm) >= 0 &&
          compareNearly(cut.highMm, toMm) <= 0,
      ),
    });
  }

  return panels;
}

/**
 * The outline of a panel, counter-clockwise.
 *
 * The walk is the one a pencil makes: left to right along the bottom, stepping up
 * and over every doorway; up the right jamb; right to left along the top, dipping
 * under every opening hung from it; and down the left jamb, which the closed loop
 * draws on its own.
 *
 * A doorway becomes a step in this outline rather than a hole because a hole may
 * not touch the edge it is cut from — two contours sharing an edge is the one
 * case a triangulator has no answer for.
 */
export function panelOutline(panel: Panel, heightMm: Millimetres): readonly Corner[] {
  const bottomNotches = panel.cuts.filter((cut) => cut.standsOnBase);
  const topNotches = panel.cuts.filter((cut) => !cut.standsOnBase && cut.reachesTop);

  return dropRepeatedCorners([
    ...runCorners(
      edgeRuns(panel.fromMm, panel.toMm, ZERO_MM, bottomNotches, (notch) => notch.headMm),
      true,
    ),
    ...runCorners(
      edgeRuns(panel.fromMm, panel.toMm, heightMm, topNotches, (notch) => notch.sillMm),
      false,
    ),
  ]);
}

/** The openings of a panel that are true holes, clear of its base and its top. */
export function panelHoles(panel: Panel): readonly OpeningCut[] {
  return panel.cuts.filter((cut) => !cut.standsOnBase && !cut.reachesTop);
}

/**
 * The strips a panel's face covers, once its openings are taken out.
 *
 * Every opening edge is a breakpoint, so each strip is either wholly inside one
 * opening or wholly outside every one. Inside, what is left is the piece under the
 * sill and the piece over the head; outside, the full height. That is the exact
 * decomposition — no tolerance, no triangulator, no case left over.
 *
 * Only the worker needs this: on the main thread `THREE.ShapeUtils` triangulates
 * the outline instead. Both cover the same face, and the tests measure that they
 * come out to the same solid.
 */
export function panelRects(panel: Panel, heightMm: Millimetres): readonly FaceRect[] {
  const breakpoints: Millimetres[] = [panel.fromMm, panel.toMm];
  for (const cut of panel.cuts) {
    breakpoints.push(cut.lowMm, cut.highMm);
  }
  breakpoints.sort((first, second) => first - second);

  const rects: FaceRect[] = [];

  for (let index = 0; index + 1 < breakpoints.length; index += 1) {
    const lowMm = breakpoints[index];
    const highMm = breakpoints[index + 1];
    if (lowMm === undefined || highMm === undefined || compareNearly(highMm, lowMm) <= 0) {
      continue;
    }

    const covering = panel.cuts.find(
      (cut) => compareNearly(cut.lowMm, lowMm) <= 0 && compareNearly(cut.highMm, highMm) >= 0,
    );

    if (covering === undefined) {
      rects.push({ lowMm, highMm, bottomMm: ZERO_MM, topMm: heightMm });
      continue;
    }
    if (compareNearly(covering.sillMm, ZERO_MM) > 0) {
      rects.push({ lowMm, highMm, bottomMm: ZERO_MM, topMm: covering.sillMm });
    }
    if (compareNearly(covering.headMm, heightMm) < 0) {
      rects.push({ lowMm, highMm, bottomMm: covering.headMm, topMm: heightMm });
    }
  }

  return rects;
}

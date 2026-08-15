/**
 * Turning a wall centreline into a solid, with its doors and windows cut out.
 *
 * A wall is stored as a line and a thickness (`domain/walls/types.ts`), and a
 * hole is stored as a fraction along that line (`domain/openings/types.ts`).
 * Neither is a shape. This module is where they become one, and it does it by
 * **generating** the geometry every time rather than by placing a library model:
 * a 3,4 m partition with a 900 mm door 600 mm from the corner is not a catalogue
 * item, it is arithmetic.
 *
 * The method is an extruded elevation. The wall is drawn flat, in its own frame —
 * `u` running along the centreline from the `start` end, `v` running up from the
 * wall base — the openings are cut out of that flat drawing, and the result is
 * extruded sideways by the wall thickness. One `ExtrudeGeometry` call, no CSG
 * library, no boolean solver: a hole in a wall is a hole in a `Shape`, which is
 * what `THREE.Shape.holes` is for.
 *
 * That choice decides how each opening is cut, because a `Shape` hole must not
 * touch the outline it is cut from — the two contours would share an edge and the
 * triangulator has no answer for that. So an opening is cut one of three ways
 * depending on where it sits, and the difference is geometric, not a matter of
 * taste:
 *
 * - A **window** floats clear of the base and the top: a true hole.
 * - A **door** stands on the base: not a hole but a notch, cut into the outline
 *   itself, so the outline walks up one jamb, across the head and down the other.
 * - A **full-height opening** — an archway that reaches base and top — is not a
 *   hole at all. It divides the wall into two panels that are extruded together
 *   into one geometry.
 *
 * Openings that cannot be cut are **reported, never repaired**. A window whose
 * head is above the top of its wall, a door that runs past the corner, two
 * openings in the same place: each comes back in `userData.refusals` with a
 * Vietnamese sentence, and the wall is built without it. Silently shrinking the
 * opening to fit would build a model that disagrees with the drawing somebody
 * measured, which is the failure this codebase exists to catch.
 *
 * Every length here is millimetres until it reaches `scene.ts`. See that file for
 * why the conversion happens exactly once and where the axes come from.
 */

import { ExtrudeGeometry, Matrix4, Mesh, Path, Shape, Vector3 } from 'three';

import { compareNearly } from '@/domain/units/compare';
import { millimetres, type Millimetres } from '@/domain/units/types';
import { openingSpan } from '@/domain/openings/validate';
import {
  describeOpeningKind,
  isAttached,
  type AttachedOpening,
  type Opening,
} from '@/domain/openings/types';
import { assertUsableWall, centrelineLength, type Wall } from '@/domain/walls/types';
import type { LevelId, OpeningId, WallId } from '@/domain/spatial/types';

import { sceneVector2, tagPart, toSceneLength, type PartUserData } from './scene';

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

/** An opening the wall could not be built with, and the sentence explaining it. */
export interface CutRefusal {
  readonly openingId: OpeningId;
  readonly reason: CutRefusalReason;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

/**
 * What a wall mesh points back at.
 *
 * `openingIds` lists the openings that were really cut, so a caller can tell a
 * wall drawn with its door from one drawn without it, and `refusals` says what
 * went missing and why rather than leaving a person to notice the door is gone.
 */
export interface WallPartData extends PartUserData {
  readonly kind: 'wall';
  readonly entityId: WallId;
  readonly openingIds: readonly OpeningId[];
  readonly refusals: readonly CutRefusal[];
}

/** What `buildWallMesh` needs beyond the wall itself. */
export interface BuildWallOptions {
  /** The storey the wall is drawn on; travels into `userData`. */
  readonly levelId: LevelId;
  /**
   * Openings to cut. Anything attached to another wall, and every orphan, is
   * ignored — a caller may pass the whole plan's list.
   */
  readonly openings?: readonly Opening[];
}

/* -------------------------------------------------------------------------- */
/* Internals: the flat elevation.                                              */
/* -------------------------------------------------------------------------- */

/** No length at all, as a labelled quantity. */
const ZERO_MM: Millimetres = millimetres(0);

/** One rectangle to be taken out of the wall elevation, in the wall's own frame. */
interface OpeningCut {
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
interface Corner {
  readonly alongMm: Millimetres;
  readonly heightMm: Millimetres;
}

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

/** A stretch of wall between two full-height openings, with what is cut from it. */
interface Panel {
  readonly fromMm: Millimetres;
  readonly toMm: Millimetres;
  readonly bottomNotches: readonly OpeningCut[];
  readonly topNotches: readonly OpeningCut[];
  readonly holes: readonly OpeningCut[];
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

/** The openings on this wall, in a fixed order, whatever order they arrived in. */
function openingsOnWall(wall: Wall, openings: readonly Opening[]): readonly AttachedOpening[] {
  return openings
    .filter((opening): opening is AttachedOpening => isAttached(opening) && opening.wallId === wall.id)
    .slice()
    .sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
}

/**
 * Turn the openings on a wall into rectangles, refusing the ones that do not fit.
 *
 * The order of the checks is the order a reader needs them: a size that is not a
 * length is wrong before anything else can be asked about it, a hole outside the
 * wall body is wrong before it can be compared with its neighbours, and only then
 * does an overlap mean anything. An opening is compared against those already
 * accepted, so of two openings in the same place the earlier id keeps its hole.
 */
function planCuts(
  wall: Wall,
  openings: readonly AttachedOpening[],
  lengthMm: Millimetres,
  heightMm: Millimetres,
): { readonly cuts: readonly OpeningCut[]; readonly refusals: readonly CutRefusal[] } {
  const cuts: OpeningCut[] = [];
  const refusals: CutRefusal[] = [];

  const refuse = (opening: AttachedOpening, reason: CutRefusalReason, detail: string): void => {
    refusals.push({ openingId: opening.id, reason, message: `${nameOf(opening)} ${detail} ${REFUSAL_TAIL}` });
  };

  for (const opening of openings) {
    if (compareNearly(opening.widthMm, ZERO_MM) <= 0 || compareNearly(opening.heightMm, ZERO_MM) <= 0) {
      refuse(
        opening,
        'sizeNotPositive',
        `có kích thước ${formatLength(opening.widthMm)} × ${formatLength(opening.heightMm)} không phải chiều dài dương`,
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
      refuse(opening, 'belowWallBase', `có bệ thấp hơn chân tường ${formatLength(millimetres(-sillMm))}`);
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
 * gap between them, and they are extruded into one geometry so the wall stays one
 * mesh with one id.
 */
function planPanels(cuts: readonly OpeningCut[], lengthMm: Millimetres): readonly Panel[] {
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

    const inside = cuts.filter(
      (cut) =>
        !(cut.standsOnBase && cut.reachesTop) &&
        compareNearly(cut.lowMm, fromMm) >= 0 &&
        compareNearly(cut.highMm, toMm) <= 0,
    );

    panels.push({
      fromMm,
      toMm,
      bottomNotches: inside.filter((cut) => cut.standsOnBase),
      topNotches: inside.filter((cut) => !cut.standsOnBase && cut.reachesTop),
      holes: inside.filter((cut) => !cut.standsOnBase && !cut.reachesTop),
    });
  }

  return panels;
}

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
  const kept: Corner[] = [];

  const same = (first: Corner, second: Corner): boolean =>
    compareNearly(first.alongMm, second.alongMm) === 0 &&
    compareNearly(first.heightMm, second.heightMm) === 0;

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

/** A rectangular hole, wound the opposite way round from the outline. */
function holePath(cut: OpeningCut): Path {
  return new Path([
    sceneVector2(cut.lowMm, cut.sillMm),
    sceneVector2(cut.lowMm, cut.headMm),
    sceneVector2(cut.highMm, cut.headMm),
    sceneVector2(cut.highMm, cut.sillMm),
  ]);
}

/**
 * One panel as a flat shape: outline counter-clockwise, holes inside it.
 *
 * The walk is the one a pencil makes: left to right along the bottom, stepping up
 * and over every doorway; up the right jamb; right to left along the top, dipping
 * under every opening hung from it; and down the left jamb, which the closed loop
 * draws on its own.
 */
function panelShape(panel: Panel, heightMm: Millimetres): Shape {
  const bottom = runCorners(
    edgeRuns(panel.fromMm, panel.toMm, ZERO_MM, panel.bottomNotches, (notch) => notch.headMm),
    true,
  );
  const top = runCorners(
    edgeRuns(panel.fromMm, panel.toMm, heightMm, panel.topNotches, (notch) => notch.sillMm),
    false,
  );

  const outline = dropRepeatedCorners([...bottom, ...top]);
  const shape = new Shape(
    outline.map((corner) => sceneVector2(corner.alongMm, corner.heightMm)),
  );

  for (const hole of panel.holes) {
    shape.holes.push(holePath(hole));
  }

  return shape;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The frame a wall's own coordinates live in, ready to be applied to geometry.
 *
 * Local `x` runs along the centreline from the `start` end, local `y` is up, and
 * local `z` crosses the wall — so a point at `(u, v, 0)` sits on the centreline
 * `u` along and `v` above the base, whatever direction the wall was drawn in.
 * `buildWallMesh` uses it for the wall body; `floor.ts` uses it to hang door
 * leaves and glazing in the holes without repeating the trigonometry.
 *
 * @throws RangeError when the wall is not one the geometry can work with.
 */
export function wallFrame(wall: Wall): Matrix4 {
  assertUsableWall(wall);

  const { start, end } = wall.centreline;
  const lengthMm = centrelineLength(wall);
  const alongX = (end.x - start.x) / lengthMm;
  const alongY = (end.y - start.y) / lengthMm;

  return new Matrix4()
    .makeBasis(
      new Vector3(alongX, 0, alongY),
      new Vector3(0, 1, 0),
      new Vector3(-alongY, 0, alongX),
    )
    .setPosition(
      toSceneLength(start.x),
      toSceneLength(wall.baseElevationMm),
      toSceneLength(start.y),
    );
}

/**
 * Extrude a wall centreline into a solid, cutting its doors and windows out.
 *
 * The mesh is centred on the centreline — half the thickness each side — and runs
 * from `baseElevationMm` to `topElevationMm`, both measured from the project
 * datum, so a parapet and the wall below it stack without either knowing about
 * the other.
 *
 * Its `userData` is a `WallPartData`: the wall id to trace back to, the openings
 * that were cut, and the ones that were refused. Reading it through
 * `readPartData` is what turns a raycast hit into something the interface can
 * select.
 *
 * No material is assigned. Colour is a token decision and belongs to the caller,
 * not to a geometry builder.
 *
 * @throws RangeError when the thickness is outside 60–600 mm, the centreline has
 * no length, or the top is not above the base.
 */
export function buildWallMesh(wall: Wall, options: BuildWallOptions): Mesh {
  const frame = wallFrame(wall);
  const lengthMm = centrelineLength(wall);
  const heightMm = millimetres(wall.topElevationMm - wall.baseElevationMm);

  const { cuts, refusals } = planCuts(
    wall,
    openingsOnWall(wall, options.openings ?? []),
    lengthMm,
    heightMm,
  );

  const shapes = planPanels(cuts, lengthMm).map((panel) => panelShape(panel, heightMm));
  const geometry = new ExtrudeGeometry(shapes, {
    depth: toSceneLength(wall.thicknessMm),
    bevelEnabled: false,
    steps: 1,
  });

  // The extrusion grows along local +z from the centreline; sliding it back by
  // half the thickness is what makes the centreline the *centre* line.
  geometry.translate(0, 0, -toSceneLength(millimetres(wall.thicknessMm / 2)));
  geometry.applyMatrix4(frame);

  // A wall swallowed whole by a full-height opening has no panels left, and
  // asking an empty geometry for its bounds only produces a NaN radius.
  if (shapes.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  const data: WallPartData = {
    kind: 'wall',
    entityId: wall.id,
    levelId: options.levelId,
    openingIds: cuts.map((cut) => cut.openingId),
    refusals,
  };

  return tagPart(new Mesh(geometry), data);
}

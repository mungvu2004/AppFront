/**
 * Standing in the model without going through it.
 *
 * A walk-through that lets the reviewer stroll out of the building through a
 * load-bearing wall is worse than no walk-through at all: everything it shows
 * afterwards has to be doubted, because the one thing the viewer just proved is
 * that it does not know where the walls are. So this module answers two
 * questions, every frame, for the price of a few multiplications:
 *
 * - **May the walker stand here?** — {@link WallBarrier}, a cylinder of
 *   {@link WalkCollisionSettings.bodyRadiusM} sliding along wall faces.
 * - **How high is the floor here, and which storey is that?** —
 *   {@link WalkNavigator}, which follows the slab under the walker's feet and
 *   changes storey when they climb a flight of stairs.
 *
 * ## Why the plan, and not a ray
 *
 * The obvious implementation raycasts the scene each frame. It is also the wrong
 * one here. A ray hits triangles, so its answer depends on how the wall happened
 * to be tessellated, it needs the built `Object3D` to exist before the camera can
 * be trusted, and the cost grows with the mesh rather than with the building. A
 * wall, though, **is a line and a thickness** — that is how `domain/walls` stores
 * it — and a person on a floor is a circle. Circle against thickened line is
 * closed-form: no BVH, no triangles, no per-frame allocation worth naming.
 *
 * What that buys, concretely: the collision is identical before and after the
 * mesh is built, identical on the worker's geometry and the main thread's, and a
 * failing case can be written down as four numbers in a test rather than as a
 * scene.
 *
 * The cost is bounded twice. {@link buildWallBarrier} is run once per plan and
 * turns every wall into the **solid stretches** of it — the doorway is removed
 * from the geometry rather than special-cased during the walk — and those
 * stretches go into a uniform grid, so a step consults the handful of walls
 * within a metre of the walker instead of all of them.
 *
 * ## Doors
 *
 * A door you cannot walk through makes a plan unreviewable, and a door you can
 * walk through when it is bricked up makes it wrong. The rule here is
 * geometric first and stateful second: a hole is a way through when it runs from
 * the floor (within {@link WalkCollisionSettings.stepOverM}) to above the
 * walker's crown, **and** nothing is hung in it — a `void` never has anything, a
 * `door` has an open leaf, a `window` always has glass. Which leaves are open is
 * the caller's to say, through {@link BarrierOptions.openDoorIds}.
 *
 * ## Units
 *
 * The input is the domain's millimetres; everything this module returns is
 * **metres**, because everything downstream of `build/scene.ts` is. The
 * conversion goes through `toSceneLength` — the one divide-by-a-thousand this
 * package is allowed — and the plan axes follow `scenePoint`: `plan.x → x`,
 * `plan.y → z`, elevation → `y`. A {@link PlanPointM} is therefore the walker
 * seen from directly above.
 */

import { Vector3 } from 'three';

import { compareNearly, isNearlyZero } from '@/domain/units/compare';
import { metres, metresToMillimetres, millimetres, type Millimetres } from '@/domain/units/types';
import { isAttached, type AttachedOpening, type Opening } from '@/domain/openings/types';
import { openingSpan } from '@/domain/openings/validate';
import { centrelineLength, type Wall } from '@/domain/walls/types';
import type { LevelId, OpeningId, WallId } from '@/domain/spatial/types';
import { toSceneLength } from '../build/scene';

import { CAMERA_SETTINGS } from './settings';

/* -------------------------------------------------------------------------- */
/* Settings — the sibling of CAMERA_SETTINGS, as PRESET_SETTINGS is.           */
/* -------------------------------------------------------------------------- */

/**
 * Every number the walk collision is made of.
 *
 * Declared here rather than added to `CAMERA_SETTINGS` for the reason
 * `PRESET_SETTINGS` gives: `settings.ts` and `modes.ts` are closed to this
 * change. Anything with an equivalent over there is *derived* from it rather
 * than restated — {@link walkerHeightM} is the eye height plus a crown, never a
 * second opinion about how tall a person is.
 *
 * Frozen, so a caller cannot widen a doorway at runtime by shrinking the body.
 */
export interface WalkCollisionSettings {
  /**
   * Radius of the cylinder the walker is, in metres.
   *
   * Three hundred millimetres: the half-width of a person's shoulders with a
   * little to spare, so a 700 mm service door is tight and a 900 mm door is
   * comfortable — which is the judgement a corridor review is trying to make.
   */
  readonly bodyRadiusM: number;
  /**
   * How far the crown of the head sits above the eye, in metres.
   *
   * Added to `CAMERA_SETTINGS.walk.eyeHeightM` by {@link walkerHeightM} to get
   * the band of air the walker occupies. A lintel below that band stops them; a
   * lintel above it is something they duck under and the plan allows.
   */
  readonly headClearanceM: number;
  /**
   * The tallest thing walked over rather than into, in metres.
   *
   * A threshold, a kerb, an upstand. Also the highest sill a hole may have and
   * still count as a way through.
   */
  readonly stepOverM: number;
  /**
   * How much clear air is left when the walker is pushed off a face, in metres.
   *
   * One millimetre. Without it the walker is left exactly touching, and the next
   * frame's test is decided by the last bit of a float.
   */
  readonly skinM: number;
  /**
   * How many times one position is pushed out before it is accepted.
   *
   * Four: one for a wall, two for a corner, and two spare for the case where
   * being pushed off one wall presses the walker into a third.
   */
  readonly resolveIterations: number;
  /** Side of one broad-phase grid cell, in metres. */
  readonly gridCellM: number;
  /**
   * Most cells along either side of the grid.
   *
   * The grid grows its cells rather than its cell count for a large site, so the
   * index costs the same however big the plan is.
   */
  readonly maxGridAxisCells: number;
  /**
   * The longest single move accepted, as a multiple of the body radius.
   *
   * A move is cut into steps no longer than one radius so that nothing is ever
   * jumped over — that is what replaces a swept test — and this caps the work a
   * nonsense destination can ask for. Anything further is shortened to this
   * distance rather than tunnelled through: 256 radii is 76,8 m, which is longer
   * than any building a person crosses inside one frame.
   */
  readonly maxTravelRadii: number;
}

/** The settings. Nothing in this module writes a length of its own. */
export const WALK_COLLISION_SETTINGS: WalkCollisionSettings = Object.freeze({
  bodyRadiusM: 0.3,
  headClearanceM: 0.1,
  stepOverM: 0.2,
  skinM: 0.001,
  resolveIterations: 4,
  gridCellM: 2,
  maxGridAxisCells: 256,
  maxTravelRadii: 256,
});

/**
 * How tall the walker is, in metres: the eye height plus the crown above it.
 *
 * Derived from `CAMERA_SETTINGS.walk.eyeHeightM` rather than written again, so
 * raising the eye raises the head with it and a lintel cannot become passable by
 * accident.
 */
export function walkerHeightM(settings: WalkCollisionSettings = WALK_COLLISION_SETTINGS): number {
  return CAMERA_SETTINGS.walk.eyeHeightM + settings.headClearanceM;
}

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A point on the floor of the scene, in metres.
 *
 * The plan seen from above: `xM` and `zM` are the scene's horizontal axes, which
 * `build/scene.ts` maps from `plan.x` and `plan.y`. There is no height here on
 * purpose — height is the ground's business, not the collision's.
 */
export interface PlanPointM {
  readonly xM: number;
  readonly zM: number;
}

/**
 * One unbroken stretch of wall, as the collision sees it.
 *
 * Not a wall: a wall with two doorways in it is three of these. Splitting at
 * build time is what keeps the per-frame test to "circle against thickened
 * segment" with no openings to consider — a doorway is an absence of geometry,
 * exactly as it is in life.
 *
 * `baseM` and `topM` are absolute elevations, so a barrier holds every storey of
 * the building at once and the walker's own height decides which parts of it are
 * in the way.
 */
export interface WallSolid {
  readonly wallId: WallId;
  readonly start: PlanPointM;
  readonly end: PlanPointM;
  /** Half the wall thickness: the solid reaches this far either side of the line. */
  readonly halfThicknessM: number;
  readonly baseM: number;
  readonly topM: number;
}

/** One storey, as the walker needs to see it. */
export interface Storey {
  readonly levelId: LevelId;
  /** Finished floor level, from the project datum, in metres. */
  readonly floorElevationM: number;
}

/**
 * A flight of stairs, as a line on the plan between two storeys.
 *
 * The run is `lowerEnd → upperEnd`, so no rotation field is needed: the two
 * points give the direction, the length and the going, and `halfWidthM` gives
 * the rest of the footprint. A caller builds one from a `stair` furniture item's
 * bounding box or from a `stairwell` room's outline.
 *
 * The two floor elevations are *not* stored: they are read from the storeys, so
 * a stair cannot come to disagree with the floors it joins.
 */
export interface Stairway {
  /** The furniture or room id the flight was taken from. */
  readonly id: string;
  readonly lowerLevelId: LevelId;
  readonly upperLevelId: LevelId;
  /** Plan point at the bottom step. */
  readonly lowerEnd: PlanPointM;
  /** Plan point at the top step. */
  readonly upperEnd: PlanPointM;
  /** Half the width of the flight, across the run, in metres. */
  readonly halfWidthM: number;
}

/** The storeys of the building and the flights joining them. */
export interface WalkGround {
  readonly storeys: readonly Storey[];
  readonly stairs: readonly Stairway[];
}

/**
 * Which storey the walker is on and how high the floor is under them.
 *
 * `stairId` and `stairProgress` are what make a storey change continuous rather
 * than a jump: while a flight is being climbed the elevation is read off the
 * flight, and the storey label follows at the halfway tread.
 */
export interface GroundState {
  readonly levelId: LevelId;
  /** Height of the floor under the walker's feet, in metres. */
  readonly floorElevationM: number;
  /** The flight being climbed, or `null` when both feet are on a slab. */
  readonly stairId: string | null;
  /** How far up that flight, `0` at the bottom step and `1` at the top. */
  readonly stairProgress: number;
}

/** What one move came to. */
export interface WalkStep {
  /** Where the walker really ended up, after the walls had their say. */
  readonly position: PlanPointM;
  readonly ground: GroundState;
  /** How much of the requested move a wall took away, in metres. */
  readonly blockedM: number;
  /** Did this move end on a different storey from the one it started on? */
  readonly changedLevel: boolean;
}

/** Where a walk starts. */
export interface WalkStart {
  readonly position: PlanPointM;
  readonly levelId: LevelId;
}

/** What {@link buildWallBarrier} needs beyond the plan itself. */
export interface BarrierOptions {
  /**
   * The door leaves standing open.
   *
   * Omit it and every door whose swing is not `fixed` counts as open, which is
   * what a reviewer expects of a plan the model has no leaf state for: they came
   * to walk the corridors, not to open doors. A caller that tracks leaf state —
   * a QC run checking escape routes with the doors shut — passes the set.
   */
  readonly openDoorIds?: ReadonlySet<OpeningId>;
  readonly settings?: WalkCollisionSettings;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers.                                                           */
/* -------------------------------------------------------------------------- */

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isFinitePoint(point: PlanPointM): boolean {
  return Number.isFinite(point.xM) && Number.isFinite(point.zM);
}

/** A plan point from a scene position, dropping the height. */
export function planPointOf(position: Vector3): PlanPointM {
  return { xM: position.x, zM: position.z };
}

/** Where the walker's eye sits, for a caller writing it onto a camera. */
export function walkEyePosition(step: WalkStep): Vector3 {
  return new Vector3(
    step.position.xM,
    step.ground.floorElevationM + CAMERA_SETTINGS.walk.eyeHeightM,
    step.position.zM,
  );
}

/**
 * How deep the walker's circle is inside one solid, and which way is out.
 *
 * Written into a caller-owned scratch object rather than returned, because this
 * is the one function in the module that runs several times per frame.
 *
 * The solid is a rectangle, not a capsule, and that distinction is load-bearing:
 * rounding the ends would push the two jambs of a doorway towards each other by
 * a half-thickness each, so a 900 mm door in a 200 mm wall would measure 700 mm
 * clear and a reviewer would be squeezed through an opening the drawing says is
 * wide enough.
 */
function penetrationOf(
  solid: WallSolid,
  xM: number,
  zM: number,
  radiusM: number,
  out: Penetration,
): boolean {
  const runXM = solid.end.xM - solid.start.xM;
  const runZM = solid.end.zM - solid.start.zM;
  const lengthM = Math.hypot(runXM, runZM);
  if (lengthM <= 0) {
    return false;
  }

  const alongXM = runXM / lengthM;
  const alongZM = runZM / lengthM;
  // The left normal of the run: across the wall, from one face to the other.
  const acrossXM = -alongZM;
  const acrossZM = alongXM;

  const offsetXM = xM - solid.start.xM;
  const offsetZM = zM - solid.start.zM;
  const alongM = offsetXM * alongXM + offsetZM * alongZM;
  const acrossM = offsetXM * acrossXM + offsetZM * acrossZM;

  const halfM = solid.halfThicknessM;
  const nearestAlongM = clamp(alongM, 0, lengthM);
  const nearestAcrossM = clamp(acrossM, -halfM, halfM);
  const gapAlongM = alongM - nearestAlongM;
  const gapAcrossM = acrossM - nearestAcrossM;

  if (gapAlongM === 0 && gapAcrossM === 0) {
    // Inside the wall body. Out is across the nearer face — never along the
    // wall, which would fire the walker down the corridor rather than off it.
    const side = acrossM >= 0 ? 1 : -1;
    out.depthM = halfM + radiusM - side * acrossM;
    out.normalXM = acrossXM * side;
    out.normalZM = acrossZM * side;
    return true;
  }

  const distanceM = Math.hypot(gapAlongM, gapAcrossM);
  if (distanceM >= radiusM) {
    return false;
  }

  out.depthM = radiusM - distanceM;
  out.normalXM = (gapAlongM * alongXM + gapAcrossM * acrossXM) / distanceM;
  out.normalZM = (gapAlongM * alongZM + gapAcrossM * acrossZM) / distanceM;
  return true;
}

/** Scratch for {@link penetrationOf}; never escapes the barrier that owns it. */
interface Penetration {
  depthM: number;
  normalXM: number;
  normalZM: number;
}

/* -------------------------------------------------------------------------- */
/* Broad phase.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A uniform grid over the solids, so a step reads a few walls rather than all.
 *
 * Built once with the barrier. The cells grow with the site instead of
 * multiplying — {@link WalkCollisionSettings.maxGridAxisCells} caps each axis —
 * so a campus costs the same index as a house and neither can allocate a grid
 * out of a stray coordinate.
 */
class SolidGrid {
  private readonly minXM: number;
  private readonly minZM: number;
  private readonly cellXM: number;
  private readonly cellZM: number;
  private readonly columns: number;
  private readonly rows: number;
  private readonly buckets: readonly (readonly number[])[];
  /** Which query last saw each solid, so one solid is reported once. */
  private readonly seenIn: Int32Array;
  private query = 0;

  constructor(solids: readonly WallSolid[], cellM: number, maxAxisCells: number) {
    let minXM = Number.POSITIVE_INFINITY;
    let minZM = Number.POSITIVE_INFINITY;
    let maxXM = Number.NEGATIVE_INFINITY;
    let maxZM = Number.NEGATIVE_INFINITY;

    for (const solid of solids) {
      const padM = solid.halfThicknessM;
      minXM = Math.min(minXM, solid.start.xM - padM, solid.end.xM - padM);
      minZM = Math.min(minZM, solid.start.zM - padM, solid.end.zM - padM);
      maxXM = Math.max(maxXM, solid.start.xM + padM, solid.end.xM + padM);
      maxZM = Math.max(maxZM, solid.start.zM + padM, solid.end.zM + padM);
    }

    if (!Number.isFinite(minXM) || !Number.isFinite(minZM)) {
      minXM = 0;
      minZM = 0;
      maxXM = 0;
      maxZM = 0;
    }

    const widthM = Math.max(maxXM - minXM, cellM);
    const depthM = Math.max(maxZM - minZM, cellM);

    this.minXM = minXM;
    this.minZM = minZM;
    this.columns = clamp(Math.ceil(widthM / cellM), 1, maxAxisCells);
    this.rows = clamp(Math.ceil(depthM / cellM), 1, maxAxisCells);
    this.cellXM = widthM / this.columns;
    this.cellZM = depthM / this.rows;

    const buckets: number[][] = [];
    for (let cell = 0; cell < this.columns * this.rows; cell += 1) {
      buckets.push([]);
    }

    solids.forEach((solid, index) => {
      const padM = solid.halfThicknessM;
      const firstColumn = this.columnOf(Math.min(solid.start.xM, solid.end.xM) - padM);
      const lastColumn = this.columnOf(Math.max(solid.start.xM, solid.end.xM) + padM);
      const firstRow = this.rowOf(Math.min(solid.start.zM, solid.end.zM) - padM);
      const lastRow = this.rowOf(Math.max(solid.start.zM, solid.end.zM) + padM);

      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          buckets[row * this.columns + column]?.push(index);
        }
      }
    });

    this.buckets = buckets;
    this.seenIn = new Int32Array(solids.length);
  }

  /** The solids whose cells meet this box, each once, written into `out`. */
  collect(minXM: number, minZM: number, maxXM: number, maxZM: number, out: number[]): void {
    out.length = 0;
    this.query += 1;

    const firstColumn = this.columnOf(minXM);
    const lastColumn = this.columnOf(maxXM);
    const firstRow = this.rowOf(minZM);
    const lastRow = this.rowOf(maxZM);

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const bucket = this.buckets[row * this.columns + column];
        if (bucket === undefined) {
          continue;
        }
        for (const index of bucket) {
          if ((this.seenIn[index] ?? 0) === this.query) {
            continue;
          }
          this.seenIn[index] = this.query;
          out.push(index);
        }
      }
    }
  }

  private columnOf(xM: number): number {
    if (!Number.isFinite(xM)) {
      return 0;
    }
    return clamp(Math.floor((xM - this.minXM) / this.cellXM), 0, this.columns - 1);
  }

  private rowOf(zM: number): number {
    if (!Number.isFinite(zM)) {
      return 0;
    }
    return clamp(Math.floor((zM - this.minZM) / this.cellZM), 0, this.rows - 1);
  }
}

/* -------------------------------------------------------------------------- */
/* The barrier.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every solid stretch of wall in the building, and the one question asked of it.
 *
 * Immutable once built: rebuild it when the plan changes rather than mutating
 * it, so a frame can never be resolved against half of an edit.
 */
export class WallBarrier {
  readonly solids: readonly WallSolid[];
  readonly settings: WalkCollisionSettings;

  private readonly grid: SolidGrid;
  private readonly bodyHeightM: number;
  private readonly nearby: number[] = [];
  private readonly hit: Penetration = { depthM: 0, normalXM: 0, normalZM: 0 };

  constructor(
    solids: readonly WallSolid[],
    settings: WalkCollisionSettings = WALK_COLLISION_SETTINGS,
  ) {
    this.solids = solids;
    this.settings = settings;
    this.bodyHeightM = walkerHeightM(settings);
    this.grid = new SolidGrid(solids, settings.gridCellM, settings.maxGridAxisCells);
  }

  /**
   * The solids a move could possibly touch, for a caller that wants to see the
   * broad phase work — and for the test that pins it.
   */
  nearbySolids(from: PlanPointM, to: PlanPointM, footElevationM: number): readonly WallSolid[] {
    const reachM = this.settings.bodyRadiusM;
    this.grid.collect(
      Math.min(from.xM, to.xM) - reachM,
      Math.min(from.zM, to.zM) - reachM,
      Math.max(from.xM, to.xM) + reachM,
      Math.max(from.zM, to.zM) + reachM,
      this.nearby,
    );

    const headM = footElevationM + this.bodyHeightM;
    const found: WallSolid[] = [];
    for (const index of this.nearby) {
      const solid = this.solids[index];
      if (solid !== undefined && this.blocksBand(solid, footElevationM, headM)) {
        found.push(solid);
      }
    }
    return found;
  }

  /** Is the walker's body inside a wall at this spot? */
  blocked(at: PlanPointM, footElevationM: number): boolean {
    if (!isFinitePoint(at) || !Number.isFinite(footElevationM)) {
      return false;
    }
    return this.deepest(at.xM, at.zM, footElevationM, footElevationM + this.bodyHeightM) !== null;
  }

  /**
   * Move from one spot towards another, stopping at whatever is in the way.
   *
   * Two things happen, in this order.
   *
   * **The move is cut into steps no longer than one body radius.** That is what
   * stands in for a swept test: a wall thinner than the walker cannot be skipped
   * over, however long the frame was or however fast the run key makes them go.
   * A destination further than {@link WalkCollisionSettings.maxTravelRadii}
   * radii away is pulled in to that distance rather than tunnelled to.
   *
   * **Each step is pushed back out of whatever it landed in**, along the face
   * normal. Pushing along the normal is exactly what makes the walker *slide*:
   * the component of the move along the wall survives untouched, so running at a
   * corridor wall at a shallow angle carries you down the corridor, and running
   * at it square stops you dead against the face.
   *
   * Each step is measured as a **fraction of the whole move from where it
   * started**, and only the pushes accumulate. Adding one step's worth of travel
   * at a time instead would leave a walker who touched nothing a few ulps short
   * of the spot they asked for, and those ulps are the difference between
   * standing on the bottom tread of a stair and standing just off it.
   *
   * Non-finite input leaves the walker where they were — a `NaN` in a frame time
   * must not teleport a reviewer out of the building.
   */
  slide(from: PlanPointM, to: PlanPointM, footElevationM: number): PlanPointM {
    const here: PlanPointM = { xM: from.xM, zM: from.zM };
    if (!isFinitePoint(from) || !isFinitePoint(to) || !Number.isFinite(footElevationM)) {
      return here;
    }

    const headM = footElevationM + this.bodyHeightM;
    const radiusM = this.settings.bodyRadiusM;
    const maxTravelM = radiusM * this.settings.maxTravelRadii;

    let travelXM = to.xM - from.xM;
    let travelZM = to.zM - from.zM;
    const travelM = Math.hypot(travelXM, travelZM);

    if (travelM > maxTravelM) {
      const scale = maxTravelM / travelM;
      travelXM *= scale;
      travelZM *= scale;
    }

    const steps = Math.max(1, Math.ceil(Math.min(travelM, maxTravelM) / radiusM));

    let atXM = from.xM;
    let atZM = from.zM;
    let pushedXM = 0;
    let pushedZM = 0;

    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      atXM = from.xM + travelXM * fraction + pushedXM;
      atZM = from.zM + travelZM * fraction + pushedZM;

      for (let pass = 0; pass < this.settings.resolveIterations; pass += 1) {
        const hit = this.deepest(atXM, atZM, footElevationM, headM);
        if (hit === null) {
          break;
        }
        const pushM = hit.depthM + this.settings.skinM;
        atXM += hit.normalXM * pushM;
        atZM += hit.normalZM * pushM;
        pushedXM += hit.normalXM * pushM;
        pushedZM += hit.normalZM * pushM;
      }
    }

    return { xM: atXM, zM: atZM };
  }

  /** Does this solid stand in the band of air the walker occupies? */
  private blocksBand(solid: WallSolid, footM: number, headM: number): boolean {
    return solid.topM > footM + this.settings.stepOverM && solid.baseM < headM;
  }

  /**
   * The worst overlap at this spot, or `null` when there is none.
   *
   * Deepest first so that a walker wedged into a corner is pushed out of the
   * wall they are most inside; the remaining passes deal with the other one.
   * Ties go to the earlier solid, which keeps a step reproducible.
   */
  private deepest(xM: number, zM: number, footM: number, headM: number): Penetration | null {
    const radiusM = this.settings.bodyRadiusM;
    this.grid.collect(xM - radiusM, zM - radiusM, xM + radiusM, zM + radiusM, this.nearby);

    let bestDepthM = 0;
    let bestNormalXM = 0;
    let bestNormalZM = 0;

    for (const index of this.nearby) {
      const solid = this.solids[index];
      if (solid === undefined || !this.blocksBand(solid, footM, headM)) {
        continue;
      }
      if (!penetrationOf(solid, xM, zM, radiusM, this.hit)) {
        continue;
      }
      if (this.hit.depthM > bestDepthM) {
        bestDepthM = this.hit.depthM;
        bestNormalXM = this.hit.normalXM;
        bestNormalZM = this.hit.normalZM;
      }
    }

    if (bestDepthM <= 0) {
      return null;
    }

    this.hit.depthM = bestDepthM;
    this.hit.normalXM = bestNormalXM;
    this.hit.normalZM = bestNormalZM;
    return this.hit;
  }
}

/* -------------------------------------------------------------------------- */
/* Building a barrier from a plan.                                             */
/* -------------------------------------------------------------------------- */

/** A stretch of a wall centreline, measured from the `start` end. */
interface SpanMm {
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
}

/** A length in metres, back in the millimetres the domain compares in. */
function toMillimetres(valueM: number): Millimetres {
  return metresToMillimetres(metres(valueM));
}

/**
 * Is this hole a way through the wall?
 *
 * Geometry first: it has to run from the floor to above the walker's crown, or
 * it is a window whatever is hung in it. Then the leaf: a `void` has none, a
 * `door` has one that may be open, and a `window` always has glass.
 */
function isWalkThrough(
  opening: AttachedOpening,
  openDoorIds: ReadonlySet<OpeningId> | undefined,
  settings: WalkCollisionSettings,
): boolean {
  const headMm = millimetres(opening.sillHeightMm + opening.heightMm);
  if (compareNearly(opening.sillHeightMm, toMillimetres(settings.stepOverM)) > 0) {
    return false;
  }
  if (compareNearly(headMm, toMillimetres(walkerHeightM(settings))) < 0) {
    return false;
  }

  switch (opening.kind) {
    case 'void':
      return true;
    case 'door':
      return opening.swing !== 'fixed' && (openDoorIds === undefined || openDoorIds.has(opening.id));
    case 'window':
      return false;
  }
}

/** Merge overlapping stretches and put them in order along the wall. */
function mergeSpans(spans: readonly SpanMm[]): readonly SpanMm[] {
  const sorted = [...spans].sort((first, second) => compareNearly(first.lowMm, second.lowMm));
  const merged: SpanMm[] = [];

  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && compareNearly(span.lowMm, last.highMm) <= 0) {
      merged[merged.length - 1] = {
        lowMm: last.lowMm,
        highMm: millimetres(Math.max(last.highMm, span.highMm)),
      };
      continue;
    }
    merged.push(span);
  }

  return merged;
}

/** What is left of a wall once its walk-through holes are taken out. */
function solidSpans(lengthMm: Millimetres, gaps: readonly SpanMm[]): readonly SpanMm[] {
  const solids: SpanMm[] = [];
  let cursorMm = millimetres(0);

  for (const gap of mergeSpans(gaps)) {
    if (compareNearly(gap.lowMm, cursorMm) > 0) {
      solids.push({ lowMm: cursorMm, highMm: gap.lowMm });
    }
    cursorMm = millimetres(Math.max(cursorMm, gap.highMm));
  }

  if (compareNearly(lengthMm, cursorMm) > 0) {
    solids.push({ lowMm: cursorMm, highMm: lengthMm });
  }

  return solids;
}

/** The plan point a fraction of the way along a wall centreline. */
function alongCentreline(wall: Wall, fraction: number): PlanPointM {
  const { start, end } = wall.centreline;
  return {
    xM: toSceneLength(millimetres(start.x + (end.x - start.x) * fraction)),
    zM: toSceneLength(millimetres(start.y + (end.y - start.y) * fraction)),
  };
}

/**
 * Turn a plan into the thing the walker bumps into.
 *
 * Run once per plan, not once per frame. Every wall becomes the stretches of it
 * that are still solid at walking height: a doorway leaves two jambs with a real
 * gap between them, so nothing about doors is left for the per-frame test to
 * know.
 *
 * Walls of zero length are dropped — `assertUsableWall` rejects them upstream,
 * and a barrier built from raw model output must not divide by one. An opening
 * whose host is not in the list is ignored, which is
 * `spatial/integrity.ts`'s report to make, not this module's.
 */
export function buildWallBarrier(
  walls: readonly Wall[],
  openings: readonly Opening[],
  options: BarrierOptions = {},
): WallBarrier {
  const settings = options.settings ?? WALK_COLLISION_SETTINGS;
  const solids: WallSolid[] = [];

  const gapsByWall = new Map<WallId, SpanMm[]>();
  const wallsById = new Map<WallId, Wall>(walls.map((wall) => [wall.id, wall]));

  for (const opening of openings) {
    if (!isAttached(opening) || !isWalkThrough(opening, options.openDoorIds, settings)) {
      continue;
    }
    const wall = wallsById.get(opening.wallId);
    if (wall === undefined) {
      continue;
    }

    const lengthMm = centrelineLength(wall);
    const span = openingSpan(wall, opening);
    const gap: SpanMm = {
      lowMm: millimetres(clamp(span.lowMm, 0, lengthMm)),
      highMm: millimetres(clamp(span.highMm, 0, lengthMm)),
    };
    if (compareNearly(gap.highMm, gap.lowMm) <= 0) {
      continue;
    }

    const gaps = gapsByWall.get(wall.id);
    if (gaps === undefined) {
      gapsByWall.set(wall.id, [gap]);
    } else {
      gaps.push(gap);
    }
  }

  for (const wall of walls) {
    const lengthMm = centrelineLength(wall);
    if (isNearlyZero(lengthMm) || !Number.isFinite(lengthMm)) {
      continue;
    }

    const halfThicknessM = toSceneLength(millimetres(wall.thicknessMm / 2));
    const baseM = toSceneLength(wall.baseElevationMm);
    const topM = toSceneLength(wall.topElevationMm);

    for (const span of solidSpans(lengthMm, gapsByWall.get(wall.id) ?? [])) {
      solids.push({
        wallId: wall.id,
        start: alongCentreline(wall, span.lowMm / lengthMm),
        end: alongCentreline(wall, span.highMm / lengthMm),
        halfThicknessM,
        baseM,
        topM,
      });
    }
  }

  return new WallBarrier(solids, settings);
}

/* -------------------------------------------------------------------------- */
/* The ground under the walker.                                                */
/* -------------------------------------------------------------------------- */

/** Where the halfway tread is: the point a flight stops being one storey's. */
const STAIR_HALFWAY = 0.5;

/**
 * How far up a flight the walker is, and whether they are on it at all.
 *
 * `null` when they are beside it rather than on it. The progress is measured
 * along the run and clamped, so a walker standing on the bottom step reads `0`
 * and one on the top step reads `1`.
 */
export function stairProgressAt(stair: Stairway, at: PlanPointM): number | null {
  const runXM = stair.upperEnd.xM - stair.lowerEnd.xM;
  const runZM = stair.upperEnd.zM - stair.lowerEnd.zM;
  const lengthM = Math.hypot(runXM, runZM);
  if (lengthM <= 0 || !isFinitePoint(at)) {
    return null;
  }

  const alongXM = runXM / lengthM;
  const alongZM = runZM / lengthM;
  const offsetXM = at.xM - stair.lowerEnd.xM;
  const offsetZM = at.zM - stair.lowerEnd.zM;

  const alongM = offsetXM * alongXM + offsetZM * alongZM;
  const acrossM = offsetXM * -alongZM + offsetZM * alongXM;

  if (alongM < 0 || alongM > lengthM || Math.abs(acrossM) > stair.halfWidthM) {
    return null;
  }
  return alongM / lengthM;
}

/**
 * Walking a building, floor by floor.
 *
 * Owns the two answers a first-person view needs and nothing else: where the
 * walker is on the plan, and how high the floor is under them. It drives no
 * camera and holds no three.js object — {@link walkEyePosition} turns a step
 * into a position, and the screen writes that wherever it likes.
 *
 * ## Following the floor
 *
 * Off a stair, the elevation is the storey's own and nothing else can move it:
 * an eye height that drifts is the defect the walk mode exists to avoid.
 *
 * ## Changing storey
 *
 * On a stair, the elevation is read off the flight — the walker rises with the
 * going rather than teleporting at the top — and the storey label changes at the
 * halfway tread. The label is only a label: what is in the way is decided by the
 * band of air the walker occupies, so a flight passing a landing wall is
 * blocked by it at the height where it really stands.
 *
 * Nothing here throws. A start on a storey that is not in the list falls back to
 * the first storey given, because a viewer that refuses to draw is worse than
 * one that draws the ground floor.
 */
export class WalkNavigator {
  readonly barrier: WallBarrier;

  private readonly floorsByLevel: ReadonlyMap<LevelId, number>;
  private readonly stairs: readonly Stairway[];
  private readonly fallbackLevelId: LevelId;
  private at: PlanPointM;
  private state: GroundState;

  constructor(barrier: WallBarrier, ground: WalkGround, start: WalkStart) {
    this.barrier = barrier;
    this.stairs = ground.stairs;
    this.floorsByLevel = new Map(
      ground.storeys.map((storey) => [storey.levelId, storey.floorElevationM]),
    );
    this.fallbackLevelId = ground.storeys[0]?.levelId ?? start.levelId;

    const levelId = this.floorsByLevel.has(start.levelId) ? start.levelId : this.fallbackLevelId;
    this.at = { xM: start.position.xM, zM: start.position.zM };
    this.state = {
      levelId,
      floorElevationM: this.floorOf(levelId),
      stairId: null,
      stairProgress: 0,
    };
  }

  /** Where the walker is on the plan. */
  get position(): PlanPointM {
    return this.at;
  }

  /** Which storey they are on, and how high the floor is. */
  get ground(): GroundState {
    return this.state;
  }

  /** Where the eye sits, in metres above the datum. */
  get eyeElevationM(): number {
    return this.state.floorElevationM + CAMERA_SETTINGS.walk.eyeHeightM;
  }

  /**
   * Try to walk to a spot.
   *
   * The walls have their say first, then the floor is read under wherever that
   * left the walker — so a step is never resolved against a storey the walker
   * did not reach.
   */
  moveTo(desired: PlanPointM): WalkStep {
    const reached = this.barrier.slide(this.at, desired, this.state.floorElevationM);
    const ground = this.groundAt(reached, this.state);
    const blockedM = isFinitePoint(desired)
      ? Math.hypot(desired.xM - reached.xM, desired.zM - reached.zM)
      : 0;

    const step: WalkStep = {
      position: reached,
      ground,
      blockedM,
      changedLevel: ground.levelId !== this.state.levelId,
    };

    this.at = reached;
    this.state = ground;
    return step;
  }

  /**
   * Put the walker down somewhere else outright, storey included.
   *
   * For arriving from another camera mode or from a shared link, where there is
   * no move to resolve — only a position to accept. Any wall the spot is inside
   * still pushes them clear, so a link cannot drop a reviewer inside a slab.
   */
  teleportTo(at: PlanPointM, levelId: LevelId): WalkStep {
    const landedLevelId = this.floorsByLevel.has(levelId) ? levelId : this.fallbackLevelId;
    const floorElevationM = this.floorOf(landedLevelId);
    const cleared = this.barrier.slide(at, at, floorElevationM);
    const ground = this.groundAt(cleared, {
      levelId: landedLevelId,
      floorElevationM,
      stairId: null,
      stairProgress: 0,
    });

    const step: WalkStep = {
      position: cleared,
      ground,
      blockedM: Math.hypot(at.xM - cleared.xM, at.zM - cleared.zM),
      changedLevel: ground.levelId !== this.state.levelId,
    };

    this.at = cleared;
    this.state = ground;
    return step;
  }

  /** The floor of a storey, or the datum when the storey is unknown. */
  private floorOf(levelId: LevelId): number {
    return this.floorsByLevel.get(levelId) ?? this.floorsByLevel.get(this.fallbackLevelId) ?? 0;
  }

  /**
   * Which storey a spot belongs to, given where the walker came from.
   *
   * A flight already being climbed keeps the walker until they step off it, so
   * two flights sharing a landing cannot swap under them mid-stride. Otherwise
   * only the flights touching the current storey are considered: the ones three
   * floors up are not reachable from here, whatever their footprint says.
   */
  private groundAt(at: PlanPointM, previous: GroundState): GroundState {
    const held =
      previous.stairId === null
        ? undefined
        : this.stairs.find((stair) => stair.id === previous.stairId);

    const candidates =
      held === undefined
        ? this.stairs.filter(
            (stair) =>
              stair.lowerLevelId === previous.levelId || stair.upperLevelId === previous.levelId,
          )
        : [held];

    for (const stair of candidates) {
      const progress = stairProgressAt(stair, at);
      if (progress === null) {
        continue;
      }

      const lowerM = this.floorOf(stair.lowerLevelId);
      const upperM = this.floorOf(stair.upperLevelId);

      return {
        levelId: progress < STAIR_HALFWAY ? stair.lowerLevelId : stair.upperLevelId,
        floorElevationM: lowerM + (upperM - lowerM) * progress,
        stairId: stair.id,
        stairProgress: progress,
      };
    }

    // Off every flight: the storey the walker last committed to, on its own slab.
    return {
      levelId: previous.levelId,
      floorElevationM: this.floorOf(previous.levelId),
      stairId: null,
      stairProgress: 0,
    };
  }
}

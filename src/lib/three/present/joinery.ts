/**
 * Joinery: what a cutaway shows that a survey does not draw.
 *
 * The builder cuts a hole and fills it with a flat panel, which is exactly
 * right for a model and exactly wrong for a picture of a home: a door is a
 * white rectangle lost in a white wall. This module takes the built storey
 * after `dressing.ts` has painted it and adds the three things that make
 * openings legible from above:
 *
 * - **Doors stand open.** A hinged leaf is re-pivoted on its hinge edge and
 *   turned through {@link DOOR_OPEN_RAD}, towards the compass point the plan's
 *   `opensTowards` names (or whichever side the hinge rule picks first), and
 *   gets a bar handle on both faces.
 * - **Every opening gets a frame.** A painted architrave round doors, a full
 *   frame round windows, a mullion down the middle of anything sliding.
 * - **Railings become rails.** A balustrade wall is taken out and replaced by
 *   posts, three horizontal bars and a handrail in paint — the balcony reads
 *   as a balcony rather than a glass box.
 *
 * Everything is computed from the built geometry and the plan entry behind it:
 * the panel's bounding box gives the sill and head heights, the wall's
 * centreline gives the direction, and the plan gives widths and thicknesses.
 * Nothing here knows which way a wall runs until it asks.
 */

import { Box3, Group, Mesh, Vector3, type Object3D } from 'three';

import { millimetres } from '@/domain/units/types';

import { readPartData, tagPart, toSceneLength } from '../build/scene';

import type { DressingPlan } from './dressing';
import type { SceneMaterials } from './materials';
import { box } from './pieces/primitives';
import { facingVector, isFacing, type PlanOpening, type PlanWall } from './plan';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** How far a hinged door stands open: seventy degrees, enough to read the swing. */
export const DOOR_OPEN_RAD = 1.22;

/** The face width of a frame, and how far it stands proud of the wall each side. */
const FRAME_FACE = 0.06;
const FRAME_PROUD = 0.025;

/**
 * How far the frame reaches into the opening. A frame flush with the reveal
 * would share a plane with it and the two would fight for every pixel as the
 * model turns; reaching in a centimetre puts the reveal inside the frame.
 */
const FRAME_INSET = 0.012;

/** Sliding glazing gets a mullion down the middle. */
const MULLION_WIDTH = 0.04;

/** The door handle: a short bar a metre up, on both faces of the leaf. */
const HANDLE_HEIGHT = 1;
const HANDLE_LENGTH = 0.14;

/** Railing parts: square posts at most this far apart, three bars and a handrail. */
const RAIL_POST = 0.04;
const RAIL_BAR = 0.025;
const RAIL_BAR_COUNT = 3;
const RAIL_POST_SPACING = 1.2;
const HANDRAIL_HEIGHT = 0.05;
const HANDRAIL_DEPTH = 0.07;

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** What `fitJoinery` put in and took out of the storey. */
export interface JoineryReport {
  /** Frames, rails and handles added to the storey. */
  readonly added: readonly Object3D[];
  /** Balustrade walls removed from the storey; their geometry is not yet disposed. */
  readonly removed: readonly Mesh[];
}

/** A wall's run in scene units: where it starts, which way it goes, how far. */
export interface WallRun {
  readonly start: Vector3;
  readonly along: Vector3;
  readonly length: number;
  /** `rotation.y` that turns local `+x` onto `along`. */
  readonly turn: number;
  readonly thickness: number;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers.                                                           */
/* -------------------------------------------------------------------------- */

const at = (values: readonly number[], index: number): number => values[index] ?? 0;

/** Read a plan wall's run. Degenerate walls get a zero-length run pointing along `+x`. */
export function wallRun(wall: PlanWall): WallRun {
  const start = new Vector3(toSceneLength(millimetres(at(wall.start, 0))), 0, toSceneLength(millimetres(at(wall.start, 1))));
  const end = new Vector3(toSceneLength(millimetres(at(wall.end, 0))), 0, toSceneLength(millimetres(at(wall.end, 1))));
  const delta = end.clone().sub(start);
  const length = delta.length();
  const along = length === 0 ? new Vector3(1, 0, 0) : delta.divideScalar(length);

  return {
    start,
    along,
    length,
    turn: Math.atan2(-along.z, along.x),
    thickness: toSceneLength(millimetres(wall.thicknessMm)),
  };
}

/** A vector turned about `y` by `angle`, the way `rotation.y` turns a mesh. */
export function turnedAboutY(vector: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new Vector3(vector.x * cos + vector.z * sin, vector.y, -vector.x * sin + vector.z * cos);
}

/**
 * Which way to turn a leaf that points along `free` from its hinge, so that it
 * ends up nearer `towards`. With no preference, the positive turn.
 */
export function chooseSwing(free: Vector3, towards: Vector3 | null): number {
  if (towards === null) {
    return DOOR_OPEN_RAD;
  }

  const positive = turnedAboutY(free, DOOR_OPEN_RAD).dot(towards);
  const negative = turnedAboutY(free, -DOOR_OPEN_RAD).dot(towards);
  return positive >= negative ? DOOR_OPEN_RAD : -DOOR_OPEN_RAD;
}

/** The compass point a door opens towards, as a floor-plane vector, or `null` for no preference. */
function swingTarget(facing: string | undefined): Vector3 | null {
  if (facing === undefined || !isFacing(facing)) {
    return null;
  }

  const vector = facingVector(facing);
  return new Vector3(vector.x, 0, vector.z);
}

function boundsOf(mesh: Mesh): Box3 {
  if (mesh.geometry.boundingBox === null) {
    mesh.geometry.computeBoundingBox();
  }
  return mesh.geometry.boundingBox ?? new Box3().setFromObject(mesh);
}

/* -------------------------------------------------------------------------- */
/* Doors.                                                                      */
/* -------------------------------------------------------------------------- */

/** Whether an opening is a door on hinges — the only kind that stands open. */
export function isHinged(opening: PlanOpening): boolean {
  return opening.kind === 'door' && (opening.swing === 'left' || opening.swing === 'right');
}

/**
 * Re-pivot a leaf on its hinge and turn it open.
 *
 * The built panel is centred on the opening; its geometry is shifted so the
 * hinge edge sits on the mesh's origin, the mesh is moved to where that edge
 * was, and a turn about `y` then swings the free edge out. `left` hinges on the
 * edge nearer the wall's start, `right` on the edge nearer its end.
 */
export function swingDoor(leaf: Mesh, opening: PlanOpening, run: WallRun, materials: SceneMaterials): void {
  const bounds = boundsOf(leaf);
  const centre = bounds.getCenter(new Vector3());
  const halfWidth = toSceneLength(millimetres(opening.widthMm)) / 2;
  const hingeSide = opening.swing === 'left' ? -1 : 1;
  const hinge = centre.clone().addScaledVector(run.along, hingeSide * halfWidth);

  leaf.geometry.translate(-hinge.x, 0, -hinge.z);
  leaf.geometry.computeBoundingBox();
  leaf.geometry.computeBoundingSphere();
  leaf.position.set(hinge.x, 0, hinge.z);

  const free = run.along.clone().multiplyScalar(-hingeSide);
  leaf.rotation.y = chooseSwing(free, swingTarget(opening.opensTowards));

  // A bar handle on each face, near the free edge; in the leaf's own frame the
  // hinge is the origin and the leaf runs along `free`.
  const normal = new Vector3(-run.along.z, 0, run.along.x);
  const grip = free.clone().multiplyScalar(halfWidth * 2 - 0.1);
  const leafThickness = bounds.max.clone().sub(bounds.min).dot(normal);
  for (const side of [-1, 1]) {
    const offset = normal.clone().multiplyScalar(side * (Math.abs(leafThickness) / 2 + 0.012));
    const handle = box(HANDLE_LENGTH, 0.02, 0.02, materials.metal);
    handle.rotation.y = run.turn;
    handle.position.set(grip.x + offset.x, bounds.min.y + HANDLE_HEIGHT, grip.z + offset.z);
    leaf.add(handle);
  }
}

/* -------------------------------------------------------------------------- */
/* Frames.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A painted frame round one opening, built in the wall's own frame — along
 * `x`, up `y`, across `z` — and turned into place.
 */
export function buildFrame(panel: Mesh, opening: PlanOpening, run: WallRun, materials: SceneMaterials): Group {
  const bounds = boundsOf(panel);
  const centre = bounds.getCenter(new Vector3());
  const width = toSceneLength(millimetres(opening.widthMm));
  const low = bounds.min.y;
  const high = bounds.max.y;
  const depth = run.thickness + FRAME_PROUD * 2;
  const sill = opening.sillHeightMm > 0;
  const jambBase = sill ? low - FRAME_FACE + FRAME_INSET : low;
  const jambHeight = high + FRAME_FACE - FRAME_INSET - jambBase;

  const frame = new Group();
  frame.position.set(centre.x, 0, centre.z);
  frame.rotation.y = run.turn;

  for (const side of [-1, 1]) {
    const across = side * (width / 2 + FRAME_FACE / 2 - FRAME_INSET);
    frame.add(box(FRAME_FACE, jambHeight, depth, materials.paint, across, jambBase));
  }
  frame.add(box(width + FRAME_FACE * 2, FRAME_FACE, depth, materials.paint, 0, high - FRAME_INSET));
  if (sill) {
    frame.add(
      box(width + FRAME_FACE * 2, FRAME_FACE, depth + FRAME_PROUD, materials.paint, 0, low - FRAME_FACE + FRAME_INSET),
    );
  }
  if (opening.swing === 'sliding') {
    frame.add(box(MULLION_WIDTH, high - low, run.thickness * 0.6, materials.paint, 0, low));
  }

  return frame;
}

/* -------------------------------------------------------------------------- */
/* Railings.                                                                   */
/* -------------------------------------------------------------------------- */

/** Posts, bars and a handrail along a balustrade's run, between the heights given. */
export function buildRailing(run: WallRun, low: number, high: number, materials: SceneMaterials): Group {
  const rail = new Group();
  rail.position.copy(run.start);
  rail.rotation.y = run.turn;

  const height = high - low;
  const bays = Math.max(1, Math.ceil(run.length / RAIL_POST_SPACING));

  for (let post = 0; post <= bays; post += 1) {
    rail.add(box(RAIL_POST, height, RAIL_POST, materials.paint, (run.length / bays) * post, low));
  }
  for (let bar = 1; bar <= RAIL_BAR_COUNT; bar += 1) {
    rail.add(box(run.length, RAIL_BAR, RAIL_BAR, materials.paint, run.length / 2, low + (height * bar) / (RAIL_BAR_COUNT + 1)));
  }
  rail.add(box(run.length + RAIL_POST, HANDRAIL_HEIGHT, HANDRAIL_DEPTH, materials.paint, run.length / 2, high - HANDRAIL_HEIGHT));

  return rail;
}

/* -------------------------------------------------------------------------- */
/* The pass.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hang doors open, frame every opening, and turn balustrades into rails.
 *
 * Run after `dressStorey`: it reads the part tags the builder left and the
 * materials the dressing assigned, and adds its own meshes untagged so counts
 * of built parts are unchanged — except the balustrade walls it takes out,
 * whose replacement rails carry the wall's tag on their group.
 */
export function fitJoinery(storey: Group, plan: DressingPlan, materials: SceneMaterials): JoineryReport {
  const wallsById = new Map(plan.walls.map((wall) => [wall.id, wall]));
  const openingsById = new Map(plan.openings.map((opening) => [opening.id, opening]));
  const added: Object3D[] = [];
  const removed: Mesh[] = [];

  storey.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const part = readPartData(object);

    if (part?.kind === 'opening') {
      const opening = openingsById.get(part.entityId);
      const wall = opening === undefined ? undefined : wallsById.get(opening.wallId);
      if (opening === undefined || wall === undefined) {
        return;
      }

      const run = wallRun(wall);
      const frame = buildFrame(object, opening, run, materials);
      added.push(frame);

      if (isHinged(opening)) {
        swingDoor(object, opening, run, materials);
      }
      return;
    }

    if (part?.kind === 'wall' && wallsById.get(part.entityId)?.kind === 'railing') {
      const wall = wallsById.get(part.entityId);
      if (wall === undefined) {
        return;
      }
      const bounds = boundsOf(object);
      const rail = tagPart(buildRailing(wallRun(wall), bounds.min.y, bounds.max.y, materials), {
        kind: 'wall',
        entityId: part.entityId,
        levelId: part.levelId,
      });
      rail.name = wall.id;
      added.push(rail);
      removed.push(object);
    }
  });

  for (const rail of removed) {
    rail.removeFromParent();
  }
  for (const piece of added) {
    storey.add(piece);
  }

  return { added, removed };
}

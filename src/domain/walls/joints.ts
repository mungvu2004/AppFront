/**
 * Welding wall ends together, and the outline that follows from it.
 *
 * Two walls that a draughtsman drew as one corner almost never touch: the ends
 * land a few millimetres apart, and a plan drawn from those centrelines shows a
 * hairline crack at every corner or a lump where the two sections overlap.
 * Neither is acceptable — a room bounded by cracked walls has no area, and a
 * lump measures wrong. So the ends are welded first, and only then is the shape
 * of each wall worked out from the node it belongs to.
 *
 * The node is what carries the geometry, not the wall. Three properties follow
 * from that and are what the tests check:
 *
 * - **No gap.** Around a node, every corner point is computed once and handed to
 *   both walls that meet there, so their outlines share the edge exactly rather
 *   than each rounding its way to nearly the same place.
 * - **No overlap.** The middle of a node — the small polygon left between the
 *   trimmed ends — belongs to exactly one wall, the strongest one meeting there.
 *   The others stop at its faces.
 * - **No repair.** A thickness outside 60–600 mm, a wall of zero length, a top
 *   below its base: all throw. Nothing is clamped into range, because a plan
 *   that silently measures differently from the survey is worse than one that
 *   refuses to draw.
 *
 * Everything here is pure: no input array or object is written to, and the same
 * walls always produce the same nodes and the same outlines, down to the order
 * of the vertices.
 */

import {
  compareNearly,
  isNearlyZero,
  nearlyEqualAngle,
  nearlyEqualPoint,
  type PointMm,
} from '../units/compare';
import { distanceBetween } from '../units/snap';
import {
  degrees,
  millimetres,
  normaliseDegrees,
  radians,
  radiansToDegrees,
  type Degrees,
  type Millimetres,
} from '../units/types';
import type { WallId } from '../spatial/types';
import {
  assertUsableWall,
  endPoint,
  verticalRangesOverlap,
  WALL_ENDS,
  type Wall,
  type WallEnd,
  type WallKind,
} from './types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** How far apart two wall ends may be and still be the same node. */
export const DEFAULT_JOINT_THRESHOLD_MM: Millimetres = millimetres(50);

/**
 * The three shapes a node can take, named after the letter they draw.
 *
 * The count of wall ends decides: two make an `L`, three a `T`, four a cross.
 * A wall that runs through a node without stopping is two walls sharing an end,
 * which is how a `T` gets its three ends.
 */
export type JointKind = 'corner' | 'tee' | 'cross';

/** Joint id, prefixed with `J-`; built from its members, so it is stable. */
export type JointId = `J-${string}`;

/** One end of one wall. */
export interface WallEndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}

/** A wall end taking part in a node. */
export interface JointMember extends WallEndRef {
  /** Direction the wall leaves the node in, within `[0, 360)`. */
  readonly bearingDeg: Degrees;
}

/** A welded node: the wall ends that meet, and where they meet. */
export interface Joint {
  readonly id: JointId;
  readonly kind: JointKind;
  /** Centre of the ends that were welded together. */
  readonly position: PointMm;
  /** Members counter-clockwise by bearing, so the order is repeatable. */
  readonly members: readonly JointMember[];
  /** The wall that owns the middle of the node; the others stop at its faces. */
  readonly primaryWallId: WallId;
}

/** Why a group of nearby ends could not be turned into one of the three nodes. */
export type UnresolvedJointReason = 'tooManyEnds' | 'selfJoin';

/** A group of ends left unwelded, reported rather than guessed at. */
export interface UnresolvedJoint {
  readonly position: PointMm;
  readonly members: readonly WallEndRef[];
  readonly reason: UnresolvedJointReason;
}

/** What `resolveJoints` found. */
export interface ResolveJointsResult {
  readonly joints: readonly Joint[];
  readonly unresolved: readonly UnresolvedJoint[];
}

/** The real footprint of one wall, once its ends have been cut at the nodes. */
export interface WallShape {
  readonly wallId: WallId;
  /**
   * Closed outline counter-clockwise, at least four vertices, the first not
   * repeated at the end.
   */
  readonly outline: readonly PointMm[];
  readonly startJointId: JointId | null;
  readonly endJointId: JointId | null;
}

/** What `resolveWallShapes` found: the outlines plus the nodes they came from. */
export interface ResolveWallShapesResult {
  readonly shapes: readonly WallShape[];
  readonly joints: readonly Joint[];
  readonly unresolved: readonly UnresolvedJoint[];
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** A dimensionless direction; unit length by construction. */
interface Vector {
  readonly x: number;
  readonly y: number;
}

/** One wall end, with everything the node geometry needs about it. */
interface EndSample {
  readonly wall: Wall;
  readonly end: WallEnd;
  readonly position: PointMm;
  /** Unit vector pointing away from the node, along the centreline. */
  readonly direction: Vector;
  readonly bearingDeg: Degrees;
  readonly halfThicknessMm: Millimetres;
}

/**
 * The corner between two neighbouring wall ends.
 *
 * Normally one point, shared by both walls — that shared point is what keeps the
 * outlines gap-free. When the two faces are parallel (two collinear walls, or a
 * step between different thicknesses) they never meet, and each wall falls back
 * to its own square end, which butts against the other without a gap either.
 */
interface FaceCorner {
  /** Corner of the earlier member's left face. */
  readonly left: PointMm;
  /** Corner of the later member's right face. */
  readonly right: PointMm;
}

/** A resolved node, with the working geometry the outlines are cut from. */
interface JointGeometry {
  readonly joint: Joint;
  /** Members counter-clockwise, matching `joint.members`. */
  readonly members: readonly EndSample[];
  /** `corners[k]` sits between `members[k]` and `members[k + 1]`. */
  readonly corners: readonly FaceCorner[];
  readonly primaryIndex: number;
}

/** Ends this far apart in angle count as running along the same line. */
const COLLINEAR_TOLERANCE_DEG: Degrees = degrees(1);

/** Which wall keeps the middle of a node when several meet there. */
const KIND_RANK: Readonly<Record<WallKind, number>> = {
  loadBearing: 0,
  partition: 1,
  glazed: 2,
  railing: 3,
};

/** Half a turn, used to find the wall opposite another one. */
const OPPOSITE_DEG = 180;

const JOINT_KIND_BY_END_COUNT: Readonly<Record<number, JointKind>> = {
  2: 'corner',
  3: 'tee',
  4: 'cross',
};

/** Read a list cyclically, so `-1` is the last item and `length` the first. */
function atIndex<TItem>(items: readonly TItem[], index: number): TItem {
  const count = items.length;
  const item = items[((index % count) + count) % count];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} falls outside a list of ${String(count)} items.`);
  }
  return item;
}

function unitDirection(from: PointMm, to: PointMm): Vector {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  const length = Math.hypot(runX, runY);
  return { x: runX / length, y: runY / length };
}

/** The normal pointing to the left of a direction of travel. */
function leftNormal(direction: Vector): Vector {
  return { x: -direction.y, y: direction.x };
}

function bearingOf(direction: Vector): Degrees {
  return normaliseDegrees(radiansToDegrees(radians(Math.atan2(direction.y, direction.x))));
}

function offsetPoint(origin: PointMm, direction: Vector, distanceMm: number): PointMm {
  return {
    x: millimetres(origin.x + direction.x * distanceMm),
    y: millimetres(origin.y + direction.y * distanceMm),
  };
}

function otherEnd(end: WallEnd): WallEnd {
  return end === 'start' ? 'end' : 'start';
}

function endKey(wallId: WallId, end: WallEnd): string {
  return `${wallId}.${end}`;
}

/**
 * Reject the walls the geometry cannot work with, before anything is computed.
 *
 * Ids are checked for duplicates too: two walls sharing an id would make the
 * node lookup ambiguous, and the outline of one would silently be given to the
 * other.
 */
function assertUsableWalls(walls: readonly Wall[]): void {
  const seen = new Set<WallId>();
  for (const wall of walls) {
    assertUsableWall(wall);
    if (seen.has(wall.id)) {
      throw new Error(`Wall id ${wall.id} appears more than once.`);
    }
    seen.add(wall.id);
  }
}

function assertUsableThreshold(thresholdMm: Millimetres): void {
  if (!Number.isFinite(thresholdMm) || thresholdMm <= 0) {
    throw new RangeError(`Joint threshold must be a positive length: ${String(thresholdMm)}`);
  }
}

function collectEnds(walls: readonly Wall[]): EndSample[] {
  const samples: EndSample[] = [];

  for (const wall of walls) {
    for (const end of WALL_ENDS) {
      const position = endPoint(wall, end);
      const direction = unitDirection(position, endPoint(wall, otherEnd(end)));
      samples.push({
        wall,
        end,
        position,
        direction,
        bearingDeg: bearingOf(direction),
        halfThicknessMm: millimetres(wall.thicknessMm / 2),
      });
    }
  }

  return samples;
}

/**
 * Group ends that are within the threshold of each other.
 *
 * Grouping is transitive: three ends in a row, each close to the next, become
 * one node even when the outer two are further apart than the threshold. That is
 * what a person sees on the drawing, and it keeps the answer independent of the
 * order the walls arrive in.
 *
 * Ends whose walls occupy no common height are never grouped, so a parapet is
 * not welded to the wall of the storey above it.
 */
function groupNearbyEnds(
  samples: readonly EndSample[],
  thresholdMm: Millimetres,
): readonly (readonly EndSample[])[] {
  const parents = samples.map((_, index) => index);

  const rootOf = (index: number): number => {
    let current = index;
    let parent = atIndex(parents, current);
    while (parent !== current) {
      current = parent;
      parent = atIndex(parents, current);
    }
    return current;
  };

  const merge = (first: number, second: number): void => {
    const firstRoot = rootOf(first);
    const secondRoot = rootOf(second);
    if (firstRoot !== secondRoot) {
      parents[Math.max(firstRoot, secondRoot)] = Math.min(firstRoot, secondRoot);
    }
  };

  for (let first = 0; first < samples.length; first += 1) {
    for (let second = first + 1; second < samples.length; second += 1) {
      const one = atIndex(samples, first);
      const other = atIndex(samples, second);
      if (!verticalRangesOverlap(one.wall, other.wall)) {
        continue;
      }
      if (compareNearly(distanceBetween(one.position, other.position), thresholdMm) < 0) {
        merge(first, second);
      }
    }
  }

  const groupByRoot = new Map<number, EndSample[]>();

  samples.forEach((sample, index) => {
    const root = rootOf(index);
    const group = groupByRoot.get(root);
    if (group === undefined) {
      groupByRoot.set(root, [sample]);
    } else {
      group.push(sample);
    }
  });

  return [...groupByRoot.values()].filter((group) => group.length > 1);
}

function centreOf(samples: readonly EndSample[]): PointMm {
  const total = samples.reduce(
    (sum, sample) => ({ x: sum.x + sample.position.x, y: sum.y + sample.position.y }),
    { x: 0, y: 0 },
  );
  return {
    x: millimetres(total.x / samples.length),
    y: millimetres(total.y / samples.length),
  };
}

/** Counter-clockwise by bearing; ties fall back to the id so runs agree. */
function compareMembers(first: EndSample, second: EndSample): number {
  const byBearing = compareNearly(first.bearingDeg, second.bearingDeg);
  if (byBearing !== 0) {
    return byBearing;
  }
  if (first.wall.id !== second.wall.id) {
    return first.wall.id < second.wall.id ? -1 : 1;
  }
  return first.end === second.end ? 0 : first.end === 'start' ? -1 : 1;
}

/** Does another end at this node run back along the same line? */
function hasOppositeMember(members: readonly EndSample[], index: number): boolean {
  const member = atIndex(members, index);
  const opposite = degrees(member.bearingDeg + OPPOSITE_DEG);
  return members.some(
    (other, otherIndex) =>
      otherIndex !== index && nearlyEqualAngle(other.bearingDeg, opposite, COLLINEAR_TOLERANCE_DEG),
  );
}

/**
 * Which wall keeps the middle of the node.
 *
 * Structure first, then the thicker section, then the wall that runs straight
 * through rather than the one that stops — a partition butts onto a load-bearing
 * wall, not the other way round. The wall id settles the rest, so the choice
 * never depends on the order the walls were listed in.
 */
function choosePrimaryIndex(members: readonly EndSample[]): number {
  const throughness = members.map((_, index) => hasOppositeMember(members, index));

  let best = 0;

  for (let index = 1; index < members.length; index += 1) {
    const candidate = atIndex(members, index);
    const incumbent = atIndex(members, best);

    const byKind = KIND_RANK[candidate.wall.kind] - KIND_RANK[incumbent.wall.kind];
    if (byKind !== 0) {
      if (byKind < 0) {
        best = index;
      }
      continue;
    }

    const byThickness = compareNearly(candidate.wall.thicknessMm, incumbent.wall.thicknessMm);
    if (byThickness !== 0) {
      if (byThickness > 0) {
        best = index;
      }
      continue;
    }

    const candidateThrough = atIndex(throughness, index);
    if (candidateThrough !== atIndex(throughness, best)) {
      if (candidateThrough) {
        best = index;
      }
      continue;
    }

    if (candidate.wall.id !== incumbent.wall.id) {
      if (candidate.wall.id < incumbent.wall.id) {
        best = index;
      }
      continue;
    }

    if (candidate.end === 'start' && incumbent.end === 'end') {
      best = index;
    }
  }

  return best;
}

/**
 * Where two neighbouring wall faces meet.
 *
 * `earlier` and `later` are neighbours counter-clockwise, so the empty wedge
 * between them is bounded by the left face of the first and the right face of
 * the second. Their intersection is the corner both walls stop at.
 */
function faceCorner(position: PointMm, earlier: EndSample, later: EndSample): FaceCorner {
  const earlierNormal = leftNormal(earlier.direction);
  const laterNormal = leftNormal(later.direction);
  const onEarlier = offsetPoint(position, earlierNormal, earlier.halfThicknessMm);
  const onLater = offsetPoint(position, laterNormal, -later.halfThicknessMm);

  const cross = earlier.direction.x * later.direction.y - earlier.direction.y * later.direction.x;

  if (isNearlyZero(cross)) {
    // Parallel faces never meet. Both walls keep a square end on the node plane,
    // which for two collinear walls of one thickness is the very same point.
    return { left: onEarlier, right: onLater };
  }

  const along =
    ((onLater.x - onEarlier.x) * later.direction.y - (onLater.y - onEarlier.y) * later.direction.x) /
    cross;
  const meeting = offsetPoint(onEarlier, earlier.direction, along);

  return { left: meeting, right: meeting };
}

function buildJointId(members: readonly EndSample[]): JointId {
  const keys = members.map((member) => endKey(member.wall.id, member.end)).sort();
  return `J-${keys.join('+')}`;
}

/** Turn one group of welded ends into a node, or explain why it cannot be one. */
function buildJointGeometry(group: readonly EndSample[]): JointGeometry | UnresolvedJoint {
  const position = centreOf(group);
  const refs = group.map((sample) => ({ wallId: sample.wall.id, end: sample.end }));

  const wallIds = new Set(group.map((sample) => sample.wall.id));
  if (wallIds.size !== group.length) {
    return { position, members: refs, reason: 'selfJoin' };
  }

  const kind = JOINT_KIND_BY_END_COUNT[group.length];
  if (kind === undefined) {
    return { position, members: refs, reason: 'tooManyEnds' };
  }

  const members = [...group].sort(compareMembers);
  const corners = members.map((member, index) =>
    faceCorner(position, member, atIndex(members, index + 1)),
  );
  const primaryIndex = choosePrimaryIndex(members);

  return {
    joint: {
      id: buildJointId(members),
      kind,
      position,
      members: members.map((member) => ({
        wallId: member.wall.id,
        end: member.end,
        bearingDeg: member.bearingDeg,
      })),
      primaryWallId: atIndex(members, primaryIndex).wall.id,
    },
    members,
    corners,
    primaryIndex,
  };
}

function isUnresolved(candidate: JointGeometry | UnresolvedJoint): candidate is UnresolvedJoint {
  return 'reason' in candidate;
}

/** Sort nodes by position, then by id, so two runs list them the same way. */
function compareJoints(first: Joint, second: Joint): number {
  const byX = compareNearly(first.position.x, second.position.x);
  if (byX !== 0) {
    return byX;
  }
  const byY = compareNearly(first.position.y, second.position.y);
  if (byY !== 0) {
    return byY;
  }
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}

function resolveGeometry(
  walls: readonly Wall[],
  thresholdMm: Millimetres,
): { readonly geometries: readonly JointGeometry[]; readonly unresolved: readonly UnresolvedJoint[] } {
  assertUsableWalls(walls);
  assertUsableThreshold(thresholdMm);

  const groups = groupNearbyEnds(collectEnds(walls), thresholdMm);
  const geometries: JointGeometry[] = [];
  const unresolved: UnresolvedJoint[] = [];

  for (const group of groups) {
    const built = buildJointGeometry(group);
    if (isUnresolved(built)) {
      unresolved.push(built);
    } else {
      geometries.push(built);
    }
  }

  return { geometries, unresolved };
}

/* -------------------------------------------------------------------------- */
/* Outlines.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The end cap of one wall at a node, counter-clockwise.
 *
 * Every wall stops on the straight line between its two corners — except the
 * wall that owns the node, whose cap walks the long way round and so swallows
 * the small polygon left in the middle. That is the whole overlap-and-gap story:
 * the middle is covered exactly once, by exactly one wall.
 */
function capWalk(geometry: JointGeometry, memberIndex: number): readonly PointMm[] {
  const { corners, primaryIndex } = geometry;

  if (memberIndex !== primaryIndex) {
    return [atIndex(corners, memberIndex).left, atIndex(corners, memberIndex - 1).right];
  }

  const walk: PointMm[] = [];
  for (let step = 0; step < corners.length; step += 1) {
    const corner = atIndex(corners, memberIndex + step);
    walk.push(corner.left, corner.right);
  }
  return walk;
}

/** Square end of a wall that meets nothing, counter-clockwise from left to right. */
function freeCap(point: PointMm, direction: Vector, halfThicknessMm: Millimetres): readonly PointMm[] {
  const normal = leftNormal(direction);
  return [offsetPoint(point, normal, halfThicknessMm), offsetPoint(point, normal, -halfThicknessMm)];
}

function dropRepeatedPoints(points: readonly PointMm[]): readonly PointMm[] {
  const kept: PointMm[] = [];

  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous === undefined || !nearlyEqualPoint(previous, point)) {
      kept.push(point);
    }
  }

  const first = kept[0];
  const last = kept[kept.length - 1];
  if (kept.length > 1 && first !== undefined && last !== undefined && nearlyEqualPoint(first, last)) {
    kept.pop();
  }

  return kept;
}

/** How far a point sits off the line through two others. */
function offLineDistance(point: PointMm, from: PointMm, to: PointMm): Millimetres {
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  const length = Math.hypot(runX, runY);
  if (isNearlyZero(length)) {
    return distanceBetween(point, from);
  }
  const cross = runX * (point.y - from.y) - runY * (point.x - from.x);
  return millimetres(Math.abs(cross) / length);
}

/**
 * Drop vertices that carry no shape.
 *
 * A wall trimmed at a node collects points that lie on the straight face it
 * already had; removing them changes nothing about the region covered — and so
 * cannot open a gap — while keeping the outline of a plain wall the four corners
 * a reader expects. Four vertices are always kept, whatever happens.
 */
function simplifyOutline(points: readonly PointMm[]): readonly PointMm[] {
  let outline = dropRepeatedPoints(points);
  let removedOne = true;

  while (removedOne && outline.length > 4) {
    removedOne = false;
    for (let index = 0; index < outline.length; index += 1) {
      const previous = atIndex(outline, index - 1);
      const next = atIndex(outline, index + 1);
      if (isNearlyZero(offLineDistance(atIndex(outline, index), previous, next))) {
        outline = outline.filter((_, other) => other !== index);
        removedOne = true;
        break;
      }
    }
  }

  return outline;
}

/**
 * The outline of one wall, counter-clockwise.
 *
 * The walk is: up the right face, across the far cap, back down the left face,
 * across the near cap. At a node the cap comes from the node; where the wall
 * meets nothing it is square.
 */
function buildOutline(
  startCap: readonly PointMm[],
  endCap: readonly PointMm[],
): readonly PointMm[] {
  return simplifyOutline([...endCap, ...startCap]);
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Weld wall ends that sit closer together than the threshold into nodes.
 *
 * Ends exactly on the threshold are left alone: the rule is *under* 50 mm, so a
 * pair 50 mm apart, and certainly one 60 mm apart, stays two free ends.
 *
 * Groups that cannot be one of the three node shapes are returned in
 * `unresolved` instead of being forced into one: five ends in one place, or both
 * ends of a single wall, mean the input is wrong in a way this module must not
 * paper over.
 *
 * @throws RangeError when a wall is unusable, or the threshold is not positive.
 * @throws Error when two walls share an id.
 */
export function resolveJoints(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveJointsResult {
  const { geometries, unresolved } = resolveGeometry(walls, thresholdMm);
  const joints = geometries.map((geometry) => geometry.joint).sort(compareJoints);

  return { joints, unresolved };
}

/**
 * The real footprint of every wall, once its ends are cut at the nodes.
 *
 * Every outline is a closed polygon of at least four vertices, listed
 * counter-clockwise, with the first vertex not repeated at the end. Walls that
 * meet nothing keep their square ends and their plain rectangle.
 *
 * Outlines come back in the order the walls were given, and the input is never
 * written to.
 *
 * @throws RangeError when a wall is unusable, or the threshold is not positive.
 * @throws Error when two walls share an id.
 */
export function resolveWallShapes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveWallShapesResult {
  const { geometries, unresolved } = resolveGeometry(walls, thresholdMm);

  const geometryByEnd = new Map<string, { geometry: JointGeometry; memberIndex: number }>();
  for (const geometry of geometries) {
    geometry.members.forEach((member, memberIndex) => {
      geometryByEnd.set(endKey(member.wall.id, member.end), { geometry, memberIndex });
    });
  }

  const shapes = walls.map((wall): WallShape => {
    const halfThicknessMm = millimetres(wall.thicknessMm / 2);
    const forward = unitDirection(wall.centreline.start, wall.centreline.end);
    const backward = { x: -forward.x, y: -forward.y };

    const atStart = geometryByEnd.get(endKey(wall.id, 'start'));
    const atEnd = geometryByEnd.get(endKey(wall.id, 'end'));

    // At the start the wall leaves along `forward`, so the node's left is the
    // wall's left; at the far end it leaves along `backward` and the two swap.
    // Either way the cap runs from the node's left corner to its right one.
    const startCap =
      atStart === undefined
        ? freeCap(wall.centreline.start, forward, halfThicknessMm)
        : capWalk(atStart.geometry, atStart.memberIndex);
    const endCap =
      atEnd === undefined
        ? freeCap(wall.centreline.end, backward, halfThicknessMm)
        : capWalk(atEnd.geometry, atEnd.memberIndex);

    return {
      wallId: wall.id,
      outline: buildOutline(startCap, endCap),
      startJointId: atStart?.geometry.joint.id ?? null,
      endJointId: atEnd?.geometry.joint.id ?? null,
    };
  });

  return {
    shapes,
    joints: geometries.map((geometry) => geometry.joint).sort(compareJoints),
    unresolved,
  };
}

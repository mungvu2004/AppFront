/**
 * Finding the parts of a building that run all the way up it.
 *
 * A stair does not belong to a storey. Neither does a riser shaft, a lift well
 * or a duct: they are one object that the drawing set happens to cut into one
 * slice per sheet. Every other module here works a level at a time, which is
 * right for a wall and wrong for a stair — read that way, a four-storey stair
 * is four unrelated rooms that happen to share a name.
 *
 * Nothing in the spatial graph says otherwise. `Room` carries a `levelId` and
 * nothing that points at the room above it, and that is deliberate: the link
 * between two slices of a stair is not a fact somebody typed, it is a fact
 * about where the two slices are. Adding a field would move the work onto the
 * person doing data entry and make every screen trust an answer nobody checked.
 * So the link is **derived**, here, from the outlines the tracer already drew.
 *
 * Two slices are the same core when they sit on **adjacent** storeys, share a
 * usage that can be continuous, and **overlap in plan** — the balance point of
 * one falls inside the outline of the other. Overlap, not proximity: two
 * stairwells at opposite ends of a building are two stairs however similar
 * their areas are, and a slice that has drifted a whole room away is a break in
 * the core rather than a wobble in it.
 *
 * What the drawing is really being asked is whether the core is **plumb**. It
 * usually is not, quite: the sheets were scanned and scaled one at a time, so a
 * stair that was poured in one continuous formwork arrives with its slices a
 * few centimetres apart. Past `ALIGNMENT_WARNING_THRESHOLD_MM` — the same bar
 * `alignFloors` holds a whole storey to, because a core cannot be judged by a
 * looser rule than the floor it stands in — the offset stops being scanner
 * noise and starts being something a person has to look at, and it earns an
 * issue naming both storeys and the millimetres.
 *
 * A core of a single storey is still reported. It is the shape of a stair that
 * stops, and a stair that stops is exactly what the reader needs to see; a
 * module that only returned the runs of two or more would answer the easy
 * question and hide the interesting one.
 *
 * The entry point takes rooms and levels as plain records rather than a
 * `SpatialGraph`, for the reason `alignFloors` takes `FloorPlan` rather than
 * `Level`: a test of this rule should be four rectangles and two numbers, not a
 * whole building.
 *
 * Every function is pure. The same rooms always give the same cores, in the
 * same order, with the same issues in the same order — no clock, no randomness,
 * and no dependence on the order the rooms were handed over in.
 */

import { computeCentroid, outlineContains } from '../rooms/area';
import type { LevelId, Point, RoomId, RoomUsage } from '../spatial/types';
import { compareNearly, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import { millimetres, type Millimetres } from '../units/types';
import { ALIGNMENT_WARNING_THRESHOLD_MM } from './alignFloors';

/* -------------------------------------------------------------------------- */
/* What can be continuous.                                                     */
/* -------------------------------------------------------------------------- */

/** A usage that is allowed to form a vertical core. */
export type ContinuousCoreUsage = 'stairwell' | 'utility';

/**
 * The usages a vertical core can be made of.
 *
 * Exactly two of the eight, and the count is the point rather than an accident
 * of what has been built so far. A stairwell is the one room whose whole
 * purpose is to pass through the slab, and `utility` is where this model puts
 * the riser: the duct, the shaft, the plant cupboard stacked on the one below.
 * Those are the rooms a building repeats vertically on purpose, and the two a
 * reader is asking about when they ask whether the core lines up.
 *
 * The other six are not left out for want of effort. A bedroom above a bedroom
 * is two bedrooms — that they line up is a consequence of the structure, not a
 * thing that has to hold, and reporting it as a "core" would bury the two rows
 * that matter under thirty that do not. A corridor is the near miss and stays
 * out for the same reason: corridors stack because floor plates repeat, and
 * nothing is wrong when one of them does not.
 */
export const CONTINUOUS_CORE_USAGES: readonly ContinuousCoreUsage[] = ['stairwell', 'utility'];

/** Is this usage one that a vertical core can be made of? */
export function isContinuousCoreUsage(usage: RoomUsage): usage is ContinuousCoreUsage {
  return CONTINUOUS_CORE_USAGES.some((continuous) => continuous === usage);
}

/** Fewest corners a shape needs before it encloses anything at all. */
const MIN_OUTLINE_VERTICES = 3;

/** Vietnamese name of what the core is, for the sentence that reports it. */
const USAGE_TEXT: Readonly<Record<ContinuousCoreUsage, string>> = {
  stairwell: 'thang',
  utility: 'hộp kỹ thuật',
};

/* -------------------------------------------------------------------------- */
/* Input.                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One storey, as this rule needs to see it.
 *
 * `order` counts from the bottom up with the ground storey at 0, exactly as
 * `Level.order` does; it is what "adjacent" means here. Elevations and heights
 * are deliberately absent — how far apart two storeys are vertically has no
 * bearing on whether a stair passes between them.
 */
export interface CoreLevel {
  readonly levelId: LevelId;
  /** Named in the issue sentence, so the reader knows which storeys. */
  readonly name: string;
  readonly order: number;
}

/**
 * One room, as this rule needs to see it.
 *
 * The fields are ones `Room` already carries, with the same names and the same
 * meanings, so a caller hands a room straight over.
 */
export interface CoreRoom {
  readonly id: RoomId;
  readonly levelId: LevelId;
  readonly name: string;
  readonly usage: RoomUsage;
  /** Closed outline; the first point is not repeated at the end. */
  readonly outline: readonly Point[];
}

/* -------------------------------------------------------------------------- */
/* Output.                                                                     */
/* -------------------------------------------------------------------------- */

/** What a core can be short of, and there is only one thing: standing plumb. */
export type VerticalCoreIssueKind = 'coreOffset';

/**
 * One place a core does not stand over itself.
 *
 * The shape deliberately matches `alignFloors`'s `FloorIssue` — same fields,
 * same meanings, same Vietnamese sentence naming the storeys and the
 * millimetres — so a screen that already renders one list of issues renders
 * this one too. `severity` is always `attention`: a core that has drifted still
 * builds. Nothing here is ever green, because approval belongs to a person.
 */
export interface VerticalCoreIssue {
  readonly kind: VerticalCoreIssueKind;
  /** The upper storey of the pair — the one that has moved. */
  readonly levelId: LevelId;
  /** The storey below it, the one it should be standing on. */
  readonly relatedLevelId: LevelId;
  readonly severity: 'attention';
  /** Distance between the two balance points, in millimetres. */
  readonly amountMm: Millimetres;
  /** Vietnamese sentence naming both storeys and the millimetres. */
  readonly message: string;
}

/** One slice of a core: what it is on one storey. */
export interface VerticalCoreSlice {
  readonly roomId: RoomId;
  readonly levelId: LevelId;
  readonly levelOrder: number;
  /** The room's own name, for a caption on the vertical path. */
  readonly name: string;
  /** Its balance point: where the path passes through this storey. */
  readonly centroid: PointMm;
}

/** One element that runs continuously through the building. */
export interface VerticalCore {
  /**
   * Code for the core.
   *
   * Built from the usage and the lowest slice's room, which belongs to exactly
   * one core, so the code is unique and is the same however the rooms were
   * ordered on the way in.
   */
  readonly id: string;
  readonly usage: ContinuousCoreUsage;
  /** The storeys it passes through, from the bottom up. */
  readonly levelIds: readonly LevelId[];
  /** The slices themselves, in that same order. */
  readonly slices: readonly VerticalCoreSlice[];
  /**
   * Where to draw the vertical path, in plan.
   *
   * The mean of the slice balance points: the path is one line across the whole
   * run, and the mean is the line nearest all of them rather than the one that
   * favours whichever storey happened to be traced first.
   */
  readonly centroid: PointMm;
  /** How far the worst adjacent pair is out of plumb; zero when plumb. */
  readonly maxOffsetMm: Millimetres;
  /** Its own offsets past the threshold, by storey from the bottom up. */
  readonly issues: readonly VerticalCoreIssue[];
}

/** Every core in the building, checked. */
export interface VerticalCoreReport {
  /** By lowest storey, then by code, so the order never wobbles. */
  readonly cores: readonly VerticalCore[];
  /** Every core's issues, concatenated in that same order. */
  readonly issues: readonly VerticalCoreIssue[];
}

export interface FindVerticalCoresOptions {
  /** Offset past which a pair earns an issue. */
  readonly offsetThresholdMm?: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Formatting, in the units the interface reads them in.                       */
/* -------------------------------------------------------------------------- */

/**
 * Millimetres, whole where they can be, with a comma for the decimal.
 *
 * `alignFloors` keeps its own copy of this and does not export it, so the two
 * sentences round the same way and stay comparable side by side in one list —
 * restated rather than reached for, as `compare.ts` restates `scale.ts`'s
 * `RESULT_PRECISION`.
 */
function millimetreText(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded === 0 ? 0 : rounded).replace('.', ',');
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The outline in labelled millimetres.
 *
 * `Room.outline` stores bare numbers and the geometry in `rooms/area` takes
 * tagged ones; this is the one gate between them, as in `rules/function`.
 */
function toPointsMm(outline: readonly Point[]): PointMm[] {
  return outline.map((corner) => ({ x: millimetres(corner.x), y: millimetres(corner.y) }));
}

/** Order two ids the way `Array.prototype.sort` wants to hear it. */
function compareId(first: string, second: string): number {
  return first < second ? -1 : 1;
}

/**
 * A room that passed the filter, with its geometry worked out once, and the
 * core it has been found to belong to.
 *
 * `group` is the only thing here that moves: it starts as the room's own id and
 * is rewritten as links merge slices together. Once `findVerticalCores`
 * returns, nothing about the answer depends on that having happened in any
 * particular order.
 */
interface CoreNode {
  readonly room: CoreRoom;
  readonly usage: ContinuousCoreUsage;
  readonly level: CoreLevel;
  readonly outline: readonly PointMm[];
  readonly centroid: PointMm;
  group: RoomId;
}

/**
 * Which rooms can be part of a core at all.
 *
 * A room whose storey is not in the list is dropped rather than guessed at:
 * without an `order` there is no telling what it is adjacent to. So is an
 * outline with fewer than three corners, which encloses nothing and so can
 * neither contain a point nor be contained by one.
 *
 * The result is bottom up, then by room id, so every step after this — the
 * pairing, the grouping and the final order — is decided by the building rather
 * than by the order the caller happened to list the rooms in.
 */
function collectNodes(rooms: readonly CoreRoom[], levels: readonly CoreLevel[]): CoreNode[] {
  const levelsById = new Map<LevelId, CoreLevel>();
  for (const level of levels) {
    levelsById.set(level.levelId, level);
  }

  const nodes: CoreNode[] = [];

  for (const room of rooms) {
    if (!isContinuousCoreUsage(room.usage)) {
      continue;
    }
    if (room.outline.length < MIN_OUTLINE_VERTICES) {
      continue;
    }
    const level = levelsById.get(room.levelId);
    if (level === undefined) {
      continue;
    }
    const outline = toPointsMm(room.outline);
    nodes.push({
      room,
      usage: room.usage,
      level,
      outline,
      centroid: computeCentroid(outline),
      group: room.id,
    });
  }

  nodes.sort((first, second) => {
    if (first.level.order !== second.level.order) {
      return first.level.order - second.level.order;
    }
    return compareId(first.room.id, second.room.id);
  });

  return nodes;
}

/**
 * Do these two slices sit over each other?
 *
 * Either balance point inside the other outline counts, and that asymmetry is
 * the useful part: a small plant cupboard tucked inside a wide stair hall has
 * its own centre inside the hall while the hall's centre falls outside the
 * cupboard, and the two are still the same shaft. Asking both ways costs one
 * more test and catches the case a single direction drops.
 *
 * This is deliberately not a polygon intersection. Two shapes that merely graze
 * each other along an edge are not one core, and an intersection test would say
 * they were.
 */
function overlapsInPlan(lower: CoreNode, upper: CoreNode): boolean {
  return (
    outlineContains(upper.outline, lower.centroid) || outlineContains(lower.outline, upper.centroid)
  );
}

/** One rung of a core: two slices on adjacent storeys, and how far out they are. */
interface Link {
  readonly lower: CoreNode;
  readonly upper: CoreNode;
  readonly offsetMm: Millimetres;
}

/**
 * Every pair of slices that belongs to the same core.
 *
 * The nodes are already bottom up, so one pass over the pairs finds each rung
 * once, in order. A slice may link to more than one above it — a stair hall
 * that splits into two shafts is one core, not two — which is why this hands
 * back a set of rungs to be grouped rather than a chain to be walked.
 */
function findLinks(nodes: readonly CoreNode[]): Link[] {
  const links: Link[] = [];

  for (const [lowerIndex, lower] of nodes.entries()) {
    for (const upper of nodes.slice(lowerIndex + 1)) {
      if (upper.level.order - lower.level.order !== 1) {
        continue;
      }
      if (upper.usage !== lower.usage) {
        continue;
      }
      if (!overlapsInPlan(lower, upper)) {
        continue;
      }
      links.push({ lower, upper, offsetMm: distanceBetween(lower.centroid, upper.centroid) });
    }
  }

  return links;
}

/**
 * Merge linked slices into cores.
 *
 * A core is a connected run of linked slices. Each rung folds the upper slice's
 * group into the lower slice's, taking everything already in the upper group
 * with it — which is the case where two shafts meet in one hall on the storey
 * above, and the reason a rung between two slices that are already in the same
 * core is simply skipped.
 */
function mergeGroups(nodes: readonly CoreNode[], links: readonly Link[]): void {
  for (const link of links) {
    const absorbed = link.upper.group;
    const surviving = link.lower.group;
    if (absorbed === surviving) {
      continue;
    }
    for (const node of nodes) {
      if (node.group === absorbed) {
        node.group = surviving;
      }
    }
  }
}

/** The mean of the slice balance points: where the vertical path is drawn. */
function meanCentroid(slices: readonly VerticalCoreSlice[]): PointMm {
  let totalX = 0;
  let totalY = 0;
  for (const slice of slices) {
    totalX += slice.centroid.x;
    totalY += slice.centroid.y;
  }
  return {
    x: millimetres(totalX / slices.length),
    y: millimetres(totalY / slices.length),
  };
}

/** The sentence a reader gets when a core is not plumb. */
function offsetMessage(link: Link, thresholdMm: Millimetres): string {
  return (
    `Lõi ${USAGE_TEXT[link.upper.usage]} ở ${link.upper.level.name} lệch ` +
    `${millimetreText(link.offsetMm)} mm so với ${link.lower.level.name}, ` +
    `vượt ngưỡng ${millimetreText(thresholdMm)} mm.`
  );
}

/** The slices of one core, and the lowest of them, kept together. */
interface CoreMembers {
  readonly lowest: CoreNode;
  readonly nodes: CoreNode[];
}

/* -------------------------------------------------------------------------- */
/* The rule.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Find the elements that run continuously through the building.
 *
 * Rooms of a continuous usage are matched to the rooms directly above and below
 * them, a connected run of matches becomes one core, and each rung of the run
 * is measured. A rung further out than the threshold earns an `attention` issue
 * naming both storeys and the millimetres; anything under it is scanner noise
 * and is left alone, though `maxOffsetMm` still reports it so a caller can draw
 * the path with the wobble it really has.
 *
 * Cores come back lowest storey first, and a building with no continuous rooms
 * in it gives an empty report rather than throwing: a plan with no stair on it
 * yet is a plan being drawn, not a plan that is wrong.
 */
export function findVerticalCores(
  rooms: readonly CoreRoom[],
  levels: readonly CoreLevel[],
  options: FindVerticalCoresOptions = {},
): VerticalCoreReport {
  const thresholdMm = options.offsetThresholdMm ?? ALIGNMENT_WARNING_THRESHOLD_MM;

  const nodes = collectNodes(rooms, levels);
  const links = findLinks(nodes);
  mergeGroups(nodes, links);

  const members = new Map<RoomId, CoreMembers>();
  for (const node of nodes) {
    const found = members.get(node.group);
    if (found === undefined) {
      members.set(node.group, { lowest: node, nodes: [node] });
      continue;
    }
    found.nodes.push(node);
  }

  const issuesByGroup = new Map<RoomId, VerticalCoreIssue[]>();
  const worstOffsetByGroup = new Map<RoomId, number>();

  for (const link of links) {
    const group = link.lower.group;
    worstOffsetByGroup.set(group, Math.max(worstOffsetByGroup.get(group) ?? 0, link.offsetMm));

    if (compareNearly(link.offsetMm, thresholdMm) <= 0) {
      continue;
    }
    const bucket = issuesByGroup.get(group) ?? [];
    bucket.push({
      kind: 'coreOffset',
      levelId: link.upper.level.levelId,
      relatedLevelId: link.lower.level.levelId,
      severity: 'attention',
      amountMm: link.offsetMm,
      message: offsetMessage(link, thresholdMm),
    });
    issuesByGroup.set(group, bucket);
  }

  // `members` was filled from the bottom-up node list, so each core's slices are
  // already in order; the cores go in that same order, by the storey they start
  // on, with the lowest slice's id breaking a tie between two that start level.
  const grouped = [...members.entries()].sort(([, first], [, second]) => {
    if (first.lowest.level.order !== second.lowest.level.order) {
      return first.lowest.level.order - second.lowest.level.order;
    }
    return compareId(first.lowest.room.id, second.lowest.room.id);
  });

  const cores: VerticalCore[] = grouped.map(([group, core]) => {
    const slices: VerticalCoreSlice[] = core.nodes.map((node) => ({
      roomId: node.room.id,
      levelId: node.level.levelId,
      levelOrder: node.level.order,
      name: node.room.name,
      centroid: node.centroid,
    }));

    return {
      id: `VC-${core.lowest.usage}-${core.lowest.room.id}`,
      usage: core.lowest.usage,
      levelIds: slices.map((slice) => slice.levelId),
      slices,
      centroid: meanCentroid(slices),
      maxOffsetMm: millimetres(worstOffsetByGroup.get(group) ?? 0),
      issues: issuesByGroup.get(group) ?? [],
    };
  });

  return { cores, issues: cores.flatMap((core) => core.issues) };
}

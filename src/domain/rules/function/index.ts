/**
 * The second group of rules: what the building is like to use, and to leave.
 *
 * The geometry group asks whether the model can exist. This one asks whether a
 * person can live in it — walk into every room, see daylight, pass someone in
 * the corridor, and get out of the building when they have to. None of these
 * defects stop the drawing rendering, which is exactly why they survive to site
 * unless something says them out loud.
 *
 * **Everything a use requires lives in `USAGE_REQUIREMENTS`.** Not in the
 * functions: no rule below contains a number for how big a bedroom is or how
 * wide a corridor has to be. A rule reads the row for the room's use and
 * compares. Changing what a project demands of a bedroom is editing one line of
 * a table, and every rule that cares follows automatically.
 *
 * **This group supersedes two of the built-in rules.** `ROOM-NO-DOOR` and
 * `ROOM-AREA-BELOW-MINIMUM` are the fuller versions of `ROOM-HAS-DOOR` and
 * `ROOM-MIN-AREA` in `registry.ts` — they read the same table and say more
 * about what they found. `registerFunctionRules` therefore switches the two
 * built-ins **off** as it registers, so a QC list never carries the same room
 * twice under two codes. The area minimums are imported from `registry.ts`
 * rather than restated, so the two tables cannot drift apart while both exist.
 *
 * The boundary with the geometry group is drawn on the same principle:
 * `DOOR-SWING-BLOCKED` there is a door whose leaf hits a wall, so it cannot
 * open at all; `DOOR-BLOCKS-PATH` here is a door that opens perfectly well and
 * leaves too little of the corridor to walk past. Different defect, different
 * fix, and a corridor already reported as too narrow is skipped here so that
 * one narrow corridor is one finding, not one plus a door.
 *
 * Every function is pure and reads only the graph it is handed. Severities are
 * all this layer returns about how bad something is — no colour, no token, no
 * opinion about how a screen should draw it.
 */

import { computeCentroid, computeLargestInnerRectangle } from '../../rooms/area';
import { openingsOfRoom as openingsOfRoomOfAnyKind } from '../../spatial/roomOpenings';
import type { BoundingBox, Opening, Point, Room, RoomUsage, Wall } from '../../spatial/types';
import { compareNearly, isNearlyZero, type PointMm } from '../../units/compare';
import { millimetres } from '../../units/types';
import { formatLength } from '../../../lib/format/measure';
import { formatNumber } from '../../../lib/format/number';
import {
  entitiesInScope,
  findEntity,
  MIN_ROOM_AREA_M2,
  ROOM_USAGE_LABELS,
  type Rule,
  type RuleContext,
  type RuleFinding,
  type RuleRegistry,
} from '../registry';

/* -------------------------------------------------------------------------- */
/* The table every rule reads.                                                 */
/* -------------------------------------------------------------------------- */

/** What one use demands of the space that carries it. */
export interface UsageRequirement {
  /** Smallest usable floor area, in square metres; `0` means no minimum. */
  readonly minAreaM2: number;
  /** Narrowest clear width the space may be, in mm; `0` means no minimum. */
  readonly minClearWidthMm: number;
  /** Must somebody be able to walk in through a door of its own? */
  readonly needsDoor: boolean;
  /** Is this a room people occupy, so it needs daylight and air? */
  readonly needsWindow: boolean;
  /** Does reaching this space count as having got out? */
  readonly isEscape: boolean;
}

/**
 * Every use, and what it requires.
 *
 * A complete record rather than a lookup with a fallback, so adding a use to
 * `RoomUsage` fails the build here instead of quietly requiring nothing of it.
 *
 * The area column is imported from `registry.ts` on purpose: the built-in
 * `ROOM-MIN-AREA` and the fuller rule below have to agree about what a bedroom
 * is, and the only way two tables agree forever is by being one table.
 *
 * A corridor needs no door of its own — it is what other rooms open onto — and
 * a stairwell is where people are trying to get to, so it is an escape rather
 * than a room needing one.
 */
export const USAGE_REQUIREMENTS: Readonly<Record<RoomUsage, UsageRequirement>> = {
  livingRoom: {
    minAreaM2: MIN_ROOM_AREA_M2.livingRoom,
    minClearWidthMm: 0,
    needsDoor: true,
    needsWindow: true,
    isEscape: false,
  },
  bedroom: {
    minAreaM2: MIN_ROOM_AREA_M2.bedroom,
    minClearWidthMm: 0,
    needsDoor: true,
    needsWindow: true,
    isEscape: false,
  },
  kitchen: {
    minAreaM2: MIN_ROOM_AREA_M2.kitchen,
    minClearWidthMm: 0,
    needsDoor: true,
    needsWindow: true,
    isEscape: false,
  },
  bathroom: {
    minAreaM2: MIN_ROOM_AREA_M2.bathroom,
    minClearWidthMm: 0,
    needsDoor: true,
    needsWindow: false,
    isEscape: false,
  },
  corridor: {
    minAreaM2: MIN_ROOM_AREA_M2.corridor,
    minClearWidthMm: 900,
    needsDoor: false,
    needsWindow: false,
    isEscape: false,
  },
  stairwell: {
    minAreaM2: MIN_ROOM_AREA_M2.stairwell,
    minClearWidthMm: 900,
    needsDoor: false,
    needsWindow: false,
    isEscape: true,
  },
  utility: {
    minAreaM2: MIN_ROOM_AREA_M2.utility,
    minClearWidthMm: 0,
    needsDoor: true,
    needsWindow: false,
    isEscape: false,
  },
  other: {
    minAreaM2: MIN_ROOM_AREA_M2.other,
    minClearWidthMm: 0,
    needsDoor: false,
    needsWindow: false,
    isEscape: false,
  },
};

/**
 * Furthest anybody may have to walk to reach a way out.
 *
 * Thirty metres, measured through the doors rather than through the walls,
 * which is the distance a person actually covers.
 */
export const MAX_ESCAPE_DISTANCE_MM = 30000;

/** Clear width that has to remain past an open door leaf for someone to pass. */
export const MIN_CLEAR_PASSAGE_MM = 750;

/** Overlap below this is two objects touching, not two objects clashing. */
export const MIN_CLASH_MM = 10;

/* -------------------------------------------------------------------------- */
/* What a rule in this group reports.                                          */
/* -------------------------------------------------------------------------- */

/** A finding that names every entity involved, the subject first. */
export interface FunctionFinding extends RuleFinding {
  readonly relatedIds: readonly string[];
}

/** One rule's worth of work: pure, read-only, same graph in, same findings out. */
export type FunctionCheck = (context: RuleContext) => readonly FunctionFinding[];

function finding(
  entityId: string,
  relatedIds: readonly string[],
  message: string,
  suggestion: string,
): FunctionFinding {
  return { entityId, relatedIds, message, suggestion };
}

/* -------------------------------------------------------------------------- */
/* Sentences.                                                                  */
/* -------------------------------------------------------------------------- */

/** A length, rounded to the millimetre: `1.500 mm`. */
function lengthText(valueMm: number): string {
  return formatLength(Math.round(valueMm), { unit: 'mm' });
}

/** An area with two decimals and a comma: `8,50 m²`. */
function areaText(valueM2: number): string {
  return `${formatNumber(valueM2, { fractionDigits: 2 })} m²`;
}

/** A length read in metres, as an escape distance is quoted: `31,4 m`. */
function metreText(valueMm: number): string {
  return `${formatNumber(valueMm / 1000, { fractionDigits: 1 })} m`;
}

function countText(value: number): string {
  return formatNumber(value, { fractionDigits: 0 });
}

/** "phòng ngủ P-3 (Ngủ 1)", for the start of a sentence. */
function roomText(room: Room): string {
  return `${ROOM_USAGE_LABELS[room.usage]} ${room.id} (${room.name})`;
}

/* -------------------------------------------------------------------------- */
/* Plan geometry.                                                              */
/* -------------------------------------------------------------------------- */

interface Line {
  readonly start: Point;
  readonly end: Point;
}

function itemAt<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];

  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} falls outside a list of ${String(items.length)}.`);
  }

  return item;
}

function lengthOf(line: Line): number {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

/** The point a given distance along a run, measured from its start. */
function pointAlong(line: Line, distanceMm: number): Point {
  const length = lengthOf(line);

  if (isNearlyZero(length)) {
    return line.start;
  }

  return {
    x: line.start.x + ((line.end.x - line.start.x) / length) * distanceMm,
    y: line.start.y + ((line.end.y - line.start.y) / length) * distanceMm,
  };
}

function distanceBetween(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Distance from a point to the nearest place on a run, ends included. */
function distanceToLine(point: Point, line: Line): number {
  const runX = line.end.x - line.start.x;
  const runY = line.end.y - line.start.y;
  const lengthSquared = runX * runX + runY * runY;

  if (isNearlyZero(lengthSquared)) {
    return distanceBetween(point, line.start);
  }

  const raw = ((point.x - line.start.x) * runX + (point.y - line.start.y) * runY) / lengthSquared;
  const along = Math.min(1, Math.max(0, raw));

  return Math.hypot(point.x - (line.start.x + along * runX), point.y - (line.start.y + along * runY));
}

/**
 * Does this run pass through the box?
 *
 * The segment is clipped against the four sides in turn; anything surviving is
 * inside. A run that lies entirely within the box survives untouched, which is
 * the case a corner test alone would miss.
 */
function lineEntersBox(line: Line, box: BoundingBox): boolean {
  const runX = line.end.x - line.start.x;
  const runY = line.end.y - line.start.y;
  let entry = 0;
  let exit = 1;

  const clip = (edge: number, room: number): boolean => {
    if (isNearlyZero(edge)) {
      return room >= 0;
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

  return (
    clip(-runX, line.start.x - box.min.x) &&
    clip(runX, box.max.x - line.start.x) &&
    clip(-runY, line.start.y - box.min.y) &&
    clip(runY, box.max.y - line.start.y) &&
    entry <= exit
  );
}

function boxCorners(box: BoundingBox): Point[] {
  return [
    { x: box.min.x, y: box.min.y },
    { x: box.max.x, y: box.min.y },
    { x: box.max.x, y: box.max.y },
    { x: box.min.x, y: box.max.y },
  ];
}

/** Closest approach between a run and a box; zero when the run enters it. */
function distanceLineToBox(line: Line, box: BoundingBox): number {
  if (lineEntersBox(line, box)) {
    return 0;
  }

  const corners = boxCorners(box);
  let smallest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < corners.length; index += 1) {
    const edge: Line = { start: itemAt(corners, index), end: itemAt(corners, (index + 1) % corners.length) };

    smallest = Math.min(
      smallest,
      distanceToLine(line.start, edge),
      distanceToLine(line.end, edge),
      distanceToLine(edge.start, line),
      distanceToLine(edge.end, line),
    );
  }

  return smallest;
}

/** How deep two boxes share ground; `0` or less when they are clear. */
function boxOverlapMm(first: BoundingBox, second: BoundingBox): number {
  const acrossX = Math.min(first.max.x, second.max.x) - Math.max(first.min.x, second.min.x);
  const acrossY = Math.min(first.max.y, second.max.y) - Math.max(first.min.y, second.min.y);

  return Math.min(acrossX, acrossY);
}

function toPointsMm(outline: readonly Point[]): PointMm[] {
  return outline.map((corner) => ({ x: millimetres(corner.x), y: millimetres(corner.y) }));
}

/**
 * The narrowest the space gets, taken from the largest box that fits inside it.
 *
 * `null` when the outline encloses nothing. This is the width a person walks
 * through, not the bounding-box width: an L-shaped corridor measured corner to
 * corner would read as generous while being 700 mm wide all the way along.
 */
function clearWidthMm(room: Room): number | null {
  if (room.outline.length < 3) {
    return null;
  }

  const box = computeLargestInnerRectangle(toPointsMm(room.outline));

  return box === null ? null : Math.min(box.widthMm, box.heightMm);
}

function centreOf(room: Room): Point {
  const centroid = computeCentroid(toPointsMm(room.outline));

  return { x: centroid.x, y: centroid.y };
}

/* -------------------------------------------------------------------------- */
/* Reading the plan.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * How far an opening may sit from a room's outline and still be that room's.
 *
 * Naming a wall in `wallIds` is not enough to own a hole in it: a corridor and
 * six rooms can all be bounded by the same long wall, and a door at one end of
 * it belongs to exactly one of them. Every rule below therefore asks where the
 * opening actually is, and a quarter of a metre covers the thickest wall's half
 * section with slack for a traced outline that missed the tim by a little.
 */
const OPENING_ON_OUTLINE_TOLERANCE_MM = 250;

/** Distance from a point to the nearest edge of a closed outline. */
function distanceToOutline(point: Point, outline: readonly Point[]): number {
  if (outline.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (outline.length === 1) {
    return distanceBetween(point, itemAt(outline, 0));
  }

  let smallest = Number.POSITIVE_INFINITY;

  for (let index = 0; index < outline.length; index += 1) {
    smallest = Math.min(
      smallest,
      distanceToLine(point, {
        start: itemAt(outline, index),
        end: itemAt(outline, (index + 1) % outline.length),
      }),
    );
  }

  return smallest;
}

/** Where the middle of an opening sits on the plan. */
function openingCentre(wall: Wall, opening: Opening): Point {
  return pointAlong(wall.centreline, opening.offsetMm + opening.widthMm / 2);
}

/** Is this opening on the stretch of wall that bounds this room? */
function opensOnto(at: Point, room: Room): boolean {
  return compareNearly(distanceToOutline(at, room.outline), OPENING_ON_OUTLINE_TOLERANCE_MM) <= 0;
}

/**
 * The openings of one kind cut into the stretch of wall that bounds a room.
 *
 * Resolving `room.wallIds` against `RuleContext` into plain arrays is this
 * function's only remaining job: the walk itself — and the "shared wall
 * counts for both rooms" behaviour that comes with it — lives in
 * `openingsOfRoom` of `src/domain/spatial/roomOpenings`, the one definition of
 * that behaviour. Do not re-implement the traversal here.
 */
function openingsOfRoom(context: RuleContext, room: Room, kind: Opening['kind']): Opening[] {
  const walls: Wall[] = [];
  const openingIds = new Set<string>();

  for (const wallId of room.wallIds) {
    const wall = findEntity(context, 'wall', wallId);

    if (wall === null) {
      continue;
    }

    walls.push(wall);

    for (const openingId of wall.openingIds) {
      openingIds.add(openingId);
    }
  }

  const openings: Opening[] = [];

  for (const openingId of openingIds) {
    const opening = findEntity(context, 'opening', openingId);

    if (opening !== null) {
      openings.push(opening);
    }
  }

  return openingsOfRoomOfAnyKind(room, walls, openings).filter((opening) => opening.kind === kind);
}

/** How much leaf has to swing: half the width for a double door. */
function leafWidthMm(opening: Opening): number {
  return opening.swing === 'double' ? opening.widthMm / 2 : opening.widthMm;
}

/** Does this door have a leaf that swings at all? */
function hasSwingingLeaf(opening: Opening): boolean {
  return opening.kind === 'door' && opening.swing !== 'sliding' && opening.swing !== 'fixed';
}

/** Which rooms name each wall as part of their boundary. */
function roomsByWall(rooms: readonly Room[]): Map<string, Room[]> {
  const index = new Map<string, Room[]>();

  for (const room of rooms) {
    for (const wallId of room.wallIds) {
      const bucket = index.get(wallId);

      if (bucket === undefined) {
        index.set(wallId, [room]);
      } else {
        bucket.push(room);
      }
    }
  }

  return index;
}

/* -------------------------------------------------------------------------- */
/* 1 — ROOM-NO-DOOR.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A room nobody can walk into.
 *
 * Which uses need a door of their own is the table's business, not this
 * function's: a corridor is a space other rooms open onto and can perfectly
 * well have no door of its own, while a bedroom without one is not a bedroom.
 *
 * This is the fuller form of the built-in `ROOM-HAS-DOOR`, which
 * `registerFunctionRules` switches off, so the room is reported once.
 */
export const checkRoomHasDoor: FunctionCheck = (context) => {
  const findings: FunctionFinding[] = [];

  for (const room of entitiesInScope(context, 'room')) {
    if (!USAGE_REQUIREMENTS[room.usage].needsDoor) {
      continue;
    }

    if (openingsOfRoom(context, room, 'door').length > 0) {
      continue;
    }

    findings.push(
      finding(
        room.id,
        [room.id, ...room.wallIds],
        `${roomText(room)} không có cửa đi nào trên ${countText(room.wallIds.length)} tường bao ` +
          'của nó, nên không vào được.',
        'Thêm một cửa đi vào một tường bao, hoặc gộp phòng này với không gian bên cạnh.',
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 2 — CORRIDOR-WIDTH.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A route too narrow to walk along.
 *
 * Only the uses the table gives a `minClearWidthMm` are measured, which today
 * is the corridor and the stairwell — the two spaces whose whole purpose is
 * being walked through.
 */
export const checkCorridorWidth: FunctionCheck = (context) => {
  const findings: FunctionFinding[] = [];

  for (const room of entitiesInScope(context, 'room')) {
    const requiredMm = USAGE_REQUIREMENTS[room.usage].minClearWidthMm;

    if (requiredMm <= 0) {
      continue;
    }

    const widthMm = clearWidthMm(room);

    if (widthMm === null || compareNearly(widthMm, requiredMm) >= 0) {
      continue;
    }

    findings.push(
      finding(
        room.id,
        [room.id, ...room.wallIds],
        `${roomText(room)} chỉ rộng ${lengthText(widthMm)} chỗ hẹp nhất, dưới mức ` +
          `${lengthText(requiredMm)} của lối đi.`,
        `Nới lối đi thêm ${lengthText(requiredMm - widthMm)}, hoặc dời tường bao ra để đạt ` +
          `${lengthText(requiredMm)} thông thuỷ.`,
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 3 — ROOM-NO-WINDOW.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A room people occupy with no daylight.
 *
 * A bathroom is not on the list and a store room is not either; what counts as
 * a room people occupy is a line in the table, so a project that ventilates its
 * bathrooms naturally changes one boolean rather than this function.
 */
export const checkHabitableWindow: FunctionCheck = (context) => {
  const findings: FunctionFinding[] = [];

  for (const room of entitiesInScope(context, 'room')) {
    if (!USAGE_REQUIREMENTS[room.usage].needsWindow) {
      continue;
    }

    if (openingsOfRoom(context, room, 'window').length > 0) {
      continue;
    }

    findings.push(
      finding(
        room.id,
        [room.id, ...room.wallIds],
        `${roomText(room)} rộng ${areaText(room.areaM2)} nhưng không có cửa sổ nào, nên không ` +
          'có ánh sáng và thông gió tự nhiên.',
        'Mở một cửa sổ trên tường bao ngoài, hoặc đổi công năng phòng sang loại không cần chiếu sáng.',
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 4 — ESCAPE-DISTANCE.                                                        */
/* -------------------------------------------------------------------------- */

/** One door, and the rooms it joins. */
interface DoorLink {
  readonly openingId: string;
  readonly at: Point;
  readonly roomIds: readonly string[];
  /** Cut into an envelope wall, so it leads straight out of the building. */
  readonly leadsOutside: boolean;
}

/** A room part-way through the search for the nearest way out. */
interface EscapeNode {
  readonly room: Room;
  readonly centre: Point;
  distanceMm: number;
  anchorId: string | null;
  settled: boolean;
}

function buildDoorLinks(context: RuleContext, rooms: readonly Room[]): DoorLink[] {
  const byWall = roomsByWall(rooms);
  const links: DoorLink[] = [];

  for (const opening of entitiesInScope(context, 'opening')) {
    if (opening.kind !== 'door') {
      continue;
    }

    const wall = findEntity(context, 'wall', opening.wallId);

    if (wall === null) {
      continue;
    }

    const at = openingCentre(wall, opening);

    links.push({
      openingId: opening.id,
      at,
      // Only the rooms this door is actually cut into; naming the wall is not
      // enough, or one long party wall would join every room along it.
      roomIds: (byWall.get(wall.id) ?? [])
        .filter((room) => opensOnto(at, room))
        .map((room) => room.id),
      leadsOutside: wall.kind === 'envelope',
    });
  }

  return links;
}

/**
 * How far every room is from a way out.
 *
 * A shortest-path search over the door graph: rooms are nodes, a door joining
 * two rooms is an edge, and the length of a hop is centre → door → centre. That
 * is the distance a person covers, and it is the reason the search is not a
 * straight line from the room to the exit — a straight line goes through walls.
 *
 * Two things count as having got out: a door in an envelope wall, and reaching
 * a space the table marks as an escape, which is the protected stair. Both seed
 * the search, so the answer is the distance to the **nearest** of them.
 *
 * Ties are broken by room code rather than by whichever room the loop met
 * first, so the same plan always gives the same answer.
 */
function measureEscapeDistances(
  context: RuleContext,
  rooms: readonly Room[],
): Map<string, EscapeNode> {
  const nodes = new Map<string, EscapeNode>();

  for (const room of rooms) {
    nodes.set(room.id, {
      room,
      centre: centreOf(room),
      distanceMm: Number.POSITIVE_INFINITY,
      anchorId: null,
      settled: false,
    });
  }

  const links = buildDoorLinks(context, rooms);
  const linksByRoom = new Map<string, DoorLink[]>();

  for (const link of links) {
    for (const roomId of link.roomIds) {
      const bucket = linksByRoom.get(roomId);

      if (bucket === undefined) {
        linksByRoom.set(roomId, [link]);
      } else {
        bucket.push(link);
      }
    }
  }

  const relax = (node: EscapeNode, distanceMm: number, anchorId: string | null): void => {
    if (distanceMm < node.distanceMm) {
      node.distanceMm = distanceMm;
      node.anchorId = anchorId;
    }
  };

  for (const node of nodes.values()) {
    if (USAGE_REQUIREMENTS[node.room.usage].isEscape) {
      relax(node, 0, node.room.id);
    }
  }

  for (const link of links) {
    if (!link.leadsOutside) {
      continue;
    }

    for (const roomId of link.roomIds) {
      const node = nodes.get(roomId);

      if (node !== undefined) {
        relax(node, distanceBetween(node.centre, link.at), link.openingId);
      }
    }
  }

  for (let step = 0; step < nodes.size; step += 1) {
    let current: EscapeNode | null = null;

    for (const node of nodes.values()) {
      if (node.settled || !Number.isFinite(node.distanceMm)) {
        continue;
      }

      if (
        current === null ||
        node.distanceMm < current.distanceMm ||
        (node.distanceMm === current.distanceMm && node.room.id < current.room.id)
      ) {
        current = node;
      }
    }

    if (current === null) {
      break;
    }

    current.settled = true;

    for (const link of linksByRoom.get(current.room.id) ?? []) {
      const toDoorMm = distanceBetween(current.centre, link.at);

      for (const roomId of link.roomIds) {
        const neighbour = nodes.get(roomId);

        if (neighbour === undefined || neighbour === current || neighbour.settled) {
          continue;
        }

        relax(
          neighbour,
          current.distanceMm + toDoorMm + distanceBetween(link.at, neighbour.centre),
          current.anchorId,
        );
      }
    }
  }

  return nodes;
}

/**
 * A room too far from the way out, or with no way out at all.
 *
 * A room the table says needs a door but has none is left alone: that is
 * `ROOM-NO-DOOR`'s finding, and saying it twice in two vocabularies would send
 * a person to the same room for the same reason.
 */
export const checkEscapeDistance: FunctionCheck = (context) => {
  const rooms = entitiesInScope(context, 'room');
  const nodes = measureEscapeDistances(context, rooms);
  const findings: FunctionFinding[] = [];

  for (const room of rooms) {
    const requirement = USAGE_REQUIREMENTS[room.usage];

    if (requirement.isEscape) {
      continue;
    }

    const node = nodes.get(room.id);

    if (node === undefined) {
      continue;
    }

    if (requirement.needsDoor && openingsOfRoom(context, room, 'door').length === 0) {
      continue;
    }

    if (!Number.isFinite(node.distanceMm)) {
      findings.push(
        finding(
          room.id,
          [room.id],
          `${roomText(room)} không có đường nào dẫn ra lối thoát: không cửa nào của nó nối tới ` +
            'thang bộ hay cửa ra ngoài.',
          'Nối phòng này vào hành lang thoát nạn, hoặc mở một cửa ra tường bao ngoài.',
        ),
      );

      continue;
    }

    if (compareNearly(node.distanceMm, MAX_ESCAPE_DISTANCE_MM) <= 0) {
      continue;
    }

    findings.push(
      finding(
        room.id,
        node.anchorId === null ? [room.id] : [room.id, node.anchorId],
        `${roomText(room)} cách lối thoát gần nhất ${metreText(node.distanceMm)} đi qua các cửa, ` +
          `vượt ngưỡng ${metreText(MAX_ESCAPE_DISTANCE_MM)}.`,
        `Thêm một lối thoát trong bán kính ${metreText(MAX_ESCAPE_DISTANCE_MM)}, hoặc mở thêm ` +
          'cửa để rút ngắn đường đi.',
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 5 — DOOR-BLOCKS-PATH.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A door that opens across the way past it.
 *
 * A leaf swinging into a corridor eats the corridor for as long as it is open,
 * and what is left has to be enough for somebody to get by. The rule is
 * therefore about the space, not about the door hitting anything: a door with
 * all the room in the world to swing still fails this if it swings into the one
 * route out.
 *
 * A corridor already reported by `CORRIDOR-WIDTH` is skipped. It is one narrow
 * corridor, and the fix is the corridor — listing its doors as well would turn
 * one defect into four.
 */
export const checkDoorBlocksPath: FunctionCheck = (context) => {
  const findings: FunctionFinding[] = [];

  for (const room of entitiesInScope(context, 'room')) {
    const requiredMm = USAGE_REQUIREMENTS[room.usage].minClearWidthMm;

    if (requiredMm <= 0) {
      continue;
    }

    const widthMm = clearWidthMm(room);

    if (widthMm === null || compareNearly(widthMm, requiredMm) < 0) {
      continue;
    }

    for (const opening of openingsOfRoom(context, room, 'door')) {
      if (!hasSwingingLeaf(opening)) {
        continue;
      }

      const leafMm = leafWidthMm(opening);
      const leftMm = widthMm - leafMm;

      if (compareNearly(leftMm, MIN_CLEAR_PASSAGE_MM) >= 0) {
        continue;
      }

      findings.push(
        finding(
          opening.id,
          [opening.id, opening.wallId, room.id],
          `Cửa đi ${opening.id} mở vào ${roomText(room)} rộng ${lengthText(widthMm)}: cánh ` +
            `${lengthText(leafMm)} chỉ chừa lại ${lengthText(Math.max(0, leftMm))}, dưới mức ` +
            `${lengthText(MIN_CLEAR_PASSAGE_MM)} để đi lọt.`,
          `Đổi sang cửa trượt hoặc cửa mở ngược ra khỏi lối đi, hoặc thu hẹp cánh xuống ` +
            `${lengthText(Math.max(0, widthMm - MIN_CLEAR_PASSAGE_MM))}.`,
        ),
      );
    }
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 6 — ROOM-AREA-BELOW-MINIMUM.                                                */
/* -------------------------------------------------------------------------- */

/**
 * A room too small for what it is called.
 *
 * The minimum comes from the table and nowhere else, and a use with a minimum
 * of zero — a store, a space still called "khác" — is not measured at all
 * rather than measured against nothing.
 *
 * This is the fuller form of the built-in `ROOM-MIN-AREA`, which
 * `registerFunctionRules` switches off; both read the same numbers.
 */
export const checkRoomArea: FunctionCheck = (context) => {
  const findings: FunctionFinding[] = [];

  for (const room of entitiesInScope(context, 'room')) {
    const requiredM2 = USAGE_REQUIREMENTS[room.usage].minAreaM2;

    if (requiredM2 <= 0 || compareNearly(room.areaM2, requiredM2) >= 0) {
      continue;
    }

    findings.push(
      finding(
        room.id,
        [room.id],
        `${roomText(room)} rộng ${areaText(room.areaM2)}, thiếu ` +
          `${areaText(requiredM2 - room.areaM2)} so với mức tối thiểu ${areaText(requiredM2)} ` +
          `của ${ROOM_USAGE_LABELS[room.usage]}.`,
        `Mở rộng phòng lên ${areaText(requiredM2)}, hoặc đổi công năng sang loại phù hợp với ` +
          `${areaText(room.areaM2)}.`,
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 7 — FURNITURE-CLASH.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Furniture standing where something else already is.
 *
 * Two clashes, one finding: a piece inside a wall, and two pieces inside each
 * other. They are reported together because they are one question to whoever is
 * reading — can this be placed here — and one trip to fix.
 *
 * A pair is reported against the piece the model lists first, so moving one of
 * them settles a single entry rather than two that disagree.
 *
 * The footprint is the stored bounding box. It is axis-aligned, so a rotated
 * item is judged by the box around it: generous on a diagonal wardrobe, which
 * is the safe direction to be wrong in — a clash that turns out to be clear is
 * a glance, a clash that goes unreported is a site instruction.
 */
export const checkFurnitureClash: FunctionCheck = (context) => {
  const items = entitiesInScope(context, 'furniture');
  const walls = entitiesInScope(context, 'wall');
  const findings: FunctionFinding[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = itemAt(items, index);
    const wallIds: string[] = [];
    const otherIds: string[] = [];
    let worstMm = 0;

    for (const wall of walls) {
      if (isNearlyZero(lengthOf(wall.centreline))) {
        continue;
      }

      const reachMm = wall.thicknessMm / 2;
      const overlapMm = reachMm - distanceLineToBox(wall.centreline, item.boundingBox);

      if (compareNearly(overlapMm, MIN_CLASH_MM) <= 0) {
        continue;
      }

      wallIds.push(wall.id);
      worstMm = Math.max(worstMm, overlapMm);
    }

    for (let other = index + 1; other < items.length; other += 1) {
      const secondItem = itemAt(items, other);
      const overlapMm = boxOverlapMm(item.boundingBox, secondItem.boundingBox);

      if (compareNearly(overlapMm, MIN_CLASH_MM) <= 0) {
        continue;
      }

      otherIds.push(secondItem.id);
      worstMm = Math.max(worstMm, overlapMm);
    }

    if (wallIds.length === 0 && otherIds.length === 0) {
      continue;
    }

    const parts: string[] = [];

    if (wallIds.length > 0) {
      parts.push(`tường ${wallIds.join(', ')}`);
    }

    if (otherIds.length > 0) {
      parts.push(`đồ đạc ${otherIds.join(', ')}`);
    }

    findings.push(
      finding(
        item.id,
        [item.id, ...wallIds, ...otherIds],
        `Đồ đạc ${item.id} chồng lên ${parts.join(' và ')}, chỗ lấn sâu nhất ${lengthText(worstMm)}.`,
        `Dời đồ đạc ${item.id} ra ${lengthText(worstMm)}, hoặc thu nhỏ kích thước cho vừa chỗ trống.`,
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* The rules.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Severities, and why each one.
 *
 * A room nobody can enter, a route nobody can walk and a distance nobody can
 * escape over are `critical`: the building fails at what it is for. Daylight,
 * a swing across a passage and a room a little under size are `warning` — real,
 * arguable, and a person may sign them off. Furniture is a `suggestion`,
 * because it is the layer the model is least sure about and the one that costs
 * nothing to move.
 */
export const roomHasDoorRule: Rule = {
  code: 'ROOM-NO-DOOR',
  name: 'phòng nào cũng có lối vào',
  group: 'circulation',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['room', 'wall', 'opening'],
  check: checkRoomHasDoor,
};

export const corridorWidthRule: Rule = {
  code: 'CORRIDOR-WIDTH',
  name: 'lối đi đủ rộng để thoát nạn',
  group: 'circulation',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['room'],
  check: checkCorridorWidth,
};

export const habitableWindowRule: Rule = {
  code: 'ROOM-NO-WINDOW',
  name: 'phòng ở có cửa sổ',
  group: 'circulation',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['room', 'wall', 'opening'],
  check: checkHabitableWindow,
};

export const escapeDistanceRule: Rule = {
  code: 'ESCAPE-DISTANCE',
  name: 'đường thoát nạn trong ngưỡng cho phép',
  group: 'circulation',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['room', 'wall', 'opening'],
  check: checkEscapeDistance,
};

export const doorBlocksPathRule: Rule = {
  code: 'DOOR-BLOCKS-PATH',
  name: 'cửa mở không chặn lối đi',
  group: 'circulation',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['room', 'wall', 'opening'],
  check: checkDoorBlocksPath,
};

export const roomAreaRule: Rule = {
  code: 'ROOM-AREA-BELOW-MINIMUM',
  name: 'phòng đủ diện tích cho công năng',
  group: 'area',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['room'],
  check: checkRoomArea,
};

export const furnitureClashRule: Rule = {
  code: 'FURNITURE-CLASH',
  name: 'đồ đạc không chồng lên tường hay lên nhau',
  group: 'geometry',
  severity: 'suggestion',
  scope: 'level',
  dependsOn: ['furniture', 'wall'],
  check: checkFurnitureClash,
};

/** The seven, in the order a report reads them: getting in, getting about, getting out. */
export const FUNCTION_RULES: readonly Rule[] = [
  roomHasDoorRule,
  corridorWidthRule,
  habitableWindowRule,
  escapeDistanceRule,
  doorBlocksPathRule,
  roomAreaRule,
  furnitureClashRule,
];

/** Built-in rules this group replaces, and switches off as it registers. */
export const SUPERSEDED_BUILT_IN_CODES: readonly string[] = ['ROOM-HAS-DOOR', 'ROOM-MIN-AREA'];

/**
 * Put the seven in a rule book, and stand down the two they replace.
 *
 * Switching the built-ins off rather than deleting them keeps the decision
 * visible and reversible: the codes are still in the book, still listed, and a
 * project that prefers the simpler pair can switch them back on and this group
 * off. What must not happen is both being on at once, which is the only reason
 * this function does more than register.
 *
 * Registering the same rules twice is a no-op; a different rule claiming one of
 * these codes still throws.
 *
 * The registry is a required argument: the shared book comes assembled from
 * `rules/defaults`, and this function is for a caller building a narrower one.
 */
export function registerFunctionRules(registry: RuleRegistry): void {
  for (const rule of FUNCTION_RULES) {
    if (registry.get(rule.code) === rule) {
      continue;
    }

    registry.register(rule);
  }

  for (const code of SUPERSEDED_BUILT_IN_CODES) {
    if (registry.get(code) !== null) {
      registry.setEnabled(code, false);
    }
  }
}

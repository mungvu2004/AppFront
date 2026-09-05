/**
 * The third group of rules: whether what is *in* the rooms makes sense.
 *
 * The geometry group asks whether the model can exist and the function group
 * whether a person can live in it. This one asks a narrower question that a
 * reviewer asks constantly and no other rule covers: is this the right thing, in
 * the right place, in the right wall.
 *
 * Three defects, and all three come from a model reading a scanned drawing
 * rather than from a person drawing badly:
 *
 * - A **bed in a bathroom** is almost never a bed. It is a bath the classifier
 *   read as a bed, or a room whose use was labelled from the wrong text. Either
 *   way the pair is wrong, and which half is wrong is exactly the judgement a
 *   person has to make — so the rule reports the pair and refuses to guess.
 * - A **basin standing in the middle of the floor** is a fixture whose position
 *   was traced from a symbol rather than from the plumbing. Sanitary fittings and
 *   kitchen units go against a wall; one that does not is either misplaced or in
 *   a room it does not belong to.
 * - A **window in an internal wall** looks into a corridor. Sometimes that is an
 *   internal screen, drawn as glazing; far more often the wall was classified as
 *   a partition when it is the envelope, and every room behind it has just lost
 *   its daylight.
 *
 * **What each use refuses lives in `MISPLACED_FURNITURE`.** No function below
 * contains a room name or a furniture kind: they read the table and compare, the
 * way `USAGE_REQUIREMENTS` works one group over. Adding a use to `RoomUsage`
 * fails the build here rather than quietly allowing everything into it.
 *
 * These three replace `runSpatialRules`, a prototype that lived outside the
 * domain, ran on the pre-domain model, was imported by nothing, and knew only two
 * hard-coded room names. It has been deleted. Room use and furniture kind are
 * enumerations here, so the checks are total instead of a pair of special cases.
 *
 * Every function is pure and reads only the graph it is handed.
 */

import { outlineContains } from '../../rooms/area';
import type { BoundingBox, FurnitureKind, Point, Room, RoomUsage } from '../../spatial/types';
import { compareNearly, isNearlyZero, type PointMm } from '../../units/compare';
import { millimetres } from '../../units/types';
import { formatLength } from '../../../lib/format/measure';
import {
  entitiesInScope,
  findEntity,
  ROOM_USAGE_LABELS,
  type Rule,
  type RuleContext,
  type RuleFinding,
  type RuleRegistry,
} from '../registry';

/* -------------------------------------------------------------------------- */
/* The tables every rule reads.                                                */
/* -------------------------------------------------------------------------- */

/**
 * What has no business being in a room of each use.
 *
 * Read as "a room of this use should not contain any of these". The lists are
 * deliberately about things that contradict the use rather than things that are
 * merely unusual: a chair in a bathroom is odd, a bed in one means the drawing
 * was misread. Flagging the merely unusual is how a QC list gets ignored.
 *
 * `other` refuses nothing on purpose. It is the bucket for a space the model
 * could not classify, and a rule that fires on an unclassified room is firing on
 * the fact that it is unclassified, which `ROOM-UNNAMED` already says.
 */
export const MISPLACED_FURNITURE: Readonly<Record<RoomUsage, readonly FurnitureKind[]>> = {
  livingRoom: ['sanitaryFixture'],
  bedroom: ['sanitaryFixture', 'kitchenCabinet'],
  kitchen: ['bed', 'sanitaryFixture'],
  bathroom: ['bed', 'wardrobe', 'kitchenCabinet'],
  corridor: ['bed', 'wardrobe', 'kitchenCabinet', 'sanitaryFixture'],
  stairwell: ['bed', 'wardrobe', 'kitchenCabinet', 'sanitaryFixture', 'table'],
  utility: ['bed'],
  other: [],
};

/**
 * Furniture that has to stand against a wall, because it is plumbed to one.
 *
 * A basin, a WC and a run of kitchen units all need a soil stack or a supply
 * behind them. A bed does not, a table does not, and requiring them to touch a
 * wall would flag half of every open-plan drawing.
 */
export const WALL_HUGGING_FURNITURE: readonly FurnitureKind[] = ['sanitaryFixture', 'kitchenCabinet'];

/**
 * How far from a wall face such a fitting may stand and still count as against it.
 *
 * Fifty millimetres is a tiled skirting plus the slack a traced symbol carries.
 * Wider and the tolerance starts accepting a basin that is genuinely stranded;
 * tighter and it fires on every drawing whose symbols were placed by eye.
 */
export const WALL_HUGGING_TOLERANCE_MM = 50;

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** A finding that names every entity involved, the subject first. */
export interface FitoutFinding extends RuleFinding {
  readonly relatedIds: readonly string[];
}

/** One rule's worth of work: pure, read-only, same graph in, same findings out. */
export type FitoutCheck = (context: RuleContext) => readonly FitoutFinding[];

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** Vietnamese names for the furniture kinds these rules talk about. */
const FURNITURE_KIND_LABELS: Readonly<Record<FurnitureKind, string>> = {
  table: 'Bàn',
  chair: 'Ghế',
  bed: 'Giường',
  wardrobe: 'Tủ quần áo',
  kitchenCabinet: 'Tủ bếp',
  sanitaryFixture: 'Thiết bị vệ sinh',
  stair: 'Cầu thang',
  other: 'Đồ đạc',
};

function finding(
  entityId: string,
  relatedIds: readonly string[],
  message: string,
  suggestion: string,
): FitoutFinding {
  return { entityId, relatedIds, message, suggestion };
}

/** A length, rounded to the millimetre: `1.500 mm`. */
function lengthText(valueMm: number): string {
  return formatLength(Math.round(valueMm), { unit: 'mm' });
}

/** "phòng ngủ P-3 (Ngủ 1)", for the middle of a sentence. */
function roomText(room: Room): string {
  return `${ROOM_USAGE_LABELS[room.usage]} ${room.id} (${room.name})`;
}

/** "Giường F-7", for the start of a sentence. */
function furnitureText(kind: FurnitureKind, id: string): string {
  return `${FURNITURE_KIND_LABELS[kind]} ${id}`;
}

/**
 * The room outline as points the area module will take.
 *
 * The spatial graph stores plain numbers and the measuring code takes labelled
 * ones; this is the one place the two meet, and it is a re-tag rather than a
 * conversion — both are millimetres.
 */
function toPointsMm(outline: readonly Point[]): PointMm[] {
  return outline.map((corner) => ({ x: millimetres(corner.x), y: millimetres(corner.y) }));
}

/** Distance from a point to a segment, zero when the foot lands on it. */
function distancePointToSegment(point: Point, start: Point, end: Point): number {
  const runX = end.x - start.x;
  const runY = end.y - start.y;
  const lengthSquared = runX * runX + runY * runY;

  if (isNearlyZero(lengthSquared)) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const along = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * runX + (point.y - start.y) * runY) / lengthSquared),
  );

  return Math.hypot(point.x - (start.x + along * runX), point.y - (start.y + along * runY));
}

/**
 * How far a footprint stands clear of a wall's face.
 *
 * Measured from the box's corners and its centre to the wall centreline, then
 * the wall's half thickness is taken off, because a fitting touches the *face* of
 * a wall and not its middle. A basin inside the wall body reads as zero rather
 * than as a negative gap: it is against the wall, which is all this asks.
 */
function gapToWallFace(box: BoundingBox, start: Point, end: Point, thicknessMm: number): number {
  const corners: readonly Point[] = [
    box.min,
    { x: box.max.x, y: box.min.y },
    box.max,
    { x: box.min.x, y: box.max.y },
    { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 },
  ];

  const nearest = corners.reduce(
    (closest, corner) => Math.min(closest, distancePointToSegment(corner, start, end)),
    Number.POSITIVE_INFINITY,
  );

  return Math.max(0, nearest - thicknessMm / 2);
}

/** The room whose outline holds this point, or `null` when it is in none. */
function roomAt(rooms: readonly Room[], point: Point): Room | null {
  const centre: PointMm = { x: millimetres(point.x), y: millimetres(point.y) };

  return (
    rooms.find((room) => room.outline.length >= 3 && outlineContains(toPointsMm(room.outline), centre)) ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* 1 — ROOM-FURNITURE-MISMATCH.                                                */
/* -------------------------------------------------------------------------- */

/**
 * Furniture that contradicts the use of the room it stands in.
 *
 * Which room a piece is in comes from its stored `roomId` when it has one, and
 * from its centre otherwise — a model that traced the furniture and the rooms
 * separately fills in neither reliably, and falling back to the geometry is what
 * makes the rule work on a freshly imported drawing.
 *
 * The finding names both halves and proposes both repairs, because the pair is
 * what is wrong and a reviewer is the only one who can say which half to change.
 * A piece standing in no room at all is not this rule's business: `roomAt`
 * returns nothing, and the piece is skipped.
 */
export const checkRoomFurnitureMismatch: FitoutCheck = (context) => {
  const rooms = entitiesInScope(context, 'room');
  const findings: FitoutFinding[] = [];

  for (const item of entitiesInScope(context, 'furniture')) {
    const room =
      (item.roomId === undefined ? null : findEntity(context, 'room', item.roomId)) ??
      roomAt(rooms, item.centre);

    if (room === null) {
      continue;
    }

    if (!MISPLACED_FURNITURE[room.usage].includes(item.kind)) {
      continue;
    }

    findings.push(
      finding(
        item.id,
        [item.id, room.id],
        `${furnitureText(item.kind, item.id)} nằm trong ${roomText(room)}, ` +
          `không phù hợp với công năng phòng.`,
        `Đổi công năng ${room.id} cho khớp với đồ đạc, hoặc sửa loại của ${item.id}, ` +
          `hoặc chuyển ${item.id} sang phòng khác.`,
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 2 — FIXTURE-OFF-WALL.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A plumbed fitting standing away from every wall.
 *
 * The gap is measured to the nearest wall **face** on the level, not to the
 * nearest wall of its own room, because a fitting served by a wall it does not
 * belong to is still served. Walls with no length are skipped: they have no face
 * to measure to, and `WALL-LENGTH` already reports them.
 *
 * The message carries the gap so a reviewer can tell a fitting that is 60 mm out
 * — a traced symbol, nudge it — from one that is two metres out, which is a
 * fitting in the wrong room.
 */
export const checkFixtureOffWall: FitoutCheck = (context) => {
  const walls = entitiesInScope(context, 'wall');
  const findings: FitoutFinding[] = [];

  for (const item of entitiesInScope(context, 'furniture')) {
    if (!WALL_HUGGING_FURNITURE.includes(item.kind)) {
      continue;
    }

    let nearestGapMm = Number.POSITIVE_INFINITY;
    let nearestWallId: string | null = null;

    for (const wall of walls) {
      const { start, end } = wall.centreline;

      if (isNearlyZero(Math.hypot(end.x - start.x, end.y - start.y))) {
        continue;
      }

      const gapMm = gapToWallFace(item.boundingBox, start, end, wall.thicknessMm);

      if (gapMm < nearestGapMm) {
        nearestGapMm = gapMm;
        nearestWallId = wall.id;
      }
    }

    if (nearestWallId === null) {
      continue;
    }

    if (compareNearly(nearestGapMm, WALL_HUGGING_TOLERANCE_MM) <= 0) {
      continue;
    }

    findings.push(
      finding(
        item.id,
        [item.id, nearestWallId],
        `${furnitureText(item.kind, item.id)} cách mặt tường gần nhất ${nearestWallId} ` +
          `${lengthText(nearestGapMm)}, vượt ngưỡng ${lengthText(WALL_HUGGING_TOLERANCE_MM)}.`,
        `Dời ${item.id} áp sát tường ${nearestWallId}, hoặc kiểm tra lại vị trí đã bóc ` +
          `từ ký hiệu trên bản vẽ.`,
      ),
    );
  }

  return findings;
};

/* -------------------------------------------------------------------------- */
/* 3 — WINDOW-ON-INNER-WALL.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A window cut into a wall that is not part of the envelope.
 *
 * A window earns its name by looking outside, so one in a partition is either an
 * internal screen that was drawn as glazing, or — far more likely — an envelope
 * wall the classifier called a partition. The second reading is the dangerous
 * one, which is why the suggestion offers it first: getting the wall kind wrong
 * silently removes daylight from every room behind it, and `ROOM-NO-WINDOW`
 * downstream will then blame the rooms.
 *
 * An opening whose wall is missing from the graph is skipped; `checkIntegrity`
 * reports the dangling reference in its own vocabulary already.
 */
export const checkWindowOnInnerWall: FitoutCheck = (context) => {
  const findings: FitoutFinding[] = [];

  for (const opening of entitiesInScope(context, 'opening')) {
    if (opening.kind !== 'window') {
      continue;
    }

    const wall = findEntity(context, 'wall', opening.wallId);

    if (wall === null || wall.kind === 'envelope') {
      continue;
    }

    findings.push(
      finding(
        opening.id,
        [opening.id, wall.id],
        `Cửa sổ ${opening.id} nằm trên tường ${wall.id}, không phải tường bao ngoài.`,
        `Đổi tường ${wall.id} thành tường bao ngoài nếu đã phân loại nhầm, ` +
          `hoặc đổi ${opening.id} thành cửa đi, hoặc xoá cửa sổ này.`,
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
 * A window on an inner wall is `critical`: it is a classification that is wrong
 * on its face and it poisons the daylight rules downstream. The other two are
 * `warning` — both describe a pair that cannot both be right, and a person may
 * look at the drawing and sign either off.
 */
export const roomFurnitureMismatchRule: Rule = {
  code: 'ROOM-FURNITURE-MISMATCH',
  name: 'đồ đạc hợp với công năng phòng',
  group: 'area',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['furniture', 'room'],
  check: checkRoomFurnitureMismatch,
};

export const fixtureOffWallRule: Rule = {
  code: 'FIXTURE-OFF-WALL',
  name: 'thiết bị vệ sinh và tủ bếp áp sát tường',
  group: 'geometry',
  severity: 'warning',
  scope: 'level',
  dependsOn: ['furniture', 'wall'],
  check: checkFixtureOffWall,
};

export const windowOnInnerWallRule: Rule = {
  code: 'WINDOW-ON-INNER-WALL',
  name: 'cửa sổ nằm trên tường bao ngoài',
  group: 'geometry',
  severity: 'critical',
  scope: 'level',
  dependsOn: ['opening', 'wall'],
  check: checkWindowOnInnerWall,
};

/** The three, in the order a report reads them: what, where, and in which wall. */
export const FITOUT_RULES: readonly Rule[] = [
  roomFurnitureMismatchRule,
  fixtureOffWallRule,
  windowOnInnerWallRule,
];

/**
 * Put the three in a rule book.
 *
 * Nothing is superseded and nothing is switched off: this group covers ground no
 * other rule covers, which is why it exists. Registering the same rules twice is
 * a no-op; a different rule claiming one of these codes still throws.
 *
 * The registry is a required argument: the shared book comes assembled from
 * `rules/defaults`, and this function is for a caller building a narrower one.
 */
export function registerFitoutRules(registry: RuleRegistry): void {
  for (const rule of FITOUT_RULES) {
    if (registry.get(rule.code) === rule) {
      continue;
    }

    registry.register(rule);
  }
}

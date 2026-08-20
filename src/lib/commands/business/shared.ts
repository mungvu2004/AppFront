/**
 * What the three business command groups all need.
 *
 * A business command is a **pure function of the drawing**: it reads the graph,
 * decides whether the edit is allowed, and returns either a `Command` carrying
 * full before/after snapshots or a refusal carrying Vietnamese sentences. It
 * never touches the store — `dispatch` does that, and only after re-validating.
 *
 * Three rules hold across every group.
 *
 * - **Nothing here computes geometry.** Splitting, welding, projecting an
 *   opening onto a wall, measuring an area: all of it belongs to `src/domain`
 *   and is called, never restated. What lives here is the business decision
 *   around that call — is the edit allowed, what does it touch, and what does
 *   the activity log say about it.
 * - **Every command is invertible by construction**, because every change is a
 *   full snapshot on both sides (see `../types`). A command that removes an
 *   entity carries the whole entity, so `invertCommand` puts it back.
 * - **Review metadata is preserved on an update and set on a creation.** A new
 *   entity is authored by a person and not yet approved — `reviewed: false` —
 *   because the verified green belongs to the review step, never to the act of
 *   drawing (invariant A5). Whether an edit should retract an existing approval
 *   is a QC policy question, not a command-layer one, so an update carries the
 *   metadata it found.
 *
 * The graph vocabulary and the geometry vocabulary do not fully agree — the
 * graph stores an opening as a millimetre offset while `domain/openings` stores
 * it as a fraction of its wall — so the converters below are the single place
 * the two are translated.
 */

import { describeOpeningKind, clampRelativePosition } from '@/domain/openings/types';
import type { AttachedOpening, RelativePosition } from '@/domain/openings/types';
import { readEntity } from '@/domain/spatial/applyPatch';
import type { EntityKind, IdByKind } from '@/domain/spatial/ids';
import { isEntityOfKind, type EntityByKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  FurnitureKind,
  Level,
  LevelId,
  Opening as GraphOpening,
  Point,
  Wall as GraphWall,
  WallId,
  WallKind,
} from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { millimetres, MILLIMETRES_PER_METRE } from '@/domain/units/types';
import { centrelineLength, type Wall as SolidWall, type WallKind as SolidWallKind } from '@/domain/walls/types';
import { formatNumber } from '@/lib/format/number';
import { err, ok, type Result } from '@/lib/http/types';

import { createCommand } from '../createCommand';
import type { Command, CommandId, CommandType, EntityChange } from '../types';

/* -------------------------------------------------------------------------- */
/* What a builder is given, and what it gives back.                            */
/* -------------------------------------------------------------------------- */

/** Everything a builder reads that is not part of the edit itself. */
export interface CommandContext {
  /** The drawing as it is now; snapshots are taken from here. */
  readonly graph: NormalizedSpatial;
  readonly actorId: string;
  /** Only for tests and replay; generated when left out. */
  readonly id?: CommandId;
  /** Only for tests and replay; the current time when left out. */
  readonly timestamp?: string;
}

/** Why an edit was refused, in the words the interface shows. */
export interface CommandRefusal {
  /** The command that was refused, for telemetry; English, never shown. */
  readonly type: CommandType;
  /** Vietnamese sentences, one per problem found. Never empty. */
  readonly reasons: readonly string[];
}

/** What every builder returns: a command to dispatch, or the reasons why not. */
export type CommandResult = Result<Command, CommandRefusal>;

/**
 * Wraps the changes in a command, carrying the test-only overrides through.
 *
 * The overrides are spread conditionally because `exactOptionalPropertyTypes`
 * makes an explicit `undefined` a different thing from an absent field.
 */
export const buildCommand = (
  type: CommandType,
  description: string,
  changes: readonly EntityChange[],
  context: CommandContext,
): Command =>
  createCommand({
    type,
    actorId: context.actorId,
    description,
    changes,
    ...(context.id === undefined ? {} : { id: context.id }),
    ...(context.timestamp === undefined ? {} : { timestamp: context.timestamp }),
  });

/** A refusal, always with at least one sentence in it. */
export const refuse = (type: CommandType, reasons: readonly string[]): CommandResult =>
  err({
    type,
    reasons: reasons.length > 0 ? reasons : ['Lệnh bị từ chối nhưng không nêu được lý do.'],
  });

/** A command that passed its own checks. */
export const accept = (command: Command): CommandResult => ok(command);

/* -------------------------------------------------------------------------- */
/* Provenance.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The review metadata a newly drawn entity starts with.
 *
 * Drawing is authoring, not approving: the entity comes from a person, so the
 * confidence is total and the source is `human`, but `reviewed` stays false
 * until somebody checks it. Invariant A5 reserves the verified green for that.
 */
export const AUTHORED_BY_HAND = {
  confidence: 1,
  source: 'human',
  reviewed: false,
} as const;

/* -------------------------------------------------------------------------- */
/* Reading the graph.                                                          */
/* -------------------------------------------------------------------------- */

/** Every entity of one kind, in graph order. */
export const entitiesOfKind = <K extends EntityKind>(
  graph: NormalizedSpatial,
  kind: K,
): readonly EntityByKind[K][] => {
  const found: EntityByKind[K][] = [];

  for (const id of graph.byKind[kind]) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind(kind, entity)) {
      found.push(entity);
    }
  }

  return found;
};

/** Is anything at all already stored under this id? */
export const idIsTaken = (graph: NormalizedSpatial, id: string): boolean => graph.byId[id] !== undefined;

/** An entity of a known kind, or `null` when it is absent or of another kind. */
export const readOf = <K extends EntityKind>(
  graph: NormalizedSpatial,
  kind: K,
  id: IdByKind[K],
): EntityByKind[K] | null => readEntity(graph, kind, id);

/**
 * The openings cut into one wall.
 *
 * Read from the openings themselves rather than from `wall.openingIds`, because
 * the opening's own `wallId` is the reference `spatial/integrity` treats as the
 * truth and the list on the wall as the copy.
 */
export const openingsOfWall = (graph: NormalizedSpatial, wallId: WallId): readonly GraphOpening[] =>
  entitiesOfKind(graph, 'opening').filter((opening) => opening.wallId === wallId);

/** The walls standing on one level. */
export const wallsOnLevel = (graph: NormalizedSpatial, levelId: LevelId): readonly GraphWall[] =>
  entitiesOfKind(graph, 'wall').filter((wall) => wall.levelId === levelId);

/** The level a wall stands on, or `null` when the reference dangles. */
export const levelOfWall = (graph: NormalizedSpatial, wall: GraphWall): Level | null =>
  readOf(graph, 'level', wall.levelId);

/* -------------------------------------------------------------------------- */
/* Vietnamese names.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Vietnamese names for every wall kind the graph knows.
 *
 * A complete record rather than a lookup with a fallback, so adding a kind
 * fails the build here instead of showing its English name on the screen.
 * Lower case, sentence style, as invariant A6 requires of interface labels.
 */
export const WALL_KIND_LABELS: Readonly<Record<WallKind, string>> = {
  loadBearing: 'tường chịu lực',
  partition: 'vách ngăn',
  envelope: 'tường bao',
};

/** Every wall kind, in the order the interface lists them. */
export const WALL_KINDS: readonly WallKind[] = ['loadBearing', 'partition', 'envelope'];

/** Vietnamese names for every furniture kind the graph knows. */
export const FURNITURE_KIND_LABELS: Readonly<Record<FurnitureKind, string>> = {
  table: 'bàn',
  chair: 'ghế',
  bed: 'giường',
  wardrobe: 'tủ áo',
  kitchenCabinet: 'tủ bếp',
  sanitaryFixture: 'thiết bị vệ sinh',
  stair: 'thang',
  other: 'đồ đạc khác',
};

/** Every furniture kind, in the order the interface lists them. */
export const FURNITURE_KINDS: readonly FurnitureKind[] = [
  'table',
  'chair',
  'bed',
  'wardrobe',
  'kitchenCabinet',
  'sanitaryFixture',
  'stair',
  'other',
];

/** "cửa đi D-3", for the middle of a sentence. */
export const nameOfOpening = (opening: GraphOpening): string =>
  `${describeOpeningKind(opening.kind).toLowerCase()} ${opening.id}`;

/* -------------------------------------------------------------------------- */
/* Numbers, as Vietnamese reads them.                                          */
/* -------------------------------------------------------------------------- */

/** A length in millimetres; whole values keep no decimal (invariant A15). */
export const formatLengthMm = (valueMm: number): string => {
  const rounded = Math.round(valueMm * 10) / 10;

  return `${formatNumber(rounded, { fractionDigits: Number.isInteger(rounded) ? 0 : 1 })} mm`;
};

/** An area in square metres, always two decimals. */
export const formatAreaM2 = (valueM2: number): string => `${formatNumber(valueM2, { fractionDigits: 2 })} m²`;

/** A height or a difference of heights, in metres. */
export const formatMetres = (valueMm: number): string =>
  `${formatNumber(valueMm / MILLIMETRES_PER_METRE, { fractionDigits: 3 })} m`;

/** An elevation above the datum, signed the way a section drawing writes it. */
export const formatElevationM = (valueMm: number): string =>
  `${valueMm < 0 ? '−' : '+'}${formatMetres(Math.abs(valueMm))}`;

/** An angle in degrees; whole values keep no decimal. */
export const formatAngleDeg = (valueDeg: number): string => {
  const rounded = Math.round(valueDeg * 10) / 10;

  return `${formatNumber(rounded, { fractionDigits: Number.isInteger(rounded) ? 0 : 1 })}°`;
};

/** A plain count. */
export const formatCount = (value: number): string => formatNumber(value, { fractionDigits: 0 });

/** A plan coordinate, both axes in millimetres, with the unit written once. */
export const formatPoint = (point: Point): string =>
  `(${formatLengthMm(point.x).replace(' mm', '')}; ${formatLengthMm(point.y).replace(' mm', '')}) mm`;

/* -------------------------------------------------------------------------- */
/* Converting between the graph and the geometry vocabulary.                   */
/* -------------------------------------------------------------------------- */

/** Is this a coordinate the geometry can work with? */
export const isFinitePoint = (point: Point): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

/** A graph coordinate, labelled as millimetres for the domain functions. */
export const toPointMm = (point: Point): PointMm => ({
  x: millimetres(point.x),
  y: millimetres(point.y),
});

/** A labelled coordinate, back in the plain form the graph stores. */
export const toPoint = (point: PointMm): Point => ({ x: point.x, y: point.y });

/**
 * The wall-domain vocabulary the graph's kinds map onto.
 *
 * The two vocabularies do not agree — the graph knows `envelope`, the wall
 * domain knows `railing` and `glazed` — so the map is chosen for one property
 * only: it is **one to one**, and therefore two walls share a domain kind
 * exactly when they share a graph kind. That is the only thing `mergeWalls`
 * reads the kind for, and every command reaching it has already compared the
 * graph kinds itself.
 */
const SOLID_WALL_KIND: Readonly<Record<WallKind, SolidWallKind>> = {
  loadBearing: 'loadBearing',
  partition: 'partition',
  envelope: 'glazed',
};

/**
 * A graph wall as the geometry functions want it.
 *
 * The graph stores a height above the floor while the geometry works in
 * absolute elevations, so the level the wall stands on has to come with it.
 *
 * @throws RangeError when a measurement on the wall or its level is not finite.
 * Callers validate first, so this only fires on data that never should have
 * reached the command layer.
 */
export const toSolidWall = (wall: GraphWall, level: Level): SolidWall => ({
  id: wall.id,
  kind: SOLID_WALL_KIND[wall.kind],
  centreline: {
    start: toPointMm(wall.centreline.start),
    end: toPointMm(wall.centreline.end),
  },
  thicknessMm: millimetres(wall.thicknessMm),
  baseElevationMm: millimetres(level.elevationMm),
  topElevationMm: millimetres(level.elevationMm + wall.heightMm),
});

/** The same wall with a centreline the geometry produced. */
export const withCentrelineOf = (wall: GraphWall, geometry: SolidWall): GraphWall => ({
  ...wall,
  centreline: {
    start: toPoint(geometry.centreline.start),
    end: toPoint(geometry.centreline.end),
  },
});

/**
 * Where the centre of a graph opening sits along its host, as a fraction.
 *
 * The graph stores the distance from the start of the centreline to the **left
 * edge** of the opening; the openings domain stores the fraction of the way
 * along to its **centre**. This is the whole of the difference.
 */
export const relativePositionOf = (opening: GraphOpening, wall: SolidWall): RelativePosition =>
  clampRelativePosition((opening.offsetMm + opening.widthMm / 2) / centrelineLength(wall));

/** The graph's stored offset for an opening the openings domain placed. */
export const offsetOnWall = (opening: AttachedOpening, wall: SolidWall): number =>
  opening.relativePosition * centrelineLength(wall) - opening.widthMm / 2;

/** A graph opening as the openings domain wants it. */
export const toAttachedOpening = (opening: GraphOpening, wall: SolidWall): AttachedOpening => ({
  id: opening.id,
  kind: opening.kind,
  widthMm: millimetres(opening.widthMm),
  heightMm: millimetres(opening.heightMm),
  sillHeightMm: millimetres(opening.sillHeightMm),
  swing: opening.swing,
  wallId: wall.id,
  relativePosition: relativePositionOf(opening, wall),
});

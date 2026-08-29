/**
 * Core types of the spatial graph.
 *
 * Unit conventions:
 * - Every coordinate and geometric size is an integer number of millimetres.
 * - Level elevations are stored in millimetres too; only the presentation
 *   layer converts them to metres.
 * - Areas are stored in square metres.
 *
 * This file only declares types. Id generation and validation live in `./ids`.
 */

import type { MillimetresPerPixel } from '../units/types';

/** A length in millimetres, always an integer. */
export type Millimetres = number;

/** An area in square metres. */
export type SquareMetres = number;

/** An angle in degrees, within [0, 360). */
export type Degrees = number;

/** A point on the floor plan, in millimetres. */
export interface Point {
  x: Millimetres;
  y: Millimetres;
}

/** A straight segment between two points, in millimetres. */
export interface Segment {
  start: Point;
  end: Point;
}

/** An axis-aligned bounding box, in millimetres. */
export interface BoundingBox {
  min: Point;
  max: Point;
}

/** The vertical band a given object occupies on one level. */
export interface LevelRange {
  levelId: LevelId;
  bottomElevationMm: Millimetres;
  topElevationMm: Millimetres;
}

/** Whether the data came from the AI model or from a person. */
export type DataSource = 'ai' | 'human';

/** A confidence score within [0, 1]. */
export type Confidence = number;

/**
 * Review metadata carried by every object in the graph.
 *
 * `reviewed` may only be set once a user has approved the object; AI output
 * must never set the flag on its own.
 */
export interface ReviewMetadata {
  confidence: Confidence;
  source: DataSource;
  reviewed: boolean;
}

/** Level id, prefixed with `L-`. */
export type LevelId = `L-${string}`;

/** Wall id, prefixed with `W-`. */
export type WallId = `W-${string}`;

/** Opening id (door or window), prefixed with `D-`. */
export type OpeningId = `D-${string}`;

/** Furniture id, prefixed with `F-`. */
export type FurnitureId = `F-${string}`;

/** Room id, prefixed with `R-`. */
export type RoomId = `R-${string}`;

/** Axis id, prefixed with `A-`. */
export type AxisId = `A-${string}`;

/** Dimension id, prefixed with `M-`. */
export type DimensionId = `M-${string}`;

/** Id of any prefixed entity. */
export type EntityId = LevelId | WallId | OpeningId | FurnitureId | RoomId | AxisId | DimensionId;

/** Note id; notes are outside the prefix table, so their id is free-form. */
export type NoteId = string;

/** The building described by the graph. */
export interface Building extends ReviewMetadata {
  name: string;
  address?: string;
  /** The `+0.000` datum expressed in the project coordinate system. */
  datumElevationMm: Millimetres;
  grossFloorAreaM2?: SquareMetres;
}

/** One level of the building. */
export interface Level extends ReviewMetadata {
  id: LevelId;
  name: string;
  /** Ordering from the bottom up; the ground level is 0. */
  order: number;
  elevationMm: Millimetres;
  heightMm: Millimetres;
  areaM2?: SquareMetres;
  /**
   * Tỷ lệ bản vẽ của tầng này, mm trên mỗi pixel.
   * Không bắt buộc vì tầng chưa hiệu chỉnh thì chưa có.
   */
  scaleMillimetresPerPixel?: MillimetresPerPixel;
}

/** Structural role of a wall. */
export type WallKind = 'loadBearing' | 'partition' | 'envelope';

/** A wall run on one level. */
export interface Wall extends ReviewMetadata {
  id: WallId;
  levelId: LevelId;
  /** Centreline, measured through the middle of the wall section. */
  centreline: Segment;
  thicknessMm: Millimetres;
  heightMm: Millimetres;
  kind: WallKind;
  openingIds: readonly OpeningId[];
}

/** Kind of opening cut into a wall. */
export type OpeningKind = 'door' | 'window';

/** How the leaf opens, seen from inside the room. */
export type SwingDirection = 'left' | 'right' | 'double' | 'sliding' | 'fixed';

/** An opening in a wall: a door or a window. */
export interface Opening extends ReviewMetadata {
  id: OpeningId;
  wallId: WallId;
  kind: OpeningKind;
  /** Distance from the centreline start point to the left edge of the opening. */
  offsetMm: Millimetres;
  widthMm: Millimetres;
  heightMm: Millimetres;
  /** Sill height above the level floor; doors use 0. */
  sillHeightMm: Millimetres;
  swing: SwingDirection;
}

/** Furniture grouped by purpose. */
export type FurnitureKind =
  | 'table'
  | 'chair'
  | 'bed'
  | 'wardrobe'
  | 'kitchenCabinet'
  | 'sanitaryFixture'
  | 'stair'
  | 'other';

/** A furniture item placed on the plan. */
export interface Furniture extends ReviewMetadata {
  id: FurnitureId;
  levelId: LevelId;
  roomId?: RoomId;
  kind: FurnitureKind;
  centre: Point;
  boundingBox: BoundingBox;
  rotationDeg: Degrees;
}

/** What a room is used for. */
export type RoomUsage =
  | 'livingRoom'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'corridor'
  | 'stairwell'
  | 'utility'
  | 'other';

/** A closed room on the plan. */
export interface Room extends ReviewMetadata {
  id: RoomId;
  levelId: LevelId;
  name: string;
  usage: RoomUsage;
  /** Closed outline; the first point is not repeated at the end. */
  outline: readonly Point[];
  areaM2: SquareMetres;
  wallIds: readonly WallId[];
}

/** Orientation of a setting-out axis. */
export type AxisDirection = 'horizontal' | 'vertical';

/** A structural setting-out axis. */
export interface Axis extends ReviewMetadata {
  id: AxisId;
  levelId: LevelId;
  /** Label drawn on the sheet, for example `A` or `12`. */
  label: string;
  direction: AxisDirection;
  line: Segment;
}

/** Kind of dimension being annotated. */
export type DimensionKind = 'linear' | 'chain' | 'radial' | 'angular' | 'elevation';

/** A dimension string annotated on the drawing. */
export interface Dimension extends ReviewMetadata {
  id: DimensionId;
  levelId: LevelId;
  kind: DimensionKind;
  /** The entities this dimension measures. */
  referenceIds: readonly EntityId[];
  /** The dimension line, from start point to end point. */
  line: Segment;
  valueMm: Millimetres;
  /** Value the user typed over the automatically measured one. */
  overrideValueMm?: Millimetres;
}

/** A note attached to any entity in the graph. */
export interface Note extends ReviewMetadata {
  id: NoteId;
  entityId: EntityId;
  body: string;
  /** Creation time as an ISO 8601 string with offset. */
  createdAt: string;
  authorId: string;
}

/**
 * The spatial graph describing a whole multi-level building.
 *
 * The lists only reference each other through prefixed ids and never nest
 * entities, so every edit stays a flat patch.
 */
export interface SpatialGraph {
  building: Building;
  levels: readonly Level[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  furniture: readonly Furniture[];
  rooms: readonly Room[];
  axes: readonly Axis[];
  dimensions: readonly Dimension[];
  notes: readonly Note[];
}

export type ReviewState = 'pending' | 'approved' | 'rejected';

export interface BaseEntity {
  id: string;
  confidence?: number;
  review_state?: ReviewState;
}

export interface Point2D extends BaseEntity {
  x: number;
  y: number;
}

export type WallThickness = 110 | 220 | 330 | 'CONCRETE_COLUMN';

export interface Wall extends BaseEntity {
  from: string; // Point2D id
  to: string; // Point2D id
  thickness_mm: WallThickness;
}

export interface Door extends BaseEntity {
  wall_id: string;
  position_t: number; // 0 to 1 along the wall
  width_mm: number;
  height_mm: number;
  type: string;
}

export type FurnitureType =
  | 'door'
  | 'double_door'
  | 'window'
  | 'bed'
  | 'sofa'
  | 'dining_table'
  | 'toilet'
  | 'kitchen_sink';

export interface Furniture extends BaseEntity {
  type: FurnitureType;
  x: number;
  y: number;
  rotation_deg: number;
}

export interface Window extends BaseEntity {
  wall_id: string;
  position_t: number;
  width_mm: number;
  height_mm: number;
  elevation_m: number;
}

export interface Room extends BaseEntity {
  label: string;
  vertices: string[]; // array of Point2D ids
  area_m2: number;
}

export interface Dimension extends BaseEntity {
  p1: string; // Point2D id
  p2: string; // Point2D id
  value_mm: number;
}

export interface Geometry {
  vertices: Record<string, Point2D>;
  walls: Record<string, Wall>;
  doors: Record<string, Door>;
  windows: Record<string, Window>;
  furniture: Record<string, Furniture>;
  rooms: Record<string, Room>;
  dimensions: Record<string, Dimension>;
}

export interface Level {
  level_id: string;
  name: string;
  elevation_m: number;
  height_m: number;
}

export interface GlobalAnchor {
  axis_intersection: string; // e.g. "A-1"
  x_offset: number;
  y_offset: number;
}

export interface ProjectMetadata {
  scale_ratio_mm_per_px: number;
}

export interface SpatialProject {
  project_metadata: ProjectMetadata;
  levels: Level[];
  global_anchor: GlobalAnchor;
  geometry: Record<string, Geometry>; // key is level_id
}

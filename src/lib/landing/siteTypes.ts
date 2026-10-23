/**
 * The demo estate outside the house walls: the plot, its walls and gates, ground
 * surfaces, water, planting, outdoor objects, and the roofs over the house.
 *
 * Same frame as the plan: millimetres, `x` east along the street, `y` into the
 * plot (scene `z`), the street at `y = 0`. Elevations are millimetres relative to
 * the ground-floor FFL (level T1 = 0); natural ground is `LandingSite.groundMm`.
 * Every footprint is either a closed polygon (first point not repeated) or a
 * segment, so the 2D drawing can ink every record without knowing its kind.
 * Re-exported from `types.ts`.
 */

export type PlanPt = readonly [number, number];
export type Polygon = readonly PlanPt[];
export type Compass = 'north' | 'east' | 'south' | 'west';

/** A free-standing wall (boundary, stone feature wall): centreline + thickness. */
export interface SiteWall {
  readonly id: string;
  readonly kind: 'boundary' | 'feature';
  readonly start: PlanPt;
  readonly end: PlanPt;
  readonly thicknessMm: number;
  readonly baseMm: number;
  readonly heightMm: number;
  readonly finish: 'render' | 'stone';
  /** Limestone plinth at the foot, when there is one. */
  readonly plinthMm?: number;
}

/** A gap in a site wall, like a PlanOpening: centre as a fraction of the wall from `start`. */
export interface SiteGate {
  readonly id: string;
  readonly wallId: string;
  readonly kind: 'vehicle' | 'pedestrian';
  readonly operation: 'sliding' | 'swing';
  readonly relativePosition: number;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Square piers flanking the gap: centre, side, height above `baseMm` of the wall. */
  readonly piers: readonly { readonly at: PlanPt; readonly sizeMm: number; readonly heightMm: number }[];
  /** The gate's own little roof (cổng mái), a `HipRoof` id in `LandingRoofs.hips`. */
  readonly roofId?: string;
}

/** A ground surface, top at `elevationMm`; `holes` are cut out (even-odd). */
export interface SiteSurface {
  readonly id: string;
  readonly kind: 'lawn' | 'paving' | 'path' | 'driveway' | 'bed' | 'podium' | 'deck' | 'island';
  readonly name?: string;
  readonly outline: Polygon;
  readonly holes?: readonly Polygon[];
  /** Separate slabs (stepping stones, path slabs) inside `outline`; when present the outline is only their extent. */
  readonly slabs?: readonly Polygon[];
  readonly elevationMm: number;
  /** Paving module for joint lines: slab length along x × width along y, and the joint. */
  readonly module?: { readonly lengthMm: number; readonly widthMm: number; readonly jointMm: number };
}

/** A flight of outdoor steps filling `outline`, climbing towards `climbs`. */
export interface SiteSteps {
  readonly id: string;
  readonly outline: Polygon;
  readonly climbs: Compass;
  readonly risers: number;
  readonly riserMm: number;
  readonly treadMm: number;
  /** Elevation at the foot. */
  readonly baseMm: number;
}

/** Pool or pond: `outline` is the water edge; the coping runs `copingMm` outside it. */
export interface SiteWater {
  readonly id: string;
  readonly kind: 'pool' | 'pond';
  readonly name: string;
  readonly outline: Polygon;
  readonly copingMm: number;
  readonly copingTopMm: number;
  readonly waterLevelMm: number;
  /** Basin floor below the water level. */
  readonly depthMm: number;
  readonly finish: 'mosaic' | 'stone';
  /** Lotus pads on a pond: centre + radius. */
  readonly lotus?: readonly { readonly at: PlanPt; readonly radiusMm: number }[];
}

/**
 * A tree, palm, shrub or bonsai. `slug` names a Pascal model
 * (`/pascal/items/<slug>/model.glb`) scaled uniformly by `scale` from its native
 * size and turned `rotationDeg` about +y (0 = as modelled); `variant` is the
 * present catalogue piece for when there is no model. `canopyMm` (plan radius)
 * and `heightMm` are the scaled sizes the drawing uses.
 */
export interface SitePlant {
  readonly id: string;
  readonly species: string;
  readonly slug?: string;
  readonly modelUrl?: string;
  readonly variant: string;
  readonly at: PlanPt;
  readonly baseMm: number;
  readonly scale: number;
  readonly rotationDeg: number;
  readonly canopyMm: number;
  readonly heightMm: number;
}


/**
 * An outdoor object. `model`: a Pascal model at native size x scale (sunbed, car,
 * parking bay); the others are stone pieces the stage makes itself (boulder,
 * stone stool, round stone table) and garden path lights.
 */
export interface SiteItem {
  readonly id: string;
  readonly kind: 'model' | 'boulder' | 'stone-stool' | 'stone-table' | 'path-light';
  readonly slug?: string;
  readonly modelUrl?: string;
  /** Present catalogue piece standing in until the model arrives. */
  readonly variant?: string;
  readonly at: PlanPt;
  readonly facing: Compass;
  /** Width x depth x height after scaling, as if facing north (the plan footprint swaps w/d for east/west). */
  readonly sizeMm: readonly [number, number, number];
  readonly baseMm: number;
}

export interface LandingSite {
  readonly plot: Polygon;
  readonly groundMm: number;
  readonly walls: readonly SiteWall[];
  readonly gates: readonly SiteGate[];
  readonly surfaces: readonly SiteSurface[];
  readonly steps: readonly SiteSteps[];
  readonly water: readonly SiteWater[];
  readonly plants: readonly SitePlant[];
  readonly items: readonly SiteItem[];
}

/**
 * A low-pitch hip roof, one per storey, stepped. `eave` is the drip-line
 * rectangle in plan (drawn dashed). The straight roof is a hip of `pitchDeg`
 * whose ridge runs along `ridgeAxis`, `ridgeLengthMm` long (long side - short
 * side; 0 = a pyramid), at `ridgeMm`. The eave is only slightly flared: each
 * corner lifts `cornerUpturnMm`, the eave sags `eaveSagMm` at mid-span below the
 * straight corner-to-corner line, each ridge end lifts `ridgeEndUpturnMm`.
 * `eaveMm` is the eave at mid-span (its lowest point); `overhangMm` is how far it
 * reaches past the walls under it. A lower roof runs on under the storey above
 * it (its ridge is inside that mass): the stage clips it against the upper walls.
 * Tile colour is a material decision, not data.
 */
export interface HipRoof {
  readonly id: string;
  readonly name: string;
  /** The storey whose walls carry it. */
  readonly levelId: string;
  readonly eave: Polygon;
  readonly eaveMm: number;
  readonly pitchDeg: number;
  readonly ridgeAxis: 'x' | 'y';
  readonly ridgeLengthMm: number;
  readonly ridgeMm: number;
  readonly overhangMm: number;
  readonly cornerUpturnMm: number;
  readonly eaveSagMm: number;
  readonly ridgeEndUpturnMm: number;
  /** Fascia depth at the eave edge (rafters + battens + tiles). */
  readonly thicknessMm: number;
  readonly tile: 'flat';
  readonly soffit: 'timber';
}

/** A flat canopy: the glass pergola over the pond deck, the carport's metal roof. */
export interface Canopy {
  readonly id: string;
  readonly name: string;
  readonly kind: 'glass' | 'metal';
  readonly outline: Polygon;
  readonly topMm: number;
  readonly thicknessMm: number;
  /** Slim beams under the deck, running along `beamAxis` every `beamSpacingMm`. */
  readonly beamAxis: 'x' | 'y';
  readonly beamSpacingMm: number;
}

/** A straight row of columns or posts, `count` evenly spaced from `start` to `end` (centres). */
export interface ColumnRow {
  readonly id: string;
  /** The roof or canopy the row carries. */
  readonly carries: string;
  readonly material: 'timber' | 'steel';
  readonly start: PlanPt;
  readonly end: PlanPt;
  readonly count: number;
  readonly spacingMm: number;
  /** Round timber: diameter; steel: square side. */
  readonly sizeMm: number;
  readonly baseMm: number;
  readonly topMm: number;
}

/** Stone cladding (or timber) on a stretch of an exterior wall's outside face, as fractions from its `start`. */
export interface Cladding {
  readonly wallId: string;
  readonly from: number;
  readonly to: number;
  readonly finish: 'stone' | 'timber';
}

export interface LandingRoofs {
  readonly hips: readonly HipRoof[];
  readonly canopies: readonly Canopy[];
  readonly columns: readonly ColumnRow[];
  /** Outside faces of `plan.walls` that are not white render. */
  readonly cladding: readonly Cladding[];
}

/**
 * The landing page's shared contract: the demo house's extra data, and the one
 * state object every frame is drawn from.
 *
 * The page is a pure function of scroll: `stateAt(p)` (timeline) turns a
 * progress `p ∈ [0, 1]` into a `LandingState`, and `stage.apply(state)` draws
 * it. Nothing animates on its own, so scrolling back to any `p` gives the same
 * frame as arriving there forwards.
 *
 * Units: the plan itself is the presentation layer's `PresentationPlan`, in
 * millimetres on the drawing (`x` across, `y` down the sheet, origin at the
 * back-left corner). Everything in this file that is a position in the 3D
 * scene is in scene units — metres, `y` up, plan `y` → scene `z` — the same
 * conversion `present/plan.ts#planPoint` does.
 */

import type { PresentationPlan } from '@/lib/three/present';

import type { LandingRoofs, LandingSite } from './siteTypes';

export type * from './siteTypes';

/* -------------------------------------------------------------------------- */
/* Demo house: what a PresentationPlan does not carry.                         */
/* -------------------------------------------------------------------------- */

export type Vec3 = readonly [number, number, number];

export interface GridAxis {
  readonly id: string; // 'A'..'D' or '1'..'3'
  readonly along: 'x' | 'y'; // 'x': a vertical line at x = atMm; 'y': horizontal at y = atMm
  readonly atMm: number;
}

/** One labelled room: the polygon lives in plan.rooms, this is its name and brief area. */
export interface RoomInfo {
  readonly roomId: string;
  readonly name: string; // 'Phòng khách'
  /** The area the brief states. Shown on screen. */
  readonly statedAreaM2: number;
}

export interface StairSpec {
  readonly id: string;
  readonly levelId: string; // the storey it starts on
  /** Foot of the flight, plan mm, centre of the first tread's nosing line. */
  readonly startMm: readonly [number, number];
  /** Compass direction the flight climbs towards on the plan. */
  readonly climbs: 'north' | 'east' | 'south' | 'west';
  readonly widthMm: number;
  readonly risers: number; // 18
  readonly riserMm: number; // 187.5
  readonly treadMm: number;
  /**
   * A half-landing that turns the stair back on itself (a U-stair). Absent: one
   * straight flight. The first `afterRisers` risers climb `climbs`; the landing is
   * the tread on top of riser `afterRisers`, `depthMm` deep; the rest climb back in
   * a parallel flight `gapMm` beside the first, on the `returnsOn` side, so the
   * top of the stair lands on the same line as its foot.
   */
  readonly landing?: {
    readonly afterRisers: number;
    readonly depthMm: number;
    readonly gapMm: number;
    readonly returnsOn: 'north' | 'east' | 'south' | 'west';
  };
}

/** A detection the AI scene shows: plan furniture id + class label + confidence. */
export interface Detection {
  readonly furnitureId: string; // plan.furniture[].id
  readonly label: string; // 'Giường'
  readonly confidence: number; // 0.94
  /** Whether this one gets a visible label in scene 03 (only a few do). */
  readonly labelled: boolean;
}

/** The recognition error scene 04 corrects: a gap the AI left in one wall. */
export interface ReviewGap {
  readonly wallId: string;
  /** Gap along the wall, as fractions of its length from `start`. */
  readonly from: number;
  readonly to: number;
}

export interface ComplianceCheck {
  readonly id: string;
  readonly label: string; // 'Cửa WC ≥ 0,75 m'
  readonly value: string; // '0,7 m'
  readonly pass: boolean;
  /** What it is about: an opening id, a room id, a stair id, a wall id or a level id. */
  readonly targetId: string;
  readonly suggestion?: string;
}

export interface ExportFormat {
  readonly format: 'GLB' | 'IFC' | 'PDF' | 'JSON' | 'PNG';
  readonly label: string; // 'Xem 3D'
}

export interface LandingHouse {
  readonly plan: PresentationPlan;
  readonly axes: readonly GridAxis[];
  readonly rooms: readonly RoomInfo[];
  readonly stair: StairSpec;
  /** The flight from T2 to the top floor T3, stacked in the same well (not part of the checks). */
  readonly topStair?: StairSpec;
  readonly detections: readonly Detection[];
  readonly reviewGap: ReviewGap;
  readonly checks: readonly ComplianceCheck[];
  readonly exports: readonly ExportFormat[];
  /** Everything on the plot outside the house walls (types in siteTypes.ts). */
  readonly site: LandingSite;
  /** Roofs, eaves and the veranda columns under them (types in siteTypes.ts). */
  readonly roofs: LandingRoofs;
}

/* -------------------------------------------------------------------------- */
/* The frame state.                                                            */
/* -------------------------------------------------------------------------- */

/** Everything below is 0..1 unless its comment says otherwise. */
export interface LandingState {
  readonly p: number;
  /** Index into SCENES of the scene that owns `p`, and how far through it we are. */
  readonly scene: number;
  readonly sceneLocal: number;

  readonly camera: {
    readonly position: Vec3;
    readonly target: Vec3;
    readonly fovDeg: number;
    readonly rollDeg: number;
  };

  /** Scene 01–02: the sheet and the ink on it. */
  readonly paper: {
    readonly opacity: number;
    /** How much of each stroke is drawn, in drawing order (walls first, then openings, axes, dims). */
    readonly ink: number;
    /** Non-model ink — notes and dimension lines the AI ignores. */
    readonly junkInk: number;
    readonly axes: number;
    readonly dims: number;
    /** Metres the drawing plane floats above the sheet (scene 02). */
    readonly liftM: number;
  };

  /** Scene 03: semantic layers over the same plan. */
  readonly detect: {
    readonly walls: number;
    readonly rooms: number;
    readonly openings: number;
    readonly furniture: number;
    readonly labels: number;
    /** Metres between layers in the restrained exploded view; 0 = flat. */
    readonly explodeM: number;
  };

  /** Scene 04: the gap the user closes. */
  readonly review: {
    readonly highlight: number;
    /** 0 = gap open, 1 = wall continuous and room closed. */
    readonly close: number;
  };

  /** Scene 05 onward: the physical building. */
  readonly build: {
    /** Per wall id, how far it has risen: 0 = drawing only, 1 = full height. */
    readonly wallRise: Readonly<Record<string, number>>;
    readonly floors: number;
    readonly joinery: number; // frames, doors, rails, trim
    /** Per furniture id, 0 = not there, 1 = standing. */
    readonly furniture: Readonly<Record<string, number>>;
    /** 0 = drawn (paper-white, ink edges), 1 = full PBR materials. */
    readonly material: number;
    readonly stair: number;
    /** Upper storey: 0 = absent, 1 = built. */
    readonly upper: number;
    /** Metres the upper storey is lifted for the cutaway (scene 05 E, scene 07). */
    readonly upperLiftM: number;
    /** 0 = full walls, 1 = walls cut for the interior/cutaway read. */
    readonly cutaway: number;
    /** Roofs, overhangs, canopies, louvres, pergola: 0 = absent, 1 = built. */
    readonly roof: number;
    /** Metres the roof layer is lifted away (interiors, cutaways); 0 = in place. */
    readonly roofLiftM: number;
    /** Ceilings over the rooms the camera is inside: 0 = open, 1 = closed. */
    readonly ceiling: number;
    /** Site hardscape (ground, paths, driveway, boundary walls, gates, pool shell): 0 = drawing, 1 = built. */
    readonly site: number;
    /** Trees, shrubs, lawn, planters grow in: 0 = none, 1 = grown. */
    readonly planting: number;
    /** Pool and pond water: 0 = empty, 1 = full. */
    readonly water: number;
  };

  /** Scene 08. */
  readonly compliance: {
    readonly bathDoor: number;
    readonly stair: number;
    readonly passMarks: number;
  };

  /** Scene 09. */
  readonly exports: number;

  /** How much semantic colour is left on the finished house (recedes in scene 09). */
  readonly semantic: number;

  /** DOM labels anchored to the model, by label id → opacity. */
  readonly labels: Readonly<Record<string, number>>;
}

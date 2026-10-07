import type { FloorplanGeometry, FloorplanPoint } from '@pascal-app/core';
/**
 * PERMIT-SET PLAN SYMBOLS for items — what a sheet draws instead of the
 * asset's raster sprite: real fixtures (sinks …) with fixture labels, as a
 * full plan set shows them.
 *
 * A plans examiner reads plumbing fixtures and appliances off the floor plan,
 * so those draw as crisp linework at true size with the standard label (WC,
 * LAV, TUB, SHWR, W, D, WH, REF, R, DW …). Furniture is thin light-grey
 * outline, a car a light dashed outline, and ceiling-mounted items, wall
 * devices and decor are left off — the lights go on the electrical plan.
 *
 * Symbols are built in the item's LOCAL plan frame, true size: x across the
 * width, y along the depth, the BACK (the wall it stands against) at
 * y = -depth / 2 and the front at +depth / 2. The caller maps the points.
 */
/**
 * Metadata key on a drafted item's group naming what it is (`fixture`,
 * `furniture`, `car`) — how a sheet tells a WC it must keep text off from a
 * bed it may overlap, without re-classifying the asset itself.
 */
export declare const PLAN_SYMBOL_METADATA_KEY = "pascal:sheet/plan-symbol";
export type PlanFixtureKind = 'wc' | 'lav' | 'tub' | 'shower' | 'washer' | 'dryer' | 'washer-dryer' | 'water-heater' | 'ref' | 'range' | 'cooktop' | 'oven' | 'dw' | 'mw' | 'sink' | 'fireplace' | 'ev' | 'condenser';
export type PlanItemClass = {
    kind: 'fixture';
    fixture: PlanFixtureKind;
    label: string;
} | {
    kind: 'casework';
} | {
    kind: 'car';
} | {
    kind: 'furniture';
    shape: 'bed' | 'sofa' | 'plain';
} | {
    kind: 'omit';
};
type AssetLike = {
    id?: string;
    name?: string;
    category?: string;
    tags?: readonly string[];
    attachTo?: string;
};
/** What a sheet draws for an item, from its asset. */
export declare function classifyPlanItem(asset: AssetLike): PlanItemClass;
/** Fixture linework — the weight casework draws in, near-black. */
export declare const FIXTURE_STROKE = "#1f2937";
export declare const FIXTURE_STROKE_WIDTH = 0.012;
/** Furniture: thin, light grey — present, never competing with the walls. */
export declare const FURNITURE_STROKE = "#9ca3af";
export declare const FURNITURE_STROKE_WIDTH = 0.006;
/** Fixture label size on the paper, points, and its plan-metre size at 1/4" = 1'-0". */
export declare const FIXTURE_LABEL_PT = 6.5;
export declare const FIXTURE_LABEL_SIZE = 0.11;
export type PlanSymbolFrame = {
    /** Local (x across, y along the depth; back = -depth / 2) → plan point. */
    map: (x: number, y: number) => FloorplanPoint;
    width: number;
    depth: number;
};
/**
 * The drafting symbol for an item, in plan coordinates. Empty for `omit`.
 */
export declare function buildPlanItemSymbol(cls: PlanItemClass, frame: PlanSymbolFrame): FloorplanGeometry[];
export {};
//# sourceMappingURL=plan-symbols.d.ts.map
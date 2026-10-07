/**
 * The permit-set layers of the site plan (A1.0) beyond the lot, the yards
 * and the house: the street each street edge fronts, the contour labels,
 * the driveway and walks, the utility services a plugin located, the drainage
 * arrows, and the finish-floor and spot elevations. Every function is pure
 * and returns site-metre primitives (x east, y south) for
 * `buildSitePlanDrawing`, which owns the order they stack in.
 */
import { type BuildingNode, type FloorplanGeometry, type LevelNode, type SceneSnapshot, type SiteNode, type TerrainField } from '@pascal-app/core';
import { type SitePlanServicePoint, type SitePlanServiceRole } from './contributors';
import { type Pt } from './geometry';
import { type OutdoorPart } from './site-parts';
/**
 * A street name as a site plan prints it: the house number dropped, the
 * quadrant abbreviated, the street type spelled out — "4121 NW 34th St" and
 * OSM's "Northwest 34th Street" both read "NW 34TH STREET", and "Northwest
 * 34th Terrace" reads "NW 34TH TERRACE" (a different street: the type is part
 * of the name). Empty for an empty name.
 */
export declare function formatStreetName(raw: string | null | undefined): string;
/** Printed on a street edge whose street the lot drop-in could not name. */
export declare const UNNAMED_STREET = "STREET (NAME NOT ON RECORD \u2014 VERIFY)";
/**
 * The street each street edge of the lot runs along, as printed: only the
 * edges that front a street — `site.streetEdges` and the front edge — and
 * each with ITS street: the name the lot drop-in stored for that edge
 * (`site.metadata.streetNames`, from the mapped roads), else — for a lot dropped
 * before names were kept per edge — the front edge's street from the
 * drop-in's note, the address's street on the one other street edge when
 * the front is a different street (a through or corner lot is addressed on
 * one of its streets), and "name not on record" where neither says.
 */
export declare function streetEdgeNames(site: Pick<SiteNode, 'address' | 'parcel' | 'streetEdges'> & {
    metadata?: unknown;
}, frontEdge: number): Map<number, string>;
/**
 * The contour lines and their labels. With a survey datum (the terrain
 * sample's USGS elevation, or the dossier's 3DEP lines) the lines fall on
 * whole multiples of the interval in ABSOLUTE feet — 173, 174, 175 — not on
 * the site datum's fraction, and each is labelled with its elevation; every
 * fifth is an index contour (heavier). Each elevation is labelled once, or
 * twice on a long line, on its longest pieces — never on every loop.
 */
export declare function contourPrimitives(args: {
    site: SiteNode;
    lot: readonly Pt[];
    field: TerrainField;
    intervalIn: number;
    datumFt: number | null;
    fontSize: number;
    /** Rings no label is set inside (the house, porches, paving). */
    avoid?: readonly Pt[][];
}): FloorplanGeometry[];
/**
 * The driveway and walks: a concrete tone under a fine edge, the driveway
 * dimensioned across its throat (the garage door) and its flared mouth at
 * the property line, the walk's width printed along it.
 */
export declare function flatworkPrimitives(scene: SceneSnapshot, building: BuildingNode | null, parts: readonly OutdoorPart[], fontSize: number): FloorplanGeometry[];
export type ServiceRole = SitePlanServiceRole;
type ServicePoint = {
    role: SitePlanServicePoint['role'];
    at: Pt;
    normal: Pt | null;
};
/** The registered service points of the building's ground storey, in site metres. */
export declare function servicePoints(scene: SceneSnapshot, level: LevelNode | null, building: BuildingNode | null, outline: readonly Pt[][]): ServicePoint[];
/** The storey's electric service entrance: a registered plugin's choice, else the building's, else overhead. */
export declare function serviceEntranceOf(scene: SceneSnapshot, level: LevelNode | null, building: BuildingNode | null): {
    kind: 'overhead' | 'underground';
    source: 'plugin' | 'building' | 'default';
};
/**
 * A schematic route from a service point to the street: out square from
 * the wall, then to the nearest point of a street edge — around the house
 * (a dogleg past its end) when the straight run would cross it.
 */
export declare function serviceRoute(from: Pt, normal: Pt | null, lot: readonly Pt[], streetEdges: readonly number[], outline: readonly Pt[][]): Pt[] | null;
/**
 * The utility services a plugin located, drawn schematically to the street:
 * the electric service from the meter (to the utility pole overhead, or
 * underground to the street), the water service from its entry to a meter
 * box at the property line, the sewer lateral from its exit to a cleanout at
 * the property line, and the A/C condenser on its pad. Sizes are the common
 * residential ones and say "verify"; the utility sets the real ones.
 */
export declare function servicePrimitives(args: {
    scene: SceneSnapshot;
    level: LevelNode | null;
    building: BuildingNode | null;
    lot: readonly Pt[];
    streetEdges: readonly number[];
    outline: readonly Pt[][];
    fontSize: number;
}): {
    primitives: FloorplanGeometry[];
    drawn: ServiceRole[];
    entrance: 'overhead' | 'underground';
    /** The condenser pad's ring, for the marks that should keep off it. */
    pad: Pt[] | null;
};
/**
 * Drainage arrows off every face of the house: the finish grade falls away
 * from the foundation — 6 in in the first 10 ft (FBC-R / IRC R401.3) — so
 * each arrow runs from the wall out 10 ft. One arrow carries the rule.
 */
export declare function drainagePrimitives(outline: readonly Pt[][], fontSize: number, obstacles?: readonly Pt[][]): FloorplanGeometry[];
/** "174.25'" from an absolute elevation in feet, or "+0.42'" relative to the site datum. */
export declare function formatElevation(relM: number, datumFt: number | null): string;
/**
 * Spot grades: an × and its elevation at each lot corner and just off each
 * corner of the house (the finish grade the pad grading left), read from
 * the site's terrain.
 */
export declare function spotElevationPrimitives(args: {
    field: TerrainField;
    datumFt: number | null;
    lot: readonly Pt[];
    outline: readonly Pt[][];
    fontSize: number;
}): FloorplanGeometry[];
/** The storey slab's top — the finish floor — level-local metres, and the garage pad's. */
export declare function floorTops(scene: SceneSnapshot, level: LevelNode | null): {
    floor: number | null;
    garage: number | null;
};
export {};
//# sourceMappingURL=site-annotations.d.ts.map
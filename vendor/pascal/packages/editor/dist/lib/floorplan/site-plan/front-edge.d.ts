/**
 * The street-facing lot edge from the mapped roads. Pure: no store, no
 * network.
 *
 * For every lot edge, score how well a road fronts it:
 *   1. PARALLELISM — the edge direction must be within `FRONT_EDGE_PARALLEL_DEG`
 *      of the nearest road segment (streets run ALONG a frontage; a road
 *      perpendicular to an edge is rejected).
 *   2. OUTSIDE — the nearest road point must sit on the OUTWARD side of the
 *      edge: the street is off the lot, not a driveway cutting through it.
 *   3. DISTANCE — among edges that pass, the smallest edge-midpoint-to-road
 *      distance wins (the closest fronting street); edges within
 *      `FRONT_EDGE_DISTANCE_TIE_M` of each other are a tie, and the LONGER
 *      edge takes it — a sliver left by a curb return or a split frontage
 *      never beats the frontage it sits beside.
 * CORNER AND THROUGH LOTS: when the address's street matches a road, edges
 * fronting THAT road are preferred over a merely-closer other street — the
 * addressed street is the true front. The match keeps the street type and
 * the directional (street-name.ts, USPS Pub. 28): "NW 34th St" is not
 * "NW 34th Terrace".
 *
 * Coordinates are the site plan frame (metres, x east, y south), the frame
 * the lot polygon and the OSM roads share.
 */
import { type Pt } from './geometry';
export interface RoadCenterline {
    name?: string;
    centerline: readonly Pt[];
}
export interface FrontEdgeMatch {
    /** Lot edge index: the edge runs from `points[index]` to `points[index + 1]`. */
    index: number;
    /** Edge midpoint to the road centerline, metres. */
    distance: number;
    /** The fronting road's name ('' when OSM has none). */
    name: string;
    /** True when the road is the address's street — name, type and directional (corner / through-lot rule). */
    named: boolean;
    /** Every lot edge a street runs along (parallel, outside, within 25 m): a corner lot lists two or more. */
    streetEdges?: number[];
    /** The street each of those edges runs along (the nearest road's name), by edge index; unnamed roads are left out. */
    streetNames?: Record<string, string>;
}
export declare const FRONT_EDGE_PARALLEL_DEG = 30;
export declare const FRONT_EDGE_DISTANCE_TIE_M = 1.5;
/**
 * Core street name: the house number, the directionals and the street type
 * dropped — "2600 Castro Way" ↔ OSM "Castro Way" ↔ "S Castro"; OSM spells
 * the quadrant out ("Northeast 109th Street" ↔ "NE 109th St"). The core
 * alone does not say two lines are one street: `sameStreet` also compares
 * the type and the directional.
 */
export declare function streetCore(s: string | null | undefined): string;
/** The winning lot-edge index with its road, or null (keep the current / fallback edge). */
export declare function detectFrontEdgeFromRoads(lot: readonly Pt[], roads: readonly RoadCenterline[], addressStreet?: string | null): FrontEdgeMatch | null;
//# sourceMappingURL=front-edge.d.ts.map
/**
 * Site-plan geometry — pure functions, no store, no React.
 *
 * All coordinates are SITE metres: origin = the geocoded point, x → east,
 * y → south (the plan frame the site polygon is stored in). Consumers
 * (2D editor, sheets) turn these into SVG through the existing renderer.
 */
export type Pt = readonly [number, number];
export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/** Yard sides in the order the site-plan dimensions are cast. */
export type YardSide = 'north' | 'south' | 'east' | 'west';
export interface SetbackInputs {
    front: number;
    side: number;
    rear: number;
    left?: number;
    right?: number;
    /** A corner lot's second street side; absent = the front setback. */
    streetSide?: number;
}
/** Per-edge classification of a lot polygon relative to its front edge. */
export type EdgeRole = 'front' | 'rear' | 'left' | 'right' | 'street' | 'street';
export declare function polygonBounds(points: readonly Pt[]): Bounds;
export declare function polygonArea(points: readonly Pt[]): number;
export declare function polygonCentroid(points: readonly Pt[]): Pt;
/** True when the ring is wound counter-clockwise in a y-down (south-positive) frame. */
export declare function isCounterClockwise(points: readonly Pt[]): boolean;
/**
 * Unit normal of edge `i` pointing OUT of the polygon, winding-agnostic.
 */
export declare function outwardNormal(points: readonly Pt[], i: number): Pt;
/**
 * Compass heading of edge `i`'s outward normal, in DEGREES clockwise from
 * north, where `northRotation` (radians, clockwise) is true north's offset
 * from plan up (−y). This is the direction the edge faces.
 */
export declare function edgeHeadingDeg(points: readonly Pt[], i: number, northRotation?: number): number;
export declare function compassLabel(headingDeg: number): string;
/** Length of edge `i`, metres. */
export declare function edgeLength(points: readonly Pt[], i: number): number;
/**
 * Fallback front edge: the edge whose outward normal points closest to true
 * north. Ties break toward the longer edge — the street frontage of a typical
 * lot is one of its long sides.
 */
export declare function mostNorthFacingEdge(points: readonly Pt[], northRotation?: number): number;
/** `frontEdge` if it indexes a real edge, else the most north-facing edge. */
export declare function resolveFrontEdge(points: readonly Pt[], frontEdge: number | undefined, northRotation?: number): number;
/**
 * Classify every edge as front / rear / left / right.
 *
 * - front = `frontIndex`.
 * - rear  = the edge whose outward normal is most anti-parallel to the front's.
 * - the rest are sides. LEFT / RIGHT are defined along the FRONT EDGE
 *   DIRECTION (`points[front] → points[front + 1]`): an edge whose midpoint
 *   projects behind the front-edge midpoint on that axis is `left`, ahead of
 *   it is `right`. Deterministic and independent of winding.
 */
export declare function classifyEdges(points: readonly Pt[], frontIndex: number, streetEdges?: readonly number[]): EdgeRole[];
/** Required setback distance (metres) for each edge role. */
export declare function setbackForRole(setbacks: SetbackInputs, role: EdgeRole): number;
/**
 * Buildable envelope — every lot edge pushed INWARD by its own setback, with
 * the new vertices taken as the intersections of adjacent offset lines
 * (variable-distance straight-skeleton-lite). Exact for convex lots; on a
 * concave lot a reflex corner can self-intersect, in which case the caller
 * still gets a ring but it is advisory, not a legal envelope.
 *
 * Adjacent offset lines that are parallel (a straight run split by a
 * surplus vertex) have no intersection: the shared vertex is then simply
 * pushed inward along the current edge's own offset, instead of the whole
 * envelope being refused.
 *
 * Returns `[]` when the polygon has fewer than 3 points or when the result
 * inverts (setbacks larger than the lot).
 */
export declare function setbackEnvelope(points: readonly Pt[], setbacks: SetbackInputs, frontIndex: number, options?: {
    streetEdges?: readonly number[];
    sightTriangleM?: number;
}): Pt[];
/**
 * Distance from `origin` along unit direction `(dx, dy)` to the first crossing
 * of the polygon boundary. `null` when the ray never hits (origin outside, or
 * a degenerate ring).
 */
export declare function rayToPolygon(points: readonly Pt[], origin: Pt, dx: number, dy: number): {
    distance: number;
    point: Pt;
} | null;
export interface YardDimension {
    side: YardSide;
    /** Bounding-box edge midpoint the dimension starts at. */
    from: Pt;
    /** Where the cast ray meets the lot line. */
    to: Pt;
    /** Metres. */
    distance: number;
}
/**
 * The four yard dimensions: from each footprint bbox edge midpoint, straight
 * out to the lot line. Sides whose ray misses the lot line (footprint outside
 * the lot) are omitted rather than faked.
 */
export declare function castYardDimensions(lot: readonly Pt[], footprint: Bounds): YardDimension[];
/**
 * Yard dimensions for a building TURNED on its lot. The footprint's bounds
 * are taken in the building's own frame (`yaw`, the building node's Y
 * rotation), and the four edge midpoints cast square to the house's faces
 * out to the lot line — the yards a plan checker measures. With `yaw` 0 this
 * is the axis-aligned cast above; with a house square to a diagonal lot the
 * axis-aligned bbox sticks out past the real corners and reads a front yard
 * inches short of the setback it actually meets (Land Park, 2026-09-06).
 * `side` is the compass direction nearest the cast, so labels keep reading
 * N / S / E / W.
 */
export declare function castYardDimensionsOriented(lot: readonly Pt[], footprintLoops: readonly (readonly Pt[])[], yaw: number): YardDimension[];
/** Even-odd point-in-polygon. */
export declare function pointInPolygon(points: readonly Pt[], x: number, y: number): boolean;
/** True when every corner of `bounds` is inside `lot`. */
export declare function boundsInsidePolygon(lot: readonly Pt[], bounds: Bounds): boolean;
export declare const METRES_PER_FOOT = 0.3048;
/** `24'-6"` — the notation a US site plan uses for yard dimensions. */
export declare function formatFeetInches(metres: number): string;
//# sourceMappingURL=geometry.d.ts.map
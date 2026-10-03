export type ScreenRect = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export type Point2 = [number, number];
/** Andrew monotone-chain convex hull. Returns CCW hull without the closing
 *  point; degenerate inputs (0–2 points, collinear sets) pass through. */
export declare function convexHull2D(points: readonly Point2[]): Point2[];
/** Segment vs polygon (general, possibly concave): endpoint containment or
 *  any edge crossing. */
export declare function segmentIntersectsPolygon(a: Point2, b: Point2, polygon: readonly Point2[]): boolean;
/** Polygon vs polygon (general): containment either way or any edge crossing. */
export declare function polygonsIntersect(a: readonly Point2[], b: readonly Point2[]): boolean;
/**
 * Does the axis-aligned marquee rect intersect the (convex) hull polygon?
 * Covers all cases: hull vertex inside the rect, rect fully inside the hull,
 * and pure edge crossings.
 */
export declare function rectIntersectsHull(rect: ScreenRect, hull: readonly Point2[]): boolean;
//# sourceMappingURL=marquee-geometry.d.ts.map
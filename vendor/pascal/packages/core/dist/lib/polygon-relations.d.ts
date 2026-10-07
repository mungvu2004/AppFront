export type Point2D = [number, number];
export declare function pointOnSegment(point: Point2D, start: Point2D, end: Point2D, tolerance?: number): boolean;
export declare function pointInPolygon(point: Point2D, polygon: Point2D[], options?: {
    includeBoundary?: boolean;
}): boolean;
export declare function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean;
export declare function polygonsIntersect(left: Point2D[], right: Point2D[]): boolean;
export declare function polygonContainsPolygon(outer: Point2D[], inner: Point2D[]): boolean;
export declare function polygonsOverlap(left: Point2D[], right: Point2D[]): boolean;
//# sourceMappingURL=polygon-relations.d.ts.map
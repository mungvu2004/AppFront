import type { Point2D } from '@pascal-app/core';
declare function toSvgX(value: number): number;
declare function toSvgY(value: number): number;
declare function toSvgPoint(point: Point2D): {
    x: number;
    y: number;
};
export declare function formatPolygonPath(points: Point2D[], holes?: Point2D[][]): string;
export declare function buildSvgPolylinePath(points: Point2D[]): string | null;
export declare function getArcPlanPoint(center: Point2D, radius: number, angle: number): Point2D;
export declare function buildSvgArcPath(center: Point2D, radius: number, startAngle: number, endAngle: number): string;
export declare function buildSvgAnnularSectorPath(center: Point2D, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): string;
export declare function formatSvgPolygonPoints(points: Point2D[]): string;
/**
 * Three points defining an arrow head — tip + two trailing barbs.
 * Returned as plain `Point2D` objects so consumers can either feed them
 * straight into `formatSvgPolygonPoints` (for SVG `points=""`) or push
 * them onto a `FloorplanGeometry.polygon.points` array. Mixing both
 * downstream paths through a string-returning helper was awkward — see
 * `nodes/src/stair/floorplan.ts` which needs the points as objects.
 */
export declare function buildSvgArrowHeadPoints(point: Point2D, angle: number, size: number): Point2D[];
export { toSvgPoint, toSvgX, toSvgY };
//# sourceMappingURL=svg-paths.d.ts.map
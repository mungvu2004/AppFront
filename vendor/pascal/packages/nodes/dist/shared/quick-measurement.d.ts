import { type MeasurementPoint } from '@pascal-app/core';
type PolygonPoint = readonly [number, number];
export declare function polygonMeasurementPoints(polygon: readonly PolygonPoint[], height: number): MeasurementPoint[];
export declare function polygonSurfaceArea(polygon: readonly PolygonPoint[], holes?: readonly (readonly PolygonPoint[])[]): number;
export declare function polygonBoundaryLength(polygon: readonly PolygonPoint[]): number;
export declare function polygonReportAnchor(polygon: readonly PolygonPoint[], height: number): MeasurementPoint;
export {};
//# sourceMappingURL=quick-measurement.d.ts.map
import type { Point2D } from '@pascal-app/core';
import type { FloorplanLineSegment, FloorplanSelectionBounds } from './types';
export declare const FLOORPLAN_VIEW_ROTATION_DEG = 0;
export declare function clampPlanValue(value: number, min: number, max: number): number;
export declare function rotatePlanVector(x: number, y: number, rotation: number): [number, number];
export declare function worldToFloorplanLocalPoint(worldX: number, worldZ: number, buildingPosition: readonly [number, number, number], buildingRotationY: number): Point2D;
export declare function floorplanLocalToWorldPoint(point: Point2D | [number, number], buildingPosition: readonly [number, number, number], buildingRotationY: number): {
    x: number;
    z: number;
};
export declare function getRotatedRectanglePolygon(center: Point2D, width: number, depth: number, rotation: number): Point2D[];
export declare function interpolatePlanPoint(start: Point2D, end: Point2D, t: number): Point2D;
export declare function getPlanPointDistance(start: Point2D, end: Point2D): number;
export declare function movePlanPointTowards(start: Point2D, end: Point2D, distance: number): Point2D;
export declare function getThickPlanLinePolygon(line: FloorplanLineSegment, thickness: number): Point2D[];
export declare function getFloorplanSelectionBounds(start: [number, number], end: [number, number]): FloorplanSelectionBounds;
export declare function isPointInsideSelectionBounds(point: Point2D, bounds: FloorplanSelectionBounds): boolean;
export declare function isPointInsidePolygon(point: Point2D, polygon: Point2D[]): boolean;
export declare function isPointInsidePolygonWithHoles(point: Point2D, polygon: Point2D[], holes?: Point2D[][]): boolean;
export declare function doesPolygonIntersectSelectionBounds(polygon: Point2D[], bounds: FloorplanSelectionBounds): boolean;
export declare function getDistanceToWallSegment(point: Point2D, start: [number, number], end: [number, number]): number;
export declare function pointMatchesWallPlanPoint(point: Point2D | undefined, planPoint: [number, number], epsilon?: number): boolean;
//# sourceMappingURL=geometry.d.ts.map
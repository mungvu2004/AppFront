import type { FenceNode, WallNode } from '../../schema/index.js';
import type { Point2D } from './wall-mitering.js';
type WallCurveLike = Pick<WallNode | FenceNode, 'start' | 'end' | 'curveOffset'>;
type CurveFrame = {
    point: Point2D;
    tangent: Point2D;
    normal: Point2D;
};
type WallSurfaceMiterOverrides = {
    startLeft?: Point2D;
    startRight?: Point2D;
    endLeft?: Point2D;
    endRight?: Point2D;
};
export declare function getWallStartPoint(wall: WallCurveLike): Point2D;
export declare function getWallEndPoint(wall: WallCurveLike): Point2D;
export declare function getWallChordLength(wall: WallCurveLike): number;
export declare function getMaxWallCurveOffset(wall: WallCurveLike): number;
export declare function getWallStraightSnapOffset(wall: WallCurveLike): number;
export declare function normalizeWallCurveOffset(wall: WallCurveLike, offset: number): number;
export declare function getClampedWallCurveOffset(wall: WallCurveLike): number;
export declare function isCurvedWall(wall: WallCurveLike): boolean;
export declare function getWallChordFrame(wall: WallCurveLike): {
    start: Point2D;
    end: Point2D;
    midpoint: Point2D;
    tangent: {
        x: number;
        y: number;
    };
    normal: {
        x: number;
        y: number;
    };
    length: number;
};
export declare function getWallArcData(wall: WallCurveLike): {
    center: {
        x: number;
        y: number;
    };
    radius: number;
    startAngle: number;
    delta: number;
    direction: number;
} | null;
export declare function getWallCurveFrameAt(wall: WallCurveLike, t: number): CurveFrame;
export declare function getWallMidpointHandlePoint(wall: WallCurveLike): Point2D;
export declare function sampleWallCenterline(wall: WallCurveLike, segments?: number): Point2D[];
export declare function constrainWallCurveOffsetToAvoidIntersections(wall: WallNode, proposedOffset: number, walls: readonly WallNode[]): number;
export declare function getWallCurveLength(wall: WallCurveLike, segments?: number): number;
export declare function getWallSurfacePolygon(wall: Pick<WallNode | FenceNode, 'start' | 'end' | 'curveOffset' | 'thickness'>, segments?: number, miterOverrides?: WallSurfaceMiterOverrides): Point2D[];
export {};
//# sourceMappingURL=wall-curve.d.ts.map
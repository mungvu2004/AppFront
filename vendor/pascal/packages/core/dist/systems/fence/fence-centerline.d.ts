import type { FenceNode } from '../../schema/index.js';
import type { Point2D } from '../wall/wall-mitering.js';
type CurveFrame = {
    point: Point2D;
    tangent: Point2D;
    normal: Point2D;
};
export declare function getFenceCenterlineFrameAt(fence: FenceNode, t: number): CurveFrame;
export declare function sampleFenceCenterline(fence: FenceNode, segments?: number): Point2D[];
export declare function getFenceCenterlineLength(fence: FenceNode, segments?: number): number;
export {};
//# sourceMappingURL=fence-centerline.d.ts.map
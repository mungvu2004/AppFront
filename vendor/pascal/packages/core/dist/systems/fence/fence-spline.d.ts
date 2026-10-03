import type { FenceNode } from '../../schema/index.js';
import type { Point2D } from '../wall/wall-mitering.js';
type FenceSplineLike = Pick<FenceNode, 'path'>;
type TangentList = ReadonlyArray<readonly [number, number] | null> | undefined;
export declare function isSplineFence(fence: FenceSplineLike): boolean;
type CurveFrame = {
    point: Point2D;
    tangent: Point2D;
    normal: Point2D;
};
/**
 * OUT-handle offset vector for control point `index` — the stored tangent if
 * the user has adjusted it, otherwise the automatic distance-aware tangent
 * (endpoints duplicate the neighbour so the ends stay tangent to their single
 * span). The IN handle is the negation of this.
 *
 * Exported so the editing UI can draw the tangent line / handle dots at the
 * right place even before the user has dragged them.
 */
export declare function getFenceControlHandle(path: ReadonlyArray<readonly [number, number]>, tangents: TangentList, index: number): Point2D;
export declare function getTwoPointFenceCurveTangents(path: ReadonlyArray<readonly [number, number]>): Array<[number, number] | null> | undefined;
/**
 * Sample the spline centerline into a polyline. Control points are honored as
 * on-curve anchors; `segmentsPerSpan` controls smoothness between them.
 * Returns `(segmentsPerSpan * spanCount) + 1` points, first == path[0],
 * last == path[-1].
 */
export declare function sampleFenceSpline(path: ReadonlyArray<readonly [number, number]>, tangents?: TangentList, segmentsPerSpan?: number): Point2D[];
/**
 * Frame (point + tangent + normal) at parameter `t` in [0, 1] along the spline
 * centerline. Same return shape as `getWallCurveFrameAt` so it is a drop-in for
 * the arc branch. `t` is uniform over the sampled polyline (arc length is not
 * reparameterised — adequate for marching posts / rails and far cheaper).
 */
export declare function getFenceSplineFrameAt(path: ReadonlyArray<readonly [number, number]>, t: number, tangents?: TangentList, segmentsPerSpan?: number): CurveFrame;
/** Total polyline length of the sampled spline centerline. */
export declare function getFenceSplineLength(path: ReadonlyArray<readonly [number, number]>, tangents?: TangentList, segmentsPerSpan?: number): number;
export {};
//# sourceMappingURL=fence-spline.d.ts.map
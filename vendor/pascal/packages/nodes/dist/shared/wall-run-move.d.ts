import type { AnyNode, GridEvent } from '@pascal-app/core';
import type { RunWallAttachment } from './distribution-run-contract';
type Point = [number, number, number];
export type WallRunMoveResult = {
    path: Point[];
    attachment: RunWallAttachment;
};
/** Recompute persisted U/V coordinates after a 3D endpoint edit. */
export declare function refreshWallRunAttachment(path: readonly Point[], attachment: RunWallAttachment, wall: Extract<AnyNode, {
    type: 'wall';
}>): RunWallAttachment;
/** Translate a wall-attached run in the wall's horizontal/vertical plane. */
export declare function translateWallRun(path: readonly Point[], attachment: RunWallAttachment, wall: Extract<AnyNode, {
    type: 'wall';
}>, event: Pick<GridEvent, 'surfaceHit' | 'surfaceLocalPosition'>): WallRunMoveResult | null;
export {};
//# sourceMappingURL=wall-run-move.d.ts.map
import type { GutterNode, SceneApi } from '@pascal-app/core';
export type GutterLengthSnap = {
    /** Length to apply to the dragged gutter. */
    length: number;
};
/**
 * @param initial          gutter at drag start (rotation, length, position)
 * @param proposedLength   length the linear-resize pipeline computed
 * @param sign             +1 for the gutter-local +X end being dragged, −1 for −X
 * @param anchorX,anchorZ  the held-fixed endpoint (opposite of `sign`)
 * @param armX,armZ        gutter +X direction in segment frame (cos r, −sin r)
 * @param minLength        floor — typically the descriptor's `min` value
 * @param sceneApi         scene access for corner-mate lookup
 */
export declare function snapLengthToCorner(initial: GutterNode, proposedLength: number, sign: 1 | -1, anchorX: number, anchorZ: number, armX: number, armZ: number, minLength: number, sceneApi: SceneApi): GutterLengthSnap;
//# sourceMappingURL=length-snap.d.ts.map
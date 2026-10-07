import { type FloorplanMoveTarget, type StairNode } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for stair.
 *
 * Existing stairs preserve the cursor grab offset, matching the 3D move
 * tools; fresh catalog placement follows the cursor absolutely.
 *
 * Figma alignment is layered on the stair footprint edges.
 * Guides are cleared by `FloorplanRegistryMoveOverlay`'s Path 1 teardown.
 *
 * The position previews through the live override store and is written to
 * scene once via `commit()`.
 */
export declare const stairFloorplanMoveTarget: FloorplanMoveTarget<StairNode>;
//# sourceMappingURL=floorplan-move.d.ts.map
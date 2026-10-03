import { type FloorplanMoveTarget, type ShelfNode } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for shelf — mirrors `itemFloorplanMoveTarget`,
 * because shelf is a `position`-field kind (it carries its location in
 * `node.position`, not in polygon vertices):
 *
 *   - Each pointermove previews through `useLiveNodeOverrides`.
 *   - On commit, the final position is written once as one undoable step.
 */
export declare const shelfFloorplanMoveTarget: FloorplanMoveTarget<ShelfNode>;
//# sourceMappingURL=floorplan-move.d.ts.map
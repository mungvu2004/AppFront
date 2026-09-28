import { type FenceNode, type FloorplanMoveTarget } from '@pascal-app/core';
/**
 * 2D floor-plan body move for fence. Mirrors `wallFloorplanMoveTarget`
 * but without bridge-wall planning: fence corners cascade through
 * shared endpoints, ALT detaches them, and there's no perpendicular
 * branch logic to chase. Tick publishes endpoint overrides; commit
 * folds them into a single tracked update.
 */
export declare const fenceFloorplanMoveTarget: FloorplanMoveTarget<FenceNode>;
//# sourceMappingURL=floorplan-move.d.ts.map
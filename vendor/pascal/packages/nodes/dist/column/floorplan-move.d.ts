import { type ColumnNode, type FloorplanMoveTarget } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for column. Columns need the same footprint-edge
 * alignment as shelf / item, but they must preview through live transforms and
 * commit once on release so the overlay does not churn the scene store on
 * every pointermove.
 *
 * Column stores rotation as a scalar (not a tuple); position is `[x, y, z]`.
 */
export declare const columnFloorplanMoveTarget: FloorplanMoveTarget<ColumnNode>;
//# sourceMappingURL=floorplan-move.d.ts.map
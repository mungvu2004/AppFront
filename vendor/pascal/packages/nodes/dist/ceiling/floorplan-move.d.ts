import { type CeilingNode, type FloorplanMoveTarget } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for ceiling. Delegates to the shared polygon
 * centroid-pivot mover (same pivot semantics as slab / items). See
 * `shared/polygon-centroid-move.ts` for the rationale.
 *
 * `meshY = resolved height − 0.01`: `CeilingSystem` parks the ceiling group
 * at that Y on rebuild, so mirroring it during the drag avoids a vertical
 * teleport in split view.
 */
export declare const ceilingFloorplanMoveTarget: FloorplanMoveTarget<CeilingNode>;
//# sourceMappingURL=floorplan-move.d.ts.map
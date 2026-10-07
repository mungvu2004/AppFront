import { type AnyNode, type AnyNodeId, type CeilingNode, type FloorplanMoveTarget, type ItemNode } from '@pascal-app/core';
export declare const itemFloorplanMoveTarget: FloorplanMoveTarget<ItemNode>;
/**
 * Walk every ceiling under the level and return the first one whose
 * polygon contains the pointer. Holes are honoured — a point inside a
 * hole counts as not inside the surface. Slabs are intentionally NOT a
 * valid target: floor items are parented to the level, not the slab,
 * because slabs don't carry a `children` field on their schema.
 */
export declare function findContainingSurface(point: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>, parentLevelId: AnyNodeId | null, targetKind: 'ceiling'): CeilingNode | null;
//# sourceMappingURL=floorplan-move.d.ts.map
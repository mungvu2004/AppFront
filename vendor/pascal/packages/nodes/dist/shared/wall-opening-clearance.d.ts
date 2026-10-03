import type { AnyNode, AnyNodeId, WallNode } from '@pascal-app/core';
export type WallOpeningClearance = {
    bottom: number;
    id: AnyNodeId;
    kind: 'door' | 'window';
    left: number;
    right: number;
    top: number;
};
export declare function wallOpeningClearances(wall: WallNode, nodes: Readonly<Record<AnyNodeId, AnyNode>>): WallOpeningClearance[];
export declare function findWallOpeningConflicts({ bottom, height, localX, nodes, wall, width, }: {
    bottom: number;
    height: number;
    localX: number;
    nodes: Readonly<Record<AnyNodeId, AnyNode>>;
    wall: WallNode;
    width: number;
}): AnyNodeId[];
//# sourceMappingURL=wall-opening-clearance.d.ts.map
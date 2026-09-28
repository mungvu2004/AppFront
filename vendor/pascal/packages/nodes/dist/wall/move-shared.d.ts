import { type AnyNodeId, useScene, type WallMoveBridgePlan, type WallNode, type WallPlanPoint } from '@pascal-app/core';
export declare function samePoint(a: WallPlanPoint, b: WallPlanPoint): boolean;
export declare function stripWallIsNewMetadata(meta: WallNode['metadata']): WallNode['metadata'];
export type LinkedWallSnapshot = WallNode;
/**
 * Walls in the same level that share an endpoint with the moving wall,
 * plus walls one hop further out that share an endpoint with a
 * directly-linked wall — needed so the junction planner can resolve
 * pivot-point context when a same-direction wall is consumed.
 */
export declare function getLinkedWallSnapshots(args: {
    wallId: WallNode['id'];
    wallParentId: string | null;
    originalStart: WallPlanPoint;
    originalEnd: WallPlanPoint;
}): LinkedWallSnapshot[];
export declare function getWallGhostColor(wall: WallNode): string;
export declare function getWallsAfterUpdates(nodes: ReturnType<typeof useScene.getState>['nodes'], updates: Array<{
    id: AnyNodeId;
    data: Partial<WallNode>;
}>): WallNode[];
export declare function buildBridgeWallCreates(args: {
    bridgePlans: Array<WallMoveBridgePlan<LinkedWallSnapshot>>;
    nextStart: WallPlanPoint;
    nextEnd: WallPlanPoint;
    existingWalls: WallNode[];
    wallCount: number;
}): Array<{
    node: WallNode;
    parentId?: AnyNodeId;
}>;
export type GhostWallPreview = {
    id: string;
    start: WallPlanPoint;
    end: WallPlanPoint;
    color: string;
    height: number;
};
export declare function buildBridgeWallPreviews(args: {
    bridgePlans: Array<WallMoveBridgePlan<LinkedWallSnapshot>>;
    nextStart: WallPlanPoint;
    nextEnd: WallPlanPoint;
    existingWalls: WallNode[];
}): Array<{
    ghost: GhostWallPreview;
    wall: WallNode;
}>;
//# sourceMappingURL=move-shared.d.ts.map
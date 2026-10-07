import { type AlignmentAnchor, type AnyNodeId, type DragAction, type FenceNode, type WallNode } from '@pascal-app/core';
import { type FencePlanPoint } from '@pascal-app/editor';
type LinkedFenceSnapshot = {
    id: FenceNode['id'];
    start: FencePlanPoint;
    end: FencePlanPoint;
};
export type MoveFenceEndpointCtx = {
    fenceId: AnyNodeId;
    endpoint: 'start' | 'end';
    originalStart: FencePlanPoint;
    originalEnd: FencePlanPoint;
    originalMovingPoint: FencePlanPoint;
    fixedPoint: FencePlanPoint;
    parentId: string | null;
    linkedOriginals: LinkedFenceSnapshot[];
    levelWalls: WallNode[];
    levelFences: FenceNode[];
    /** Alignment anchors (endpoints + midpoints) of every OTHER wall / fence on
     *  the level (building-local), feeding the resolver. */
    alignCandidates: AlignmentAnchor[];
};
export type MoveFenceEndpointDraft = {
    movingPoint: FencePlanPoint;
    start: FencePlanPoint;
    end: FencePlanPoint;
    linkedUpdates: LinkedFenceSnapshot[];
    detached: boolean;
};
export declare const moveFenceEndpointDragAction: DragAction<MoveFenceEndpointCtx, MoveFenceEndpointDraft>;
export {};
//# sourceMappingURL=move-endpoint.d.ts.map
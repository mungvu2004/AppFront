import type { WallNode } from '../../schema/index.js';
export type WallPlanPoint = [number, number];
export type WallMoveAxis = [number, number];
export type WallMoveEndpoint = 'start' | 'end';
export type WallMoveBridgePlan<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>> = {
    wall: TWall;
    originalPoint: WallPlanPoint;
    movedEndpoint: WallMoveEndpoint;
};
export type WallMoveLinkedWallTargetPlan<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>> = {
    wall: TWall;
    originalPoint: WallPlanPoint;
    targetPoint: WallPlanPoint;
};
export type WallMoveJunctionPlan<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>> = {
    linkedWallsToMove: TWall[];
    linkedWallTargetPlans: Array<WallMoveLinkedWallTargetPlan<TWall>>;
    bridgePlans: Array<WallMoveBridgePlan<TWall>>;
    wallsToDelete: TWall[];
};
export declare function getPerpendicularWallMoveAxis(start: WallPlanPoint, end: WallPlanPoint): WallMoveAxis | null;
export declare function constrainWallMoveDeltaToAxis(deltaX: number, deltaZ: number, axis: WallMoveAxis | null): WallPlanPoint;
/**
 * Apply a junction plan to a list of linked walls, producing the per-wall
 * endpoint updates. Mirrors the 3D `MoveWallTool`'s drag-preview behavior
 * so the 2D move handler can drive the same scene topology.
 *
 * `linkedWallTargetPlans` take precedence over `linkedWallsToMove` — when
 * the planner emits a target plan for a same-direction-consumed wall the
 * matchPoint/targetPoint pair encodes the pivot, not the original ↔ next
 * endpoint mapping.
 */
export declare function getLinkedWallUpdates<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>>(linkedWalls: Array<{
    wall: TWall;
    matchPoint?: WallPlanPoint;
    targetPoint?: WallPlanPoint;
}>, originalStart: WallPlanPoint, originalEnd: WallPlanPoint, nextStart: WallPlanPoint, nextEnd: WallPlanPoint): Array<{
    id: TWall['id'];
    start: WallPlanPoint;
    end: WallPlanPoint;
}>;
export declare function getPlannedLinkedWallUpdates<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>>(plan: WallMoveJunctionPlan<TWall>, originalStart: WallPlanPoint, originalEnd: WallPlanPoint, nextStart: WallPlanPoint, nextEnd: WallPlanPoint): Array<{
    id: TWall['id'];
    start: WallPlanPoint;
    end: WallPlanPoint;
}>;
export declare function planWallMoveJunctions<TWall extends Pick<WallNode, 'id' | 'start' | 'end'>>(linkedWalls: TWall[], originalStart: WallPlanPoint, originalEnd: WallPlanPoint, nextStart: WallPlanPoint, nextEnd: WallPlanPoint): WallMoveJunctionPlan<TWall>;
//# sourceMappingURL=wall-move.d.ts.map
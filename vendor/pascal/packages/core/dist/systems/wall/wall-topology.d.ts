import { type AnyNode, type AnyNodeId, type WallNode } from '../../schema/index.js';
import type { WallPlanPoint } from './wall-move.js';
export type WallTopologyChanges = {
    create: Array<{
        node: AnyNode;
        parentId?: AnyNodeId;
    }>;
    update: Array<{
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }>;
    delete: AnyNodeId[];
};
export type WallInsertionPlan = {
    changes: WallTopologyChanges;
    insertedWalls: WallNode[];
    terminalWallId: WallNode['id'];
    resolvedStart: WallPlanPoint;
    resolvedEnd: WallPlanPoint;
};
export type WallTopologyRejection = {
    ok: false;
    reason: 'covered-existing-wall' | 'segment-too-short';
};
export type WallInsertionResult = {
    ok: true;
    plan: WallInsertionPlan;
} | WallTopologyRejection;
export type WallPointSplitPlan = {
    changes: WallTopologyChanges;
    point: WallPlanPoint;
};
export type WallPointSplitResult = {
    ok: true;
    plan: WallPointSplitPlan;
} | {
    ok: false;
    reason: 'no-host';
};
/**
 * The parts of `start→end` that no straight wall already runs along, in order.
 * A side drawn along an existing wall and past its end yields the overhang
 * only, so the existing wall is reused instead of doubled. Gaps too short to
 * be a wall are treated as covered.
 */
export declare function uncoveredWallSegments(start: WallPlanPoint, end: WallPlanPoint, walls: WallNode[]): Array<[WallPlanPoint, WallPlanPoint]>;
export declare function planWallSplitAtPoint(nodes: Record<AnyNodeId, AnyNode>, args: {
    levelId: AnyNodeId | null;
    point: WallPlanPoint;
    radius: number;
    ignoreWallIds?: readonly string[];
}): WallPointSplitResult;
export declare function planWallInsertion(nodes: Record<AnyNodeId, AnyNode>, args: {
    levelId: AnyNodeId;
    start: WallPlanPoint;
    end: WallPlanPoint;
    joinRadius: number;
    wallDefaults?: Partial<WallNode>;
}): WallInsertionResult;
//# sourceMappingURL=wall-topology.d.ts.map
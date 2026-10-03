import type { AnyNode, AnyNodeId, WallNode } from '../../schema/index.js';
import type { WallPlanPoint } from './wall-move.js';
import { type WallTopologyChanges } from './wall-topology.js';
export declare function wallRectangleCorners(a: WallPlanPoint, b: WallPlanPoint): WallPlanPoint[];
/** Plan against a scratch graph so four sides commit atomically, including junction splits. */
export declare function planWallRectangle(nodes: Record<AnyNodeId, AnyNode>, args: {
    levelId: AnyNodeId;
    start: WallPlanPoint;
    end: WallPlanPoint;
    wallDefaults?: Partial<WallNode>;
}): {
    changes: WallTopologyChanges;
    walls: WallNode[];
};
/** Explicit split keeps the first wall's identity and reuses the junction planner's host migration. */
export declare function planWallDivision(nodes: Record<AnyNodeId, AnyNode>, wallId: WallNode['id'], distance: number): {
    changes: WallTopologyChanges;
    point: WallPlanPoint;
};
/**
 * Several cuts as one edit. Cutting farthest first keeps the first wall's
 * identity at every step, so the nearer distances stay valid on it.
 */
export declare function planWallDivisions(nodes: Record<AnyNodeId, AnyNode>, wallId: WallNode['id'], distances: readonly number[]): {
    changes: WallTopologyChanges;
    points: WallPlanPoint[];
};
//# sourceMappingURL=wall-operations.d.ts.map
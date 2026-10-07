import { type AnyNode, type AnyNodeId } from '../../schema/index.js';
import type { SceneState } from '../use-scene.js';
type NodeCreateOp = {
    node: AnyNode;
    parentId?: AnyNodeId;
};
type NodeUpdateOp = {
    id: AnyNodeId;
    data: Partial<AnyNode>;
};
type NodeDeleteOp = AnyNodeId;
type NumericSanitizeIssue = {
    path: PropertyKey[];
    from: number;
    to?: number;
    action: 'clamped' | 'dropped' | 'rounded';
};
export declare function numericSanitizeIssuesToMessage(issues: NumericSanitizeIssue[] | null | undefined): string;
declare const createNodesActionImpl: (set: (fn: (state: SceneState) => Partial<SceneState>) => void, get: () => SceneState, ops: NodeCreateOp[]) => void;
declare const applyNodeChangesActionImpl: (set: (fn: (state: SceneState) => Partial<SceneState>) => void, get: () => SceneState, changes: {
    create?: NodeCreateOp[];
    update?: NodeUpdateOp[];
    delete?: NodeDeleteOp[];
}) => void;
declare const updateNodesActionImpl: (set: (fn: (state: SceneState) => Partial<SceneState>) => void, get: () => SceneState, updates: {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[]) => void;
/** The scene record a node deletion reads and rewrites. */
export type NodeDeletionScene = Pick<SceneState, 'nodes' | 'rootNodeIds' | 'collections'>;
/** What deleting `ids` does to a scene, before anything is committed. */
export type NodeDeletionPlan = NodeDeletionScene & {
    /** Every removed id: the requested ids, their subtrees, kind cascades, merged-away walls. */
    deletedIds: Set<AnyNodeId>;
    parentsToMarkDirty: Set<AnyNodeId>;
    nodesToMarkDirty: Set<AnyNodeId>;
    /** Preview only: existing default gutters and downspouts the refresh may keep or replace. */
    unsettledIds: Set<AnyNodeId>;
    /** Preview only: roof segments whose `children` the refresh rewrites. */
    regeneratedHostIds: Set<AnyNodeId>;
};
/**
 * The delete store action's planner, without committing: the requested ids,
 * their `children` subtrees and kind `onDeleteCascade` companions, collinear
 * walls merged across a deleted junction, neighbour patches, support and unit
 * cleanup, and the default gutter and downspout refresh.
 *
 * The refresh mints gutters, downspouts and outlets with random ids, and which
 * existing defaults it keeps can depend on them. With `mintDefaults: false`
 * (a preview, such as the MCP patch dry run) the refresh does not run: the
 * existing defaults it would touch are listed in `unsettledIds`, and the plan
 * is deterministic and equals the commit for every other existing id. The
 * delete action mints.
 */
export declare function planNodeDeletion(scene: NodeDeletionScene, ids: AnyNodeId[], { mintDefaults }?: {
    mintDefaults?: boolean;
}): NodeDeletionPlan;
declare const deleteNodesActionImpl: (set: (fn: (state: SceneState) => Partial<SceneState>) => void, get: () => SceneState, ids: AnyNodeId[]) => void;
export declare const createNodesAction: (set: Parameters<typeof createNodesActionImpl>[0], get: Parameters<typeof createNodesActionImpl>[1], ops: NodeCreateOp[]) => void;
export declare const applyNodeChangesAction: (set: Parameters<typeof applyNodeChangesActionImpl>[0], get: Parameters<typeof applyNodeChangesActionImpl>[1], changes: Parameters<typeof applyNodeChangesActionImpl>[2]) => void;
export declare const updateNodesAction: (set: Parameters<typeof updateNodesActionImpl>[0], get: Parameters<typeof updateNodesActionImpl>[1], updates: Parameters<typeof updateNodesActionImpl>[2]) => void;
export declare const deleteNodesAction: (set: Parameters<typeof deleteNodesActionImpl>[0], get: Parameters<typeof deleteNodesActionImpl>[1], ids: AnyNodeId[]) => void;
/**
 * What the default gutter refresh of `roofIds` would touch, without running
 * it: the existing default gutters and downspouts it may keep or replace, and
 * the roof segments whose `children` it rewrites. For previews of edits that
 * trigger the refresh (a roof segment update, a delete).
 */
export declare function previewDefaultGutterRefresh(nodes: Record<AnyNodeId, AnyNode>, roofIds: Iterable<AnyNodeId>): {
    unsettledIds: Set<AnyNodeId>;
    regeneratedHostIds: Set<AnyNodeId>;
};
export {};
//# sourceMappingURL=node-actions.d.ts.map
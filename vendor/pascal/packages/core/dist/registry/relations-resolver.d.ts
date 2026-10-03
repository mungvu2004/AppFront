import type { AnyNode, AnyNodeId } from '../schema/types.js';
import type { SceneApi } from './types.js';
/**
 * Spatial neighbor query — given a node and a set of kinds, returns IDs of
 * neighboring nodes of those kinds. The runtime provides this from
 * `spatialGridManager`; tests can pass a stub.
 */
export type SpatialQuery = (node: AnyNode, kinds: readonly string[]) => Iterable<AnyNodeId>;
/**
 * Returns the IDs of nodes that share `node` as a parent. The runtime can
 * pass an optimized index; the default fallback iterates the scene.
 */
export type ChildQuery = (node: AnyNode) => Iterable<AnyNodeId>;
export type CascadeContext = {
    scene: SceneApi;
    /** Optional: bounded spatial neighbor lookup. Required for `affectsSpatial`. */
    spatialQuery?: SpatialQuery;
    /** Optional: children-by-parent lookup. Defaults to iterating the scene. */
    childQuery?: ChildQuery;
    /** Safety cap on cascade depth — guards against bad data and pathological
     * registry configurations. Default 16 (deeper than the maxHostDepth of 6). */
    maxDepth?: number;
};
/**
 * Walks the relations graph from one dirty node and returns the full set of
 * IDs (including the starting one) that should be marked dirty. Pure — does
 * NOT call `scene.markDirty`; callers iterate the result.
 *
 * Phase 1 implements:
 * - `hosts`: marks children whose `type` matches the kind list
 * - `affectsSpatial`: marks neighbors found via `spatialQuery`
 *
 * Phase 3 will add `linkedBy: 'endpoint-match'` for wall corner propagation.
 */
export declare function cascadeDirty(startId: AnyNodeId, ctx: CascadeContext): Set<AnyNodeId>;
/**
 * Recursively collects every descendant of a node, plus the node itself.
 * Used by `cascadeDelete: 'descendants'` and by tools that need to delete a
 * subtree atomically. Independent of dirty-marking — pure traversal.
 */
export declare function collectDescendants(startId: AnyNodeId, ctx: Pick<CascadeContext, 'scene' | 'childQuery' | 'maxDepth'>): Set<AnyNodeId>;
//# sourceMappingURL=relations-resolver.d.ts.map
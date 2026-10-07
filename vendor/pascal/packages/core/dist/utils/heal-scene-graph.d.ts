export interface HealSceneResult {
    nodes: Record<string, unknown>;
    /** Ids of zero-length walls that were dropped. */
    droppedWallIds: string[];
    /** Count of invalid non-string (e.g. null) entries removed from `children` arrays. */
    strippedChildRefs: number;
    /**
     * Count of child references removed because the child's `parentId` points at
     * a different node (stale reparent leftovers), plus same-array duplicates.
     */
    strippedStaleChildRefs: number;
    /**
     * Ids of nodes whose null `parentId` was repaired to the one parent that
     * still claims them via `children`.
     */
    repairedParentLinkNodeIds: string[];
}
/**
 * Returns a healed copy of a `nodes` map. Pure — does not mutate `input`.
 * Nodes that need no repair are passed through by reference.
 */
export declare function healSceneNodes(input: Record<string, unknown>): HealSceneResult;
//# sourceMappingURL=heal-scene-graph.d.ts.map
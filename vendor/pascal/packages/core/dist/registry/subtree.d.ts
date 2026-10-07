import type { AnyNode, AnyNodeId } from '../schema/types.js';
/** A flat live-scene subtree rooted at `root`. */
export type Subtree = {
    /** The root node, exactly as stored in `useScene.nodes[rootId]`. */
    root: AnyNode;
    /** Every descendant reachable from `root` via the data-model `children` array, in BFS order. */
    descendants: AnyNode[];
};
/**
 * Collect the subtree of nodes rooted at `rootId` from the live scene.
 *
 * - BFS walk via `node.children` arrays — order is stable and matches
 *   declaration order on container kinds.
 * - Returns the live node references (not clones). Cheap; the caller
 *   chooses whether to deep-clone for persistence.
 * - Returns `null` if `rootId` is missing.
 */
export declare function collectSubtree(nodes: Readonly<Record<AnyNodeId, AnyNode>>, rootId: AnyNodeId): Subtree | null;
export type CloneNodesIntoOptions = {
    /**
     * The id of the root node within `nodes` (i.e. the node whose
     * `parentId` becomes `parentId` in the destination instead of being
     * remapped to a sibling's fresh id). Required because `nodes` is a
     * flat array — there's no other way to mark which one is the root.
     */
    rootId: AnyNodeId;
    /**
     * Parent for the cloned root in the destination scene. When omitted,
     * the root is inserted as a scene root (its `parentId` becomes the
     * preserved value, often `null`).
     */
    parentId?: AnyNodeId;
    /**
     * Optional override for the cloned root's `position` (most placement
     * flows stamp the cursor / target point here). When omitted, the
     * root's own `position` field is preserved verbatim. Descendants
     * always keep their original positions — those are local to the root.
     */
    position?: readonly [number, number, number];
};
export type CloneNodesIntoResult = {
    /** Fresh id assigned to the root in the destination scene. */
    rootId: AnyNodeId;
    /** Every cloned node, root first, ready to feed into `createNodes`. */
    nodes: AnyNode[];
    /** Original id → fresh id map, mostly useful for tests and host-side bookkeeping. */
    idMap: Map<AnyNodeId, AnyNodeId>;
};
/**
 * Clone a flat array of nodes with fresh IDs and rewired references,
 * ready to insert via `useScene.createNodes`.
 *
 * Transformations applied:
 *   1. Deep-clone each node via JSON round-trip (strips three.js refs,
 *      functions, circular links — same trick `cloneLevelSubtree` uses).
 *   2. Mint a fresh id for every node, preserving the prefix
 *      (`wall_…`, `door_…`, etc.) so logs and lookups stay readable.
 *   3. Rewrite `parentId`, `children[]` to use the fresh ids.
 *   4. Stamp `position` onto the root if provided.
 *   5. Set the root's `parentId` to `opts.parentId` when supplied.
 *
 * Intentionally generic — no awareness of host refs (`wallId`/`wallT`
 * etc.). The caller is responsible for stripping or re-deriving those
 * before / after calling this function. See `getHostRefFields(def)`.
 */
export declare function cloneNodesInto(nodes: ReadonlyArray<AnyNode>, opts: CloneNodesIntoOptions): CloneNodesIntoResult;
/**
 * A deep copy of `node` as a preset stores it, without its source identity
 * (D5): the whole `provenance` (refs and lineage) and every other source
 * reference the inventory strips on preset. A placed preset is a new element,
 * so it must never claim the source elements of the node it was saved from.
 * Host references stay the host's call (`getHostRefFields`).
 */
export declare function withoutSourceIdentity<T extends AnyNode>(node: T): T;
//# sourceMappingURL=subtree.d.ts.map
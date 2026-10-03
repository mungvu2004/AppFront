import { type AnyNode, type AnyNodeId, type SurfaceRejectReason } from '@pascal-app/core';
export declare function duplicatesAsFreshSubtree(node: AnyNode): boolean;
/**
 * Prepares a non-subtree duplicate without retaining ownership of the
 * original node's children. Subtree-capable kinds take the path above and
 * receive fresh descendant IDs; every other kind duplicates only its root.
 */
export declare function prepareFreshPlacementRootDuplicate(node: AnyNode): AnyNode;
/**
 * Creates a fresh draft copy of a live subtree, with every child reference
 * rewired before move mode starts.
 */
export declare function createFreshPlacementSubtree(rootId: AnyNodeId, rootPatch?: Partial<AnyNode>): AnyNodeId | null;
export declare function discardFreshPlacementSubtree(rootId: AnyNodeId): void;
/**
 * Replace the draft in one validated write. History already excludes fresh
 * subtrees, so this records one creation without first deleting the preview.
 */
export declare function commitFreshPlacementSubtree(rootId: AnyNodeId, rootPatch: Partial<AnyNode>, onReject?: (reason: SurfaceRejectReason) => void): AnyNodeId | null;
//# sourceMappingURL=fresh-planar-placement.d.ts.map
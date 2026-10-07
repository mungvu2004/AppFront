import type { BatchCandidate } from './types';
/**
 * Candidate collection + source hide/reveal for node batching. Counterpart of
 * the wall batch's `toCandidate` (../../wall/wall-batch-system.tsx), walking
 * each node's mounted subtree instead of a single wall mesh.
 */
/** Kinds the batch system manages. Walls keep their merged-geometry batch. */
export declare const BATCH_KINDS: ReadonlySet<string>;
export declare function collectBatchCandidate(nodeId: string): BatchCandidate | null;
export declare function hideBatchedNode(candidate: BatchCandidate): void;
/**
 * Belt-and-braces reveal: drops the 'batched' hold from EVERY mesh under
 * every level root. Per-node reveals track the meshes they hid, but a system
 * can rebuild a node's children while it is batched (swapping the tracked
 * refs), and a stale ref means a mesh stays off the scene layer — which the
 * GLB exporter prunes. `showInScene` is a no-op on unheld meshes, so the
 * sweep is safe; it runs only on the rare release-everything paths (capture,
 * appearance switches, isolation).
 */
export declare function revealAllBatchedHolds(): void;
export declare function revealBatchedNode(nodeId: string): void;
/**
 * Nodes the viewer is lighting up — plus hosted openings whose host wall is
 * lit or mid-gesture: a dragged wall carries its doors with it through live
 * overrides, and a batched copy would stay behind until commit.
 */
export declare function collectTintedNodes(nodeIds: ReadonlySet<string>): Set<string>;
export declare function getBatchableNodeIds(): ReadonlySet<string>;
//# sourceMappingURL=candidates.d.ts.map
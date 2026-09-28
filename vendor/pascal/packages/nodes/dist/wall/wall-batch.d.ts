import * as THREE from 'three';
/** A contiguous vertex range one wall contributes to one material run. */
export type WallBatchSlice = {
    nodeId: string;
    start: number;
    count: number;
};
/** Every triangle drawn with one material index, in wall order. */
export type WallBatchRun = {
    materialIndex: number;
    start: number;
    count: number;
    slices: WallBatchSlice[];
};
export type WallBatchSource = {
    nodeId: string;
    geometry: THREE.BufferGeometry;
    /** Source-local to batch-root transform, baked into the merged vertices. */
    matrix: THREE.Matrix4;
};
export type WallBatch = {
    geometry: THREE.BufferGeometry;
    runs: WallBatchRun[];
};
/**
 * Concatenates wall geometries into one buffer laid out material-major,
 * wall-minor: every triangle sharing a material index ends up in a single
 * contiguous run, so the merged mesh costs one draw call per material
 * instead of one per wall per material.
 *
 * Vertices are baked into the batch root's frame, so the merged mesh needs
 * no transform of its own. Each wall's slice of every run is recorded, which
 * is what lets a single wall be pulled back out later without touching the
 * buffers — see `applyWallBatchGroups`.
 *
 * Sources must be non-indexed (the wall pipeline's `applyWorldPlanarWallUVs`
 * already de-indexes) and are skipped if they carry no positions.
 */
export declare function buildWallBatch(sources: readonly WallBatchSource[]): WallBatch | null;
/**
 * Rewrites the merged geometry's draw groups so the listed walls are skipped.
 *
 * Pulling a wall out of the batch is what happens while it is being dragged:
 * it goes back to drawing itself, and the merged mesh has to stop drawing it
 * or the two would overlap. Because each wall owns a contiguous slice of each
 * run, skipping it is a matter of splitting that run around the hole — no
 * vertex data moves and nothing is re-uploaded to the GPU, so a drag costs a
 * handful of group objects rather than a rebuild of the floor.
 *
 * Each hidden wall adds at most one extra group (one extra draw call) per run,
 * so callers should re-merge once the holes stop being temporary.
 */
export declare function applyWallBatchGroups(batch: WallBatch, hidden: ReadonlySet<string>): void;
/**
 * Silences a wall the batch now draws.
 *
 * Emptying the draw range is not enough — three.js still submits a zero-count
 * group, so 1000 muted walls cost 1000 draw calls. `visible = false` would
 * cost nothing but takes the wall's children (cutters, treatments) down with
 * it. Moving the mesh alone off the scene layer skips it in every pass while
 * its subtree keeps rendering and picking.
 */
export declare function hideBatchedWall(mesh: THREE.Object3D): void;
/** Hands a wall back its own draw call — unless solo or isolation still hide it. */
export declare function revealBatchedWall(mesh: THREE.Object3D): void;
//# sourceMappingURL=wall-batch.d.ts.map
export type PerfTrackLine = {
    name: string;
    totalMs: number;
    count: number;
    maxMs: number;
};
export type PerfStats = {
    fps: number;
    frameMs: number;
    frameMaxMs: number;
    encodeMs: number;
    encodeMaxMs: number;
    gpuMs: number;
    gpuMaxMs: number;
    gpuTracked: boolean;
    queueMs: number;
    queueMaxMs: number;
    drawCalls: number;
    triangles: number;
    batch: PerfBatchStats;
    dirty: number;
    dirtyDetail: string;
    geometries: number;
    textures: number;
    gpuBytes: number;
    heapBytes: number;
    meshes: number;
    lines: number;
    sprites: number;
    lights: number;
    tracks: PerfTrackLine[];
};
export declare function publishPerfStats(stats: PerfStats): void;
export declare function usePerfStats(): PerfStats | null;
/**
 * Batch membership, published by the batch systems themselves (the panel's
 * collector cannot read their stores across packages). Stable truth — items
 * and instances currently drawn through batch containers — unlike the
 * per-pass `_multiDrawCount`, which snapshots whichever camera (main, shadow,
 * outline) culled the batch last and flips between passes. On WebGPU each
 * batched instance still counts once in `drawCalls` (the backend loops
 * drawIndexed per visible instance), so without this row a batched scene
 * looks no cheaper than an unbatched one — the saving is encode cost per
 * call, not call count.
 */
export type PerfBatchStats = {
    items: number;
    instances: number;
    containers: number;
    releases?: number;
    joins?: number;
    geometryReplacements?: number;
    overflowRebuilds?: number;
    wallDrain?: {
        initialBuildActive: boolean;
        wallsConsumedThisFrame: number;
        budgetExits: number;
        heavyExits: number;
        drainedExits: number;
        capExits: number;
        pendingNeighbours: number;
        firstBuilds: number;
        reinvalidationBuilds: number;
        neighbourEnqueues: number;
    };
    geometryBytesCopied?: number;
};
export declare function publishPerfBatchStats(stats: Partial<PerfBatchStats>): void;
export declare function publishPerfWallDrainStats(stats: NonNullable<PerfBatchStats['wallDrain']>): void;
export declare function readPerfBatchStats(): PerfBatchStats;
//# sourceMappingURL=perf-panel-store.d.ts.map
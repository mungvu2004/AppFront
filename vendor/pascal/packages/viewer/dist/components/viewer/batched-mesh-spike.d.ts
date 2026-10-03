/**
 * De-risk spike for item instancing (charter backlog #3a): mounts one
 * BatchedMesh — two geometries, a few hundred instances, one material —
 * through the real render pipeline (post-FX, shadow pass, WebGPU backend).
 * `?spike=batch` only; never mounted in normal sessions.
 *
 * What it proves, read via the ?perf panel + `window.__batchSpike`:
 * - DRAW rises by ~1 per pass, not by the instance count.
 * - TRI drops as instances leave the frustum (perObjectFrustumCulled works).
 * - Shadows cast/receive; no pipeline crash.
 */
export declare const BATCH_SPIKE_ENABLED: boolean;
export declare const BatchedMeshSpike: () => null;
//# sourceMappingURL=batched-mesh-spike.d.ts.map
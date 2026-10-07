import { type ChimneyNode, type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Carve the top openings the chimney needs:
 *   - smoke shaft cavity in the body (one chimney-wide hole, or one
 *     bore per flue when the flues are hollow)
 *   - matching holes punched through the cap
 *   - inner bore subtracted from each flue tube
 *
 * Mirrors the v1 roof-system pipeline. Lives next to `roof-trim.ts` so
 * the CSG deps (three-bvh-csg / three-mesh-bvh) stay inside the
 * chimney folder; `geometry.ts` itself stays pure.
 */
export declare function carveChimneyHoles(body: THREE.BufferGeometry, cap: THREE.BufferGeometry | null, flues: THREE.BufferGeometry | null, node: ChimneyNode, segment: RoofSegmentNode): {
    body: THREE.BufferGeometry;
    cap: THREE.BufferGeometry | null;
    flues: THREE.BufferGeometry | null;
};
/**
 * Split the index buffer into two groups:
 *   - group 0: every triangle whose normal is NOT roughly up, or that
 *     sits below `topYMin`. Receives the body material.
 *   - group 1: the top face triangles. Receives the top material.
 *
 * Mirrors the v1 `partitionTopFaceGroups` in
 * `packages/viewer/src/systems/chimney/chimney-geometry.ts`. Operates in
 * place — the geometry is re-indexed and its `groups` array rewritten.
 */
export declare function partitionTopFaceGroups(geo: THREE.BufferGeometry, topYMin: number): void;
//# sourceMappingURL=holes.d.ts.map
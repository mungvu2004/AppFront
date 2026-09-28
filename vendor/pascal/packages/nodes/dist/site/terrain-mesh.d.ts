import type { HeightPatch, TerrainField } from '@pascal-app/core';
import { BufferGeometry } from 'three';
import { type TerrainMeshBuffers, type TerrainSkirtBuffers } from './terrain-geometry';
/**
 * The Three.js side of the terrain heightfield: owns the `BufferGeometry` and the
 * dirty-rect upload.
 *
 * Kept beside the pure builder rather than in `viewer` because the dependency
 * runs `nodes -> viewer`, not the other way, and this is a per-kind concern
 * anyway. `terrain-geometry.ts` computes *what* goes in the buffers (testable
 * without a canvas); this owns the GPU resource. The only thing that cannot live
 * on the pure side is `addUpdateRange`/`needsUpdate`, which is why this file is
 * thin.
 *
 * Why patch instead of rebuild: a 129² field is 16 641 vertices, so a full
 * re-upload is ~400 KB per dab. There is no render-on-demand to hide behind —
 * `FrameLimiter` runs a perpetual rAF at 50 FPS — so a brush dragged across a
 * slope would re-upload the whole field dozens of times a second.
 */
/** A terrain geometry plus the CPU buffers backing it. */
export type TerrainGeometry = {
    readonly geometry: BufferGeometry;
    readonly buffers: TerrainMeshBuffers;
    /** Expands during live edits; a committed-field rebuild tightens it again. */
    readonly heightBounds: {
        minY: number;
        maxY: number;
    };
    /** The edge curtain that closes the field against the horizon disc. */
    readonly skirt: {
        readonly geometry: BufferGeometry;
        readonly buffers: TerrainSkirtBuffers;
    };
};
export declare function createTerrainGeometry(field: TerrainField): TerrainGeometry;
/**
 * Push one patch to the GPU, touching only the affected rows.
 *
 * Both `position` and `normal` are updated: a height change moves its
 * neighbours' normals too, and `patchUpdateRange` already widens the span by one
 * row on each side to cover that. UVs are never touched — they are a function of
 * grid indices, not heights.
 */
export declare function applyTerrainPatch(target: TerrainGeometry, field: TerrainField, patch: HeightPatch): void;
/**
 * True when a geometry was built for a differently-shaped field.
 *
 * A resized field cannot be patched — the vertex count changed — so the caller
 * must rebuild. Checking here keeps that decision in one place instead of every
 * caller comparing `cols`/`rows` by hand.
 */
export declare function needsRebuild(target: TerrainGeometry, field: TerrainField): boolean;
export declare function disposeTerrainGeometry(target: TerrainGeometry): void;
//# sourceMappingURL=terrain-mesh.d.ts.map
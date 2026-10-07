/**
 * VECTOR EDGES FROM THE VIEWER — the elevation's lines taken from the same
 * meshes the picture is rendered from, with hidden-line removal.
 *
 * A drawing built from a second model of the house (a plugin's section solids)
 * never quite matches the render: its roof sat on the plate plane while the
 * 3D roof stacks a deck and shingles on it, its door was the opening while
 * the render showed the leaf. This is how Revit and Chief Architect avoid
 * that — ONE model, the view's lines derived from it:
 *
 *   1. every visible mesh's FEATURE EDGES (creases over `thresholdDeg`,
 *      boundaries — three's EdgesGeometry, cached per geometry), carried
 *      to world space, instance by instance for InstancedMeshes;
 *   2. a DEPTH pass of the scene through the capture camera — view-space
 *      depth as a float colour, read back once;
 *   3. each edge projected through that camera and SAMPLED along its length
 *      against the depth buffer: a point deeper than what the buffer saw is
 *      behind something. The visible runs come back as world segments.
 *
 * Orthographic only (an elevation, a section): depth is linear across a face
 * so the interpolated edge depth is exact. Not a boolean operation — an
 * edge test, cheap enough to run at capture time.
 */
import * as THREE from 'three';
export type VisibleEdges = {
    /** World-space segments, six floats each: ax ay az bx by bz. */
    segments: Float32Array;
    count: number;
    /** How many candidate edges were tested, and the depth pass' size. */
    tested: number;
    width: number;
    height: number;
    ms: number;
    /** Whether the normal pass came back (without it every in-view edge is kept). */
    normals: boolean;
};
/**
 * Whether a material draws anything. `colorWrite: false` is how a pick-only
 * collider hides on the GPU (a plugin's utility-pole proxy, 0.5 × 10.7 m, once
 * drew a tall rectangle through the elevations, 2026-09-23 — the rule
 * glb-export's `isRenderableMesh` already follows).
 */
export declare function materialShows(material: THREE.Material | THREE.Material[]): boolean;
/**
 * The shown meshes whose own materials draw nothing — pick proxies, hit
 * boxes — hidden for the length of the buffer passes: under the passes'
 * override material they would write depth and hide the real edges behind
 * them. The returned function shows them again.
 */
export declare function hideUndrawnMeshes(scene: THREE.Object3D): () => void;
/**
 * Every drawn mesh's feature edges in world space, six floats per edge —
 * instance by instance for an InstancedMesh. What draws nothing (a hidden
 * mesh, a pick proxy, a layer the camera does not see) has no lines.
 */
export declare function candidateEdges(scene: THREE.Object3D, camera: THREE.Camera, thresholdDeg: number, maxTriangles: number): number[];
/**
 * The visible feature edges of `scene` through `camera` (orthographic), as
 * world segments. `width` sets the depth pass (a multiple of 16 keeps the
 * WebGPU readback rows unpadded); `height` follows the camera's aspect.
 */
export declare function extractVisibleEdges(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera, options?: {
    width?: number;
    thresholdDeg?: number;
    maxTriangles?: number;
    bias?: number;
}): Promise<VisibleEdges | null>;
//# sourceMappingURL=vector-edges.d.ts.map
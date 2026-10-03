import * as THREE from 'three';
/**
 * Rewrites a geometry's material groups so every material is drawn exactly once.
 *
 * A group is a contiguous slice of the index buffer, so a mesh whose triangles
 * alternate between materials pays a draw call per *run*, not per material.
 * Extruded walls hit this hard: `ExtrudeGeometry` emits the cap and side faces
 * interleaved, so run-length grouping produces four groups for two materials —
 * multiplied by a thousand walls, that is thousands of avoidable draw calls.
 * Bucketing the triangles by material first makes each material one run.
 *
 * The geometry gains an index buffer if it had none. Triangle winding, vertex
 * data and material assignment are untouched, so the rendered image is
 * unchanged; only the order in which the GPU is asked to draw it differs.
 */
export declare function setGroupsSortedByMaterial(geometry: THREE.BufferGeometry, triangleMaterials: ArrayLike<number>): void;
//# sourceMappingURL=geometry-groups.d.ts.map
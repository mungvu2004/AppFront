import { BufferGeometry } from 'three';
/**
 * Placeholder geometry for a mesh whose real geometry is filled in later by a
 * system (wall / roof / roof-segment / ceiling / stair-segment). These meshes
 * are mounted *visible*, so the WebGPU renderer draws them on the first
 * frame(s) before the owning system runs — and the system passes are
 * rate-limited, so several meshes can still hold the placeholder across
 * multiple frames.
 *
 * It carries three zero-vertices — a single degenerate, zero-area (invisible)
 * triangle — rather than an empty `position` attribute. An empty attribute
 * (count 0) makes three.js create no GPU buffer for it, so vertex buffer slot 0
 * is never bound and WebGPU rejects the draw with "Vertex buffer slot 0 … was
 * not set", which poisons the whole command encoder (cascading into "Invalid
 * CommandBuffer" on every queue submit). The zero normals and UVs keep lit
 * node-material pipelines from compiling additional required-but-unbound
 * vertex buffers. Three real vertices give it bound buffers; the `groupCount`
 * count-0 groups keep nothing drawn while matching the mesh's material-array
 * length so raycasts / BVH never index past the materials.
 */
export declare function createPlaceholderGeometry(groupCount?: number): BufferGeometry;
//# sourceMappingURL=placeholder-geometry.d.ts.map
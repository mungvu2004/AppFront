import * as THREE from 'three';
/** Replace every InstancedMesh with ordinary meshes in the same local hierarchy. */
export declare function expandInstancedMeshes(root: THREE.Object3D): void;
/** Freeze current morph and skin deformation into ordinary vertex buffers. */
export declare function freezeDeformedMeshes(root: THREE.Object3D): void;
export type PortableNormalizeOptions = {
    /**
     * Leave this normal map and its material's `normalScale` untouched. By-reference
     * placeholders get their real bytes re-attached later, so baking the scale into
     * placeholder pixels would drop both the reference and the strength.
     */
    preserveNormalMap?: (texture: THREE.Texture) => boolean;
};
export type CompressedTextureDecompressor = (texture: THREE.CompressedTexture) => Promise<THREE.Texture>;
/**
 * Canonicalizing a normal map reads its pixels on the CPU, which compressed
 * (KTX2) textures cannot provide — decompress the ones that will be baked
 * first. Runs before `normalizePortableScene` / `normalizeViewerArtifactMaterials`.
 */
export declare function decompressCanonicalNormalMaps(root: THREE.Object3D, decompress: CompressedTextureDecompressor, options?: PortableNormalizeOptions): Promise<void>;
export declare function normalizePortableScene(root: THREE.Object3D, options?: PortableNormalizeOptions): string[];
/**
 * Canonicalize baked static material details without freezing authored item
 * deformation that existing saved-viewer animation clips still target.
 */
export declare function normalizeViewerArtifactMaterials(root: THREE.Object3D, options?: PortableNormalizeOptions): string[];
/** Where the portable GLB conversion parks the authored opacity of glass it
 * rewrote as transmission, so formats without transmission can fall back. */
export declare const GLASS_OPACITY_USERDATA = "pascalGlassOpacity";
/** Make reflected static geometry agree with exported normals after world transforms. */
export declare function fixReflectedMeshWinding(root: THREE.Object3D): void;
/**
 * Build a USDZ-only clone with world transforms baked into geometry. This
 * removes unsupported negative-scale transforms without changing the shared
 * prepared artifact or its identity hierarchy. Empty mesh containers become
 * groups because USDZ requires vertex positions for every mesh primitive.
 */
export declare function createUsdzScene(source: THREE.Object3D): THREE.Object3D;
/** Dispose geometry, materials, and export-owned texture handles exactly once. */
export declare function disposeExportResources(root: THREE.Object3D, options?: {
    textures?: boolean;
}): void;
//# sourceMappingURL=portable-export.d.ts.map
import type * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
/**
 * GPU decompressor handed to three's GLTF/USDZ exporters for compressed (KTX2)
 * textures. One instance lives for the duration of an export and is disposed
 * with it.
 */
export type ExportTextureUtils = {
    decompress(texture: THREE.Texture, maxTextureSize?: number): Promise<THREE.Texture>;
    dispose(): Promise<void>;
};
/**
 * Mirrors three's `WebGPUTextureUtils.decompress` but keeps a single renderer
 * for the whole export. The stock helper creates, initialises and disposes a
 * WebGPURenderer — adapter and device request included, with no timeout — for
 * every compressed texture it is handed, so a furnished scene paid that cost
 * dozens of times and hung outright when one device request stalled. Handing
 * it a renderer is not an option: it resizes whatever renderer it receives
 * (the live viewer's canvas) and, in r186, throws on the first call that
 * supplies one.
 */
export declare function createExportTextureUtils(initialize?: () => Promise<WebGPURenderer>): ExportTextureUtils;
//# sourceMappingURL=export-texture-utils.d.ts.map
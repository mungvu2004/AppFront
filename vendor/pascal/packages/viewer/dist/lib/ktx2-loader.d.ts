import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
/**
 * KTX2Loader that survives block-misaligned textures. WebGPU rejects
 * block-compressed textures whose base dimensions aren't multiples of 4;
 * three's KTX2Loader only warns and transcodes anyway, and the resulting
 * invalid texture poisons every render pass that binds it (endless
 * "Invalid BindGroup … Invalid CommandBuffer" spam — baked GLBs carrying an
 * odd-sized user-item texture triggered exactly this). Such payloads are
 * routed to a fallback loader whose support flags report no compressed
 * formats, which makes the transcoder emit plain RGBA32 — uncompressed
 * textures have no alignment requirement.
 */
declare class AlignmentSafeKTX2Loader extends KTX2Loader {
    private rgbaFallback;
    private fallbackLoader;
    /** Both `load()` and GLTFLoader's KHR_texture_basisu path funnel through
     *  this internal — overriding it covers every entry point. */
    _createTexture(buffer: ArrayBuffer, config?: Record<string, unknown>): Promise<unknown>;
    dispose(): this;
}
/**
 * Single shared KTX2 loader for the whole viewer — used both by the GLB loader
 * (`use-gltf-ktx2`) and by catalog finish textures (`materials.ts`). KTX2 must
 * be transcoded at load via the Basis WASM, and `detectSupport(renderer)` has to
 * run once before any `.ktx2` is loaded so the loader picks a GPU format the
 * device supports. `ensureKtx2Support` is idempotent per renderer and is called
 * from the viewer root the moment the renderer is ready (even when no GLB is in
 * the scene, so catalog `.ktx2` finishes still load).
 */
export declare const ktx2Loader: AlignmentSafeKTX2Loader;
/**
 * Resolves once `detectSupport` has succeeded for any renderer. `.ktx2` loads
 * issued before that point would throw inside KTX2Loader ("Missing
 * initialization with `.detectSupport( renderer )`"), so texture loaders await
 * this instead of failing — covers materials created while the renderer is
 * still initializing (e.g. a standalone capture canvas).
 */
export declare function whenKtx2Ready(): Promise<void>;
/** Returns true once support has been detected for this renderer (KTX2 safe to load). */
export declare function ensureKtx2Support(renderer: unknown): boolean;
export declare function configureKtx2Support<T>(loader: {
    setKTX2Loader: (ktx2: T) => unknown;
}, renderer: unknown): boolean;
export declare function isKtx2Url(url: string): boolean;
export {};
//# sourceMappingURL=ktx2-loader.d.ts.map
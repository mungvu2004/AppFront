import { LoadingManager } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export type ItemAssetUnavailable = {
    message: string;
    url: string;
};
export type ItemModelLoadFailureKind = 'retryable' | 'unavailable' | 'unexpected';
export declare function classifyItemModelLoadFailure(error: unknown): ItemModelLoadFailureKind;
export declare function createUnavailableItemGltf(url: string, error: unknown): GLTF;
export declare function getUnavailableItemAsset(gltf: GLTF): ItemAssetUnavailable | null;
export declare function cancelItemModelLoad(url: string): void;
export declare class ItemGLTFLoader extends GLTFLoader {
    readonly hostManager: LoadingManager;
    readonly retryDelaysMs: readonly number[];
    constructor(manager?: LoadingManager, retryDelaysMs?: readonly [1000, 3000]);
    load(url: string, onLoad: (gltf: GLTF) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): void;
}
//# sourceMappingURL=model-loader.d.ts.map
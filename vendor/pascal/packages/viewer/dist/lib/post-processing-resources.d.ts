import type { PassNode, RenderPipeline } from 'three/webgpu';
import type { LayerPassIndex } from './layer-pass';
export declare class PostProcessingResources {
    layerIndex: LayerPassIndex | null;
    readonly passes: PassNode[];
    outline: {
        dispose(): void;
    } | null;
    pipeline: RenderPipeline | null;
    dispose(): void;
}
//# sourceMappingURL=post-processing-resources.d.ts.map
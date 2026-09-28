import { type Camera, Object3D, type Scene } from 'three';
import { type NodeFrame, PassNode } from 'three/webgpu';
export declare class LayerPassIndex {
    readonly source: Scene;
    private readonly members;
    private readonly cleanups;
    constructor(source: Scene, layers: number[]);
    register(subtree: Object3D): void;
    private attach;
    private detach;
    prepare(layer: number, roots: Object3D[]): {
        drawable: boolean;
        shadowLight: boolean;
    };
    dispose(): void;
}
export declare class LayerPassNode extends PassNode {
    private readonly index;
    private readonly layer;
    private readonly mainPass;
    private readonly roots;
    private readonly size;
    private needsClear;
    constructor(index: LayerPassIndex, camera: Camera, layer: number, mainPass: PassNode);
    dispose(): void;
    updateBefore(frame: NodeFrame): undefined;
}
//# sourceMappingURL=layer-pass.d.ts.map
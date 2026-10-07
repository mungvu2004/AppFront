/**
 * MergedOutlineNode — a fork of Three.js OutlineNode that processes two object
 * groups (primary = selected, secondary = hovered), reusing scene depth when
 * supplied and rendering masks from small private scenes. Callers without scene
 * depth retain one shared non-selected depth pass for both groups.
 *
 * Additional early-outs:
 *   - Both empty       → skip everything (0 passes)
 *   - Only primary     → skip secondary mask/edge/blur
 *   - Only secondary   → skip primary mask/edge/blur
 */
import { Object3D } from 'three';
import { TempNode } from 'three/webgpu';
export declare class MergedOutlineNode extends TempNode {
    static get type(): string;
    scene: any;
    camera: any;
    primaryObjects: Object3D[];
    secondaryObjects: Object3D[];
    primaryEdgeThicknessNode: any;
    secondaryEdgeThicknessNode: any;
    primaryEdgeGlowNode: any;
    secondaryEdgeGlowNode: any;
    downSampleRatio: number;
    updateBeforeType: string;
    private readonly _sceneDepthNode;
    private readonly _depthRT;
    private readonly _depthTexUniform;
    private readonly _groupA;
    private readonly _groupB;
    private readonly _maskTexA;
    private readonly _maskDownTexA;
    private readonly _edge1TexA;
    private readonly _edge2TexA;
    private readonly _blurColorTexA;
    private readonly _maskTexB;
    private readonly _maskDownTexB;
    private readonly _edge1TexB;
    private readonly _edge2TexB;
    private readonly _blurColorTexB;
    private readonly _blurDirectionA;
    private readonly _blurDirectionB;
    private readonly _cameraNear;
    private readonly _cameraFar;
    private readonly _depthMaterial;
    private readonly _depthSpriteMaterial;
    private readonly _prepareMaskMatA;
    private readonly _prepareMaskSpriteMatA;
    private readonly _copyMatA;
    private readonly _edgeDetectMatA;
    private readonly _blurMat1A;
    private readonly _blurMat2A;
    private readonly _compositeMatA;
    private readonly _prepareMaskMatB;
    private readonly _prepareMaskSpriteMatB;
    private readonly _copyMatB;
    private readonly _edgeDetectMatB;
    private readonly _blurMat1B;
    private readonly _blurMat2B;
    private readonly _compositeMatB;
    private readonly _cacheA;
    private readonly _cacheB;
    private readonly _proxiesA;
    private readonly _proxiesB;
    private readonly _proxyMaskMaterials;
    private readonly _maskSceneA;
    private readonly _maskSceneB;
    private _wroteGroupALastFrame;
    private _wroteGroupBLastFrame;
    private readonly _textureNodeA;
    private readonly _textureNodeB;
    constructor(scene: any, camera: any, params?: {
        primaryObjects?: Object3D[];
        secondaryObjects?: Object3D[];
        primaryEdgeThickness?: any;
        secondaryEdgeThickness?: any;
        primaryEdgeGlow?: any;
        secondaryEdgeGlow?: any;
        downSampleRatio?: number;
        /** Current depth from pass(scene, camera).getTextureNode('depth'). */
        sceneDepthNode?: any;
    });
    get primaryVisibleEdge(): any;
    get primaryHiddenEdge(): any;
    get secondaryVisibleEdge(): any;
    get secondaryHiddenEdge(): any;
    setSize(width: number, height: number): void;
    updateBefore(frame: any): void;
    private _renderMask;
    private _syncProxies;
    private _supportsProxies;
    private _disposeProxyMaterial;
    private _runEdgePipeline;
    setup(builder: any): any;
    dispose(): void;
    private _buildCache;
}
export declare const mergedOutline: (scene: any, camera: any, params?: ConstructorParameters<typeof MergedOutlineNode>[2]) => MergedOutlineNode;
//# sourceMappingURL=merged-outline-node.d.ts.map
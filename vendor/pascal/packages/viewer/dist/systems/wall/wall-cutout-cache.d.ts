import { type WallNode } from '@pascal-app/core';
import { type Camera, type Material, Matrix4, type Mesh, Vector3 } from 'three';
import useViewer, { type WallMode } from '../../store/use-viewer';
import { type WallMaterialVariant } from './wall-material-variant';
import { type WallMaterialsResolver } from './wall-materials';
export declare function sameMaterialArray(a: Material | Material[], b: Material[]): boolean;
type Variant = {
    key: WallMaterialVariant;
    materials: Material[];
};
type CachedWall = {
    mesh: Mesh;
    node: WallNode;
    normal: Vector3;
    matrix: Matrix4;
    geometry: Mesh['geometry'];
    negativeFacing: boolean | undefined;
    hidden: boolean | undefined;
    variantKey: WallMaterialVariant | undefined;
    assignedMaterials: Material | Material[] | undefined;
    visibleVariant: Variant;
    hiddenVariant: Variant;
};
export declare const WALL_FACING_HYSTERESIS = 0.001;
export declare function wallHiddenFromFacing(node: Pick<WallNode, 'frontSide' | 'backSide'>, mode: WallMode, negativeFacing: boolean): boolean;
export declare function wallFacingNegative(dot: number, previous: boolean | undefined): boolean;
export type WallCutoutViewerState = Pick<ReturnType<typeof useViewer.getState>, 'wallMode' | 'shading' | 'textures' | 'colorPreset' | 'sceneTheme' | 'selection' | 'previewSelectedIds' | 'hoveredId' | 'hoverHighlightMode'>;
export type WallCutoutViewerStore = {
    getState: () => WallCutoutViewerState;
};
export declare class WallCutoutCache {
    private readonly viewerStore;
    private readonly materialResolver;
    readonly walls: Map<string, CachedWall>;
    readonly rebuilt: Set<string>;
    private viewer;
    private nodes;
    private materials;
    private registryRevision;
    private wallCount;
    private libraryVersion;
    private lastCameraPosition;
    private lastCameraTarget;
    private cameraDirection;
    private cameraTarget;
    private lastUpdateTime;
    private textureVersion;
    private selected;
    private highlightKey;
    private transformed;
    private overrides;
    constructor(viewerStore?: WallCutoutViewerStore, materialResolver?: WallMaterialsResolver);
    subscribeLiveTransforms(): () => void;
    update(camera: Camera, time: number): void;
    private refreshAppearance;
    private refreshNormal;
    private apply;
}
export {};
//# sourceMappingURL=wall-cutout-cache.d.ts.map
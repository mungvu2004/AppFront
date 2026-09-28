import { type SceneMaterial, type SceneMaterialId, type WallNode, type WallTrimConfig } from '@pascal-app/core';
import { type RenderShading } from '@pascal-app/viewer';
import * as THREE from 'three';
import { type WallTreatmentLevelData } from './treatment-level-data';
type OpeningLike = {
    type: string;
    width?: number;
    height?: number;
    position?: [number, number, number];
};
type TrimKind = 'skirting' | 'crown' | 'chairRail';
type WallSide = 'interior' | 'exterior';
type SceneMaterials = Record<SceneMaterialId, SceneMaterial>;
type WallTreatmentSlotId = 'skirtingInterior' | 'skirtingExterior' | 'crownInterior' | 'crownExterior' | 'chairRailInterior' | 'chairRailExterior';
export declare function hasWallTreatments(node: WallNode): boolean;
export declare function wallTreatmentProudOffsets(node: WallNode): number[];
export declare function buildTrimGeometry(node: WallNode, side: WallSide, trim: WallTrimConfig, kind: TrimKind, childrenNodes: OpeningLike[], levelData: WallTreatmentLevelData): THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap> | null;
export declare function createWallExtraSlotMaterials(node: WallNode, shading: RenderShading, sceneMaterials: SceneMaterials): {
    skirtingInterior: THREE.Material<THREE.MaterialEventMap>;
    skirtingExterior: THREE.Material<THREE.MaterialEventMap>;
    crownInterior: THREE.Material<THREE.MaterialEventMap>;
    crownExterior: THREE.Material<THREE.MaterialEventMap>;
    chairRailInterior: THREE.Material<THREE.MaterialEventMap>;
    chairRailExterior: THREE.Material<THREE.MaterialEventMap>;
};
export declare const WallTreatments: import("react").MemoExoticComponent<({ node, childrenNodes, levelData, materials, }: {
    node: WallNode;
    childrenNodes: OpeningLike[];
    levelData: WallTreatmentLevelData;
    materials: Record<WallTreatmentSlotId, THREE.Material>;
}) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=treatments.d.ts.map
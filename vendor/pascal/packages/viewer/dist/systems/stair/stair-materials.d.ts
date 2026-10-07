import { type StairNode, type StairSegmentNode } from '@pascal-app/core';
import type * as THREE from 'three';
import { type ColorPreset, type RenderShading } from '../../lib/materials';
export type StairBodyMaterials = [THREE.Material, THREE.Material];
export declare function getStairBodyMaterials(stair: StairNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset): StairBodyMaterials;
export declare function getStairRailingMaterial(stair: StairNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset): THREE.Material;
export declare function getStraightStairSegmentBodyMaterials(segment: StairSegmentNode, parentNode?: StairNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset): StairBodyMaterials;
//# sourceMappingURL=stair-materials.d.ts.map
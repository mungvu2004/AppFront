import { Group, type Material, type Object3D } from 'three';
import { type CabinetGeometryNode, type CabinetSlotMaterials } from './shared';
export declare function addMicrowaveButton(group: Object3D, x: number, y: number, z: number, width: number, height: number, material: Material, name: string): void;
export declare function addApplianceCompartment(group: Group, node: CabinetGeometryNode, materials: CabinetSlotMaterials, kind: 'oven' | 'microwave', faceWidth: number, faceHeight: number, faceCenterY: number, openingWidth: number, openingDepth: number, frontZ: number, index: number): void;
//# sourceMappingURL=oven-microwave.d.ts.map
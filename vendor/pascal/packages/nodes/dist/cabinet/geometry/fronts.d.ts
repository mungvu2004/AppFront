import { type BufferGeometry, Group, type Material, type Object3D } from 'three';
import { type CabinetGeometryNode, type CabinetSlotMaterials } from './shared';
export declare function buildFrontGeometry(node: CabinetGeometryNode, width: number, height: number, drawer: boolean, hinge?: 'left' | 'right' | null): BufferGeometry;
export declare function addBarHandle(group: Object3D, position: [number, number, number], length: number, vertical: boolean, name: string, material: Material): void;
export declare function addHandleFeature(group: Object3D, node: CabinetGeometryNode, materials: CabinetSlotMaterials, width: number, height: number, hinge: 'left' | 'right' | null, vertical: boolean, drawer?: boolean, name?: string, placement?: {
    x?: number;
    y?: number;
}): void;
export declare function addDoorFronts(group: Group, node: CabinetGeometryNode, materials: CabinetSlotMaterials, openingWidth: number, openingHeight: number, centerX: number, centerY: number, frontZ: number, doorType: 'single-left' | 'single-right' | 'double' | 'glass'): void;
export declare function addSinkFalseFront(group: Group, node: CabinetGeometryNode, materials: CabinetSlotMaterials, faceWidth: number, faceHeight: number, centerY: number, frontZ: number, index: number): void;
export declare function addShelfBoards(group: Group, materials: CabinetSlotMaterials, openingWidth: number, openingDepth: number, board: number, y0: number, height: number, count: number, centerX?: number): void;
export declare function addDrawerFronts(group: Group, node: CabinetGeometryNode, materials: CabinetSlotMaterials, faceWidth: number, faceHeight: number, centerY: number, y0: number, boxOpeningWidth: number, frontZ: number, count: number, boxBackZ: number, boxDepth: number): void;
//# sourceMappingURL=fronts.d.ts.map
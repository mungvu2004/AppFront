import { type Group, type Material, Mesh, MeshStandardMaterial } from 'three';
export declare function addBox(group: Group, name: string, size: [number, number, number], position: [number, number, number], material: Material): Mesh;
export declare function sectionOutline(shape: 'round' | 'rect' | 'oval', width: number, height: number): Array<[number, number]>;
export declare function addProfile(group: Group, name: string, shape: 'round' | 'rect' | 'oval', width: number, height: number, start: number, end: number, material: Material, wall?: number): Mesh;
export declare function hardwareMaterial(): MeshStandardMaterial;
export declare function addPlug(group: Group, radius: number, x: number, material: Material): void;
//# sourceMappingURL=accessory-geometry.d.ts.map
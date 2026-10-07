import type { EvaluatedLight } from '@pascal-app/core/procedural-items';
import type { Material, Mesh, Object3D } from 'three';
export declare function cloneWithProceduralEmission(material: Material, color: string, on: boolean): Material;
export declare function setProceduralEmission(material: Material, on: boolean): void;
export declare function proceduralSlotMeshes(root: Object3D, slots: Set<string>): Mesh[];
export declare function decorateProceduralEmission(root: Object3D, lights: EvaluatedLight[], on: boolean): () => void;
//# sourceMappingURL=procedural-emission.d.ts.map
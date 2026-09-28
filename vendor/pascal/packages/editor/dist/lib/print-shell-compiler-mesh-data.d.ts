import * as THREE from 'three';
import type { ManifoldMeshData } from './print-shell-compiler-protocol';
export declare function geometryToManifoldMeshData(geometry: THREE.BufferGeometry, nodeId: string): ManifoldMeshData;
export declare function geometryFromManifoldMeshData(positions: Float32Array, indices: Uint32Array): THREE.BufferGeometry;
//# sourceMappingURL=print-shell-compiler-mesh-data.d.ts.map
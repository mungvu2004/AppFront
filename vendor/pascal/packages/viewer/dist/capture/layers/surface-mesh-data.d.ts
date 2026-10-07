import { BufferGeometry } from 'three';
export type SurfaceMeshData = {
    colors: Float32Array;
    indices: Uint16Array;
    positions: Float32Array;
};
export declare function createSurfaceMeshGeometry(value: unknown): BufferGeometry | null;
export declare function buildSurfaceMeshData(value: unknown): SurfaceMeshData | null;
//# sourceMappingURL=surface-mesh-data.d.ts.map
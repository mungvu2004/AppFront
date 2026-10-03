import { BufferGeometry } from 'three';
export type TerrainPerimeterPoint = {
    x: number;
    z: number;
};
export declare function buildTerrainPerimeterFillGeometry(points: readonly TerrainPerimeterPoint[], bottomY: readonly number[], topY: number, epsilon?: number): BufferGeometry | null;
//# sourceMappingURL=terrain-perimeter-fill.d.ts.map
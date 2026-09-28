import { Vector3 } from 'three';
export type PlacementSurface = {
    point: Vector3;
    /** Optional stable origin for the construction lattice. */
    anchor?: Vector3;
    normal: Vector3;
    projection: 'surface' | 'fixed-plane';
};
export declare function publishPlacementSurface(point: Vector3, normal: Vector3, projection?: PlacementSurface['projection'], anchor?: Vector3): void;
export declare function clearPlacementSurface(): void;
export declare function getPlacementSurface(): PlacementSurface | null;
export declare function usesOrientedPlacementPlane(normal: Vector3): boolean;
//# sourceMappingURL=active-placement-surface.d.ts.map
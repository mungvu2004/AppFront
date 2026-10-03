import { type Matrix4, Plane, type Ray, Vector3 } from 'three';
export declare function createSpatialDragPlane(point: Vector3, ray: Ray, localToWorld?: Matrix4): Plane;
export declare function intersectSpatialDragPlane(ray: Ray, plane: Plane, target: Vector3): Vector3 | null;
export declare function spatialDragLocalY(worldPoint: Vector3, worldToLocal: Matrix4): number;
//# sourceMappingURL=spatial-drag-plane.d.ts.map
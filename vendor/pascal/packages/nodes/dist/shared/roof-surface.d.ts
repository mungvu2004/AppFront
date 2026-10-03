import { type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare function getSurfaceY(lx: number, lz: number, seg: RoofSegmentNode): number;
export declare function getRoofTopSurfaceY(lx: number, lz: number, seg: RoofSegmentNode): number;
export type RoofSurfacePoint2D = [number, number];
export type RoofSurfaceFaceBounds = {
    polygon: RoofSurfacePoint2D[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    surfaceYAt: (x: number, z: number) => number;
    xIntervalAtZ: (z: number) => [number, number] | null;
    zIntervalAtX: (x: number) => [number, number] | null;
};
export declare function getRoofSurfaceFaceBoundsAt(segment: RoofSegmentNode, lx: number, lz: number): RoofSurfaceFaceBounds;
export declare function getAnalyticalNormal(lx: number, lz: number, seg: RoofSegmentNode, out?: THREE.Vector3): THREE.Vector3;
export declare function surfaceQuatFromNormal(normal: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion;
export declare function getDownSlopeYaw(lx: number, lz: number, seg: RoofSegmentNode): number;
//# sourceMappingURL=roof-surface.d.ts.map
import type { DoorEvent, WallEvent, WallNode } from '@pascal-app/core';
import type { Object3D } from 'three';
/**
 * Re-attributes a hosted door hit to its wall while preserving the hit in
 * world space. Door face normals are local to the intersected door object;
 * converting through that object keeps rotated doors and hosted cutout meshes
 * aligned with the wall's local placement frame.
 */
export declare function resolveLeanToDoorWallTarget(event: DoorEvent, wall: WallNode, wallObject: Object3D): WallEvent;
//# sourceMappingURL=wall-target.d.ts.map
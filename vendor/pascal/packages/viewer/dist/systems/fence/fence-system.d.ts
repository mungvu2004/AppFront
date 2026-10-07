import { type FenceNode } from '@pascal-app/core';
import * as THREE from 'three';
type FencePart = {
    geometry?: THREE.BufferGeometry;
    position: [number, number, number];
    rotationY?: number;
    scale: [number, number, number];
    shape?: 'box' | 'pyramid';
};
export type FenceSlotId = 'posts' | 'infill' | 'base' | 'rail';
export type FenceSlotParts = Record<FenceSlotId, FencePart[]>;
/**
 * Geometry split by paint slot — posts, infill, base, rail — each a separate
 * merged BufferGeometry (empty ones included) so the fence renderer can give
 * each its own material + `userData.slotId`. Slots match the panel's build
 * options 1:1.
 */
export declare function generateFenceSlotGeometries(fence: FenceNode): Record<FenceSlotId, THREE.BufferGeometry>;
export declare function generateFenceGeometry(fence: FenceNode): THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>;
export declare const FenceSystem: () => null;
export {};
//# sourceMappingURL=fence-system.d.ts.map
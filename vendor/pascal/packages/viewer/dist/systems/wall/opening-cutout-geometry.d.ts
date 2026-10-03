import type { DoorNode, WindowNode } from '@pascal-app/core';
import * as THREE from 'three';
export type OpeningCutoutNode = DoorNode | WindowNode;
export type OpeningCutoutRect = {
    left: number;
    right: number;
    bottom: number;
    top: number;
};
export declare function getOpeningCutoutProxyDepth(wallThickness: number): number;
/**
 * Pure cutout profile for a shaped door / window opening. `rect` is in
 * the caller's coordinate frame — the wall CSG pipeline passes wall-local
 * coords, the roof-wall pipeline an origin-centered rect — so the same
 * radii / arch math serves both hosts.
 */
export declare function buildOpeningCutoutShape(opening: OpeningCutoutNode, rect: OpeningCutoutRect): THREE.Shape;
export declare function buildOpeningCutoutGeometry(opening: OpeningCutoutNode, rect: OpeningCutoutRect, depth: number, wallThickness: number): THREE.BufferGeometry;
/**
 * Whether the cutout profile's bottom edge is a flat chord. Cuts whose
 * bottom sits coplanar with the host wall base get extended slightly
 * downward to keep CSG away from coplanar faces — but only a flat chord
 * may extend; shifting a rounded bottom would distort the profile.
 */
export declare function hasFlatOpeningCutoutBottom(opening: OpeningCutoutNode): boolean;
/**
 * Extends floor-level flat cutouts below the host wall so CSG never has to
 * subtract a face exactly coplanar with the wall base.
 */
export declare function getOpeningCutoutBottomPadding(opening: OpeningCutoutNode, bottom: number): number;
//# sourceMappingURL=opening-cutout-geometry.d.ts.map
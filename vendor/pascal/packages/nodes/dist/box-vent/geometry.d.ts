import { type BoxVentNode, type RoofType } from '@pascal-app/core';
import * as THREE from 'three';
export declare const BOX_VENT_MATERIAL_INDEX: {
    readonly base: 0;
    readonly top: 1;
};
/**
 * Pure builder for the box-vent mesh. Models a real attic box vent:
 *
 *   ┌──────────────────────┐        ← rounded dome cap (closed)
 *   │        ───           │
 *   │  ◜─────────────◝    │
 *  ─┘─────────────────────└─       ← flange flashing
 *
 * - **Body**: short rectangular walls + a sealed bottom.
 * - **Dome cap**: smooth half-ellipsoid that fully closes the top — no
 *   flat plateau (the old pyramid hood left one). Used for every style;
 *   `style` just tunes how much of the total height is body vs cap.
 * - **Skirt / flange**: the dome's base ring extends past the body by
 *   `hoodOverhang`, doubling as the mounting flashing tab.
 *
 * Louvered slats were removed — real box vents read smooth from typical
 * camera distances; the slat pile only made the ghost preview noisy and
 * the texture wrap unpredictable.
 *
 * Pure: no React, no scene access, no store mutation. Safe to call from
 * unit tests, the placement preview, and the move-tool ghost.
 */
export declare function buildBoxVentGeometry(node: BoxVentNode): THREE.BufferGeometry;
/**
 * Slope tilt for a box-vent at segment-local Z position. The vent's
 * X axis stays parallel to the segment's ridge; the +Z (down-slope)
 * side dips, the -Z (up-slope) side lifts. Flat segments return 0.
 *
 * Pure: lifted out so the renderer / move tool / preview share one
 * source of truth.
 */
export declare function computeBoxVentSlopeTilt(segment: {
    roofType: RoofType;
    pitch: number;
    width: number;
    depth: number;
} | undefined, localZ: number): number;
//# sourceMappingURL=geometry.d.ts.map
import type { GutterNode } from '@pascal-app/core';
import * as THREE from 'three';
import { type GutterMitres } from './corner-mitre';
/**
 * Pure builder for the gutter mesh. The gutter is a hollow trough that
 * runs along the eave; we build its cross-section as a closed 2D Shape
 * in the (Z, Y) plane with the channel cavity carved out as a Path
 * hole, then extrude along the gutter's local +X (length direction).
 *
 * Three profiles share the same outer-outline-minus-cavity recipe; they
 * differ only in the OUTLINE shape:
 *
 *  - `k-style`:    flat back + flat bottom + ogee (S-curve) fascia.
 *                  Most common modern residential profile.
 *  - `half-round`: half-cylinder (semicircle cross-section).
 *  - `box`:        square / rectangular u-channel; reads as commercial.
 *
 * The gutter mounts at the eave line (gutter-local Y=0) and drops
 * downward (negative Y) by `size`. +Z is "away from the building" —
 * positive Z is the outer face that hangs over the eave.
 *
 * End caps: when `endCapLeft` / `endCapRight` is true, the matching
 * end gets a thin SOLID slice (depth = wall thickness) instead of the
 * hollow U-channel. The solid slice's end face closes the trough so
 * water can't run out the side. Caps subtract from the user-set
 * `length` so the gutter's total span stays constant — capping doesn't
 * silently grow the geometry past what the inspector reads.
 *
 * Corner mitres: when a sibling gutter meets this gutter at a roof
 * corner, the corner-mitre detector passes a mitre angle for the
 * affected end. The end-face vertices are skewed (back wall held in
 * place, front rim extended outward) so two perpendicular gutters'
 * front rims meet at the outer eave intersection. A mitred end's cap
 * is force-suppressed — capping a corner would wall off the L.
 *
 * Pure: no React, no scene access, no store mutation.
 */
export declare function buildGutterGeometry(node: GutterNode, mitres?: GutterMitres): THREE.BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map
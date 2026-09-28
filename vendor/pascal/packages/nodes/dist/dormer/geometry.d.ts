import { type DormerNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Grid-snap step (metres) applied to the world cursor position while a
 * dormer placement / move ghost is in flight. Shared by both tools so
 * the audible snap and the committed position step stay in lockstep.
 */
export declare const DORMER_PLACEMENT_SNAP_M = 0.05;
/**
 * Rotation step (radians) used by the keyboard rotate shortcuts (R /
 * Shift+R) while a dormer placement / move ghost is in flight. 15° —
 * lets the user reach the 90° cardinals in six taps and the 45°
 * diagonals in three.
 */
export declare const DORMER_PLACEMENT_ROTATION_STEP: number;
export declare function getDormerBodyYaw(node: Pick<DormerNode, 'roofType' | 'shedHighSide'>): number;
/**
 * Builds the lightweight placement and live-edit shell from the same
 * per-type face generator used by committed roof geometry.
 */
export declare function buildDormerShellGeometry(node: DormerNode): THREE.BufferGeometry;
export declare function buildDormerGhostGeometry(node: DormerNode): THREE.BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map
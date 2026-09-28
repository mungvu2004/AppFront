import { type CeilingNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const CeilingSystem: () => null;
/**
 * Generates flat ceiling geometry from polygon (no extrusion).
 *
 * `extraHoles` are transient, derived cutouts (e.g. recessed-fixture
 * footprints) that are cut alongside the node's persisted `holes` but never
 * stored on the node — they are recomputed on every rebuild.
 */
export declare function generateCeilingGeometry(ceilingNode: CeilingNode, extraHoles?: Array<Array<[number, number]>>): THREE.BufferGeometry;
//# sourceMappingURL=ceiling-system.d.ts.map
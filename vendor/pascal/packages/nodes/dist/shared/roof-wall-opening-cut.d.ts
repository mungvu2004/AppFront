import type { DoorNode, RoofSegmentNode, WindowNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * CSG cut for a door / window hosted on a roof-segment wall face
 * (`capabilities.roofAccessory.buildCut`). The cut goes through the wall
 * mid-plane, derived from the CURRENT host geometry (the opening stores
 * face-local coords), so the hole follows segment resizes for free.
 * Plain rectangles cut a box; shaped openings (arch / rounded /
 * frameless `opening` kind) reuse the wall pipeline's cutout profile so
 * roof-hosted holes match wall-hosted ones.
 *
 * Returns null for wall-hosted openings: their cut is handled by the
 * wall system's own cutout pipeline.
 */
export declare function buildRoofWallOpeningCut(node: DoorNode | WindowNode, hostSegment: RoofSegmentNode): THREE.BufferGeometry | null;
//# sourceMappingURL=roof-wall-opening-cut.d.ts.map
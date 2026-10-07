import { type ChimneyNode, type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Pure chimney geometry builder. Returns body, cap, flues, and cricket
 * as separate BufferGeometries so each can carry its own material
 * (body/top split mirrors the schema's `material` vs `topMaterial`).
 *
 * **Option C scope** (see commit message): no CSG. The chimney body
 * intersects the roof at the deck line; the cap is solid (no flue
 * holes carved); the body has no hollow shaft cavity; flues are solid
 * cylinders/boxes protruding from the cap. Decorative bands and inset
 * panels are no-op on this builder until roof-segment migrates to
 * Stage B and a `roofCutout` capability lets the parent segment own
 * its own boolean operations.
 *
 * Pure: no React, no scene access, no store mutation. Takes the
 * segment as a second argument so the body height can be derived from
 * the segment's pitch — analogous to `door`'s `ctx.parent` access.
 */
export type ChimneyGeometry = {
    body: THREE.BufferGeometry;
    cap: THREE.BufferGeometry | null;
    flues: THREE.BufferGeometry | null;
    cricket: THREE.BufferGeometry | null;
    bands: THREE.BufferGeometry | null;
};
export declare function buildChimneyGeometry(node: ChimneyNode, segment: RoofSegmentNode): ChimneyGeometry;
export declare function flueXPositions(count: number, chimneyWidth: number, flueDiameter: number, spacing?: number): number[];
//# sourceMappingURL=geometry.d.ts.map
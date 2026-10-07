import type { EyebrowVentNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const EYEBROW_VENT_MATERIAL_INDEX: {
    readonly hood: 0;
    readonly front: 1;
};
/**
 * Pure builder for the eyebrow-vent mesh. Three styles, all seated directly on
 * the roof at y=0 and facing +Z (downslope):
 *
 *  - `scoop`      — a rounded louvered opening at the front that sweeps back
 *                   and tapers to nothing (the classic dormer "eyebrow"). Front
 *                   = a half-ellipse of horizontal louvers; the body is a lofted
 *                   half-cone with a rounded nose.
 *  - `half-round` — a D-shaped half-round vent: a constant half-ellipse cross
 *                   section extruded a short depth, flat louvered front face,
 *                   capped back, curved top.
 *  - `slant-box`  — a low box with a slanted top (tall front, lower back) and a
 *                   framed front face holding recessed louvers + a screen.
 *
 * Every face is emitted through a winding-safe oriented quad/tri, the louvers
 * are extruded into solid slabs, and the whole mesh is double-sided at the end
 * (see `doubleSide`) so it reads correctly from any angle.
 *
 * Pure: no React, no scene access, no store mutation. Safe for unit tests, the
 * placement preview, and the move-tool ghost.
 */
export declare function buildEyebrowVentGeometry(node: EyebrowVentNode): THREE.BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map
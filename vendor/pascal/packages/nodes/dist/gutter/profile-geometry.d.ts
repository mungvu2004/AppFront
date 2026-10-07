import type { GutterNode } from '@pascal-app/core';
/**
 * Shared outlet/profile geometry constants + math used by the gutter
 * mesh builder, the outlet lookup the downspout mounts against, and the
 * downspout's own routing. Kept in one place so the trough-floor probe
 * and the collar dimensions can't drift between the three call sites
 * (they did before this file — `profileFloorMidZ` was copied verbatim
 * into both `geometry.ts` and `outlet-lookup.ts`).
 */
export declare const OUTLET_WALL_THICKNESS = 0.003;
export declare const OUTLET_STUB_LENGTH = 0.06;
/**
 * Z (outward) coordinate of the trough floor's midpoint per profile —
 * where a drop outlet drills through. k-style bottom is `wBot = 0.8 ·
 * size` wide so its midpoint sits at `0.4 · size`; box bottom is `size`
 * wide → `size / 2`; half-round's lowest point is the centre of the
 * semicircle at Z = r = size.
 */
export declare function profileFloorMidZ(profile: GutterNode['profile'], size: number): number;
export type OutletShape = 'round' | 'rect';
/**
 * Which cross-section a gutter's drop outlet (and the downspout that
 * plugs into it) takes. Half-round gutters use a round leader; the
 * flat-bottomed profiles (k-style, box) use a rectangular one — matching
 * real residential hardware (round leaders on half-round, 2×3 / 3×4
 * rectangular leaders on k-style / commercial box).
 */
export declare function outletShapeForProfile(profile: GutterNode['profile']): OutletShape;
export declare const RECT_OUTLET_DEPTH_RATIO = 0.7;
export type OutletDims = {
    shape: OutletShape;
    /** Half-extent along the gutter length (X). Round: = radius. */
    halfX: number;
    /** Half-extent outward (Z). Round: = radius. */
    halfZ: number;
};
/**
 * Cross-section half-extents for a `nominalDiameter`-sized outlet of the
 * given shape. Round → a circle of that diameter (halfX = halfZ =
 * radius); rect → that diameter wide along the run, `RECT_OUTLET_DEPTH_
 * RATIO` as deep outward.
 */
export declare function outletDims(shape: OutletShape, nominalDiameter: number): OutletDims;
//# sourceMappingURL=profile-geometry.d.ts.map
import { type RoofNode, type RoofSegmentNode } from '@pascal-app/core';
export type RoofSegmentHit = {
    segment: RoofSegmentNode;
    localX: number;
    localY: number;
    localZ: number;
};
/**
 * Resolve which roof-segment the user clicked. Used by every placement
 * tool that drops a new node onto a roof (box-vent, ridge-vent,
 * chimney, solar-panel, skylight, dormer).
 *
 * The hip/gable case puts every slope at the same roof origin and
 * differs them only by `rotation-y`. After `worldToLocal`, the hit
 * point's (x, z) lies inside *every* segment's axis-aligned half-
 * extents, so a naive first-match returns the wrong slope (typically
 * segments[0]). We instead score each candidate by
 * `|localY − getRoofSegmentSurfaceY(localX, localZ)|` and pick the
 * smallest — the slope the user actually clicked is the one whose
 * sloped surface passes through the hit point.
 *
 *  - Overhang is included in the bbox filter because the visible
 *    merged-roof mesh extends past `width/2` by the overhang on each
 *    side; without it, clicks on the eave bands produced `null`.
 *
 *  - Fallback: if no segment passes the bbox filter (clicked beyond
 *    every outer overhang, or registry is stale), return the first
 *    segment with the click projected into its frame — matches the
 *    legacy "always commit somewhere" behaviour.
 *
 * Returns null only if the roof has zero registered segments.
 */
export declare function resolveRoofSegmentHit(roof: RoofNode, wx: number, wy: number, wz: number): RoofSegmentHit | null;
//# sourceMappingURL=roof-segment-hit.d.ts.map
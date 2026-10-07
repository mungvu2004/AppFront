import { type RoofSegmentNode } from '@pascal-app/core';
/**
 * Shared ridge-line snap math for ridge-vent placement + move tools.
 *
 * Ridge vents must sit centered on a roof break line — off-line the cap's
 * far half dips into the higher part of the slope ("goes inside" the roof).
 * So the placement tools clamp the cursor onto the nearest generated ridge
 * line, preserving the line's yaw for hip / lower-slope runs.
 *
 * Per roof type:
 *   - gable / gambrel: ridge spans the full width.
 *   - mansard: top ridge, upper hip runs, plus lower-slope runs on all
 *     four steep lower faces.
 *   - dutch: top ridge between the gablet waists plus four hip runs down
 *     to the eave corners (the gablet ends are vertical walls, not ridges).
 *   - hip: ridge is shortened by the hipped ends — spans width − depth.
 *     A square hip (width ≤ depth) collapses to a single apex point.
 *   - shed: no true ridge — snap to the high eave (z = -depth/2).
 *   - flat: no ridge at all → return null.
 */
export declare const RIDGE_LIFT = 0.09;
export type RidgeSnap = {
    /** Segment-local X of the snapped ridge position. */
    localX: number;
    /** Segment-local Z of the snapped ridge position. */
    localZ: number;
    /** Segment-local yaw matching the snapped ridge line. */
    rotation: number;
};
export declare function resolveRidgeSnap(segment: RoofSegmentNode, cursorLocalX: number, cursorLocalZ: number): RidgeSnap | null;
//# sourceMappingURL=ridge-snap.d.ts.map
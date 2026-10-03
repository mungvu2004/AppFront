import { type DoorNode, type FloorplanGeometry, type GeometryContext, type WindowNode } from '@pascal-app/core';
/**
 * Build placement-measurement dimension lines for a door / window
 * being moved on a wall. Mirrors the legacy
 * `movingOpeningPlacementMeasurements` in `floorplan-panel.tsx`:
 *
 *   - Find the previous opening on the same wall (or the wall start
 *     if none) → distance from its right face to this opening's
 *     left face.
 *   - Find the next opening (or wall end) → distance from this
 *     opening's right face to its left face.
 *   - Each renders as a `dimension` primitive offset to the wall's
 *     outer face so the labels don't overlap the wall body.
 *
 * Returns an empty array if the parent isn't a wall, the wall is
 * curved, or the opening is at wall length 0 (invalid).
 */
export declare function buildOpeningPlacementDimensions(opening: DoorNode | WindowNode, ctx: GeometryContext): FloorplanGeometry[];
//# sourceMappingURL=opening-placement-dimensions.d.ts.map
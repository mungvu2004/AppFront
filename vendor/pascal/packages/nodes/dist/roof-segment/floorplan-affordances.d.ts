import { type FloorplanAffordance, type FloorplanMoveTarget, type RoofSegmentNode } from '@pascal-app/core';
/**
 * Roof-segment width / depth drag (floor-plan). Mirrors the 3D
 * `linear-resize` handles in `definition.ts`: the dragged side moves
 * while the opposite side stays fixed. Projects the plan cursor onto
 * the segment's effective rotation (roof.rotation + segment.rotation)
 * so the math survives any parent-roof rotation, then writes the
 * corresponding roof-local center shift alongside the new dimension.
 */
export declare const roofSegmentResizeAffordance: FloorplanAffordance<RoofSegmentNode>;
/**
 * Roof-segment rotation drag (floor-plan). Sister to the 3D `arc-resize`
 * handle. Same `- delta` convention as the 3D handle: the floor-plan
 * builder plots the footprint at `-(roof.rotation + segment.rotation)`
 * (see `buildRoofSegmentFloorplan`'s `rotation` local), so the 2D
 * view rotates the same direction as 3D for the same `rotation` value,
 * and the same cursor gesture writes the same sign in both views.
 */
export declare const roofSegmentRotateAffordance: FloorplanAffordance<RoofSegmentNode>;
/**
 * Roof-segment body-move target (floor-plan). The generic Path 2 move
 * fallback writes the cursor's plan position straight into `position`,
 * which is wrong for roof segments because `position` is **roof-local**
 * (the floorplan builder composes parent roof's transform to render).
 * This target inverts the parent roof's transform so the segment moves
 * to the cursor's WORLD-plan position, not to a roof-local interpretation
 * of those world coords. Falls back to identity for orphaned segments.
 */
export declare const roofSegmentMoveTarget: FloorplanMoveTarget<RoofSegmentNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
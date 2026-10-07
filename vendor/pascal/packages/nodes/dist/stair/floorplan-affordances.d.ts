import { type FloorplanAffordance, type StairNode } from '@pascal-app/core';
/**
 * Straight-stair segment side arrow → segment `width`. Sister to the 3D
 * `StairSegmentSideArrow` width drag (~line 235 of stair-segment-handles.tsx).
 * Width grows symmetrically around the segment centerline — the chain
 * rebuilds from the segment's `width` field, no opposite-edge anchor write
 * required. `axisX` is the segment-local +X axis in plan coords, captured
 * at emit-time so the projection stays valid through the drag.
 */
export declare const segmentWidthAffordance: FloorplanAffordance<StairNode>;
/**
 * Straight-stair segment length arrow → segment `length`. Sister to the 3D
 * `StairSegmentLengthArrow` drag. The chain anchors each segment's back
 * face, so length simply extends/contracts the front. `axisZ` is the
 * segment-local +Z (run) direction in plan coords.
 */
export declare const segmentLengthAffordance: FloorplanAffordance<StairNode>;
/**
 * Curved / spiral width arrow → stair `width`. Drag radially outward grows
 * the body, anchored at the inner radius (matches the 3D
 * `CurvedStairWidthArrow`). The sweep bisector matches the existing
 * floor-plan emitter (`sectorStartAngle = -rotation - sweep/2`, bisector
 * = -rotation).
 */
export declare const curvedStairWidthAffordance: FloorplanAffordance<StairNode>;
/**
 * Curved / spiral inner-radius arrow → stair `innerRadius` + `width`. Keeps
 * the outer edge pinned (width absorbs the radial delta) so dragging only
 * shifts the inner rim, matching the 3D `CurvedStairInnerRadiusArrow`.
 */
export declare const curvedStairInnerRadiusAffordance: FloorplanAffordance<StairNode>;
/**
 * Whole-stair rotation gizmo → stair `rotation`. Mirrors the 3D
 * `stairRotateHandle` (arc-resize, curved-arrow shape). Angular drag
 * around the stair's plan-space pivot — atan2 ticks CW visually, the
 * stored `rotation` field is the schema's Y-axis radians, and the
 * floorplan plots sectors at `-rotation`, so a positive cursor delta
 * (CCW around the centre in standard math coords / CW on screen given
 * inverted Y) should DECREASE `rotation`. Same `- delta` convention the
 * 3D handle uses; cursor handedness across both views matches.
 */
export declare const stairRotateAffordance: FloorplanAffordance<StairNode>;
/**
 * Curved / spiral sweep arrows → stair `sweepAngle` + `rotation`. Anchors
 * the opposite edge world-fixed by nudging `rotation` by half the applied
 * sweep delta — mirror of the 3D `CurvedStairSweepArrow`. Sign math derives
 * from the floorplan convention `sectorStartAngle = -rotation - sweep/2`:
 *
 *   END handle  (sweep += Δ, fix start): ΔR = -Δ/2
 *   START handle (sweep -= Δ, fix end):  ΔR = +Δ/2
 */
export declare const curvedStairSweepAffordance: FloorplanAffordance<StairNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
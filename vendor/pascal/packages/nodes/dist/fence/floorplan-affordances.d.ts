import { type FenceNode, type FloorplanAffordance } from '@pascal-app/core';
/**
 * Fence curve sagitta drag — 1:1 mirror of `wallCurveAffordance`. Drag
 * projects the pointer onto the chord normal to compute `curveOffset`,
 * snaps to grid when that mode is active, clamps to `getMaxWallCurveOffset`,
 * normalizes via `normalizeWallCurveOffset`. Same single-undo dance — the
 * dispatcher handles snapshot / pause / resume around `apply`. Lives in
 * the same file as the endpoint affordance to keep the two fence
 * floor-plan drags side-by-side (both publish to `useLiveNodeOverrides`,
 * both committed on pointer-up).
 */
export declare const fenceCurveAffordance: FloorplanAffordance<FenceNode>;
export declare const fenceThicknessAffordance: FloorplanAffordance<FenceNode>;
/**
 * Spline control-point drag — reshapes one point of the fence `path`. Grid
 * snap follows the active mode; start/end stay pinned to the path ends so endpoint-
 * dependent code stays valid. Publishes a live override per tick, commits the
 * final path as one tracked change. No linked-fence cascade: a spline's shape
 * is self-contained.
 */
export declare const fenceControlPointAffordance: FloorplanAffordance<FenceNode>;
/**
 * Spline tangent-handle drag — bends the curve through one control point. The
 * dragged end (in / out) gives the OUT-handle vector (negated for the IN end);
 * the IN handle is always the mirror so the curve stays smooth (symmetric).
 * The visual arm is `TANGENT_HANDLE_ARM_SCALE`× the stored vector, so we divide
 * that factor out before storing. Writes `tangents[index]`, padding the array
 * to the path length with nulls so untouched points keep their auto tangent.
 */
export declare const fenceTangentAffordance: FloorplanAffordance<FenceNode>;
export declare const fenceMoveEndpointAffordance: FloorplanAffordance<FenceNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
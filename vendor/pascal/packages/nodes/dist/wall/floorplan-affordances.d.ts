import { type FloorplanAffordance, type WallNode } from '@pascal-app/core';
/**
 * Wall curve sagitta drag — 1:1 port of the legacy
 * `handleWallCurvePointerDown` + commit flow. Drag projects the pointer
 * onto the chord normal to compute a `curveOffset`, snapped to the
 * grid step, clamped to `getMaxWallCurveOffset`,
 * normalized via `normalizeWallCurveOffset`. Same single-undo dance as
 * the move-endpoint affordance — the dispatcher handles snapshot /
 * pause / resume around `apply`.
 */
export declare const wallCurveAffordance: FloorplanAffordance<WallNode>;
export declare const wallThicknessAffordance: FloorplanAffordance<WallNode>;
export declare const wallMoveEndpointAffordance: FloorplanAffordance<WallNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
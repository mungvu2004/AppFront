/**
 * Shared rotation delta for the 2D corner rotate-arrow affordances (column /
 * elevator / roof-segment / shelf / spawn / stair — all structurally
 * identical). Measures the pointer's angular sweep from the grab bearing
 * around the node center, wrapped to [-π, π] so a drag crossing ±π keeps its
 * sign, then snaps it to the 15° increment unless `free` (the held Shift the
 * contextual HUD advertises). The 2D twin of the 3D gizmo's
 * `snapDirectRotationDelta`, so rotating a node reads the same in both views.
 */
export declare function rotateAffordanceDelta(args: {
    center: readonly [number, number];
    initialAngle: number;
    planPoint: readonly [number, number];
    free: boolean;
}): number;
//# sourceMappingURL=rotate-affordance.d.ts.map
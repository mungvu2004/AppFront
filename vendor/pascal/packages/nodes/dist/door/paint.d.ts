/**
 * Door paint on the unified slot model. The door's opening proxy (a proud,
 * invisible cutout) wins the shared scene raycast over the wall in front of the
 * recessed door body, so `resolveSlotByReRaycast` re-raycasts the door's own
 * subtree to find the part (panel / frame / glass / hardware) under the cursor.
 */
export declare const doorPaint: import("@pascal-app/core").PaintCapability;
//# sourceMappingURL=paint.d.ts.map
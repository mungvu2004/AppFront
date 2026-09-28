/**
 * Per-frame wall-side offset for items mounted to wall faces. The slab-
 * elevation lift for floor items lives in the generic
 * `<FloorElevationSystem>` and runs at priority 1 — it has already
 * landed `mesh.position.y` by the time this system clears the dirty
 * mark at priority 2.
 */
export declare const ItemSystem: () => null;
//# sourceMappingURL=item-system.d.ts.map
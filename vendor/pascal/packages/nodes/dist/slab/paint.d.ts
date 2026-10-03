/**
 * Slab paint on the unified slot model. A slab exposes two faces — `surface`
 * (top) and `side` (walls + underside) — each its own mesh tagged with
 * `userData.slotId`, so the clicked face resolves to its slot; commit writes
 * `node.slots[slotId]` (a shared scene-material or `library:` ref) like the shelf.
 */
export declare const slabPaint: import("@pascal-app/core").PaintCapability;
//# sourceMappingURL=paint.d.ts.map
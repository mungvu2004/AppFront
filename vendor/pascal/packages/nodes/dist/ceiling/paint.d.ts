/**
 * Ceiling paint on the unified slot model. A ceiling has one paintable surface,
 * so every hit resolves to `surface`; commit writes `node.slots.surface`. The
 * preview swaps the registered underside mesh to the ceiling's own flat-tinted
 * material (built `BackSide`, the way it renders), so the hover preview matches
 * the committed result — a generic PBR preview would be invisible from below.
 */
export declare const ceilingPaint: import("@pascal-app/core").PaintCapability;
//# sourceMappingURL=paint.d.ts.map
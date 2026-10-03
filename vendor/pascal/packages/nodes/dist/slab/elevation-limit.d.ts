import { type AnyNode, type AnyNodeId, type SlabElevationClamp, type SlabNode } from '@pascal-app/core';
/** Level-local Y of a solid slab's underside (its placement anchor). */
export declare function getSlabBaseElevation(slab: Pick<SlabNode, 'elevation' | 'thickness'>): number;
/** Stable vertical reference used by relative slab presets. */
export declare function getSlabAnchorElevation(slab: Pick<SlabNode, 'elevation' | 'thickness' | 'recessed' | 'recessedRimElevation'>): number;
/**
 * Translate a solid slab to a new underside elevation without changing its
 * authored thickness. Recessed slabs use a different rim/depth contract and
 * keep the existing top/depth control instead.
 */
export declare function applySlabBaseElevationChange(slab: Pick<SlabNode, 'thickness'>, newBase: number): Pick<SlabNode, 'elevation'>;
/** Translate a solid underside or recessed rim without resizing the body. */
export declare function applySlabAnchorElevationChange(slab: Pick<SlabNode, 'elevation' | 'thickness' | 'recessed' | 'recessedRimElevation'>, newAnchor: number): Partial<SlabNode>;
export declare function getSlabRecessDepth(slab: Pick<SlabNode, 'elevation' | 'recessedRimElevation'>): number;
/** Resize a recess downward while keeping its rim anchor fixed. */
export declare function applySlabRecessDepthChange(slab: Pick<SlabNode, 'recessedRimElevation'>, newDepth: number): Pick<SlabNode, 'elevation'>;
/**
 * Resize a solid slab upward from its underside. The occupied interval changes
 * from [base, old top] to [base, base + new thickness], so anything hosted on
 * the walking surface observes the new elevation.
 */
export declare function applySlabThicknessChange(slab: Pick<SlabNode, 'elevation' | 'thickness'>, newThickness: number): Pick<SlabNode, 'elevation' | 'thickness' | 'recessed'>;
/**
 * Move a slab's authored top while preserving thickness. Recessed slabs keep
 * their pool-depth gesture; a grounded solid crossing below datum becomes
 * recessed. Solid slab thickness is edited separately.
 */
export declare function applySlabTopChange(slab: SlabNode, newTop: number): Partial<SlabNode>;
/**
 * Apply a signed surface preset around the current anchor. Negative values make
 * a recess below the anchor; positive values make a solid upward from it.
 */
export declare function applySlabElevationPreset(slab: SlabNode, signedDepth: number): Partial<SlabNode>;
/**
 * Level-context wrapper over the pure core clamp: a slab under
 * plane-bound walls may not rise past the storey plane minus the
 * minimum wall height. Slabs outside a level (no parent) are
 * unconstrained.
 */
export declare function clampSlabElevation(nodes: Readonly<Record<AnyNodeId, AnyNode>>, slab: SlabNode, proposedElevation: number): SlabElevationClamp;
/** Drag-time upper bound for the slab height arrow; +Infinity when unconstrained. */
export declare function slabElevationUpperBound(nodes: Readonly<Record<AnyNodeId, AnyNode>>, slab: SlabNode): number;
//# sourceMappingURL=elevation-limit.d.ts.map
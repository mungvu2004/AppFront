import { type AnyNode } from '@pascal-app/core';
import { type SurfacePlanSnapInput, type SurfacePlanSnapResult } from './surface-plan-snap';
export declare const SLAB_ALIGNMENT_THRESHOLD_M = 0.08;
export type SlabPlanSnapInput = SurfacePlanSnapInput;
export type SlabPlanSnapResult = SurfacePlanSnapResult;
export declare function clearSlabSnapFeedback(): void;
export declare function resolveSlabPlanPointSnap(input: SlabPlanSnapInput): SlabPlanSnapResult;
export type SlabEdgeBandSnapInput = {
    /** Candidate edge endpoints after the raw/grid perpendicular translation. */
    edge: [[number, number], [number, number]];
    levelId?: string | null;
    nodes?: Readonly<Record<string, AnyNode>>;
    /**
     * Plan point (typically the cursor) the snap beacon should hug along
     * the wall. Falls back to the snapped edge's midpoint.
     */
    referencePoint?: [number, number];
    /** Override the mode-driven magnetic gate (tests). */
    magnetic?: boolean;
};
export type SlabEdgeBandSnapResult = {
    /** The candidate edge translated onto the wall centerline. */
    edge: [[number, number], [number, number]];
    wallId: string;
};
/**
 * Edge-level slab reshape snap against wall footprint bands. Unlike the
 * cursor-based `resolveSlabPlanPointSnap`, this tests the DRAGGED EDGE
 * itself (band adoption, span overlap — same permissiveness as the
 * render rule) and sticks it onto the wall CENTERLINE, the canonical
 * stored position; the render rule then places it flush with the face.
 * The beacon, the live preview and the committed polygon therefore all
 * agree. In non-magnetic modes only a tight connect-radius stick
 * remains, mirroring the sanctioned wall connect snap. Publishes /
 * clears the wall-snap beacon as a side effect.
 */
export declare function resolveSlabEdgeBandSnap(input: SlabEdgeBandSnapInput): SlabEdgeBandSnapResult | null;
//# sourceMappingURL=slab-plan-snap.d.ts.map
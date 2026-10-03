import type { GutterNode, RoofSegmentNode } from '@pascal-app/core';
/**
 * Shared eave-Y for a connected run of gutters.
 *
 * Each gutter normally derives its mount height independently from its
 * own host segment via `computeEaveY` (wallHeight − overhang·tan(pitch)
 * + tuck, or wallHeight on a flat deck). Two segments that read as the
 * same height in the inspector can still land at different eave Ys when
 * their pitch / overhang / roofType differ — so gutters that meet at a
 * corner inherit two heights and the run visibly steps at the joint.
 *
 * This walks the connected component of gutters that meet at corners
 * (same plan-space endpoint test the mitre detector uses — Y is
 * deliberately ignored, so the grouping survives the very height drift
 * we're correcting) and returns ONE height for the whole run: the
 * HIGHEST member eave. Aligning up means no gutter ever sinks into a
 * roof surface; a lower roof gets a small fascia gap, which reads
 * cleaner than a gutter clipping through its slope.
 *
 * Deterministic + symmetric: every gutter in the run computes the same
 * component and the same max, so they all converge on the identical Y
 * without any shared coordinator or store write. Isolated gutters (no
 * corner neighbour) get their own eave Y unchanged.
 *
 * Pure: no React, no scene access, no store mutation.
 */
/** A sibling gutter paired with its FULL host segment (needs the eave-Y inputs). */
export type GutterWithSegment = {
    gutter: GutterNode;
    segment: RoofSegmentNode;
};
export declare function computeSharedEaveY(subject: GutterNode, subjectSegment: RoofSegmentNode, siblings: readonly GutterWithSegment[]): number;
//# sourceMappingURL=eave-align.d.ts.map
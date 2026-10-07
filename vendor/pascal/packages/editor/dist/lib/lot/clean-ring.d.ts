/**
 * Lot ring cleanup — a GIS parcel ring as the registry draws it, made fit
 * for planning geometry (setbacks, the street edge, yard dimensions).
 *
 * What comes back from a parcel layer (seen live on the Land Park preset,
 * 2026-09-06): the closing vertex repeated, points dropped along straight
 * lines, and a curb-return CORNER drawn as nine ~1 m segments turning
 * 8–12° each. Left alone, that ring breaks everything downstream: the
 * street-facing "edge" the road detector picks is a 1 m sliver of the arc,
 * the sliver takes the 20 ft front setback while the real 30 ft frontage
 * beside it takes 5 ft, the offset lines cross and the setback envelope
 * collapses to nothing — and the house lands at the origin, unplaced.
 *
 * Three passes, each pure and tested:
 *   1. duplicates — consecutive vertices closer than `DUPLICATE_M` merge,
 *      the closing repeat goes;
 *   2. collinear — a vertex whose turn is under `COLLINEAR_DEG` goes;
 *   3. arcs — a run of short edges (each ≤ `ARC_EDGE_MAX_M`, the run ≤
 *      `ARC_RUN_MAX_M` long) between two longer edges that meet at
 *      ≥ `ARC_MIN_TURN_DEG` is a rounded or chamfered corner: its vertices
 *      are replaced by the corner the two long edges make when extended. A
 *      surveyed plat calls that point the lot corner; the envelope drawn
 *      from the squared edges sits inside the curved line by far more than
 *      the rounding took away, so it is the conservative reading for
 *      setbacks. The recorded lot area is never recomputed from it.
 *
 * Returns the cleaned ring with a count of what each pass removed, so the
 * caller can say so in the parcel notes.
 */
import type { Pt } from '../floorplan/site-plan/geometry';
export declare const DUPLICATE_M = 0.05;
export declare const COLLINEAR_DEG = 1.5;
/** A 10 ft corner cut (3.05 m) is a chamfer; a 15 ft one is a real side. */
export declare const ARC_EDGE_MAX_M = 3.5;
export declare const ARC_RUN_MAX_M = 12;
export declare const ARC_MIN_TURN_DEG = 20;
export interface CleanRingResult {
    points: Pt[];
    removed: {
        duplicates: number;
        collinear: number;
        arcVertices: number;
        arcs: number;
    };
}
/** Pass 1: consecutive near-duplicates (and the closing repeat) merge. */
export declare function dropDuplicateVertices(points: readonly Pt[], tol?: number): Pt[];
/** Pass 2: vertices that do not turn go. */
export declare function mergeCollinearVertices(points: readonly Pt[], tolDeg?: number): Pt[];
/**
 * Pass 3: rounded / chamfered corners squared. A run is a maximal set of
 * consecutive SHORT edges between two LONG edges; every vertex of the run
 * (the point where the long edge before it ends, through the point where
 * the long edge after it starts) is replaced by the long edges'
 * intersection when the run is short, the long edges meet at a real angle,
 * and the corner point lands near the run.
 */
export declare function squareCornerArcs(points: readonly Pt[], opts?: {
    edgeMax?: number;
    runMax?: number;
    minTurnDeg?: number;
}): {
    points: Pt[];
    arcs: number;
    arcVertices: number;
};
/** All three passes. */
export declare function cleanLotRing(points: readonly Pt[]): CleanRingResult;
/** One sentence for the parcel notes, or '' when nothing was removed. */
export declare function describeRingCleanup(before: number, result: CleanRingResult): string;
//# sourceMappingURL=clean-ring.d.ts.map
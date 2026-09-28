import type { GutterNode, RoofSegmentNode } from '@pascal-app/core';
/**
 * Auto-mitre detector for two gutters meeting at a roof corner.
 *
 * When two gutters' endpoints land within `CORNER_EPSILON` of each
 * other in plan (ROOF-local X/Z — see `planDistSq`), the renderer
 * treats them as a single L-junction and skews each end so the back
 * walls meet at the inner corner while the front rims extend outward to
 * a clean mitre.
 *
 * Why "back wall stays at the corner": the gutter mounts against the
 * fascia (gutter-local +X is the length, +Z is outward over the eave).
 * Two perpendicular fascias meet at the eave corner — that's the
 * fixed point. The rims hang in space past the building, so they're
 * the parts that need to extend to actually touch each other.
 *
 * For 90° (typical hip / rectangular plan) corners the mitre is 45°
 * each side; arbitrary angles use the standard mitre formula
 * `(π − interior) / 2`. Aligned gutters (interior ≈ π) → mitre 0 → no
 * displacement, no cap suppression — they read as a straight run.
 *
 * Cross-segment: endpoints + length axes are lifted into the shared
 * ROOF frame (each gutter's segment position + Y-rotation applied), so
 * gutters on DIFFERENT roof segments (L-shaped plans, additions) mitre
 * at the corner where their segments meet — not just gutters sharing a
 * segment. Same-segment corners fall out of the same path (both gutters
 * carry the same segment transform). The skew assumes a convex (outer)
 * corner; a concave inner corner mitres approximately.
 */
export type GutterMitres = {
    /**
     * SIGNED mitre angle (radians) at the gutter's −X end; 0 = no mitre.
     * Positive = CONVEX (outer) corner — the front rim EXTENDS past the
     * end to reach the outer eave intersection. Negative = CONCAVE (inner)
     * corner — the rim RETRACTS to the inner intersection. The geometry
     * builder feeds the value straight through `Math.tan`, so the sign
     * flips the skew direction; `=== 0` still means "no mitre / keep cap".
     */
    left: number;
    /** Signed mitre angle (radians) at the gutter's +X end; see `left`. */
    right: number;
};
export declare const NO_MITRES: GutterMitres;
export declare const CORNER_EPSILON_SQ: number;
/** A sibling gutter paired with the segment it sits on, for the frame lift. */
export type GutterWithSegment = {
    gutter: GutterNode;
    segment: Pick<RoofSegmentNode, 'position' | 'rotation'>;
};
export type Endpoint = {
    pos: readonly [number, number, number];
    /** Length-axis direction in segment frame, pointing from this end toward the other end. */
    awayDir: readonly [number, number];
    /** Outward normal (gutter-local +Z, "away from the building") in this frame. */
    outDir: readonly [number, number];
};
/**
 * Gutter endpoints lifted from segment-local into the shared ROOF frame
 * by applying the host segment's position + Y-rotation. Two gutters on
 * different segments can then be compared in one frame. THREE's
 * rotation-y convention: a point/dir (x, z) rotates to
 * (x·cos + z·sin, −x·sin + z·cos).
 */
export declare function gutterEndpointsInFrame(g: GutterNode, segment: Pick<RoofSegmentNode, 'position' | 'rotation'>): {
    plus: Endpoint;
    minus: Endpoint;
};
export declare function planDistSq(a: readonly [number, number, number], b: readonly [number, number, number]): number;
/**
 * Compute mitres for `subject` against every other gutter under the
 * same parent.
 *
 * A corner is the INTERSECTION of the two gutters' length-axis lines —
 * not the proximity of their endpoints. This is what makes inner
 * (concave) corners work: there the two eave drip-lines meet out in the
 * notch, a full overhang away from where either gutter naturally ends,
 * so an endpoint-to-endpoint test never fired. Keying off the axis
 * crossing treats convex and concave identically. The length-snap pulls
 * both ends out to that shared point, so by the time we mitre the
 * subject's end AND the sibling's end both sit on the intersection — we
 * require both to be within `CORNER_EPSILON` of it, which also rejects
 * runs that merely cross in the middle (a T, not an L).
 *
 * First match per end wins; siblings order is the caller's, so the
 * result is deterministic.
 */
export declare function computeGutterMitres(subject: GutterNode, subjectSegment: Pick<RoofSegmentNode, 'position' | 'rotation'>, siblings: readonly GutterWithSegment[]): GutterMitres;
//# sourceMappingURL=corner-mitre.d.ts.map
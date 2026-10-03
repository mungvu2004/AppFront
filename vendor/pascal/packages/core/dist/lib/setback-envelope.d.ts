/**
 * The BUILDABLE ENVELOPE as the zoning officer draws it: every lot line
 * pushed inward by its own required yard, measured perpendicular to that
 * line, the offsets clipped against each other where they meet. A curved
 * (radius) lot line — a cul-de-sac frontage, a rounded corner — offsets to
 * a CONCENTRIC curve, never a chord — the industry-standard setback for pie
 * shapes, radius corners and odd lots.
 *
 * Built as a distance field rather than by intersecting offset lines: a
 * point is buildable when its distance to EVERY lot line is at least that
 * line's setback. The zero contour of `min_i(dist(p, line_i) − d_i)` over
 * the lot is exactly the variable-distance inward offset — straight where
 * the lot is straight, concentric round a radius, clipped where offsets
 * cross, and rounded round a reflex notch — for convex, pie-shaped,
 * L-shaped and radius-cornered lots alike. The contour is traced by the
 * same marching squares the site plan draws terrain with, then simplified
 * so a rectangle comes back as four corners and an arc keeps its vertices.
 */
export type Pt = readonly [number, number];
export declare function polygonAreaAbs(points: readonly Pt[]): number;
/**
 * Which edges belong to the same ARC RUN: consecutive short edges (under
 * `shortM`) turning gently (under `turnDeg` per vertex) — the county
 * fabric's way of drawing a radius. A long edge is its own run. Returns
 * the run id per edge.
 */
export declare function arcRuns(points: readonly Pt[], shortM?: number, turnDeg?: number): number[];
/**
 * The polygon `points` offset INWARD by `distances[i]` along edge i (edge i
 * runs from points[i] to points[i + 1]). Empty when nothing buildable
 * remains. The result starts near the lot's first vertex and winds the
 * lot's way.
 */
/** A half-plane the envelope may not enter: the line a→b, `inside` a point on the forbidden side (a sight triangle's hypotenuse, the corner inside). */
export type KeepOut = {
    a: Pt;
    b: Pt;
    inside: Pt;
};
export declare function insetPolygon(points: readonly Pt[], distances: readonly number[], options?: {
    resolution?: number;
    simplifyM?: number;
    keepOut?: readonly KeepOut[];
}): Pt[];
/**
 * Which envelope edge is the one behind the lot's front line: the longest
 * envelope edge running parallel to it (within 25°) with its midpoint
 * nearest that line; failing that, the envelope edge whose midpoint is
 * nearest the lot front's midpoint (a pie lot's curved frontage has no
 * single parallel — its longest arc chord fronts the house).
 */
export declare function envelopeFrontEdge(lot: readonly Pt[], frontIndex: number, envelope: readonly Pt[]): number;
/**
 * The CORNER SIGHT TRIANGLE at a street intersection (the clear-vision /
 * visibility triangle): from the point where the two street lines meet —
 * the right-of-way lines extended through the curb return — `legM` along
 * each, the hypotenuse joining them; nothing over the code's height (30
 * in typically) stands inside it. The leg is the ordinance's (25 ft is the
 * common residential figure; FDOT and the Greenbook size it by speed) —
 * verify locally. `edgeA` and `edgeB` are the two street edges; null when
 * their lines are parallel or the corner lies far from both.
 */
export declare function sightTriangle(points: readonly Pt[], edgeA: number, edgeB: number, legM: number): {
    corner: Pt;
    a: Pt;
    b: Pt;
} | null;
/**
 * The street corners of a lot: pairs of street edges that meet at a real
 * turn (40° or more) directly or across a curb-return run of short edges.
 */
export declare function streetCorners(points: readonly Pt[], streetEdges: readonly number[]): [number, number][];
//# sourceMappingURL=setback-envelope.d.ts.map
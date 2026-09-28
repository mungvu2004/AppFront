/**
 * The setback envelope in the 3D site — the same rules the site plan draws
 * (packages/editor/src/lib/floorplan/site-plan/geometry.ts: front edge,
 * edge roles, per-role setbacks, offset-line intersections), ported here
 * because the nodes package cannot import the editor. Pure. When the site
 * has setbacks, the 3D view draws them black and dashed.
 */
export type Pt = readonly [number, number];
export type EdgeRole = 'front' | 'rear' | 'left' | 'right' | 'street';
export type SetbackInputs = {
    front: number;
    side: number;
    rear: number;
    left?: number;
    right?: number;
    /** A corner lot's second street side; absent = the front setback. */
    streetSide?: number;
};
export declare function polygonArea(points: readonly Pt[]): number;
export declare function isCounterClockwise(points: readonly Pt[]): boolean;
/** Unit normal of edge i pointing OUT of the polygon (away from its centroid). */
export declare function outwardNormal(points: readonly Pt[], i: number): Pt;
/** The most north-facing edge (plan up = −z = north, turned by `northRotation`). */
export declare function mostNorthFacingEdge(points: readonly Pt[], northRotation?: number): number;
export declare function resolveFrontEdge(points: readonly Pt[], frontEdge: number | undefined, northRotation?: number): number;
export declare function classifyEdges(points: readonly Pt[], frontIndex: number, streetEdges?: readonly number[]): EdgeRole[];
export declare function setbackForRole(setbacks: SetbackInputs, role: EdgeRole): number;
/** The buildable envelope: every edge pushed inward by its role's setback (see the editor's copy for the rules). */
export declare function setbackEnvelope(points: readonly Pt[], setbacks: SetbackInputs, frontIndex: number, options?: {
    streetEdges?: readonly number[];
    sightTriangleM?: number;
}): Pt[];
//# sourceMappingURL=setbacks.d.ts.map
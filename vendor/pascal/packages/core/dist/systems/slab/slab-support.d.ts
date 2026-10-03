import type { SlabNode, WallNode } from '../../schema/index.js';
export type SlabElevationClamp = {
    elevation: number;
    clamped: boolean;
};
/**
 * Clamp-never-ask upper bound for a slab's elevation. A plane-bound wall
 * (no stored `height`) keeps its top at the storey plane, so a slab that
 * rises past `storeyHeight - MIN_WALL_HEIGHT` while electing as that
 * wall's base would squeeze the wall body below its minimum (and at the
 * plane, to nothing). Walls with explicit heights don't constrain — their
 * top rides the elected base, not the plane. Negative proposals (the
 * drag-through-zero path that commits the `recessed` intent) pass
 * through untouched: this is a purely numeric upper bound.
 *
 * The election runs against `levelSlabs` with `proposedElevation`
 * substituted into `slab`, so a slab that would only WIN the election at
 * the proposed elevation still clamps, and a slab out-elected by a
 * sibling doesn't. Pure.
 */
export declare function clampSlabElevationForWalls(proposedElevation: number, slab: SlabNode, levelWalls: WallNode[], levelSlabs: readonly SlabNode[], storeyHeight: number): SlabElevationClamp;
/**
 * Static upper bound for a slab-elevation drag: probe the election with
 * the slab raised above every sibling and the storey plane. If any
 * plane-bound wall would elect it there, the drag may not pass
 * `storeyHeight - MIN_WALL_HEIGHT`; otherwise it is unbounded above.
 */
export declare function getSlabElevationUpperBound(slab: SlabNode, levelWalls: WallNode[], levelSlabs: readonly SlabNode[], storeyHeight: number): number;
/**
 * Point-in-polygon test using ray casting algorithm.
 */
export declare function pointInPolygon(px: number, pz: number, polygon: Array<[number, number]>): boolean;
export declare function pointOnPolygonBoundary(px: number, pz: number, polygon: Array<[number, number]>): boolean;
export type WallOverlapInput = {
    start: [number, number];
    end: [number, number];
    curveOffset?: number;
    thickness?: number;
};
/**
 * Test whether a wall overlaps a slab polygon along a segment of its length.
 *
 * The wall's centerline and both face lines are clipped against the polygon;
 * the wall overlaps when the longest clipped inside-or-on-boundary length
 * exceeds a threshold (5cm, halved for very short walls). Because interval
 * midpoints classify "on the boundary" as inside explicitly (never by
 * ray-cast tie-breaking), a wall sitting exactly on a slab edge resolves
 * identically on every side of the slab.
 *
 * A wall that only touches the polygon at a point — a perpendicular wall
 * butting into a room's edge, or a corner-to-corner touch — clips to ~zero
 * length and does NOT overlap.
 */
export declare function wallOverlapsPolygon(startOrWall: [number, number] | WallOverlapInput, endOrPolygon: [number, number] | Array<[number, number]>, polygonArg?: Array<[number, number]>): boolean;
/**
 * {@link wallOverlapsPolygon} with the slab's stored holes subtracted from
 * the covered length: a wall whose band only reaches the polygon inside a
 * hole does not overlap. Hole boundaries keep coverage (rim convention —
 * see {@link computeWallSlabSupport}). Polygon boundary contact counts as
 * covered, so a wall sitting exactly on a slab edge resolves identically
 * on every side of the slab. Pure.
 */
export declare function wallOverlapsSlabFootprint(wallLike: WallOverlapInput, polygon: Array<[number, number]>, holes?: ReadonlyArray<Array<[number, number]>>): boolean;
/**
 * Tolerance for the pointer-decided support cap: a slab still counts as
 * "the surface you're pointing at (or below)" when its walking surface is
 * within this many meters ABOVE the pointed elevation. Absorbs elevation
 * noise between the ray hit and slab tops without letting a deck hanging
 * clearly above the hit point capture the election. Defined here (rather
 * than in the spatial-grid manager, which re-exports it) so the wall
 * election below can honour the same cap without an import cycle.
 */
export declare const SUPPORT_ELEVATION_EPSILON = 0.05;
/**
 * Base elevation for a wall, decided by which slabs actually SUPPORT it.
 *
 * Support is measured as covered length: the wall's centerline and face
 * lines are clipped against each slab's RENDERED footprint
 * (`getRenderableSlabPolygon` with the level walls + siblings, not the
 * stored polygon — legacy polygons stored at wall faces or with old
 * baked offsets fall short of the wall body, but their band-adopted
 * rendered edge reaches the wall's outer face) minus the slab's stored
 * holes (holes are data, never render-offset). A slab supporting less
 * than `WALL_SLAB_MIN_OVERLAP` of the wall is ignored entirely (point
 * contact, endpoint grazes).
 *
 * Same-elevation slabs pool their coverage. `elevation` is elected from
 * the wall's carrying profile: per arc segment, the highest support on
 * each face, then the min across supported faces — so a slab that only
 * brushes one face (e.g. an elevated deck adjacent along the outer face)
 * never lifts the wall origin. The highest carrying elevation covering
 * at least `WALL_SLAB_SUPPORT_MAJORITY` of the wall wins, or the
 * best-covered carrying elevation when none reaches majority.
 * `baseElevation` only fills down
 * where a lower support remains exposed on a wall face after higher,
 * overlapping support is accounted for. Coincident floor/platform slabs
 * therefore keep the wall on the platform, while slabs on opposite wall
 * sides bridge correctly. A slab touching only one endpoint never enters
 * either result. Pure;
 * exported for tests.
 */
export type WallSlabSupport = {
    /** Existing wall-relative floor elevation used by hosted children and wall height. */
    elevation: number;
    /** Slab whose elevation won the election, or null when the wall has no support. */
    electedSlabId: string | null;
    /** Lowest exposed adjacent support; wall geometry fills down to this elevation. */
    baseElevation: number;
    /** Piecewise bottom elevation along the wall centerline, in normalized arc-length units. */
    baseSegments: WallSlabSupportSegment[];
};
export type WallSlabSupportSegment = {
    start: number;
    end: number;
    elevation: number;
};
export declare function computeWallSlabSupport(wallLike: WallOverlapInput, slabs: readonly SlabNode[], levelWalls: WallNode[], preferredSlabId?: string | null, maxElevation?: number | null, levelBase?: number): WallSlabSupport;
export declare function computeWallSlabElevation(wallLike: WallOverlapInput, slabs: readonly SlabNode[], levelWalls: WallNode[]): number;
//# sourceMappingURL=slab-support.d.ts.map
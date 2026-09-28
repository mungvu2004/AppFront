import type { GeometryContext } from '../registry/types.js';
import type { AnyNode, AnyNodeId, SlabNode, WallNode } from '../schema/index.js';
export type SlabPolygonContext = {
    /** Walls on the slab's level. */
    walls: WallNode[];
    /** Other slabs on the same level — the slab itself must be excluded. */
    siblingSlabs: SlabNode[];
};
/** [ax, az, bx, bz] segment in plan space. */
type Segment = [number, number, number, number];
/** A sibling slab edge and the direction of its polygon interior. */
type NeighborSegment = {
    slab: SlabNode;
    segment: Segment;
    bounds: Bounds;
    elevation: number;
    /** Unit normal pointing into the sibling polygon at this edge. */
    inwardX: number;
    inwardZ: number;
};
/**
 * Derive a {@link SlabPolygonContext} from a registry `GeometryContext`:
 * sibling slabs come from `ctx.siblings` (same kind, same parent, self
 * excluded) and walls from the parent level's children.
 */
export declare function slabPolygonContextFromGeometry(ctx: GeometryContext | undefined): SlabPolygonContext;
export declare function slabPolygonContextForLevel(parent: AnyNode | null, resolve: (id: AnyNodeId) => AnyNode | undefined, fallbackSlabs?: SlabNode[]): SlabPolygonContext;
export declare function getRenderableSlabPolygon(slabNode: SlabNode, context: SlabPolygonContext | PreparedSlabPolygonContext): Array<[number, number]>;
type WallCandidate = {
    wall: WallNode;
    segments: Segment[];
    halfThickness: number;
};
export type SlabEdgeWallBandSnap = {
    wallId: WallNode['id'];
    /** The candidate edge translated perpendicular onto the wall centerline. */
    edge: [[number, number], [number, number]];
};
/**
 * Reshape-snap counterpart of the render band rule: when the edge
 * `a → b` lies inside a wall's footprint band, return the edge
 * translated onto that wall's CENTERLINE — the canonical stored
 * position (matching what auto slabs store); the render rule then
 * places it at the face. `maxLateral` optionally tightens the stick
 * distance (non-magnetic modes keep only a connect-radius stick).
 */
export declare function snapSlabEdgeToWallBand(a: [number, number], b: [number, number], walls: readonly WallNode[], options?: {
    maxLateral?: number;
}): SlabEdgeWallBandSnap | null;
type Bounds = [number, number, number, number];
export declare function scopeSlabPolygonContext(slab: SlabNode, context: PreparedSlabPolygonContext): PreparedSlabPolygonContext;
export declare function slabPolygonContextChanges(before: PreparedSlabPolygonContext, after: PreparedSlabPolygonContext): (slab: SlabNode) => boolean;
type PreparedWallCandidate = WallCandidate & {
    bounds: Bounds;
};
type PreparedSlabPolygonContext = SlabPolygonContext & {
    wallCache: WeakMap<WallNode, PreparedWallCandidate>;
    neighborCache: WeakMap<SlabNode, NeighborSegment[]>;
    wallCandidates: PreparedWallCandidate[];
    neighborSegments: NeighborSegment[];
    siblingBreakTolerance: number;
};
export declare function prepareSlabPolygonContext(context: SlabPolygonContext, previous?: PreparedSlabPolygonContext): PreparedSlabPolygonContext;
export {};
//# sourceMappingURL=slab-polygon.d.ts.map
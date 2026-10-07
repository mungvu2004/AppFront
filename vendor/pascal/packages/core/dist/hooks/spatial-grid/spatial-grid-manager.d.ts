import type { AnyNode, WallNode } from '../../schema/index.js';
import { type WallSlabSupport } from '../../systems/slab/slab-support.js';
export { itemOverlapsPolygon } from '../../lib/item-polygon-overlap.js';
export { computeWallSlabElevation, computeWallSlabSupport, pointInPolygon, SUPPORT_ELEVATION_EPSILON, type WallOverlapInput, type WallSlabSupport, type WallSlabSupportSegment, wallOverlapsPolygon, } from '../../systems/slab/slab-support.js';
export { type PlanAabb, type PlanVec2, planFootprintAABB, planFootprintCorners, } from '../../lib/plan-footprint.js';
/** One slab overlapping a queried footprint, as seen by support election. */
export type SlabSupportCandidate = {
    slabId: string;
    elevation: number;
};
export type ItemSlabSupport = {
    elevation: number;
    /** The winning slab, or null when no slab overlaps the footprint. */
    slabId: string | null;
};
export type PointedSupportSurface = ItemSlabSupport & {
    /**
     * Level-local XZ where the ray meets the pointed surface's plane, or
     * null when the ray never reaches it (grazing / aimed above the base).
     * This is the plan point the pointer actually indicates: unlike a grid
     * event-plane hit — whose XZ shifts with whatever height the event
     * plane currently rides at — it depends only on the ray and the
     * aimed-at surface, so election/preview at this point cannot flip when
     * the event plane changes storey.
     */
    point: [number, number] | null;
};
export declare class SpatialGridManager {
    private readonly floorGrids;
    private readonly wallGrids;
    private readonly walls;
    private readonly slabsByLevel;
    private readonly ceilingGrids;
    private readonly ceilings;
    private readonly itemCeilingMap;
    private readonly cellSize;
    constructor(cellSize?: number);
    private getFloorGrid;
    private getWallGrid;
    private getWallLength;
    private getWallHeight;
    private getCeilingGrid;
    private getSlabMap;
    /**
     * Per-slab RENDERED polygon cache (`getRenderableSlabPolygon`). Item
     * support queries run per frame and the projection scans the level's
     * walls + sibling slabs, so the result is cached per slab id and
     * dropped for the whole level whenever a slab or wall on that level
     * flows through the manager's create/update/delete handlers.
     */
    private readonly renderedSlabPolygons;
    private invalidateRenderedSlabPolygons;
    /**
     * True while a slab or wall on `levelId` has a live preview: group drags
     * publish translated slab polygons and wall endpoints to
     * `useLiveNodeOverrides`, and the slab move tool / room-preset stamp
     * publish a translation DELTA to `useLiveTransforms` — either way the
     * scene store commits only on release, so the committed cache and index
     * would elect support against pre-drag footprints (items and walls
     * visibly drop to ground mid-preview). Support queries then read
     * live-effective records and skip the rendered-polygon cache.
     */
    private levelHasLivePreview;
    /**
     * The live-effective slab record: field overrides merged, then the
     * `useLiveTransforms` DELTA (slab publishers — move tool, room-preset
     * stamp — store a translation, not an absolute position) applied to the
     * polygon, holes, and elevation. Mapping happens exactly ONCE at each
     * public query's loop entry: `slabSupportsFootprint` /
     * `getRenderedSlabPolygon` take the already-effective record and must
     * never re-map, or the delta would apply twice.
     */
    private effectiveSlabRecord;
    private getRenderedSlabPolygon;
    /**
     * Support test shared by election, candidate listing, and persisted-host
     * validation: the footprint overlaps the slab's RENDERED polygon (what
     * users see — matching the wall election in `computeWallSlabSupport`),
     * with the center-point hole veto kept against the stored holes (holes
     * are data, never render-offset).
     */
    private slabSupportsFootprint;
    handleNodeCreated(node: AnyNode, levelId: string): void;
    handleNodeUpdated(node: AnyNode, levelId: string): void;
    handleNodeDeleted(nodeId: string, nodeType: string, levelId: string): string[];
    canPlaceOnFloor(levelId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
    };
    canPlaceOnFloorFootprints(levelId: string, footprints: readonly {
        position: [number, number, number];
        dimensions: [number, number, number];
        rotation: [number, number, number];
    }[], ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
    };
    /**
     * Check if an item can be placed on a wall
     * @param levelId - the level containing the wall
     * @param wallId - the wall to check
     * @param localX - X position in wall-local space (distance from wall start)
     * @param localY - Y position (height from floor)
     * @param dimensions - item dimensions [width, height, depth]
     * @param attachType - 'wall' (needs both sides) or 'wall-side' (needs one side)
     * @param side - which side for 'wall-side' items
     * @param ignoreIds - item IDs to ignore in collision check
     */
    canPlaceOnWall(levelId: string, wallId: string, localX: number, localY: number, dimensions: [number, number, number], attachType?: 'wall' | 'wall-side', side?: 'front' | 'back', ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
        adjustedY: number;
        wasAdjusted: boolean;
    } | {
        valid: boolean;
        conflictIds: never[];
    };
    getWallForItem(levelId: string, itemId: string): string | undefined;
    /**
     * Get the total slab elevation at a given (x, z) position on a level.
     * Returns the highest slab elevation if the point is inside any slab polygon (but not in any holes), otherwise 0.
     */
    getSlabElevationAt(levelId: string, x: number, z: number): number;
    /**
     * Get the slab elevation for an item using its full footprint (bounding box).
     * Thin wrapper over {@link getSlabSupportForItem} for callers (and tests)
     * that only need the number.
     */
    getSlabElevationForItem(levelId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], maxElevation?: number | null): number;
    /**
     * Elect the supporting slab for a footprint: the highest-elevation slab
     * whose RENDERED polygon the footprint overlaps (center-point hole veto
     * applies). Returns `{ elevation: 0, slabId: null }` when nothing
     * overlaps.
     *
     * `maxElevation` is the pointer-decided cap: when set, only slabs whose
     * walking surface sits at or below `maxElevation +
     * SUPPORT_ELEVATION_EPSILON` may win — a deck hanging above the surface
     * the cursor ray actually hit never captures the election.
     */
    getSlabSupportForItem(levelId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], maxElevation?: number | null): ItemSlabSupport;
    /**
     * The walking surface the pointer actually points at: the nearest slab
     * plane the ray crosses INSIDE that slab's rendered polygon (hole veto
     * applies), or the level base (`elevation: 0, slabId: null`) when it
     * crosses none. Ray origin/direction are level-local. Deliberately a
     * point test, not a footprint test — it answers "which surface is under
     * the cursor", which then caps the footprint election so a deck hanging
     * above the aimed-at floor never lifts the placement. `point` is the
     * ray's crossing of that surface's plane — the stable plan point
     * callers should elect/preview at (see {@link PointedSupportSurface}).
     */
    getPointedSupportSurface(levelId: string, rayOrigin: [number, number, number], rayDirection: [number, number, number]): PointedSupportSurface;
    /**
     * All slabs supporting a footprint, one entry per overlapping slab
     * (highest elevation first; slab id breaks ties deterministically).
     * Commit-side ambiguity check: persist a `supportSlabId` only when the
     * candidates carry ≥ 2 distinct elevations.
     */
    getSupportCandidatesForFootprint(levelId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number]): SlabSupportCandidate[];
    /**
     * Elevation of a persisted support host for a footprint, or null when
     * the slab no longer exists on the level or no longer overlaps the
     * footprint (same overlap test as election). Deliberately read-only: a
     * host reshaped away is NOT cleared — callers fall back to election and
     * the stale reference resumes hosting if the slab's polygon returns.
     * Slab deletion is the only writer (`deleteNodesAction` strips it).
     */
    getHostSlabElevationForFootprint(levelId: string, slabId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number]): number | null;
    /**
     * Get the slab elevation for a wall by checking if it overlaps with any slab polygon (excluding holes).
     * Returns the highest slab elevation found, or 0 if none.
     *
     * Accepts an optional `curveOffset` so curved walls evaluate overlap
     * against their actual centerline samples, not just the chord.
     */
    getSlabElevationForWall(levelId: string, start: [number, number], end: [number, number], curveOffset?: number, thickness?: number, preferredSlabId?: string | null): number;
    getSlabSupportForWall(levelId: string, start: [number, number], end: [number, number], curveOffset?: number, thickness?: number, preferredSlabId?: string | null, maxElevation?: number | null, supportOffset?: number): WallSlabSupport;
    /**
     * Effective slab and wall records for a level, held BY IDENTITY. A single
     * viewer pass queries support once per wall, and each query used to derive
     * both arrays afresh — mapping every wall on the level through
     * `getEffectiveNode` — which also defeated the rendered-polygon memo
     * downstream in `computeWallSlabSupport`. Rebuilt only when the scene
     * nodes, either live-preview store, or the manager's own slab/wall
     * bookkeeping changes.
     */
    private supportInputsRevision;
    private readonly supportInputs;
    private getSupportInputs;
    /**
     * Walls on a level, resolved fresh from the scene store (the manager's
     * own wall map is only maintained on create/delete, not on updates).
     * Cached per scene `nodes` record so per-pointer-tick callers
     * (door/window move) don't rescan the node map.
     */
    private readonly levelWallsCache;
    private getLevelWallNodes;
    /**
     * Check if an item can be placed on a ceiling.
     * Validates that the footprint is within the ceiling polygon (but not in any holes) and doesn't overlap other ceiling items.
     */
    canPlaceOnCeiling(ceilingId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
    };
    clearLevel(levelId: string): void;
    clear(): void;
}
export declare const spatialGridManager: SpatialGridManager;
/** Level-local Y where the rendered wall mesh begins. */
export declare function getWallBaseElevationForNodes(wall: WallNode, nodes: Record<string, AnyNode>): number;
/**
 * Effective (extruded) height of a wall resolved from a nodes record:
 * {@link resolveWallEffectiveHeight} over the covering-clamped plane top
 * (`getWallPlaneTop`) and the singleton manager's slab election — so the
 * value always agrees with the rendered wall. One shared resolver for the
 * editor overlays (measurement label, action menu, side handles) that used
 * to copy this derivation locally.
 */
export declare function getWallEffectiveHeightForNodes(wall: WallNode, nodes: Record<string, AnyNode>): number;
//# sourceMappingURL=spatial-grid-manager.d.ts.map
import type { LevelNode, WallNode } from '../schema/index.js';
import type { AnyNode, AnyNodeId } from '../schema/types.js';
/**
 * Gap kept between a ceiling's stored height and its clamp bound (storey
 * plane or covering-slab underside), so the ceiling surface never
 * coincides with the solid above it.
 */
export declare const CEILING_CLAMP_MARGIN = 0.01;
/**
 * Stored storey height in meters (floor-to-floor). Falls back to
 * {@link DEFAULT_LEVEL_HEIGHT} for unmigrated legacy levels whose `height`
 * field is absent.
 */
export declare function getStoredLevelHeight(level: Pick<LevelNode, 'height'>): number;
export type LevelElevation = {
    /** World Y of the level's floor: cumulative heights and level offsets through this level. */
    baseY: number;
    /** Stored storey height of this level (fallback applied). */
    height: number;
    buildingId: string | null;
    ordinal: number;
};
export declare function getLevelElevations(nodes: Record<AnyNodeId, AnyNode>): Map<string, LevelElevation>;
export declare function getLevelFloorToFloorHeight(levelId: string, nodes: Record<AnyNodeId, AnyNode>): number;
/**
 * The id of the level directly above `levelId` in its own stack (same
 * resolved building, or the shared legacy stack for building-less levels):
 * the level with the lowest ordinal strictly greater than the queried
 * level's. `null` when the level is topmost or unresolvable.
 */
export declare function findLevelAboveId(levelId: string, elevations: Map<string, LevelElevation>): string | null;
/**
 * The level directly above `levelId` — see {@link findLevelAboveId}.
 * `null` when topmost or unresolvable. Pure.
 */
export declare function getLevelAbove(levelId: string, nodes: Record<AnyNodeId, AnyNode>): LevelNode | null;
/**
 * The id of the level directly below `levelId` in its own stack — mirror of
 * {@link findLevelAboveId}: the level with the highest ordinal strictly less
 * than the queried level's. `null` when the level is lowest or unresolvable.
 */
export declare function findLevelBelowId(levelId: string, elevations: Map<string, LevelElevation>): string | null;
/**
 * The level directly below `levelId` — see {@link findLevelBelowId}.
 * `null` when lowest or unresolvable. Pure.
 */
export declare function getLevelBelow(levelId: string, nodes: Record<AnyNodeId, AnyNode>): LevelNode | null;
/**
 * Underside of the LOWEST slab from the level above that covers
 * level-local point `[x, z]`, expressed in the queried level's local Y:
 * `floorToFloorHeight + (slab.elevation - slab.thickness)`. `recessed` slabs
 * (pools) never cover. `null` when no covering slab (or no level above).
 *
 * Coordinate spaces: levels stack in Y only (`LevelNode` carries no XZ
 * transform and the viewer's LevelSystem writes only `position.y`), so a
 * level-local `[x, z]` is valid in every level of the stack unchanged.
 */
export declare function getCoveringSlabUndersideAt(levelId: string, nodes: Record<AnyNodeId, AnyNode>, x: number, z: number): number | null;
/**
 * Top plane for a plane-bound wall on `levelId`, in level-local Y:
 * `min(stored storey height, lowest covering-slab underside over the wall's
 * span)` — a thick or flush slab on the level above SHORTENS the walls below
 * instead of colliding with them (Revit-style automatic attach).
 *
 * Coverage: the wall's thickness band (centerline + face lines, arc-aware)
 * is clipped against each covering slab's stored polygon minus holes via
 * {@link wallOverlapsSlabFootprint} — the same overlap machinery as the
 * support election. Point sampling is deliberately avoided: auto-slab
 * polygons derive from wall CENTERLINES, so perimeter walls sit exactly ON
 * the polygon boundary, where ray-cast point-in-polygon flips with the
 * edge's orientation (one wall clamped, its neighbor didn't). Boundary
 * contact counts as covered on every side of the slab.
 *
 * This is THE plane for a plane-bound wall (`height` absent). Explicit-height
 * walls ignore the value (`resolveWallTop` returns their stored height), so
 * passing it wherever a raw storey height feeds `resolveWallTop` /
 * `resolveWallEffectiveHeight` is always safe. Falls back to
 * {@link DEFAULT_LEVEL_HEIGHT} when `levelId` doesn't resolve to a level.
 */
export declare function getWallPlaneTop(wall: Pick<WallNode, 'start' | 'end'> & Partial<Pick<WallNode, 'thickness' | 'curveOffset'>>, levelId: string, nodes: Record<AnyNodeId, AnyNode>): number;
/**
 * Upper bound for a ceiling's stored height over `polygon` on `levelId`:
 * `min(storey plane, lowest covering-slab underside) - CEILING_CLAMP_MARGIN`.
 * The covering underside is sampled at every polygon vertex plus the
 * centroid — cheap, and a slab overlapping a convex-ish ceiling almost
 * always covers one of those points; exact polygon-vs-polygon overlap is
 * not worth its cost for a clamp bound. Ceiling outlines share footprint
 * edges with the slabs above them the same way walls do, so vertices
 * sitting exactly on a slab's boundary count as covered on every side
 * (see `slabCoversPoint`) instead of flipping with the edge orientation.
 *
 * Returns `Infinity` when `levelId` doesn't resolve, so callers clamp
 * against nothing rather than a garbage plane.
 */
export declare function getCeilingClampBound(levelId: string, nodes: Record<AnyNodeId, AnyNode>, polygon: ReadonlyArray<[number, number]>): number;
//# sourceMappingURL=storey.d.ts.map
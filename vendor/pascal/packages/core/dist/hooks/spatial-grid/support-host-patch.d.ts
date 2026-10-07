import type { AnyNode, AnyNodeId, FenceNode, WallNode } from '../../schema/index.js';
export type SupportSlabPatch = {
    supportSlabId: string | undefined;
};
export type SupportSlabPatchOptions = {
    /**
     * Pointer-decided support cap (level-local Y) — see
     * `FloorPlacedElevationArgs.maxElevation`. When set, the persisted host
     * reproduces the CAPPED election: the elected lower slab wins over a
     * deck hanging above the cap, and `GROUND_SUPPORT_ID` is stored when the
     * ground is elected while capped-out slabs still overlap the footprint.
     */
    maxElevation?: number | null;
    /** Pointer- or snap-decided host. Ground is a first-class support source. */
    preferredSlabId?: string | null;
    /** Persist even an unambiguous host so later overlapping slabs cannot re-elect it. */
    pinSupport?: boolean;
};
export type FrozenFloorPlacementOptions = {
    /** Canonical position before floor/support lift is applied. */
    position: [number, number, number];
    rotation?: unknown;
    /** Exact level-local elevation hit on a non-slab construction surface. */
    elevation: number;
    /** Slab/ground supporting that construction surface, when known. */
    preferredSlabId?: string | null;
};
export declare function resolveSupportSlabPatch(node: AnyNode, nodes: Record<string, AnyNode>, options?: SupportSlabPatchOptions): SupportSlabPatch;
/**
 * Freeze an exact pointed node-top elevation into a floor-placed node's
 * existing canonical Y offset, while pinning the slab/ground beneath that
 * surface. This deliberately does not create a live hosting edge to the
 * pointed node: arbitrary mesh faces can be edited or sloped, so placement
 * captures the plane the user chose at commit time.
 */
export declare function resolveFrozenFloorPlacementPatch(node: AnyNode, nodes: Record<string, AnyNode>, options: FrozenFloorPlacementOptions): SupportSlabPatch & {
    position: [number, number, number];
};
export declare function resolveWallSupportSlabPatch(wall: WallNode, nodes: Record<string, AnyNode>, options?: SupportSlabPatchOptions): SupportSlabPatch;
/**
 * Re-elect a moved wall without discarding an explicit construction source.
 *
 * Move tools change only the wall's plan geometry. A persisted host therefore
 * remains preferred when it still supports the new footprint; the normal
 * resolver falls back when a slab no longer overlaps. Ground is also an
 * explicit source, so preserving it keeps terrain-hosted walls on terrain.
 */
export declare function resolveMovedWallSupportSlabPatch(wall: WallNode, nodes: Record<string, AnyNode>): SupportSlabPatch;
/** Fence-like shape the fence host election needs — plain segment, arc, or spline. */
export type FenceSupportInput = Pick<FenceNode, 'start' | 'end' | 'curveOffset' | 'path' | 'thickness' | 'parentId'>;
/**
 * Support-host patch for a fence: elect the slab the fence line stands on
 * and persist it as `supportSlabId` (the fence lift resolves absent =
 * level floor — see `packages/nodes/src/fence/lift.ts`).
 *
 * The centerline (chord, sampled arc, or spline path) is turned into thin
 * band footprints and run through the same candidate machinery items use.
 * `options.maxElevation` is the pointer-decided cap: aiming at the floor
 * under a deck elects the floor, aiming at the deck top elects the deck.
 *
 * Persist rule: the items ambiguity rule (stacked candidates disagree)
 * PLUS the elevated-host case — a winner sitting meaningfully above the
 * level floor must be persisted even when unambiguous (a balcony deck with
 * nothing underneath), or the commit loses the election entirely since
 * fences run no per-frame election. A single default ground slab (its top
 * within `SUPPORT_ELEVATION_EPSILON` of the floor) stays unpersisted so
 * plain fences keep sitting at the level base. A capped-out election (all
 * overlapping slabs above the aimed-at ground) also resolves to the floor
 * via the same absent-host default. Pure; exported for tests.
 */
export declare function resolveFenceSupportSlabPatch(fence: FenceSupportInput, nodes: Record<string, AnyNode>, options?: SupportSlabPatchOptions): SupportSlabPatch;
export type FenceConstructionOptions = {
    supportCap?: number | null;
    preferredSupportSlabId?: string | null;
    constructionElevation?: number | null;
};
export declare function resolveFenceConstructionSupport(fence: FenceNode, levelId: string, nodes: Record<string, AnyNode>, options?: FenceConstructionOptions): FenceNode;
export type WallConstructionOptions = {
    supportCap?: number | null;
    preferredSupportSlabId?: string | null;
    constructionElevation?: number | null;
    constructionHeight?: number | null;
    flatConstructionBase?: boolean;
    constructionSourceNodeId?: AnyNodeId | null;
};
export declare function resolveTerrainWallConstructionOptions(nodes: Record<string, AnyNode>, levelId: string, point: readonly [number, number], defaults?: Record<string, unknown>): WallConstructionOptions | undefined;
export type WallConstructionResolution = {
    walls: WallNode[];
    sourceSupportUpdate: {
        id: AnyNodeId;
        data: SupportSlabPatch;
    } | null;
};
export declare function resolveWallConstruction(nodes: Record<string, AnyNode>, levelId: string, walls: readonly WallNode[], options?: WallConstructionOptions): WallConstructionResolution;
//# sourceMappingURL=support-host-patch.d.ts.map
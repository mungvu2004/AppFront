import { type AnyNodeId } from '@pascal-app/core';
import { type Camera, type Ray } from 'three';
export type PointerSupportSurface = {
    /** Level-local elevation of the pointed surface — the election cap. */
    elevation: number;
    /** Slab host, or the explicit ground sentinel when the level base won. */
    supportSlabId: string | null;
    /** Node whose upward-facing geometry supplied this surface, when applicable. */
    sourceNodeId: AnyNodeId | null;
    /** World-space Y of the same surface, for grid-plane / preview placement. */
    worldY: number;
    /**
     * World-space point where the pointer ray meets the pointed surface's
     * plane, or null when the ray never reaches it. Unlike the grid event's
     * own hit — whose XZ is perspective-skewed whenever the event plane
     * rides at a different storey than the aimed-at surface — this point
     * depends only on the ray and the pointed surface, so a preview /
     * election fed from it cannot flip with the event plane's height.
     */
    worldPoint: [number, number, number] | null;
    /** {@link PointerSupportSurface.worldPoint} in the grid event's
     *  `localPosition` (building-local) frame — a drop-in replacement for
     *  the event's plane-hit XZ. */
    localPoint: [number, number, number] | null;
};
/**
 * The walking surface the pointer actually points at: its level-local
 * elevation (for use as the slab-support election cap, `maxElevation`),
 * its world-space Y (for riding the grid event plane / draw preview on
 * it), and the ray's crossing of that surface's plane (the plan point the
 * cursor indicates).
 *
 * The grid event plane rides at the ghost's last height, so its hit point
 * alone can't be trusted (that feedback loop is what made a ghost under an
 * elevated deck blink between the deck top and the ground). But camera →
 * hit reconstructs the true pointer ray regardless of the plane height,
 * and the nearest slab plane that ray crosses inside its rendered polygon
 * IS the surface under the cursor — the deck top when aiming at the deck,
 * the floor/ground when aiming underneath it. The same reasoning applies
 * to the cursor XZ: the event plane's hit is skewed along the ray whenever
 * the plane sits on a different storey than the pointed surface, so
 * callers should place at `localPoint` / `worldPoint`, not the event hit.
 *
 * When the ray crosses no slab, the surface is the level base — and on the
 * storey that sits on the ground, that base is the sculpted terrain rather
 * than a plane, so `elevation` varies with XZ. Everything downstream already
 * treats it as a varying scalar, which is why terrain needs no new axis here.
 *
 * Returns null when no level is active (callers fall back to the
 * uncapped max election and the raw event hit).
 */
export declare function resolvePointerSupportSurface(camera: Camera, worldHit: readonly [number, number, number], options?: {
    includeNodeTopSurfaces?: boolean;
    pointerRay?: Ray;
}): PointerSupportSurface | null;
/** {@link resolvePointerSupportSurface}, elevation only — the election cap. */
export declare function resolvePointerSupportElevation(camera: Camera, worldHit: readonly [number, number, number]): number | null;
//# sourceMappingURL=pointer-support-cap.d.ts.map
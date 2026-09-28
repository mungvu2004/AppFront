import type { GutterNode } from '@pascal-app/core';
import { type OutletShape } from './profile-geometry';
/**
 * Outlet position lookup — used by the downspout (renderer / tool /
 * routing) to mount a pipe at one of the gutter's outlets without
 * walking the gutter's geometry pipeline.
 *
 * Returns the outlet's center in GUTTER-MESH-LOCAL frame (i.e. after
 * the gutter's own `position` + `rotation` have already been applied
 * by the renderer chain): X is along the gutter length, Y is the
 * gutter's vertical extent (−size, the trough floor), Z is outward
 * (the profile-dependent floor midpoint).
 *
 * The clamp mirrors the geometry's `resolveOutletPlacements` so the
 * lookup and the drilled hole agree on X. Ignores mitres — when a
 * gutter end is mitred its cap collapses, which shifts the clamp bound
 * by ≤ 6 mm; the drift is below what reads visually, and the gutter's
 * own CSG drill still cuts in the exact spot since it sees the full
 * mitre context.
 */
export type GutterOutletPlacement = {
    /** Gutter-mesh-local X — along the length axis, signed from center. */
    x: number;
    /** Gutter-mesh-local Y — the trough floor at −size. */
    y: number;
    /** Gutter-mesh-local Z — profile-dependent floor midpoint. */
    z: number;
    /** Nominal bore radius (= halfX); `bore * 2` is the outlet diameter. */
    bore: number;
    /** Outlet cross-section — round on half-round, rect on k-style / box. */
    shape: OutletShape;
    /** Bore half-extent along the gutter length (X) — the pipe nests just inside this. */
    innerHalfX: number;
    /** Bore half-extent outward (Z) — the pipe nests just inside this. */
    innerHalfZ: number;
};
/** Placement of the gutter's outlet with the given id, or null if absent / doesn't fit. */
export declare function resolveGutterOutletById(gutter: GutterNode, outletId: string | undefined): GutterOutletPlacement | null;
/** Placements for every fitting outlet, tagged with its id. */
export declare function resolveGutterOutlets(gutter: GutterNode): Array<GutterOutletPlacement & {
    id: string;
}>;
//# sourceMappingURL=outlet-lookup.d.ts.map
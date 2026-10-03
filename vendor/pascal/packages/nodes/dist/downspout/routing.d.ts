import type { DownspoutNode, GutterNode, RoofSegmentNode, SceneApi } from '@pascal-app/core';
import { type OutletDims, type OutletShape } from '../gutter/profile-geometry';
/**
 * Routing parameters that turn the downspout from a straight drop into
 * a pipe that actually returns to the wall. Derived from the host
 * gutter + its roof segment — the geometry builder stays pure (takes
 * this as data) so the renderer, the placement preview, and the handle
 * descriptors can all feed it the same numbers.
 */
export type DownspoutRouting = {
    /**
     * Distance the pipe must travel toward the wall (downspout-local −Z)
     * to leave the eave overhang and sit flat against the fascia. The
     * outlet hangs `overhang − tuck` outboard of the wall face, plus the
     * `floorMidZ` offset of the outlet within the trough — so the offset
     * elbow at the top steps the pipe back by exactly this much.
     */
    wallJog: number;
    /** Cross-section the pipe takes — round on half-round, rect on k-style / box. */
    shape: OutletShape;
    /**
     * Inner half-extents of the gutter's drilled collar (along-length X,
     * outward Z). The pipe's cross-section is clamped just under these so
     * it slip-fits up inside the collar instead of sharing a coincident
     * surface with it (the old pipe sat at exactly the bore and z-fought
     * the collar wall).
     */
    collarHalfX: number;
    collarHalfZ: number;
};
/**
 * Pure routing from resolved nodes — used by the renderer / preview /
 * tool, which already hold the effective gutter + segment.
 */
export declare function computeDownspoutRouting(gutter: GutterNode, segment: Pick<RoofSegmentNode, 'overhang'>, outletId: string | undefined): DownspoutRouting | null;
/**
 * Routing for the handle descriptors, which only get `(node, sceneApi)`.
 * Walks downspout → gutter → segment through the scene snapshot.
 */
export declare function resolveDownspoutRouting(node: DownspoutNode, sceneApi: SceneApi): DownspoutRouting | null;
/**
 * Rendered pipe cross-section — round (halfX = halfZ = radius) or rect,
 * following the host gutter's profile. Defaults to `diameter`-sized, but
 * each half-extent that lands within a hair of the collar's matching
 * bore is nudged just inside so the pipe slip-fits the collar instead of
 * sharing a coincident wall. A deliberately larger / smaller pipe is
 * left alone, so the diameter field stays honest.
 */
export declare function downspoutPipeDims(node: Pick<DownspoutNode, 'diameter' | 'shape'>, routing?: DownspoutRouting | null): OutletDims;
/**
 * The −Z distance the wall run actually sits at. The raw `wallJog`
 * reaches the wall *face*; we pull back by the pipe's outward half-depth
 * (so the pipe's surface — not its centerline — meets the wall) plus the
 * `standoff` (bracket gap / overshoot escape hatch), so the pipe sits
 * proud of the wall instead of burying into it.
 */
export declare function effectiveWallJog(node: Pick<DownspoutNode, 'diameter' | 'standoff' | 'shape'>, routing?: DownspoutRouting | null): number;
export type DownspoutPath = {
    /** Centerline points, top → bottom, in downspout-local space. */
    points: [number, number, number][];
    /** Bottom mouth — the kicked-out pipe end. */
    bottom: [number, number, number];
    /** Z of the vertical wall run (downspout-local; −jog). */
    wallRunZ: number;
    /** Y at the top of the straight wall run (just below the offset elbow). */
    wallRunTopY: number;
    /** Y at the bottom of the straight wall run (just above the kickout). */
    wallRunBottomY: number;
};
/**
 * Pure centerline of the routed pipe. Shared by the geometry builder
 * (sweeps a cylinder along it) and the handle descriptors (place the
 * length cube at `bottom`), so the dimension chrome can never drift
 * from the mesh.
 *
 * Local frame: Y = 0 at the gutter floor, −Y down, −Z toward the wall.
 * The four legs are the vertical drop out of the collar, the offset
 * elbow stepping back to the wall, the wall run, and the kickout.
 */
export declare function computeDownspoutPath(length: number, jog: number, allowKick?: boolean): DownspoutPath;
//# sourceMappingURL=routing.d.ts.map
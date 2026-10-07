/**
 * World-grid snap for tools that consume `grid:move` / `grid:click`.
 *
 * Tools historically snapped on `event.localPosition` (the cursor in the
 * active building's local frame). After the floor-plan grid was pulled
 * out of the rotated scene group, snapping has to follow the WORLD XZ
 * grid — otherwise a rotated building drags every placement off the
 * visible grid lines. This helper resolves the active building's pose
 * and projects the world snap back into local coords for storage.
 */
import { type AlignmentAnchor, type AlignmentGuide, type AnyNodeId, type BuildingPose, type ResolveAlignmentInBuildingResult } from '@pascal-app/core';
/**
 * Look up the active building's pose, or null when we're at the site root.
 * Used by tools that need to resolve alignment in world coords.
 *
 * Falls back through the active level's `parentId` because the 2D floor-plan
 * often runs with `selection.buildingId === null` while still operating
 * inside a specific building (the user is editing a level, not the building
 * shell itself). Without the fallback, alignment in the floor plan saw a
 * `buildingRotY === 0` pose and emitted world-axis guides — which appeared
 * diagonal once the building was rotated.
 *
 * Honours `useLiveTransforms` overrides: while the building is being moved
 * or rotated, the floor-plan scene <g> is driven by the live transform
 * (see `use-floorplan-scene-data.ts`), so alignment has to read the same
 * pose or the rotated anchors fall out of sync with the SVG transform and
 * guides drift off the visible grid mid-drag (and through any post-drag
 * frame where the live override is still set).
 */
export declare function getActiveBuildingId(): AnyNodeId | null;
export declare function getActiveBuildingPose(): BuildingPose | null;
/**
 * Resolve Figma-style alignment for tools whose anchors are in the active
 * building's local frame, but where alignment must run on the WORLD axes
 * (the frame the user sees the grid in). Wraps `resolveAlignmentInBuildingWorld`
 * with the active building lookup so callers don't repeat the boilerplate.
 *
 * Returns:
 *   - `guides` in WORLD coords (renderer must live in a world-space group),
 *   - `snap`   in BUILDING-LOCAL coords (ready to add to a local position).
 */
export declare function resolveAlignmentForActiveBuilding(args: {
    moving: readonly AlignmentAnchor[];
    candidates: readonly AlignmentAnchor[];
    threshold: number;
}): ResolveAlignmentInBuildingResult;
/**
 * Project WORLD-frame alignment guides into the active building's LOCAL frame.
 *
 * The 3D alignment layer is still mounted inside the building-local tool group,
 * so tools that resolve alignment on the world axes (item placement, slab move)
 * need their guides converted before publishing to `useAlignmentGuides`.
 */
export declare function projectAlignmentGuidesWorldToActiveBuildingLocal(guides: readonly AlignmentGuide[]): AlignmentGuide[];
/**
 * Resolve alignment in the 2D floor-plan view frame — the frame the user
 * sees the (always axis-aligned) grid lines in, regardless of how the
 * building has been rotated. Use this from EVERY 2D floor-plan path so
 * alignment guides stay parallel to the visible grid.
 *
 * Why it differs from `resolveAlignmentForActiveBuilding`: the 3D viewport
 * shows the world XZ grid, so world-frame alignment matches the visible
 * grid there. The 2D floor plan, however, rotates the scene `<g>` by
 * `floorplanSceneRotationDeg = FVR − buildingRot` and renders the grid
 * OUTSIDE that rotated group — so the visible axes are
 * `R(FVR − buildingRot) · local`. World-frame alignment would land on
 * world axes, which appear diagonal in this view; view-frame alignment
 * lands on the SVG axes the user actually reads.
 *
 * Returns guides in view-frame coords (correct input for the floor-plan
 * alignment-guide layer, which is mounted outside the rotated scene
 * group) and a snap delta projected back into building-local (so callers
 * can add it to a local position as-is).
 */
export declare function resolveAlignmentForFloorplanView(args: {
    moving: readonly AlignmentAnchor[];
    candidates: readonly AlignmentAnchor[];
    threshold: number;
}): ResolveAlignmentInBuildingResult;
/**
 * Snap a world XZ position to the grid, then express it in the active
 * building's local frame. When no building is active, world == local.
 */
export declare function snapWorldXZForActiveBuilding(worldX: number, worldZ: number, step: number): {
    world: [number, number];
    local: [number, number];
};
/**
 * Snap a building-local plan point so the resulting position sits on the
 * world XZ grid. The returned point is still in building-local coords —
 * useful as a `gridSnap` callback for snapWallDraftPoint / snapFenceDraftPoint
 * etc., which operate entirely in the local frame.
 */
export declare function snapBuildingLocalToWorldGrid(local: readonly [number, number], step: number): [number, number];
//# sourceMappingURL=world-grid-snap.d.ts.map
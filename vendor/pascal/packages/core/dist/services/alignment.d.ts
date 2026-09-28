/**
 * Pure alignment-guide resolver — no React, no DOM, no scene access.
 *
 * Given a moving object's anchor points at its proposed position and a
 * pool of candidate anchors from nearby static objects, returns:
 *   - the best per-axis matches as `Guide` rendering primitives, and
 *   - an optional `{ dx, dz }` snap delta the caller can apply.
 *
 * Anchors are 2D points on the floor plane (XZ, in world meters). The
 * resolver picks at most one match per axis: the smallest |Δx| match
 * snaps X; the smallest |Δz| match snaps Z. This mirrors Figma's
 * behaviour — guides appear along the matched axes, regardless of how
 * many neighbours could have matched.
 *
 * Two guides max per call keeps the visual signal sharp at the cost of
 * not surfacing every possible alignment at once. Multi-guide ("this
 * lines up with three things") is intentionally out of scope for v1.
 */
export type AnchorKind = 'corner' | 'edge-mid' | 'center';
export type AlignmentAnchor = {
    /** Owning node id — informational; resolver does not use it. */
    nodeId: string;
    kind: AnchorKind;
    x: number;
    z: number;
};
export type AlignmentGuideAxis = 'x' | 'z';
/**
 * Rendering primitive — a guide line on the floor plane.
 *
 * `axis === 'x'`: vertical guide. Both endpoints share `coord` as their X.
 * `axis === 'z'`: horizontal guide. Both endpoints share `coord` as their Z.
 *
 * The line spans from the matched candidate anchor to the moving anchor
 * after snap. Renderers extend visually beyond the endpoints if they want
 * Figma-style "infinite line" feel.
 */
export type AlignmentGuide = {
    axis: AlignmentGuideAxis;
    coord: number;
    from: {
        x: number;
        z: number;
    };
    to: {
        x: number;
        z: number;
    };
    /** The matched candidate anchor — the fixed end the moving point aligns to. */
    anchor: {
        x: number;
        z: number;
    };
    movingAnchorKind: AnchorKind;
    candidateAnchorKind: AnchorKind;
    candidateNodeId: string;
    /** Perpendicular distance between the two anchors (used by the distance pill). */
    distance: number;
};
export type ResolveAlignmentInput = {
    /** Anchors of the moving node, positioned at the proposed (pre-snap) location. */
    moving: readonly AlignmentAnchor[];
    /** Anchors from every other candidate node the caller has already filtered. */
    candidates: readonly AlignmentAnchor[];
    /**
     * Max |Δ| (meters) for an anchor pair to count as a match. Typically
     * derived from a screen-pixel budget × current units-per-pixel so the
     * snap feel is zoom-invariant.
     */
    threshold: number;
};
export type ResolveAlignmentResult = {
    guides: AlignmentGuide[];
    /**
     * Delta the caller should add to the moving node's planar position so
     * its anchors land on the matched axes. `null` when no axis matched.
     */
    snap: {
        dx: number;
        dz: number;
    } | null;
};
export type BuildingPose = {
    position: readonly [number, number, number];
    rotationY: number;
};
export type ResolveAlignmentInBuildingResult = {
    /** Guides in WORLD coordinates. Renderers must be in a world-space group. */
    guides: AlignmentGuide[];
    /** Snap delta in the BUILDING-LOCAL frame, ready to add to a local position. */
    snap: {
        dx: number;
        dz: number;
    } | null;
};
/**
 * Resolve alignment in WORLD space while accepting BUILDING-LOCAL anchors.
 *
 * Why this exists: the floor-plan grid lives in world XZ (rendered outside
 * the rotated scene group), so alignment must follow the same axes —
 * otherwise rotating a building drags the alignment guides off the visible
 * grid and onto the rotated wall's local axes (the bug the user hit). The
 * resolver itself is frame-agnostic; this wrapper just transforms anchors
 * to world, resolves, then rotates the snap delta back into building-local
 * so callers can add it to a local position without further math.
 *
 * `pose === null` → resolve in the caller's frame as-is (no transform).
 */
export declare function resolveAlignmentInBuildingWorld(input: {
    moving: readonly AlignmentAnchor[];
    candidates: readonly AlignmentAnchor[];
    threshold: number;
    pose: BuildingPose | null;
}): ResolveAlignmentInBuildingResult;
export declare function resolveAlignment(input: ResolveAlignmentInput): ResolveAlignmentResult;
/**
 * Produces the 9 standard anchors for an axis-aligned bounding box on the
 * floor plane: 4 corners, 4 edge midpoints, 1 center. Suitable for any
 * floor-plan entity whose footprint can be expressed as a bbox.
 *
 * Caller is responsible for computing the bbox — the resolver doesn't
 * care how (per-kind dimensions, SVG getBBox(), etc.).
 */
export declare function bboxAnchors(nodeId: string, minX: number, minZ: number, maxX: number, maxZ: number): AlignmentAnchor[];
/**
 * The 4 corner anchors of a bbox — edges only, no edge-midpoints or center.
 * Used where alignment should lock to an object's edges (left/right/front/
 * back), never its centreline.
 */
export declare function bboxCornerAnchors(nodeId: string, minX: number, minZ: number, maxX: number, maxZ: number): AlignmentAnchor[];
//# sourceMappingURL=alignment.d.ts.map
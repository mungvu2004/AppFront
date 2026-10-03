/** An opening's footprint in its host wall's local frame. */
export type OpeningSpan = {
    id: string;
    /** Centre along the wall, measured from `wall.start` (m). */
    centerS: number;
    /** Along-wall extent (m). */
    width: number;
    /** Vertical centre above the wall base (floor at y=0) (m). */
    centerY: number;
    /** Vertical extent (m). */
    height: number;
};
export type WallExtent = {
    /** Wall length (m). */
    length: number;
    /** Wall height (m). */
    height: number;
};
export type OpeningGuideTolerances = {
    /** Max distance for an edge/centre to count as aligned with a neighbour (m). */
    align: number;
    /** Max difference between two gaps for them to count as equal (m). */
    equalSpacing: number;
    /** Gaps below this are treated as touching/overlap noise and ignored (m). */
    minGap: number;
};
export declare const DEFAULT_OPENING_GUIDE_TOLERANCES: OpeningGuideTolerances;
/** Which along-wall feature of an opening a guide references. */
export type AlongWallFeature = 'left' | 'center' | 'right';
/** Which vertical feature of an opening a guide references. */
export type VerticalFeature = 'sill' | 'center' | 'top';
export type SillHeadGuide = {
    /** Floor (y=0) → the opening's bottom edge (m). */
    sill: number;
    /** Wall-local y of the bottom edge. */
    bottomY: number;
    /** The opening's top edge → the wall top (m). */
    head: number;
    /** Wall-local y of the top edge. */
    topY: number;
};
export type EdgeGap = {
    side: 'left' | 'right';
    /** Clearance along the wall (m). */
    distance: number;
    /** Wall-local s of the moving opening's edge. */
    fromS: number;
    /** Wall-local s of the neighbour edge / wall end. */
    toS: number;
    target: 'opening' | 'wall-start' | 'wall-end';
    /** Set when `target === 'opening'`. */
    targetId?: string;
};
export type AlongWallAlignment = {
    /** Wall-local s the two features share. */
    s: number;
    movingFeature: AlongWallFeature;
    targetId: string;
    targetFeature: AlongWallFeature;
    /** Delta to add to the moving opening's `centerS` to make them coincide. */
    snap: number;
};
export type VerticalAlignment = {
    /** Wall-local y the two features share. */
    y: number;
    movingFeature: VerticalFeature;
    targetId: string;
    targetFeature: VerticalFeature;
    /** Delta to add to the moving opening's `centerY` to make them coincide. */
    snap: number;
};
export type EqualSpacingRun = {
    /** The repeated gap value (average of the run's gaps) (m). */
    gap: number;
    /** The equal-gap segments along the wall, in order (left → right). */
    segments: {
        fromS: number;
        toS: number;
    }[];
    /** Participating opening ids, ordered along the wall, including the moving one. */
    openingIds: string[];
};
export type OpeningGuides = {
    sillHead: SillHeadGuide | null;
    gaps: EdgeGap[];
    alongWall: AlongWallAlignment | null;
    vertical: VerticalAlignment | null;
    equalSpacing: EqualSpacingRun | null;
};
export type OpeningGuideInput = {
    moving: OpeningSpan;
    /** Other openings on the SAME wall (the moving opening excluded). */
    siblings: readonly OpeningSpan[];
    wall: WallExtent;
    /**
     * Whether to compute vertical (sill/head/vertical-alignment) guides. True for
     * windows; false for doors, which sit on the floor so their sill is always 0.
     */
    includeVertical: boolean;
    tolerances?: Partial<OpeningGuideTolerances>;
};
/**
 * Edge-to-edge clearance from the moving opening to the nearest neighbour on
 * each side, falling back to the wall ends when there is no neighbour — the
 * "how much wall is left here" reading. Returns 0–2 gaps (one per side); a side
 * is omitted when its clearance is below `minGap` (the opening is flush against
 * or overlapping that neighbour).
 */
export declare function computeEdgeGaps(moving: OpeningSpan, siblings: readonly OpeningSpan[], wall: WallExtent, minGap: number): EdgeGap[];
/**
 * The closest coincidence between any of the moving opening's edges/centre and
 * any sibling's edges/centre along the wall, within `tolerance`. Edge-to-edge
 * and centre-to-centre are weighed equally; the single closest pair wins
 * (matching the one-guide-per-axis behaviour of the floor-plane resolver).
 */
export declare function detectAlongWallAlignment(moving: OpeningSpan, siblings: readonly OpeningSpan[], tolerance: number): AlongWallAlignment | null;
/**
 * The closest coincidence between the moving opening's sill/centre/top and any
 * sibling's sill/centre/top, within `tolerance` — the "these two windows share
 * a sill height" detector. Same single-best-match policy as the along-wall
 * variant.
 */
export declare function detectVerticalAlignment(moving: OpeningSpan, siblings: readonly OpeningSpan[], tolerance: number): VerticalAlignment | null;
/**
 * Figma-style equal-spacing detection: order all openings along the wall, look
 * at the clearances BETWEEN consecutive openings, and return the longest run of
 * ≥2 consecutive gaps that are equal within `tolerance` and that the moving
 * opening participates in (so the badges only appear while the drag is actually
 * forming or extending a series). Returns null when no such run exists.
 *
 * Gaps below `minGap` (touching/overlapping openings) break a run — a row of
 * flush openings is not "equally spaced".
 */
export declare function detectEqualSpacing(allOpenings: readonly OpeningSpan[], movingId: string, tolerance: number, minGap: number): EqualSpacingRun | null;
/**
 * Compute every proximity/alignment guide for the moving opening in one pass.
 * Pure: feed it the moving opening's wall-local span, its same-wall siblings,
 * and the wall extent; render the result in whichever view.
 */
export declare function computeOpeningGuides(input: OpeningGuideInput): OpeningGuides;
//# sourceMappingURL=opening-guides.d.ts.map
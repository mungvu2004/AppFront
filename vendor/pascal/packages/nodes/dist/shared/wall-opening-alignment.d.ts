import { type AlignmentAnchor, type AnyNode, type WallNode } from '@pascal-app/core';
/** Figma-style alignment-snap threshold (meters), matching the move tools. */
export declare const WALL_OPENING_ALIGNMENT_THRESHOLD_M = 0.08;
/**
 * Alignment candidates for a wall opening (door / window): only OTHER things
 * hosted ON a wall — sibling openings and wall-mounted items. Floor/ground
 * objects are excluded so an opening's along-wall guides line up with what's on
 * the walls, never with furniture sitting on the floor below.
 */
export declare function collectWallOpeningAlignmentCandidates(nodes: Readonly<Record<string, AnyNode>>, excludeId: string): AlignmentAnchor[];
/**
 * Resolve a wall opening's along-wall position with Figma-style alignment to
 * other objects, publishing the matching guide as a side effect.
 *
 * The probe is the RAW cursor position on the wall (not the grid snap) so
 * off-grid anchors are caught; we then keep only the guide on an axis the wall
 * runs along and map it to the along-wall coordinate that lands the opening on
 * it. Falls back to the grid snap when nothing aligns, and clears the guide on
 * bypass / no-match. Returns the localX to use (X-clamped to the wall given
 * `width`). `bypass` disables alignment entirely (guide + pull). `applySnap`
 * splits display from pull: the guide is always published while alignment is
 * active, but the along-wall pull is applied only when `applySnap` (magnetic
 * "lines" mode) — pass `false` to show the guide passively without moving the
 * opening. The grid component lives in `snapToHalf`, itself mode-aware.
 */
export declare function resolveWallSlideAlignment(args: {
    wallNode: WallNode;
    rawLocalX: number;
    width: number;
    candidates: readonly AlignmentAnchor[];
    bypass?: boolean;
    applySnap?: boolean;
}): number;
//# sourceMappingURL=wall-opening-alignment.d.ts.map
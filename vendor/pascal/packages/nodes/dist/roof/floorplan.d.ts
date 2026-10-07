import { type FloorplanGeometry, type GeometryContext, type RoofNode } from '@pascal-app/core';
/**
 * `roof-segment.pitch` is stored in DEGREES; a roof plan is annotated as the
 * rise over a 12 run. 30.256° → tan 0.5833 × 12 → 7.00 → '7:12'. Rounded to
 * the nearest half, so a modelled pitch a hair off a standard slope still
 * reads as the slope the framer will cut. Returns '' for a flat roof, which
 * has no slope to annotate.
 */
export declare function roofPitchLabel(pitchDeg: number): string;
/**
 * Roof-level floor-plan builder. Draws the whole merged-roof plan: the
 * unioned silhouette and every segment's ridge/hip/break linework. The
 * segment builder keeps only its hit-target / selection chrome.
 *
 * Composition uses the floor plan's negated-rotation convention
 * (segment-local → roof-local → plan). `unionPolygons` returns one ring per
 * disjoint group, so non-touching segments each keep their own outline. The
 * group is decorative (`pointerEvents: 'none'`) — clicks fall through to the
 * segment hit-targets.
 */
export declare function buildRoofFloorplan(node: RoofNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
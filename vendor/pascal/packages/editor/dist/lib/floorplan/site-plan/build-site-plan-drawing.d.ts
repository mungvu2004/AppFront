import { type AnyNodeId, type FloorplanGeometry, type SceneSnapshot, type SiteNode } from '@pascal-app/core';
import { type SiteCoverage } from './coverage';
import { type Bounds, type Pt, type YardDimension } from './geometry';
import { footprintOutline, levelFootprintLoops, roofOutlineRings } from './site-parts';
export { footprintOutline, levelFootprintLoops, roofOutlineRings };
/** Contract shared by every drawing producer (see docs/construction-documents.md). */
export interface SitePlanDrawing {
    primitives: FloorplanGeometry[];
    bounds: Bounds;
    /** What the drawing could not take from the model — printed on the sheet, never silent. */
    warnings?: string[];
    /** Live values the panel / sheets reuse without re-deriving them. */
    meta: {
        site: SiteNode | null;
        frontEdge: number;
        lot: Pt[];
        envelope: Pt[];
        /** The envelope edge behind the lot's front line (the envelope has its own vertex count now). */
        envelopeFrontEdge: number;
        /** The corner sight triangles (corner, leg end A, leg end B), site metres. */
        sightTriangles: Pt[][];
        /** Per-wall footprint bands of the lowest level, in SITE metres. */
        footprintLoops: Pt[][];
        footprintBounds: Bounds | null;
        yards: YardDimension[];
        buildingId: AnyNodeId | null;
        /** Building coverage and impervious area — the figures the lot label and the sheets print. */
        coverage?: SiteCoverage;
    };
}
export interface SitePlanEdge {
    index: number;
    headingDeg: number;
    compass: string;
    lengthM: number;
    label: string;
}
/** Lot edges with their compass heading — feeds the panel's front-edge picker. */
export declare function describeSiteEdges(site: SiteNode | null | undefined): SitePlanEdge[];
/**
 * The setbacks line the site plan prints when the yards are not the zoning
 * code's own: worded for a plans examiner from the site's numbers — never the
 * internal source tag a lot drop-in stored (QA 2026-09-23 printed the
 * internal defaults tag on A1.0). A cited code prints nothing.
 */
export declare function setbacksWarning(site: Pick<SiteNode, 'setbacks' | 'setbacksSource'> | null): string | null;
/**
 * Build the site-plan drawing from the scene.
 *
 * Everything is recomputed from the current snapshot, so the drawing is live:
 * move the building or edit a setback and the next call reflects it.
 * Returns an empty drawing (no primitives) when the scene has no site polygon.
 */
export declare function buildSitePlanDrawing(scene: SceneSnapshot): SitePlanDrawing;
/**
 * Translation (site metres, `[dx, dz]`) that centres the building's footprint
 * on the lot centroid. `null` when there is nothing to move or the footprint
 * already sits inside the ring.
 */
export declare function buildingRecentreOffset(lot: readonly Pt[], footprintBounds: Bounds | null): [number, number] | null;
//# sourceMappingURL=build-site-plan-drawing.d.ts.map
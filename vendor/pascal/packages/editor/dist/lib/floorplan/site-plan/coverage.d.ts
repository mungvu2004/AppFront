/**
 * Lot coverage and impervious surface — the ONE computation the site plan
 * (A1.0) and the cover's PROJECT DATA both print, so the two sheets can never
 * disagree again (QA 2026-09-23: the cover said 24.6 %, the site plan 45.6 %
 * — the site plan had counted the house's own floor platform and garage pad
 * as "porches" on top of the footprint).
 *
 * The two figures a Florida plans examiner asks for (Alachua County / the
 * City of Gainesville ask for both on a new single-family site plan; the
 * zoning district caps the first, the stormwater review reads the second):
 *
 *  BUILDING COVERAGE  the lot area under roofed structure: the building's
 *                     footprint to the OUTSIDE FACE of its exterior walls —
 *                     every storey at or above grade projected, the attached
 *                     garage included — plus the roofed porches, patios and
 *                     decks (a slab at least half under a roof outline).
 *                     Eaves and the roof overhang are not counted.
 *  IMPERVIOUS SURFACE building coverage plus the paving ON THE LOT (an apron
 *                     drawn out into the right-of-way is not counted): the driveway, the
 *                     walks, and the uncovered patios, landings and decks
 *                     (a slatted deck over pervious ground is counted —
 *                     the conservative reading; some jurisdictions exclude
 *                     it, verify).
 *
 * Both are divided by the LOT AREA: the county parcel record when the lot
 * drop-in resolved one (`site.parcel.lotAreaSqFt`), else the drawn lot
 * polygon. Pure: reads a scene snapshot, touches no store.
 */
import type { SceneSnapshot } from '@pascal-app/core';
import { type Pt } from './geometry';
import { type OutdoorPart } from './site-parts';
export type ImperviousRowKey = 'building' | 'porches' | 'driveway' | 'walks' | 'patios';
export interface ImperviousRow {
    key: ImperviousRowKey;
    label: string;
    sqFt: number;
    /** What the row holds, e.g. "2 covered: porch, rear deck". */
    note: string;
}
export interface SiteCoverage {
    /** Lot area, SF, and where it came from; null without a lot. */
    lotSqFt: number | null;
    lotSource: 'parcel' | 'polygon' | null;
    /** The building's footprint to the outside face of its walls (garage included), SF. */
    buildingSqFt: number;
    /** Roofed porches, patios and decks, SF. */
    coveredOutdoorSqFt: number;
    /** Building coverage = footprint + roofed porches, SF. */
    buildingCoverageSqFt: number;
    /** Building coverage ÷ lot, 0–1; null without a lot or a building. */
    buildingCoverageRatio: number | null;
    drivewaySqFt: number;
    walksSqFt: number;
    /** Uncovered patios, landings and decks, SF. */
    openOutdoorSqFt: number;
    /** Everything impervious, SF. */
    imperviousSqFt: number;
    imperviousRatio: number | null;
    /** The IMPERVIOUS AREA table's rows, in print order (total and % are the caller's). */
    rows: ImperviousRow[];
    /** One line each: what the two figures are measured to — printed with them. */
    basis: {
        building: string;
        impervious: string;
        lot: string;
    };
    /** The parts, for the drawing: the walls' outline and every outdoor slab (site metres). */
    outline: Pt[][];
    parts: OutdoorPart[];
}
/** "12.3 %" — the one way both sheets print a ratio. */
export declare function formatCoveragePercent(ratio: number | null): string;
/** "2,739 SF" — the one way both sheets print an area. */
export declare function formatSqFt(sqFt: number): string;
export declare function computeSiteCoverage(scene: Pick<SceneSnapshot, 'nodes'>): SiteCoverage;
//# sourceMappingURL=coverage.d.ts.map
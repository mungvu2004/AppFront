/**
 * Lot terrain from USGS elevations: an N×N grid of points over the lot's
 * bounding box (padded a touch so the ground runs past the lines) goes to
 * the parcel provider's `elevation` (USGS EPQS, feet), the readings come
 * back relative to a DATUM — the ground at the lot's centre, so the site
 * plane y = 0 is the ground where the house will stand — and are written
 * into the site's heightfield (`site.terrain`, the same field the sculpt
 * tool edits and every placement / raycast / drape reads).
 *
 * Honesty: a web-service DEM is preliminary — the sample record on the
 * site (`metadata.terrainSample`: source, grid, holes, datum, relief) says
 * what was read; a lot flatter than `MIN_RELIEF_M` writes NO terrain and
 * keeps the flat-ground fast path; every failure returns a reason and
 * writes nothing.
 */
import { type TerrainData, type TerrainField } from '@pascal-app/core';
import { type ParcelProvider } from './parcel-provider';
export type Pt = readonly [number, number];
/** apps/editor/lib/parcel/project.ts — the plan frame's degree scale. */
export declare const FEET_PER_DEG_LAT = 364000;
/** Grid points per side (81 points — well under the route's 256 cap). */
export declare const DEFAULT_GRID_N = 9;
/** The lot bbox is padded by this fraction so the mesh runs past the lines. */
export declare const PAD_FRAC = 0.08;
/** A lot with less fall than this across its samples is flat: no terrain written. */
export declare const MIN_RELIEF_M = 0.15;
export interface TerrainSampleSummary {
    source: 'USGS EPQS';
    /** Grid side (n × n points). */
    grid: number;
    /** Points with a reading / without one. */
    sampled: number;
    holes: number;
    /** Absolute elevation of the site plane (the datum), feet. */
    datumFt: number;
    /** Highest − lowest reading, feet. */
    reliefFt: number;
    /** True when the lot read flat and no heightfield was written. */
    flat: boolean;
    at: string;
}
export interface TerrainSampleResult {
    ok: boolean;
    reason?: string;
    /** The heightfield to write to `site.terrain` (absent when flat). */
    terrain?: TerrainData;
    summary?: TerrainSampleSummary;
}
export interface SampleGrid {
    n: number;
    x0: number;
    z0: number;
    x1: number;
    z1: number;
    /** Row-major, `r * n + c`. */
    points: Pt[];
}
/** Local plan metres (the site frame) → `{ lat, lng }`, the inverse of `ringsToPlanFeet`. */
export declare function localMetresToLngLat(p: Pt, originLngLat: readonly [number, number]): {
    lat: number;
    lng: number;
};
/** The n × n sample grid over the ring's padded bounding box. */
export declare function gridOver(ring: readonly Pt[], n?: number, pad?: number): SampleGrid;
/**
 * Bilinear read of the coarse grid at a plan point; holes (null readings)
 * read as `fill`. Clamped to the grid — the field never extrapolates.
 */
export declare function coarseHeightAt(grid: SampleGrid, elev: readonly (number | null)[], x: number, z: number, fill: number): number;
/** A heightfield over the grid's extent, metres above the datum, bilinear from the coarse samples. */
export declare function fieldFromSamples(grid: SampleGrid, elevM: readonly (number | null)[], datumM: number, fillM: number): TerrainField;
export interface SampleOptions {
    /** Default = the provider the host set. */
    provider?: ParcelProvider;
    /** Grid side, default 9. */
    n?: number;
    /** Passed to the route (USGS is slow; the route caps it). */
    deadlineMs?: number;
    /** Where the datum is read (site metres); default = the ring's centroid. */
    datumAt?: Pt;
    now?: () => string;
}
/**
 * Sample the lot. Resolves `{ ok: false, reason }` on every failure path and
 * never throws; `ok: true` with no `terrain` means the lot read flat.
 */
export declare function sampleLotTerrain(ring: readonly Pt[], originLngLat: readonly [number, number], options?: SampleOptions): Promise<TerrainSampleResult>;
/** One status fragment for the drop-in message. */
export declare function describeTerrainSample(summary: TerrainSampleSummary | null, failure: string): string;
//# sourceMappingURL=terrain.d.ts.map
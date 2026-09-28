/**
 * The Pascal Map location dossier, read for the lot drop-in.
 *
 * `fetchDossier` asks the parcel provider's `dossier` (the key lives with
 * the host); the rest is pure: the parcel polygon and the FRONTAGE
 * (the boundary shared with no neighbour — the street edges) projected
 * into the site plan frame, the front edge picked from the frontage, the
 * zoning setbacks read with their citation, and the facts the plan set
 * prints (`siteFactsFromDossier`) with every geometry stripped.
 *
 * Every section carries `status`; `not_covered` / `not_available` mean
 * "not answered" — never a negative finding. Unknown keys are ignored
 * (the platform's additive-change policy).
 */
import type { SiteDossier } from '@pascal-app/core';
import type { ParcelProvider } from './parcel-provider';
export type SectionStatus = 'available' | 'empty' | 'not_covered' | 'not_available';
export type DossierSection<T = Record<string, unknown>> = {
    layer: string;
    name?: string;
    status: SectionStatus;
    summary?: string;
    data?: T | null;
    source?: {
        name?: string;
        kind?: string;
        vintage?: string;
        attribution?: string;
        note?: string;
    };
    reason?: string;
    hint?: string;
};
export type Dossier = {
    object: 'location';
    as_of: string;
    point: {
        lat: number;
        lng: number;
        source: string;
    };
    address?: {
        formatted: string;
        precision: string;
    };
    layers: Record<string, DossierSection>;
};
export type LngLat = readonly [number, number];
export type Pt = readonly [number, number];
export type ParcelData = {
    parcel_key?: string;
    county?: {
        name?: string | null;
        fips?: string | null;
        local_code?: number | null;
    };
    situs_address?: {
        line1?: string;
        city?: string | null;
        zip?: string | null;
    } | null;
    vintage?: string | null;
    area_m2?: number | null;
    frontage?: {
        total_ft?: number;
        total_m?: number;
        segment_count?: number;
        geometry?: unknown;
    } | null;
    geometry?: {
        type?: string;
        geometry?: {
            type?: string;
            coordinates?: unknown;
        };
    } | null;
};
export type ZoningData = {
    district?: string;
    district_description?: string | null;
    jurisdiction?: string;
    setbacks?: {
        front_ft?: number | null;
        side_ft?: number | null;
        rear_ft?: number | null;
    } | null;
    max_height_ft?: number | null;
    max_far?: number | null;
    min_lot_sqft?: number | null;
    dimensional_note?: string | null;
    dimensional_source?: {
        url?: string;
        section?: string;
        retrieved_at?: string;
    } | null;
    land_development_code_url?: string | null;
};
export type CodeBasisData = {
    climate_zone_iecc?: string | null;
    frost_depth_ft?: number | null;
    ground_snow_load_psf?: number | null;
    seismic_design_category?: string | null;
    wind_speed_mph?: number | null;
    wind_borne_debris_region?: boolean | null;
    rainfall_100yr_24hr_in?: number | null;
    climate_zone_title24?: string | null;
    seismic_sds?: number | null;
    seismic_sd1?: number | null;
};
export type FloodData = {
    is_in_flood_zone?: boolean | null;
    mapped?: boolean;
    firm_panel?: {
        panel?: string;
        effective_date?: string | null;
    } | null;
    zone_at_point?: {
        zone?: string;
        description?: string;
        is_in_flood_zone?: boolean;
        base_flood_elevation_ft?: number | null;
        bfe_datum?: string;
    } | null;
    highest_risk_zone_on_parcel?: string | null;
};
export type DossierResult = {
    ok: true;
    dossier: Dossier;
} | {
    ok: false;
    reason: string;
    code?: string;
    retryAfterS?: number;
};
/** Ask the provider's dossier. Never throws: a failure is a reason. */
export declare function fetchDossier(provider: ParcelProvider, input: {
    address?: string;
    latitude?: number;
    longitude?: number;
    layers?: string[];
}): Promise<DossierResult>;
/** A section by layer name, or null when the dossier has none. */
export declare function section<T = Record<string, unknown>>(dossier: Dossier | null | undefined, layer: string): DossierSection<T> | null;
/** A section's data when it answered (`available`), else null. */
export declare function answered<T = Record<string, unknown>>(dossier: Dossier | null | undefined, layer: string): T | null;
/** `[lng, lat]` → plan METRES with `origin` at (0, 0): x east, z south. */
export declare function planPointFromLngLat(origin: LngLat, p: LngLat): Pt;
/**
 * The parcel's outer ring in plan metres: the largest polygon of a
 * Polygon / MultiPolygon Feature, closing vertex dropped, consecutive
 * duplicates removed. Empty when the section carries no usable geometry.
 */
export declare function parcelRingMetres(parcel: ParcelData | null | undefined, origin: LngLat): Pt[];
/** The frontage as plan-metre segments (every consecutive pair of a MultiLineString / LineString). */
export declare function frontageSegmentsMetres(parcel: ParcelData | null | undefined, origin: LngLat): [Pt, Pt][];
export type FrontageMatch = {
    /** The lot edge index (points[index] → points[index + 1]). */
    index: number;
    lengthM: number;
    /** How many lot edges front the street / water — a corner lot has two or more. */
    frontingEdges: number;
    /** Every fronting edge index (a corner lot has two or more). */
    edges: number[];
};
/**
 * The front edge from the FRONTAGE: a lot edge fronts when most of its
 * length lies on a frontage segment (five samples along it, each within
 * `tolM` — the ring is cleaned after the fabric was cut, so the tolerance
 * is generous). Of the fronting edges the LONGEST is the front (a corner
 * lot's long street). Null when no edge fronts.
 */
export declare function detectFrontEdgeFromFrontage(ring: readonly Pt[], segments: readonly [Pt, Pt][], tolM?: number): FrontageMatch | null;
export type ElevationData = {
    terrain_status?: string;
    terrain?: {
        min_ft?: number;
        max_ft?: number;
        contour_interval_ft?: number;
        contour_count?: number;
        datum?: string;
        source_resolution_m?: number;
        geometry?: unknown;
    } | null;
};
export type ContourLines = {
    datum: string;
    intervalFt: number;
    source?: string;
    lines: {
        elevationFt: number;
        points: [number, number][];
    }[];
};
/**
 * The dossier's USGS 3DEP contour lines (elevation.data.terrain.geometry —
 * a FeatureCollection of LineStrings with `elevation_ft`), projected into
 * the site frame. Consecutive points closer than 0.3 m are dropped (the
 * 10 m grid draws smooth curves with more vertices than a plan needs).
 * Null when the section carries no lines.
 */
export declare function contourLinesFromDossier(dossier: Dossier, origin: LngLat): ContourLines | null;
/**
 * Setbacks from the zoning section, METRES — null when the code expresses
 * a conditional rule (a null side) or the section did not answer: the
 * default then stands and the `dimensional_note` prints beside it.
 */
export declare function setbacksFromZoning(z: ZoningData | null | undefined): {
    front: number;
    side: number;
    rear: number;
} | null;
/** The citation line for `setbacksSource`. */
export declare function setbacksCitation(z: ZoningData, source?: DossierSection['source']): string;
/**
 * What the site node keeps of the dossier: when it was assembled, the
 * point and address it was evaluated at, every section's status +
 * summary + source, and the data of the sections the plan set acts on
 * (geometry-free). `parcel.adjacent_parcels` is dropped too — thirty
 * neighbours' keys are the platform's, not the plan's.
 */
export declare function siteFactsFromDossier(dossier: Dossier): SiteDossier;
/** One line for the status row: which sections answered. */
export declare function describeDossier(dossier: Dossier): string;
//# sourceMappingURL=dossier.d.ts.map
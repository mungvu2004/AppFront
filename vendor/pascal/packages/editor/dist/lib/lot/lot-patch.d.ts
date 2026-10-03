/**
 * Lot drop-in — the PURE half. Given the parcel service's answer and the
 * mapped roads, compute the site node patch and a summary of what was
 * decided (front edge, setbacks, notes). No store, no network, so every
 * rule here is unit-tested; `drop-in.ts` does the fetching and writing.
 *
 * Rules:
 * - The lot ring, address, parcel provenance and zoning come straight from
 *   the parcel `resolve` answer; a new ring invalidates any front edge picked on
 *   the old one.
 * - The FRONT edge is the lot edge the real street fronts
 *   (`detectFrontEdgeFromRoads`: parallel, outside, nearest, addressed
 *   street wins on a corner). No road data → left undefined, which the site
 *   plan resolves to the most north-facing edge, and the notes say so.
 * - With the parcel fabric's frontage (Pascal Map), the front is the fronting
 *   edge on the addressed street (`frontageFront`), else the longest fronting
 *   edge; the note says which rule decided.
 * - Setbacks: when the site has none, the planning defaults
 *   (`DEFAULT_SETBACKS_FT` — front 20 ft, side 5 ft, rear 15 ft) are
 *   written with a `setbacksSource` that says they are defaults. Existing
 *   setbacks are never overwritten.
 * - `northRotation` is 0: the parcel frame is x east / z south, so plan up
 *   is true north.
 */
import type { SiteNode, SiteSetbacks } from '@pascal-app/core';
import { type FrontEdgeMatch, type RoadCenterline } from '../floorplan/site-plan/front-edge';
import { type Pt } from '../floorplan/site-plan/geometry';
import { type FrontageMatch } from './dossier';
export declare const DEFAULT_SETBACKS_FT: {
    readonly front: 20;
    readonly side: 5;
    readonly rear: 15;
};
export declare const DEFAULT_SETBACKS_M: SiteSetbacks;
export declare const DEFAULT_SETBACKS_SOURCE = "Planning defaults (front 20 ft, side 5 ft, rear 15 ft; typical single-family yards) \u2014 confirm with the zoning district.";
/** OSM highway classes a house can front: streets, not alleys, driveways or sidewalks. */
export declare const STREET_CLASSES: ReadonlySet<string>;
/** The parcel provider's `resolve` answer (the fields the drop-in reads). */
export interface ParcelResolveData {
    ok: boolean;
    error?: string;
    apn?: string;
    county?: string;
    state?: string;
    zip?: string;
    zoning?: string;
    lotAreaSqFt?: number;
    originLngLat?: [number, number];
    geocodedBy?: string;
    matchPrecision?: string;
    notes?: string[];
    polygonM?: [number, number][];
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
    } | null;
}
/** A road from the parcel provider's `roads` (centerline in the lot's frame, metres). */
export interface LotRoad extends RoadCenterline {
    id?: string;
    klass?: string;
    widthM?: number;
}
/** What the user typed or picked. Coordinates skip geocoding when present. */
export interface DropInInput {
    address?: string;
    latitude?: number;
    longitude?: number;
    state?: string;
    street?: string;
    city?: string;
    zip?: string;
}
/**
 * What the Pascal Map dossier adds to a lot patch (lot drop-in, dossier.ts):
 * the frontage segments the front edge is read from, the zoning setbacks
 * with their citation, and the facts the site keeps for the sheets.
 */
export interface DossierExtras {
    /** Frontage segments in plan metres — the lot edges that touch no neighbour. */
    frontageSegmentsM?: readonly [readonly [number, number], readonly [number, number]][];
    /** Zoning setbacks, metres — null when the code's rule is conditional. */
    setbacks?: {
        front: number;
        side: number;
        rear: number;
    } | null;
    setbacksSource?: string;
    /** The code's verbatim condition when a number cannot say it. */
    dimensionalNote?: string | null;
    zone?: string;
    /** The geometry-free record the site node keeps. */
    facts: SiteNode['dossier'];
    /** One status line, e.g. "Pascal Map: 9 sections answered (parcel not here)". */
    line: string;
}
export interface LotSummary {
    apn: string;
    county: string;
    state: string;
    lotAreaSqFt: number;
    /** The street-facing edge index, or null when the north-facing fallback stands. */
    frontEdge: number | null;
    frontStreet: string | null;
    frontEdgeSource: string;
    /** How many lot edges front a street / water per the parcel fabric (corner lots ≥ 2); absent without frontage. */
    frontingEdges?: number;
    /** The dossier's own status line, when one was read. */
    dossierLine?: string;
    setbacksDefaulted: boolean;
    roadsFound: number;
    notes: string[];
}
/**
 * The typed "street, city, ST zip" split into its parts — what the address
 * says when the resolver answered no situs line (the parcel route never
 * does). Without a comma it is all street.
 */
export declare function splitTypedAddress(typed: string | undefined): {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
};
/** The front-edge decision, as text for the parcel notes and the panel. */
export declare function describeFrontEdge(match: FrontEdgeMatch | null, roadsFound: number): string;
/**
 * Under this share of the longest frontage the addressed street's fronting
 * edge is a sliver of the lot (a corner cut, a flag's pole), not its face.
 */
export declare const ADDRESSED_FRONTAGE_MIN_SHARE = 0.5;
/**
 * The front among the parcel fabric's fronting edges: the one on the
 * addressed street (a corner or through lot is addressed on its front
 * street) — `streetNames` are the mapped street along each edge — unless it
 * is under half the longest frontage; else the longest. `rule` says which
 * decided, for the note.
 */
export declare function frontageFront(ring: readonly Pt[], frontage: FrontageMatch, streetNames: Readonly<Record<string, string>>, addressStreet: string | null | undefined): {
    index: number;
    name: string;
    named: boolean;
    rule: string;
};
/**
 * The site patch for a resolved parcel. `null` when the answer has no usable
 * ring. `now` stamps `parcel.resolvedAt` (injectable for tests).
 */
export declare function sitePatchFromParcel(site: (Pick<SiteNode, 'setbacks' | 'zone'> & {
    metadata?: unknown;
}) | null | undefined, input: DropInInput, data: ParcelResolveData, roads: readonly LotRoad[] | null, now?: string, dossier?: DossierExtras | null): {
    patch: Partial<SiteNode>;
    summary: LotSummary;
} | null;
/** One line for a status row: "Lot set — APN 123 · 5,300 sq ft · Sacramento · fronts Castro Way · default setbacks". */
export declare function describeLotSummary(summary: LotSummary, extra?: string[]): string;
//# sourceMappingURL=lot-patch.d.ts.map
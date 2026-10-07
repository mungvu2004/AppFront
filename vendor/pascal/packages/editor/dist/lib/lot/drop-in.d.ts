/**
 * Lot drop-in — the store-aware half. One call does what "click a button,
 * the lot drops in" needs:
 *
 *   1. `resolve` — address (or a picked suggestion's
 *      coordinates) → the real parcel ring, APN, county, zoning.
 *   2. `roads` — the streets around the lot from OpenStreetMap,
 *      in the lot's own frame (fail-soft: no roads is not an error).
 *   3. `sitePatchFromParcel` — the site node patch: ring, address,
 *      provenance, the street-facing front edge, planning-default setbacks
 *      when the site has none, north up.
 *   4. The scene's site node is updated (created at the root when the scene
 *      has none) and a building that fell outside the new ring is
 *      re-centred on it — `building.position` only, never the walls.
 *   5. `elevation` — USGS ground over the lot into the site's
 *      heightfield (`site.terrain`, terrain.ts; fail-soft, flat lots write
 *      nothing), so a foundation can read the hill.
 *
 * Used by the Lot rail panel, the Generate panel (drop in, then generate)
 * and the Site inspector's "Find parcel", so every path behaves the same.
 * Nothing here is invented: a lookup that fails says why and writes nothing.
 * The calls go to the host's parcel provider (`setParcelProvider`).
 */
import { SiteNode } from '@pascal-app/core';
import { type DropInInput, type LotSummary } from './lot-patch';
import { type ParcelProvider } from './parcel-provider';
import { type TerrainSampleSummary } from './terrain';
export interface LotDropInResult {
    ok: boolean;
    error?: string;
    siteId?: string;
    summary?: LotSummary;
    /** True when a building was moved back onto the new lot. */
    recentred?: boolean;
    /** Why no roads were used, when the road lookup failed ('' when it worked). */
    roadsFailure?: string;
    /** The USGS terrain read, when it worked (flat lots write no heightfield). */
    terrain?: TerrainSampleSummary | null;
    /** Why no terrain was read ('' when it worked). */
    terrainFailure?: string;
    /** The Pascal Map dossier's status line, or why none was read ('' when it worked). */
    dossierLine?: string;
    dossierFailure?: string;
    /** One status line. */
    message: string;
}
export interface DropInOptions {
    /** The site to write; default = the scene's first root site (created when there is none). */
    siteId?: string;
    /** Skip the road lookup (the front edge stays north-facing). */
    roads?: boolean;
    roadsRadiusM?: number;
    /** Skip the USGS terrain read (the ground stays flat). */
    terrain?: boolean;
    terrainDeadlineMs?: number;
    /** Skip the Pascal Map dossier (the parcel / roads / elevation routes alone). */
    dossier?: boolean;
    /** Default = the provider the host set. */
    provider?: ParcelProvider;
}
/** The scene's site node — the requested one, else the first root site. */
export declare function findSiteNode(siteId?: string): SiteNode | null;
/** Resolve the parcel, map the streets, write the site. */
export declare function dropInLot(input: DropInInput, options?: DropInOptions): Promise<LotDropInResult>;
//# sourceMappingURL=drop-in.d.ts.map
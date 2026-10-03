import { type BrushSettings, type HeightPatch, type SiteNode, type TerrainField, type TerrainVerb } from '@pascal-app/core';
/**
 * Sample count a fresh field gets, chosen to cover the site polygon at roughly
 * `DEFAULT_TERRAIN_SPACING` and never exceeding 257² (66 049 samples — about
 * four furnished rooms' worth of vertices).
 *
 * Sizing from the polygon rather than a fixed extent matters because the extent
 * is baked at creation: the field is the ground for the whole session, and a
 * grid that stops short of the lot line leaves a visible cliff where the terrain
 * mesh ends and the flat fill resumes. Padding by one spacing keeps the boundary
 * line itself on interpolated ground rather than on the clamped edge row.
 */
export declare function fieldExtentForSite(site: Pick<SiteNode, 'polygon'> | null | undefined): {
    origin: [number, number];
    cols: number;
    rows: number;
    spacing: number;
};
/**
 * The field a sculpt stroke on `site` should start from: its existing terrain,
 * or a fresh flat one sized to the lot.
 *
 * Not `terrainFieldForEdit` — that takes explicit options, and the whole point
 * here is that the tool must not have to know how to size a grid.
 */
export declare function sculptFieldForSite(site: SiteNode): TerrainField;
/** Whether an XZ point belongs to the editable property footprint. */
export declare function terrainPointInsideSite(site: Pick<SiteNode, 'polygon'>, x: number, z: number): boolean;
/**
 * Keep a rectangular brush patch inside the property footprint.
 *
 * The heightfield stays padded and square for compact storage and predictable
 * partial uploads, but that implementation extent is not editable land. Samples
 * outside the polygon retain their current values even when a brush overlaps the
 * property line.
 */
export declare function clipTerrainPatchToSite(field: TerrainField, patch: HeightPatch, site: Pick<SiteNode, 'polygon'>): HeightPatch;
/**
 * The site node the sculpt tool acts on, read straight from the scene.
 *
 * The tool and panel get this from a subscribed selector; the keyboard handler
 * cannot (it is one imperative listener, not a component), and open-coding
 * "root[0], is it a site?" a third time is how the three drift apart.
 */
export declare function activeSiteNode(): SiteNode | null;
/**
 * Largest brush radius offered, in metres.
 *
 * A taste call, unlike the minimum: 20 m covers a building pad in one pass and is
 * about where a bigger brush stops being aimable and starts being `flattenSite`.
 */
export declare const MAX_BRUSH_RADIUS = 20;
/**
 * The legal brush-radius range for `site`, low end first.
 *
 * Exists because two controls set this value — the panel's Size slider and the
 * `[`/`]` keys — and both used to carry their own hardcoded `0.5`/`20`, with a
 * comment in the keyboard handler asserting they matched. They did, but nothing
 * held them to it, and the shared minimum was wrong anyway: it was a flat 0.5 m
 * while the real floor scales with the field's spacing, which
 * `fieldExtentForSite` stretches on large lots. Below that floor a drag paints
 * nothing at all (see `MIN_BRUSH_RADIUS_IN_SPACINGS`).
 *
 * The max is clamped to stay above the min so the range never inverts on a lot
 * big enough that the minimum passes 20 m — the brush ends up pinned to one
 * usable size, which is honest, rather than to an empty range.
 */
export declare function brushRadiusRange(site: SiteNode | null | undefined): [number, number];
/** `radius` clamped into `brushRadiusRange(site)`. */
export declare function clampBrushRadius(site: SiteNode | null | undefined, radius: number): number;
/**
 * The absolute height a `flatten` stroke aims at.
 *
 * `null` target means the user never picked one, so the first click samples the
 * ground under the cursor — flatten stays usable without ever opening a number
 * field, and "flatten this pad to match that corner" is a two-step gesture.
 */
export declare function resolveFlattenTarget(field: TerrainField, explicitTarget: number | null, x: number, z: number): number;
export type SculptCommit = {
    verb: TerrainVerb;
    settings: BrushSettings;
};
/**
 * Flatten the whole site to one height in a single step.
 *
 * The brush cannot do this well and should not have to: covering a lot with dabs
 * is dozens of strokes, and any sample the brush misses leaves a ridge that is
 * invisible until a slab lands on it. Sizing from `fieldExtentForSite` means the
 * result covers the padded extent, so the property line stays on flat ground too.
 */
export declare function flattenSite(site: SiteNode, metres: number): void;
/**
 * Drop a site's terrain entirely, back to the implicit flat ground.
 *
 * Distinct from flattening to 0: this removes the `terrain` field, so the scene
 * returns to the exact state it had before terrain was ever touched rather than
 * carrying a field of zeroes. Undo-able like any other sculpt.
 */
export declare function resetSiteTerrain(site: SiteNode): void;
/**
 * Persist a finished stroke as exactly one undo step.
 *
 * `runAsSingleSceneHistoryStep` collapses the write, which matters because a
 * stroke is one user action even though it produced dozens of dabs — without it,
 * undo would walk back through the stroke dab by dab, which is both surprising
 * and unbounded in length.
 *
 * A stroke that leaves the field at the datum writes `undefined` rather than
 * ~11 KB of base64 zeroes: sculpting up and then flattening back down should
 * return the scene to the state it would have had if terrain were never touched,
 * not merely to a visually identical one.
 */
export declare function commitStroke(siteId: SiteNode['id'], field: TerrainField): void;
//# sourceMappingURL=terrain-sculpt.d.ts.map
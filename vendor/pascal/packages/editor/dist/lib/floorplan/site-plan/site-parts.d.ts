/**
 * What the site plan reads off the scene — the site, the building on it, its
 * storeys, the walls' outline, the roof's outline and the outdoor slabs
 * (porches, decks, patios, and the flatwork: driveway and walks) — in SITE
 * metres. Shared by the drawing (`build-site-plan-drawing.ts`) and the
 * coverage / impervious-area figures (`coverage.ts`) so both read the same
 * parts. Pure: no store.
 */
import { type BuildingNode, type LevelNode, type SceneSnapshot, type SiteNode } from '@pascal-app/core';
import { type Pt } from './geometry';
/**
 * The scene's site node, with legacy `metadata.setbacks / zone / apn` lifted
 * onto the real fields. This is a READ-side lift only — nothing is written
 * back to the store, so a scene that was never re-saved keeps its metadata.
 * A persistence-side migration would belong in
 * `packages/core/src/utils/scene-migrations.ts` (not owned by this
 * workstream); see the note in `migrateSiteMetadata`.
 */
export declare function findSite(scene: SceneSnapshot): SiteNode | null;
export declare function findBuilding(scene: SceneSnapshot, site: SiteNode | null): BuildingNode | null;
/** Lowest `level` number among the building's level children. */
export declare function findLowestLevel(scene: SceneSnapshot, building: BuildingNode | null): LevelNode | null;
/**
 * Per-wall plan footprints for a level, mitred, then transformed by the
 * building's site placement. `position` is `[x, y, z]` in site metres (y is
 * height, ignored in plan); `rotation[1]` is the yaw in radians.
 */
export declare function levelFootprintLoops(scene: SceneSnapshot, level: LevelNode | null, building: BuildingNode | null): Pt[][];
/**
 * The outer ring(s) of a set of wall bands: their union, minus any ring that
 * lies inside another (a room enclosed by partitions is a hole in the union,
 * not a second building). Falls back to the bands themselves when the union
 * yields nothing.
 */
export declare function footprintOutline(loops: readonly Pt[][]): Pt[][];
/** A three.js Y rotation of a plan point: local (x, z) turned by `yaw`. */
export declare function turn(x: number, z: number, yaw: number): Pt;
export declare function yawOf(rotation: unknown): number;
/** Level-local plan (x, z) → site metres, through the building's placement (see `levelFootprintLoops`). */
export declare function siteFrame(building: BuildingNode | null): (x: number, z: number) => Pt;
/**
 * The roof's outline on the lot — every roof segment's plan rectangle plus
 * its overhang, through the segment's, the roof's and the building's turns,
 * unioned into the outer ring(s). Dashed on the site plan: what the eye sees
 * from above is the roof, and the setback is measured to the wall under it.
 */
export declare function roofOutlineRings(scene: SceneSnapshot, level: LevelNode | null, building: BuildingNode | null): Pt[][];
/** Every storey of the building at or above grade (level ≥ 0), lowest first. */
export declare function aboveGradeLevels(scene: SceneSnapshot, building: BuildingNode | null): LevelNode[];
/** What an outdoor slab is on the site plan and in the impervious table. */
export type OutdoorKind = 'porch' | 'deck' | 'patio' | 'landing' | 'driveway' | 'walk';
export interface OutdoorPart {
    id: string;
    kind: OutdoorKind;
    /** Upper-case label for the plan ("PORCH", "REAR DECK", "DRIVEWAY"). */
    label: string;
    ring: Pt[];
    /** Plan area, m². */
    area: number;
    /** Under a roof (≥ half its area inside a roof outline): building coverage, not open paving. */
    covered: boolean;
    /** Wood decking (a deck): open boards over grade. */
    wood: boolean;
}
export declare function flatworkKindOf(node: {
    type?: string;
    name?: unknown;
    metadata?: unknown;
}): 'driveway' | 'walk' | null;
/**
 * The level's outdoor slabs in site metres: porches, decks, patios and
 * landings (a generator `metadata.porch`, or a deck / porch-slab floor, or a
 * slab lying outside the house's walls) and the flatwork. The house's own
 * floors (the storey slab, a raised platform, the garage pad) and a porch
 * cover's beam are not outdoor parts. `roofs` decides which are covered.
 */
export declare function outdoorParts(scene: SceneSnapshot, level: LevelNode | null, building: BuildingNode | null, walls: readonly Pt[][], roofs: readonly Pt[][]): OutdoorPart[];
//# sourceMappingURL=site-parts.d.ts.map
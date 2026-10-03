/**
 * Terrain as the level base — the third and last place flat ground was assumed.
 *
 * `getFloorPlacedElevation` returns a *lift* added to a node's level-local Y, and
 * two of its `0`-returns mean "supported by the level base". This module is what
 * those two branches call so that "the level base" can mean the sculpted ground
 * instead of the plane `y = 0`. The other `0`-returns are `+0` no-ops for
 * wall/ceiling-attached items, non-`level` parents, and broken graphs; substituting
 * terrain there would lift sconces off walls, so they stay `0` forever.
 *
 * The whole file is pure — nodes in, metres out — which is what lets the stacking
 * matrix be tested per kind without a canvas.
 */
import type { AnyNode } from '../schema/index.js';
/**
 * World Y of the site datum — the plane terrain heights are measured from.
 *
 * Terrain vertices are absolute world coordinates (the site group renders at the
 * origin and `terrain-geometry` writes `origin + col * spacing` straight into the
 * buffer), so the datum is a constant rather than a site property. It is named
 * because the *comparison* against it is load-bearing, not the value: it is what
 * separates "the ground" from every other horizontal surface in the scene.
 */
export declare const SITE_DATUM_Y = 0;
/**
 * How close a surface must sit to the datum to count as the ground.
 *
 * Loose enough to absorb float drift through a level's world matrix, tight enough
 * that a ground slab (5 cm) still reads as a built surface rather than as terrain.
 */
export declare const SITE_DATUM_EPSILON = 0.0001;
/** True when a world-space height is the site datum — i.e. the terrain's plane. */
export declare function isSiteDatum(worldY: number): boolean;
/**
 * Whether the sculpted ground is what a node on `levelId` stands on — i.e.
 * whether moving the terrain moves that node.
 *
 * Split out of `terrainSupportLift` so the invalidation rule that re-elevates
 * nodes after a sculpt (`markTerrainSupportDependents`) tests grade-ness with
 * the *same* predicate the resolver does. Two copies of this test would drift,
 * and the failure is silent: a level the resolver drapes but the dirty rule
 * skips leaves its contents frozen at the height the ground used to be.
 *
 * Deliberately independent of whether a field exists. A stroke that clears the
 * terrain has to re-elevate exactly the nodes a stroke that creates it does, and
 * asking about the field here would mark none of them on the way back down.
 */
export declare function isLevelAtSiteDatum(nodes: Record<string, AnyNode>, levelId: string): boolean;
/**
 * The lift, in level-local metres, that the sculpted ground provides to a node on
 * `levelId` at level-local `x`/`z`. Null when terrain does not support this node —
 * no sculpted ground, an unresolvable level, or a storey whose floor is not at
 * grade.
 *
 * Null rather than 0 so callers keep their existing flat-ground path verbatim.
 * That is what makes this change invisible to every scene that never touched
 * terrain, which is nearly all of them.
 */
export declare function terrainSupportLift(nodes: Record<string, AnyNode>, levelId: string, x: number, z: number): number | null;
/**
 * **The level base, in level-local metres, at level-local `x`/`z`** — the surface
 * a node rests on when nothing built is under it. Sculpted ground where terrain
 * supports this storey, `0` everywhere else.
 *
 * This is the one function every "nothing is under me, so I'm at zero" site in
 * the codebase should call, and the reason it exists separately from
 * {@link terrainSupportLift}: that function answers *"is there terrain here"*
 * (nullable, so a caller can branch), while this one answers *"how high is the
 * floor of the world here"* (total, so a caller does not have to know terrain
 * exists). Spelling the second question `terrainSupportLift(…) ?? 0` at each
 * site is what made terrain opt-in per kind — every new consumer had to remember
 * to ask, and the ones that forgot silently assumed the plane `y = 0`. Kinds
 * inherit terrain by resolving their base through here instead of hardcoding a
 * zero; nothing has to be registered for that to work.
 *
 * Callers that must distinguish "flat ground" from "a built surface flush with
 * the storey base" still need {@link terrainSupportLift}'s null — both read `0`
 * here and only the first follows a hillside.
 */
export declare function levelBaseElevationAt(nodes: Record<string, AnyNode>, levelId: string, x: number, z: number): number;
/** Record that `type`'s geometry builder resolved its origin from the ground. */
export declare function noteLevelBaseConsumer(type: string): void;
/** Whether `type`'s geometry has to be rebuilt when the sculpted ground moves. */
export declare function isLevelBaseConsumer(type: string): boolean;
//# sourceMappingURL=terrain-support.d.ts.map
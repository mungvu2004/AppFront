/**
 * Ray → terrain intersection.
 *
 * This is the function that replaces `t = -oy / dy` (the flat-ground plane
 * solve) everywhere the editor asks "where on the ground is the pointer?".
 * It lives in `core` with no Three.js so the 2D view, the tools, the placement
 * coordinator, and the tests all call the same code — the failure mode this
 * avoids is each surface having its own idea of where the ground is, which on
 * flat ground is invisible and on a slope is a perspective-skewed offset that
 * only some tools correct for.
 *
 * Method: march the ray in `spacing`-sized steps, watching the sign of
 * `rayY - terrainY`, then bisect the bracketing interval. Marching (rather than
 * per-triangle intersection over the whole grid) is what keeps this O(path
 * length) instead of O(samples) — a 129² field is 32 768 triangles, and testing
 * all of them per pointer-move is not affordable at 50 FPS.
 *
 * The bisection is exact to `spacing / 2^ITERATIONS`; at 0.5 m spacing and 20
 * iterations that is under half a micrometre, i.e. far below the quantization
 * ladder, so the returned point is on the same rendered triangle plane
 * `heightAt` reports.
 */
import { type TerrainField } from './terrain-field.js';
export type TerrainHit = {
    /** Distance along the (unnormalized) direction vector. */
    readonly t: number;
    readonly x: number;
    readonly y: number;
    readonly z: number;
};
/**
 * First intersection of a ray with the terrain surface, or `null` if it misses.
 *
 * `direction` need not be normalized; `t` is in units of `direction`'s length,
 * matching `Ray.at(t)` semantics so a viewer-side caller can pass a three.js ray
 * through unchanged.
 *
 * The march tracks the *sign change* of `rayY - surfaceY` rather than assuming
 * the ray starts above the ground, so a ray fired from inside a hill or from a
 * basement finds the surface it exits through. A ray whose origin is already
 * exactly on the surface returns `t = 0`.
 */
export declare function raycastTerrain(field: TerrainField, origin: readonly [number, number, number], direction: readonly [number, number, number]): TerrainHit | null;
//# sourceMappingURL=terrain-raycast.d.ts.map
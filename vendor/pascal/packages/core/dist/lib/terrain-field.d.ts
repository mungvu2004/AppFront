/**
 * The terrain heightfield: one regular grid of quantized heights, and the
 * only place terrain geometry is read from.
 *
 * Two invariants carry the whole design:
 *
 * 1. **Quantized to `Int16` multiples of `step`.** Heights are integers, so
 *    "is this ground flat?" is exact integer equality rather than an epsilon
 *    comparison. That is what lets the support election treat terrain as one
 *    discrete candidate (see `slab-support.ts`) instead of a float soup that
 *    never ties. `step` is metres per unit; at 0.01 the Int16 range covers
 *    ±327 m of relief, far past any building site.
 * 2. **Every read goes through `heightAt`.** Consumers never index `heights`
 *    directly. One authority means the mesh, the raycast, the placement
 *    predicate, and the tests cannot disagree about where the ground is.
 *
 * Pure data — no Three.js, per the core layer rule. The mesh built from this
 * lives in `@pascal-app/nodes`.
 */
/**
 * A regular grid of heights over the XZ plane.
 *
 * `origin` is the world XZ of sample [0,0]; sample [c,r] sits at
 * `(origin[0] + c * spacing, origin[1] + r * spacing)`. Row-major, so index
 * `r * cols + c`.
 *
 * Sized `2ⁿ+1` per side by convention (33, 65, 129, …) so a future LOD halving
 * lands on existing samples and shares edge vertices with its neighbour rather
 * than interpolating a seam.
 */
export type TerrainField = {
    /** World XZ of sample [0,0]. */
    readonly origin: readonly [number, number];
    /** Metres between adjacent samples. */
    readonly spacing: number;
    readonly cols: number;
    readonly rows: number;
    /** Metres per `heights` unit — the quantization ladder. */
    readonly step: number;
    /** Row-major quantized heights, length `cols * rows`. */
    readonly heights: Int16Array;
};
/** A rectangular sub-block of samples — the unit of every terrain write. */
export type HeightPatch = {
    readonly col0: number;
    readonly row0: number;
    readonly cols: number;
    readonly rows: number;
    /** Row-major quantized heights, length `cols * rows`. */
    readonly heights: Int16Array;
};
export declare const DEFAULT_TERRAIN_STEP = 0.01;
export declare const DEFAULT_TERRAIN_SPACING = 0.5;
export declare function createTerrainField(options?: {
    origin?: readonly [number, number];
    spacing?: number;
    cols?: number;
    rows?: number;
    step?: number;
}): TerrainField;
/** Quantize a metre height onto the field's ladder, clamped to Int16. */
export declare function quantize(field: TerrainField, metres: number): number;
/** Sample [c,r] in metres. Out-of-range indices clamp to the edge, so a
 * consumer reading just past the boundary gets the border height rather than
 * a hole — the same clamp-don't-ask rule the vertical model uses. */
export declare function heightAtSample(field: TerrainField, col: number, row: number): number;
/**
 * The ground height in metres at a world XZ, on the rendered triangle plane.
 *
 * This is the single read authority named in the plan. Each cell uses the same
 * `(c+1,r)`–`(c,r+1)` diagonal as `nodes/src/site/terrain-geometry.ts`, so
 * placement, picking, collision, draping, and pixels all answer the same height.
 */
export declare function heightAt(field: TerrainField, x: number, z: number): number;
/**
 * Compatibility name for callers that explicitly describe a rendered surface.
 * There is intentionally no second interpolation model: `heightAt` is the
 * rendered triangle plane.
 */
export declare function surfaceHeightAt(field: TerrainField, x: number, z: number): number;
/**
 * Surface normal at a world XZ, from analytic central differences.
 *
 * Central differences rather than per-triangle face normals: the field is the
 * authority, so the normal is a property of the *field* and stays continuous
 * across triangle boundaries. Returns a unit vector, +Y up.
 */
export declare function normalAt(field: TerrainField, x: number, z: number): [number, number, number];
/** Slope in radians from horizontal at a world XZ. 0 = flat, π/2 = vertical. */
export declare function slopeAt(field: TerrainField, x: number, z: number): number;
/**
 * True when every sample under the world-XZ rect is at the identical quantized
 * height — the placement predicate for kinds that need level ground.
 *
 * Exact integer equality, which is only meaningful because heights are
 * quantized (invariant 1). A float field would need a tolerance here, and that
 * tolerance would then have to agree with the support election's own epsilon —
 * two tunables that could drift apart. Instead there is one ladder and no
 * tolerance.
 */
export declare function isFlatOver(field: TerrainField, minX: number, minZ: number, maxX: number, maxZ: number): boolean;
/**
 * The one write API. Every terrain mutation — brush stroke, DEM import, scan
 * conversion, preset, MCP tool — lands here.
 *
 * Returns a new field with a new `heights` buffer, so a stroke's before/after
 * pair can be diffed for undo and for `diffToPatches`. Patch samples outside
 * the field are ignored rather than throwing: an imported DEM is allowed to
 * overhang the site, and clipping is the sane response.
 */
export declare function applyHeightPatch(field: TerrainField, patch: HeightPatch): TerrainField;
/** The world-XZ sample range a rect covers, clamped to the field. Shared by
 * the brushes so every tool agrees which samples a footprint touches. */
export declare function sampleRangeOver(field: TerrainField, minX: number, minZ: number, maxX: number, maxZ: number): {
    col0: number;
    row0: number;
    col1: number;
    row1: number;
} | null;
/**
 * The only brush in the first slice: set every sample under a world-XZ rect to
 * one absolute height.
 *
 * Absolute-height flatten before raise/lower is deliberate. A raise/lower brush
 * answers "make this taller", which the user cannot aim; flatten-to-height
 * answers "put the ground at 2.5 m here", which is the actual task when siting
 * a building — and it is the one brush whose result is predictable enough to
 * test. Returns null when the rect misses the field entirely.
 */
export declare function flattenPatch(field: TerrainField, rect: {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
}, metres: number): HeightPatch | null;
/**
 * Split the difference between two fields into patches that each stay under
 * `maxBytes` when serialized.
 *
 * This exists because scene operations are capped at
 * `MAX_SCENE_OPERATION_BYTES` (64 KiB) and each mutation carries both `from`
 * and `to` — so a whole-field write is over budget the moment the grid gets
 * interesting. Rows are the split unit: a patch is always whole rows, which
 * keeps reassembly trivial and means a single-row edit costs one row.
 *
 * Returns the minimal dirty row span, so a small brush stroke on a large field
 * produces a small patch rather than a full-field rewrite.
 */
export declare function diffToPatches(before: TerrainField, after: TerrainField, maxBytes: number): HeightPatch[];
//# sourceMappingURL=terrain-field.d.ts.map
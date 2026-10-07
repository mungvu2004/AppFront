/**
 * Laying a polyline *on* the terrain surface, exactly.
 *
 * The site boundary is the first consumer: a ring of four flat vertices at
 * `y = 0.01` slices straight through any hill it crosses and floats over any
 * excavation, which is the single most obvious way sculpted ground looks broken —
 * the lot line is the one element always on screen.
 *
 * The approach is exactness rather than density. The rendered surface is
 * piecewise-**planar**: `buildTerrainMesh` emits two triangles per cell, so the
 * only places it creases are the grid lines and each cell's diagonal. Subdivide a
 * segment at exactly those crossings and every resulting sub-segment lies inside
 * one triangle, where the surface is a plane and a straight line on it is on it
 * everywhere. Uniform oversampling can only approach that, and needs an arbitrary
 * density to argue about.
 *
 * In field index space (`u = (x - originX) / spacing`, `v = (z - originZ) /
 * spacing`) the three crease families are just `u ∈ ℤ`, `v ∈ ℤ`, and `u + v ∈ ℤ` —
 * the last being the diagonals, since a cell's diagonal runs from `(c+1, r)` to
 * `(c, r+1)`. All three are affine in the segment parameter, so each crossing is
 * one division.
 *
 * Heights come from `surfaceHeightAt`, the explicit rendered-surface alias for
 * the shared `heightAt` triangle-plane authority.
 *
 * Nothing here touches Three.js: it is array math over a field, so the guarantee
 * that a sub-segment lies inside one triangle is asserted in unit tests rather
 * than eyeballed on a canvas.
 */
import { type TerrainField } from '@pascal-app/core';
/** A draped polyline: xyz per vertex, plus normalized arc length per vertex. */
export type DrapedPolyline = {
    /** xyz per vertex, length `count * 3`. */
    positions: Float32Array;
    /** Normalized distance along the line per vertex, length `count`. */
    uvs: Float32Array;
};
/**
 * Parameters in `(0, 1)` where the segment crosses a crease of the rendered
 * surface, sorted and deduplicated.
 *
 * Exported for tests: the crease convention is the load-bearing part, and
 * asserting it on the parameter list is far sharper than inferring it from
 * vertex positions.
 */
export declare function creaseCrossings(field: TerrainField, ax: number, az: number, bx: number, bz: number): number[];
/**
 * Build a draped polyline through `points`.
 *
 * `field` of `null` means flat ground at the datum: the result is the input
 * points at `y = lift`, no subdivision. Keeping that case *here* rather than at
 * every call site is what lets a consumer hold one geometry and one code path
 * whether or not the site has terrain — and it means a scene that never touched
 * terrain builds byte-identical buffers to the ones it built before draping
 * existed.
 *
 * `closed` repeats the first point at the end, so a `LineStrip` closes the ring.
 */
export declare function buildDrapedPolyline({ points, field, lift, closed, }: {
    points: ReadonlyArray<readonly [number, number]>;
    field: TerrainField | null;
    lift: number;
    closed: boolean;
}): DrapedPolyline;
/**
 * Rewrite only the heights of an existing draped polyline, in place.
 *
 * This is the sculpt-stroke path. The crease set is a function of the field's
 * *grid* — origin, spacing, sample counts — and not of its heights, so every dab
 * of a stroke leaves the XZ of every vertex exactly where it was. Rebuilding the
 * ring per dab would reallocate two buffers and a `BufferGeometry` at pointer
 * rate for a result that differs only in Y.
 *
 * Reads each vertex's own XZ back out of the buffer rather than taking the source
 * polygon again: there is then no second copy of the subdivision to keep in step.
 *
 * Arc lengths are deliberately *not* refreshed — see `writeArcLengths`.
 */
export declare function updateDrapedHeights(ring: DrapedPolyline, field: TerrainField | null, lift: number): void;
/**
 * Everything about a field that changes the crease set, and nothing that doesn't.
 *
 * A React consumer needs to rebuild a draped ring when the *grid* moves and only
 * rewrite heights when the *heights* move. Keying a memo on the field object would
 * rebuild every dab (each `applyHeightPatch` returns a new field); keying it on
 * this rebuilds only when a resize or re-origin actually invalidates the
 * subdivision, which in practice means import. `null` for no terrain, so the
 * flat-ground ring is one more value in the same key space.
 */
export declare function terrainGridKey(field: TerrainField | null): string | null;
//# sourceMappingURL=terrain-drape.d.ts.map
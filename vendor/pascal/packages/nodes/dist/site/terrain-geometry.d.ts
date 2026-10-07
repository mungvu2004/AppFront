import { type HeightPatch, type TerrainField } from '@pascal-app/core';
/**
 * Builds the terrain mesh buffers from a `TerrainField`.
 *
 * Split out of the renderer as pure array math so the vertex layout is
 * unit-testable without a canvas, and so the partial-upload path has one
 * definition. The renderer owns the `BufferGeometry`; this owns what goes in it.
 *
 * The triangulation this file emits is the convention `surfaceHeightAt`
 * (`core/lib/terrain-field.ts`) reads back: two triangles per cell split along the
 * `(c+1,r)`–`(c,r+1)` diagonal. Anything drawn *on* the ground samples that
 * function, so changing the winding below without changing it there would make
 * every draped line sink into half of every cell.
 *
 * Two rules that are easy to get wrong and expensive to debug:
 *
 * - **Normals are analytic, never `computeVertexNormals()`.** Beyond the cost
 *   (~1.5 ms at 257²), `computeVertexNormals()` rewrites the *whole* normal
 *   attribute, which silently defeats the dirty-rect partial upload that makes
 *   sculpting cheap. `normalAt` central-differences the field instead, so a
 *   patch touches only its footprint and the neighbouring normals.
 * - **Vertices are one-per-sample and shared between triangles**, so a partial
 *   upload is a contiguous row range. Duplicating verts per-triangle for flat
 *   shading would triple memory and scatter the dirty range.
 */
/**
 * Y of the site's presentation horizon disc (`site/renderer.tsx`).
 *
 * It lives here, next to the skirt, because the skirt is the thing that has to
 * bracket it: its top edge never sits below this plane and its base always clears
 * it, so no sightline can pass between the sculpted ground and the surrounding
 * one. Two readers, one number.
 */
export declare const HORIZON_PLANE_Y = -0.07;
/** One vertex per sample, row-major — index `r * cols + c` matches the field. */
export type TerrainMeshBuffers = {
    /** xyz per sample, length `cols * rows * 3`. */
    positions: Float32Array;
    /** xyz per sample, length `cols * rows * 3`. */
    normals: Float32Array;
    /** uv per sample, length `cols * rows * 2`. */
    uvs: Float32Array;
    /** Triangle indices, two per grid cell. */
    indices: Uint32Array;
};
export declare function buildTerrainMesh(field: TerrainField): TerrainMeshBuffers;
/**
 * A vertical curtain around the field boundary, closing the terrain against the
 * site's horizon disc.
 *
 * The disc is a flat plate at `HORIZON_PLANE_Y` standing in for ground beyond the
 * field, and the field's extent is punched out of it so an excavation is not simply
 * hidden under it. That punch leaves an open rim, and sculpted ground turns it into
 * a visible fault: a raised edge shows daylight under the terrain shell, a lowered
 * one shows the disc's cut edge hanging in the air over the pit.
 *
 * The curtain spans `[min(h, H) - SKIRT_DROP, max(h, H)]` at every boundary
 * sample, so it *brackets* both the terrain edge and the horizon plane no matter
 * which is higher. That is the whole correctness argument: a sightline through the
 * rim has to cross the curtain, because the curtain covers the rim's entire Y
 * range at the rim's exact XZ.
 *
 * One vertex pair (top, bottom) per boundary sample, in a ring whose first sample
 * is repeated at the end so the strip closes.
 */
export type TerrainSkirtBuffers = {
    /** xyz, `(perimeter + 1) * 2` vertices — top then bottom per ring position. */
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array;
};
/**
 * The field's own footprint, as a polygon to punch out of the horizon disc.
 *
 * The punch is the only reason an excavation is visible at all: without it the disc
 * — a flat plate at `HORIZON_PLANE_Y` standing in for ground beyond the field —
 * roofs over every pit, so digging a basement reads as no change whatsoever. On
 * raised or flat ground it costs nothing visually, because the terrain shell and its
 * skirt cover the hole from both sides.
 *
 * Inset by half a cell, so the disc and the terrain edge *overlap* rather than meet:
 * two coplanar edges at exactly the same XZ z-fight along the whole perimeter. The
 * inset is what the skirt's bracketing span is covering, which is why this lives
 * beside `buildTerrainSkirt` — the two have to agree about where the rim is, and a
 * footprint that punched wider than the skirt spans would open a gap the skirt never
 * closes.
 *
 * Kept here rather than in the renderer so it is reachable without Three.js: it
 * decides whether a pit is visible, and that is a property to assert, not to eyeball.
 */
export declare function terrainFootprint(field: TerrainField): Array<[number, number]>;
export declare function buildTerrainSkirt(field: TerrainField): TerrainSkirtBuffers;
/**
 * Rewrite the whole skirt in place.
 *
 * Whole, not dirty-ranged, unlike the surface: the perimeter is `2(cols + rows)`
 * vertices — 1 028 at 257², under 3% of the surface's vertex count — so the
 * bookkeeping to find which boundary samples a rectangular patch touched costs
 * more than re-uploading all of them. The surface's dirty range earns its
 * complexity because it saves 400 KB a dab; here there is nothing to save.
 */
export declare function updateTerrainSkirt(field: TerrainField, buffers: TerrainSkirtBuffers): void;
/**
 * The contiguous vertex range a patch dirties, in **array elements** — the unit
 * `BufferAttribute.addUpdateRange(start, count)` expects.
 *
 * A patch is rectangular, so the touched vertices are not contiguous unless the
 * patch spans full rows. Rather than issue one range per row, this returns the
 * single span from the patch's first vertex to its last: over-reporting a few
 * clean vertices is far cheaper than many small GPU uploads, and it keeps the
 * caller to one `addUpdateRange` call.
 *
 * The range is widened by one row on each side because a height change moves the
 * *normals* of its neighbours too (central differences reach one sample out).
 * Getting this wrong produces the classic symptom: correct silhouette, stale
 * shading along the edit boundary.
 */
export declare function patchUpdateRange(field: TerrainField, patch: HeightPatch, itemSize: number): {
    start: number;
    count: number;
} | null;
/**
 * Rewrites only the vertices a patch touched, in place.
 *
 * Takes the *already-patched* field (the one `applyHeightPatch` returned) and
 * the patch that produced it, so the caller cannot accidentally rebuild from
 * stale heights. Mutates the buffers rather than reallocating — that is the
 * whole point of the dirty-rect path.
 */
export declare function updateTerrainMesh(field: TerrainField, buffers: TerrainMeshBuffers, patch: HeightPatch): void;
//# sourceMappingURL=terrain-geometry.d.ts.map
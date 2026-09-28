/**
 * A patterned RIBBON along a draped polyline — the way a property line or a
 * setback line is drawn on the ground in 3D. WebGL ignores line widths, so
 * a thick line is a flat mesh: the polyline (already draped on the terrain
 * by `buildDrapedPolyline`) is walked by arc length, the on / off pattern
 * is unrolled along it (metres: dash, gap, dot, gap, dot, gap — the
 * standard property line; dash, gap — a setback), and every "on" run
 * becomes quads `width` wide lying flat in the XZ plane at the draped
 * height. Pure; the renderer wraps the geometry in a mesh.
 *
 * The property line draws dark and thick in the standard dash-dot-dot
 * pattern; the setbacks draw black and dashed.
 */
import { type TerrainField } from '@pascal-app/core';
import { BufferGeometry } from 'three';
/** The standard property line: a long dash, two dots (metres). */
export declare const PROPERTY_LINE_PATTERN: readonly number[];
/** A setback line: dashed. */
export declare const SETBACK_LINE_PATTERN: readonly number[];
/**
 * Re-drape a ribbon on a changed field: every vertex keeps its XZ and takes
 * the ground's height there plus `lift` (a sculpt stroke mid-flight).
 */
export declare function updateRibbonHeights(geometry: BufferGeometry, field: TerrainField | null, lift: number): void;
/**
 * Build the ribbon. `positions` is the draped polyline (xyz per vertex,
 * consecutive, NOT closed — pass the closing vertex yourself); `pattern`
 * alternates on / off lengths in metres; `width` is the ribbon's full width.
 */
export declare function buildPatternedRibbon(positions: Float32Array, pattern: readonly number[], width: number, step?: number): BufferGeometry;
//# sourceMappingURL=line-ribbon.d.ts.map
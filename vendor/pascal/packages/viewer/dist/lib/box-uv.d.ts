import type { BoxGeometry } from 'three';
/**
 * Rewrite a default `BoxGeometry`'s UVs to world scale — 1 UV unit = 1 metre —
 * so tiled finishes (with `repeat` in tiles-per-metre) render at a consistent
 * real-world scale instead of stretching to fit each face. Matches the
 * world-scale UV convention used by the procedural slab/wall geometry.
 *
 * three.js builds box faces in the fixed order [+X, -X, +Y, -Y, +Z, -Z], four
 * verts each, with UVs spanning 0→1 across the face. Each face's two in-plane
 * dimensions differ, so we scale U/V per face by that face's size in metres.
 */
export declare function applyWorldScaleBoxUVs(geometry: BoxGeometry, w: number, h: number, d: number): void;
//# sourceMappingURL=box-uv.d.ts.map
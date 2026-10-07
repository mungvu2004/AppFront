import { type ChimneyNode, type RoofSegmentNode } from '@pascal-app/core';
import { type getRoofSegmentBrushes } from '@pascal-app/viewer';
import * as THREE from 'three';
export type SegmentTrimBrushes = NonNullable<ReturnType<typeof getRoofSegmentBrushes>>;
/**
 * CSG-trim the chimney body against the parent roof segment so the
 * portion of the chimney that passes through the wall and shingles
 * is hidden — gives the clean "chimney emerges from the roof" look
 * the archive shipped. Lives in the chimney folder (not the geometry
 * builder) because three-bvh-csg + three-mesh-bvh are viewer-only
 * deps; the renderer is the natural seam since it already imports
 * from `@pascal-app/viewer`.
 *
 * Segment brushes are passed in (built once per segment shape in the
 * renderer and reused across slider drags); the function does NOT
 * dispose them. CSG `evaluate` returns a new brush, so the input
 * brushes survive the call unmutated.
 *
 * Returns the input geometry untouched on any CSG failure so the
 * chimney still renders (just not trimmed).
 */
export declare function trimChimneyBodyAgainstRoof(body: THREE.BufferGeometry, segment: RoofSegmentNode, node: ChimneyNode, segBrushes: SegmentTrimBrushes): THREE.BufferGeometry;
//# sourceMappingURL=roof-trim.d.ts.map
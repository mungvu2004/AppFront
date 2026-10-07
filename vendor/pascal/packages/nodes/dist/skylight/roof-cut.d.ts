import type { RoofSegmentNode, SkylightNode } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Build the segment-local cut geometry the host roof's merge loop
 * subtracts from its shin / deck / wall brushes so the skylight has a
 * clean hole to poke through.
 *
 * The cut is a box, sized to the skylight footprint plus frame +
 * cutout offset, oriented to the outer roof surface frame at the
 * skylight's position (so multi-slope roofs — gambrel / mansard /
 * dutch — cut perpendicular to the actual surface rather than world
 * up).
 *
 * Returns null on degenerate input.
 *
 * Coordinates are SEGMENT-LOCAL. The viewer welds vertices, attaches
 * a single material group, and wraps the result in a Brush — see
 * `wiki/architecture/node-definitions.md` (`capabilities.roofAccessory.buildCut`).
 */
export declare function buildSkylightRoofCut(skylight: SkylightNode, segment: RoofSegmentNode): THREE.BufferGeometry | null;
//# sourceMappingURL=roof-cut.d.ts.map
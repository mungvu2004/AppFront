import { type SlabNode, type SlabPolygonContext } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Generates slab geometry from polygon. `context` carries the slab's level
 * neighbourhood (walls + sibling slabs) driving the per-edge render offsets —
 * see `getRenderableSlabPolygon`. Branches on the explicit `recessed` intent:
 * a recessed slab is an open shell (pool), everything else a solid occupying
 * `[elevation − thickness, elevation]`.
 */
export declare function generateSlabGeometry(slabNode: SlabNode, context: SlabPolygonContext): THREE.BufferGeometry;
//# sourceMappingURL=slab-system.d.ts.map
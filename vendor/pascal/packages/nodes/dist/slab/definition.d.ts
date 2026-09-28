import { type NodeDefinition } from '@pascal-app/core';
import { SlabNode } from './schema';
/**
 * Slab — Phase 5 batch kind, polygon-based. Stage B: `def.geometry`
 * drives the rebuild via generic <GeometrySystem>; <ParametricNodeRenderer>
 * mounts the empty group. No per-kind renderer or system file.
 *
 * Capabilities:
 *  - **No `movable`**: slab's "move" today is whole-slab translation via
 *    legacy `MoveSlabTool`, which integrates with the floor-plan boundary /
 *    hole editors. Capability-driven dispatch keeps the legacy mover.
 *  - **`surfaces.top`**: items host on the slab top at `elevation`.
 *  - `selectable`, `duplicable`, `deletable` standard.
 *
 * Relations:
 *  - `hosts: ['item']` — items mount on the slab top.
 *  - `cascadeDelete: 'descendants'` — deleting a slab removes hosted items.
 */
export declare const slabDefinition: NodeDefinition<typeof SlabNode>;
//# sourceMappingURL=definition.d.ts.map
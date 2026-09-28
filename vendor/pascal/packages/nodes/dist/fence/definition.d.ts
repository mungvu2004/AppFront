import { type NodeDefinition } from '@pascal-app/core';
import { FenceNode } from './schema';
/**
 * Fence — Phase 5 batch kind. Stage B complete: `def.geometry` drives
 * the rebuild via the generic `<GeometrySystem>`; `<ParametricNodeRenderer>`
 * mounts the empty group. No per-kind renderer or system file.
 *
 * Capabilities:
 *  - **No `movable`**: fence move is bespoke endpoint-drag. Capability-
 *    driven dispatch keeps the legacy MoveFenceTool until the
 *    affordance port (Stage D).
 *  - `surfaces.sides`, `selectable`, `duplicable`, `deletable` standard.
 *
 * Relations: `linkedBy: 'endpoint-match'` for corner cascade.
 */
export declare const fenceDefinition: NodeDefinition<typeof FenceNode>;
//# sourceMappingURL=definition.d.ts.map
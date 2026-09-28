import type { NodeDefinition } from '@pascal-app/core';
import { DuctFittingNode } from './schema';
/**
 * Phase 2 of the HVAC node system — duct fittings (elbow / tee / reducer)
 * and the first kind to expose typed ports (`def.ports`).
 *
 * Composition: `def.geometry` only, same as duct-segment. Ports are the
 * architectural payload: placement tools snap onto them, and a later
 * slice walks them to build the supply/return system graph.
 */
export declare const ductFittingDefinition: NodeDefinition<typeof DuctFittingNode>;
//# sourceMappingURL=definition.d.ts.map
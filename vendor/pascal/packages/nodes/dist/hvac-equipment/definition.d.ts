import type { NodeDefinition } from '@pascal-app/core';
import { HvacEquipmentNode } from './schema';
/**
 * Phase 3 of the HVAC node system — equipment cabinets (furnace /
 * air handler / condenser). Furnaces and air handlers expose supply +
 * return ports, giving duct runs a real origin: the duct and fitting
 * tools snap onto these collars like any other port.
 *
 * Composition: `def.geometry` only. Yaw-only rotation, so the editor's
 * default R-rotate works on a selected unit without custom actions.
 */
export declare const hvacEquipmentDefinition: NodeDefinition<typeof HvacEquipmentNode>;
//# sourceMappingURL=definition.d.ts.map
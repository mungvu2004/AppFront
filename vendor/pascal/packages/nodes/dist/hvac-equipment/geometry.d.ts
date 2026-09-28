import { Group } from 'three';
import type { HvacEquipmentNode } from './schema';
/**
 * Pure geometry builder for an HVAC equipment cabinet, in the node's
 * LOCAL frame (origin at base center, +Z front, +X right) —
 * `<ParametricNodeRenderer>` applies `position` + yaw.
 *
 * Furnace / air handler: the cabinet is built from individual sheet-metal
 * walls (not a solid box) so the lower front can be left OPEN — a real
 * cut that exposes the squirrel-cage circulating fan and, on a furnace,
 * the orange burner manifold and gas valve. Furnaces also get the
 * combustion train from the reference drawing: a draft hood + vent
 * connector elbow on top and a gas pipe with drip leg down the front-left.
 *
 * Air handler: tall white cabinet with two stacked guarded axial fans on
 * the front and finned coil bands down the sides (vertical fan-coil look).
 * Condenser: squat cabinet with a fan ring and hub on top.
 */
export declare function buildHvacEquipmentGeometry(node: HvacEquipmentNode): Group;
//# sourceMappingURL=geometry.d.ts.map
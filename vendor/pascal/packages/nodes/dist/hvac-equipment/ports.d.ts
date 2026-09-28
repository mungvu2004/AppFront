import type { NodePort } from '@pascal-app/core';
import { Vector3 } from 'three';
import type { HvacEquipmentNode } from './schema';
type CollarShape = 'round' | 'rect' | 'oval';
type LocalPort = {
    id: string;
    position: Vector3;
    direction: Vector3;
    diameter: number;
    system: 'supply' | 'return' | 'refrigerant';
    shape?: CollarShape;
    width?: number;
    height?: number;
};
/**
 * Duct ports in the cabinet's LOCAL frame (origin at the base center,
 * before yaw / position). Matches a typical upflow furnace / vertical air
 * handler: supply plenum collar on top, return drop on the -X side near
 * the bottom third. Condensers carry no duct ports — their connection is
 * the refrigerant lineset (see `localRefrigerantPorts`).
 */
export declare function localEquipmentPorts(node: HvacEquipmentNode): LocalPort[];
/**
 * Refrigerant service connection in the cabinet's LOCAL frame — the point
 * a lineset run leaves from (condenser) or arrives at (indoor coil on a
 * furnace / air handler). Every equipment type exposes exactly one, on the
 * +X service-valve face: a condenser/air-handler near the bottom third, a
 * furnace near the top where the cased A-coil sits above the heat
 * exchanger.
 */
export declare function localRefrigerantPorts(node: HvacEquipmentNode): LocalPort[];
/** `def.ports` — duct + refrigerant ports transformed into level-local
 * space (yaw + position). */
export declare function getHvacEquipmentPorts(node: HvacEquipmentNode): NodePort[];
export {};
//# sourceMappingURL=ports.d.ts.map
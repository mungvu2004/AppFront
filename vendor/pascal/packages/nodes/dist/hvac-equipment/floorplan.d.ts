import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { HvacEquipmentNode } from './schema';
/**
 * Floor-plan footprint for HVAC equipment: the cabinet rectangle
 * (rotated by yaw) with a diagonal so it reads as an equipment symbol,
 * plus a supply/return collar dot per duct port. Selected → themed
 * stroke + move handle.
 */
export declare function buildHvacEquipmentFloorplan(node: HvacEquipmentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
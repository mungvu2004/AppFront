import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { DuctFittingNode } from './schema';
/**
 * Floor-plan symbol for a duct fitting: one stub line per port from the
 * junction center out to the collar (drawn at each collar's real
 * diameter), plus a junction circle. Ports are computed in level-local
 * 3D and projected to plan, so a rotated or riser-turned fitting shows
 * its true plan footprint; a vertical port collapses onto the junction
 * circle, which is exactly how it should read from above.
 */
export declare function buildDuctFittingFloorplan(node: DuctFittingNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
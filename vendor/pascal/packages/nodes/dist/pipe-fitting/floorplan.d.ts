import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { PipeFittingNode } from './schema';
/**
 * Floor-plan symbol for a DWV fitting: one line per collar from the
 * junction out (a wye's 45° branch reads at its true plan angle), plus
 * a hub circle. Vertical collars (stack connections) collapse onto the
 * hub, which is how they should read from above.
 */
export declare function buildPipeFittingFloorplan(node: PipeFittingNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
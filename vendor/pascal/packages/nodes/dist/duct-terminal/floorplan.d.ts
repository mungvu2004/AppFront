import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { DuctTerminalNode } from './schema';
/**
 * Floor-plan symbol for a duct terminal: the face rectangle (rotated by
 * yaw) with the conventional register cross-slats hinted as a single
 * mid-line, tinted by system. Wall mounts render the same footprint —
 * the face projects to a thin strip, which is close enough for plan
 * reading at this stage.
 */
export declare function buildDuctTerminalFloorplan(node: DuctTerminalNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
import type { CeilingNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for ceiling. Dashed boundary (ceilings sit
 * above the slab); when selected, mounts the same boundary editor as
 * slab — vertex + midpoint + edge handles on the outer ring AND every
 * hole, with `holeIndex` carried in the handle payloads.
 */
export declare function buildCeilingFloorplan(node: CeilingNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { PipeTrapNode } from './schema';
/**
 * Floor-plan symbol — the conventional trap glyph: a short stub at the
 * inlet (the fixture drop, drawn as a dot since it's vertical) and a
 * solid line for the trap arm out to the outlet. Reads as the P-trap's
 * arm in plan.
 */
export declare function buildPipeTrapFloorplan(node: PipeTrapNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
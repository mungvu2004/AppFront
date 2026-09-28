import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { LiquidLineNode } from './schema';
/**
 * Floor-plan representation of a liquid line: a single thin copper polyline at
 * the line's real width. Vertical risers collapse to a point in plan;
 * consecutive duplicate plan points are dropped so they don't render
 * zero-length artifacts.
 */
export declare function buildLiquidLineFloorplan(node: LiquidLineNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { LinesetNode } from './schema';
/**
 * Floor-plan representation of a lineset: the path drawn at the suction
 * jacket's real width with a dashed copper centerline. Vertical risers
 * collapse to a point in plan; consecutive duplicate plan points are
 * dropped so they don't render zero-length artifacts.
 */
export declare function buildLinesetFloorplan(node: LinesetNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
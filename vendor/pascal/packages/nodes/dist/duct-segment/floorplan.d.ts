import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { DuctSegmentNode } from './schema';
/**
 * Floor-plan representation of a duct run: the path drawn at the duct's
 * real width (plan-unit stroke so it scales with zoom), with a dashed
 * centerline tinted by system — orange for supply, blue for return, the
 * same hues the 3D tint uses. Vertical risers collapse to a point in
 * plan; consecutive duplicate plan points are dropped so they don't
 * render zero-length artifacts.
 */
export declare function buildDuctSegmentFloorplan(node: DuctSegmentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
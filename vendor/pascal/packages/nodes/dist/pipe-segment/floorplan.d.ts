import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { PipeSegmentNode } from './schema';
/**
 * Floor-plan representation of a DWV run, following drafting convention:
 * waste lines draw SOLID at the pipe's width, vent lines draw DASHED and
 * thin. Vertical stacks collapse to a circle.
 */
export declare function buildPipeSegmentFloorplan(node: PipeSegmentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
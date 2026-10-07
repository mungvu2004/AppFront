import type { Point2D, StairNode, StairSegmentNode } from '@pascal-app/core';
import type { FloorplanStairEntry, StairSegmentTransform } from './types';
export declare function computeFloorplanStairSegmentTransforms(segments: StairSegmentNode[]): StairSegmentTransform[];
export declare function getFloorplanStairSegmentPolygon(stair: StairNode, segment: StairSegmentNode, transform: StairSegmentTransform): Point2D[];
export declare function buildFloorplanStairEntry(stair: StairNode, segments: StairSegmentNode[]): FloorplanStairEntry | null;
//# sourceMappingURL=stairs.d.ts.map
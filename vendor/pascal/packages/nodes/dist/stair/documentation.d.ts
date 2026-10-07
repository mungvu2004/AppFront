import { type FloorplanGeometry, type GeometryContext, type StairNode } from '@pascal-app/core';
import type { FloorplanStairArrowEntry, FloorplanStairEntry } from '@pascal-app/editor';
export type StairPlanDirection = 'up' | 'down';
export declare function resolveStairPlanDirection(stair: StairNode, activeLevelId: string | null | undefined): StairPlanDirection;
export declare function resolveStraightStairDirectionArrow(entry: FloorplanStairEntry, direction: StairPlanDirection): FloorplanStairArrowEntry | null;
export declare function stairPlanBreakStep(stepCount: number): number;
export declare function buildStairDocumentation(stair: StairNode, entry: FloorplanStairEntry, ctx: GeometryContext): FloorplanGeometry[];
//# sourceMappingURL=documentation.d.ts.map
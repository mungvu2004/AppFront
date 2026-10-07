import { type AnyNode, type FloorplanGeometry, type FloorplanPoint, type GeometryContext, type WallNode } from '@pascal-app/core';
import { type ConstructionDimensionDrawingStandard } from '../shared/construction-dimension-standards';
import { type ConstructionLengthProfile, type ConstructionLinearUnit } from '../shared/construction-length';
export { formatConstructionLength } from '../shared/construction-length';
export type ConstructionDimensionTier = 'opening-widths' | 'openings' | 'partitions' | 'structure' | 'jogs' | 'overall' | 'structural-overall' | 'interior' | 'interior-overall';
export type PlannedConstructionDimension = {
    tier: ConstructionDimensionTier;
    start: FloorplanPoint;
    end: FloorplanPoint;
    dimensionStart?: FloorplanPoint;
    dimensionEnd?: FloorplanPoint;
    offsetNormal: FloorplanPoint;
    offsetDistance: number;
    textPrefix?: string;
};
export type WallConstructionDimensionPlan = ReadonlyMap<string, readonly PlannedConstructionDimension[]>;
export declare function buildLevelWallConstructionDimensionPlan(walls: ReadonlyArray<WallNode>, nodes: Record<string, AnyNode>, standard?: ConstructionDimensionDrawingStandard): WallConstructionDimensionPlan;
export declare function renderPlannedConstructionDimensions(planned: readonly PlannedConstructionDimension[], unit: ConstructionLinearUnit, stroke?: string, profile?: ConstructionLengthProfile, standard?: ConstructionDimensionDrawingStandard): FloorplanGeometry[];
export declare function buildCurvedWallConstructionDimensions(wall: WallNode, { unit, stroke, profile, standard, siblings, }: {
    unit: ConstructionLinearUnit;
    stroke?: string;
    profile?: ConstructionLengthProfile;
    standard?: ConstructionDimensionDrawingStandard;
    siblings?: ReadonlyArray<WallNode>;
}): FloorplanGeometry[];
export declare function buildWallConstructionDimensions(wall: WallNode, ctx: GeometryContext, { unit, stroke, profile, standard, }: {
    unit: ConstructionLinearUnit;
    stroke?: string;
    profile?: ConstructionLengthProfile;
    standard?: ConstructionDimensionDrawingStandard;
}): FloorplanGeometry[];
//# sourceMappingURL=construction-dimensions.d.ts.map
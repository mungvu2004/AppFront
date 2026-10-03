import { type AnyNode, type AnyNodeId, type ConstructionDimensionChainMode, type ConstructionDimensionMode, type FloorplanGeometry, type MeasurementAnchor, type MeasurementPoint, type WallNode } from '@pascal-app/core';
import { type FloorplanToolContext } from '@pascal-app/editor';
type Draft = {
    anchors: MeasurementAnchor[];
    points: MeasurementPoint[];
    stage: 'witnesses' | 'baseline';
};
export declare function resolveConstructionDimensionDraftDirection(points: readonly MeasurementPoint[], anchors?: readonly MeasurementAnchor[], nodes?: Readonly<Record<AnyNodeId, AnyNode>>): [number, number] | null;
export declare function buildConstructionDimensionPreviewGeometries(points: readonly MeasurementPoint[], baselinePoint: MeasurementPoint, unit: 'metric' | 'imperial', mode?: ConstructionDimensionMode, metricNotation?: 'meters' | 'millimeters', directionOverride?: readonly [number, number] | null): FloorplanGeometry[];
export declare function normalizeConstructionDimensionChainMode(value: unknown): ConstructionDimensionChainMode;
export declare function normalizeConstructionDimensionMode(value: unknown): ConstructionDimensionMode;
export declare function constructionDimensionUsesBaseline(mode: ConstructionDimensionMode): boolean;
export declare function shouldConsumeConstructionDimensionPointerEvent(event: {
    type: string;
    button: number;
    buttons: number;
}): boolean;
export declare function buildCurvedWallConstructionDimensionDraft(wall: WallNode, mode: ConstructionDimensionMode): Pick<Draft, 'anchors' | 'points'> | null;
export declare function FloorplanConstructionDimensionToolLayer({ activeLevelId, finishTool, gridSnapStep, metricNotation, sceneApi, selectNode, toolDefaults, unit, }: FloorplanToolContext): import("react").JSX.Element | null;
export default FloorplanConstructionDimensionToolLayer;
//# sourceMappingURL=floorplan-tool.d.ts.map
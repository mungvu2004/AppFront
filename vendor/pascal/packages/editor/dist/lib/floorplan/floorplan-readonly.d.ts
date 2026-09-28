import type { AnyNode, FloorplanPalette, GeometryContext } from '@pascal-app/core';
import { type FloorplanWallDimensionReference } from './floorplan-extension';
export type FloorplanViewState = {
    automaticDimensions?: boolean;
    selected: boolean;
    unit: 'metric' | 'imperial';
    metricNotation?: 'meters' | 'millimeters';
    purpose?: 'edit' | 'document';
    /** Sheet drafting conventions (see `FloorplanContextExtension.drafting`). */
    drafting?: boolean;
    wallDimensionReference?: FloorplanWallDimensionReference;
    highlighted: boolean;
    hovered: boolean;
    moving: boolean;
    focusedUnitId?: string;
    focusedUnitMemberIds?: readonly string[];
    palette: FloorplanPalette | undefined;
};
export declare function buildFloorplanContext(node: AnyNode, nodes: Record<string, AnyNode>, viewState: FloorplanViewState, levelData?: unknown): GeometryContext;
export declare function floorplanLayerRank(type: string): number;
//# sourceMappingURL=floorplan-readonly.d.ts.map
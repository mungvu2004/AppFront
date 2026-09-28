import { type FloorplanGeometry, type GeometryContext, type WallNode } from '@pascal-app/core';
type WallHostedOpening = {
    position: readonly [number, number, number];
    width: number;
};
type OpeningDimensionOptions = {
    showClearancesWhileMoving: boolean;
    useExteriorNormal: boolean;
};
export declare function buildWallContextualDimensions(node: WallNode, ctx: GeometryContext): FloorplanGeometry | null;
export declare function buildWallHostedOpeningContextualDimensions(node: WallHostedOpening, ctx: GeometryContext, options: OpeningDimensionOptions): FloorplanGeometry | null;
export {};
//# sourceMappingURL=contextual-dimensions.d.ts.map
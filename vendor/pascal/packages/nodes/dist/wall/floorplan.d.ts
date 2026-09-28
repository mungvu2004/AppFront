import { type AnyNode, type FloorplanGeometry, type GeometryContext, type WallLayerMiterData, type WallMiterData, type WallNode } from '@pascal-app/core';
import { type WallConstructionDimensionPlan } from './construction-dimensions';
declare const WALL_DIMENSION_REFERENCES: readonly ["finished-faces", "centerline", "stud-faces"];
type WallDimensionReference = (typeof WALL_DIMENSION_REFERENCES)[number];
export type WallFloorplanLevelData = {
    miters: WallMiterData;
    documentMiters: WallMiterData;
    layerMiters: WallLayerMiterData;
    documentLayerMiters: WallLayerMiterData;
    constructionDimensionsByReference: Record<WallDimensionReference, WallConstructionDimensionPlan>;
};
export declare function computeWallFloorplanLevelData({ siblings, nodes, }: {
    siblings: ReadonlyArray<WallNode>;
    nodes: Record<string, AnyNode>;
}): WallFloorplanLevelData;
/**
 * Stage C floor-plan builder for wall — emits the full chrome stack the
 * legacy `floorplan-panel.tsx` rendered inline:
 *
 *   1. The mitered footprint polygon (themed fill + stroke).
 *   2. A diagonal hatch overlay when selected.
 *   3. A transparent hit-line on the centerline so the user can grab the
 *      wall body easily.
 *   4. Two endpoint handles (start + end) when selected — the registry
 *      layer hosts the 5-circle stack + hover transitions + 2D drag.
 *   5. Exterior facade strings plus interior wall spans and hosted-opening widths.
 *
 * `ctx.levelData` provides the shared level miter graph when the floor-plan
 * dispatcher precomputes it; `ctx.siblings` remains the fallback path for
 * direct builder callers.
 */
export declare function buildWallFloorplan(node: WallNode, ctx: GeometryContext): FloorplanGeometry | null;
export {};
//# sourceMappingURL=floorplan.d.ts.map
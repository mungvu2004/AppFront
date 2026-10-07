import { type AnyNode, type AnyNodeId, type ConstructionDrawingType, type FloorplanGeometry, type FloorplanPalette, type NodeCategory } from '@pascal-app/core';
import { type FloorplanAnnotationVisibility } from './annotation-visibility';
import { type FloorplanMetricNotation, type FloorplanSchedule, type FloorplanWallDimensionReference } from './floorplan-extension';
import { type FloorplanMode } from './floorplan-mode';
/**
 * Floorplan PDF export.
 *
 * Re-runs the same registry-driven geometry pipeline the live 2D layer uses
 * (`def.floorplan(node, ctx)` → `FloorplanGeometryRenderer`) headlessly, with
 * a neutral `viewState` so nodes render in their default, unselected form.
 * Every level of the active building becomes its own page, titled with the
 * level's label, with the plan fit to the page (independent of the live
 * pan/zoom). PDFKit is dynamically imported so it only loads when an export
 * actually runs. Geometry and labels are emitted as native PDF vectors and
 * text instead of being reinterpreted from browser SVG.
 *
 * `scope: 'structure'` keeps only `category === 'structure'` nodes (walls,
 * slabs, ceilings, doors, windows, stairs, columns, roofs…); `'full'` keeps
 * every node that has a floorplan builder and is visible.
 */
export type FloorplanExportScope = 'full' | 'structure';
/**
 * Whether a node belongs in the given export scope. `'full'` short-circuits
 * and admits every node; `'structure'` admits only `structure`-category
 * nodes. An `undefined` definition (unregistered node type) behaves like a
 * node with no category.
 */
export declare function isFloorplanNodeInExportScope(definition: {
    category?: NodeCategory;
} | undefined, scope: FloorplanExportScope): boolean;
export declare function resolveFloorplanExportViewState(unit: 'metric' | 'imperial', metricNotation: FloorplanMetricNotation, wallDimensionReference?: FloorplanWallDimensionReference, automaticDimensions?: boolean): {
    automaticDimensions: boolean;
    unit: "metric" | "imperial";
    metricNotation: FloorplanMetricNotation;
    wallDimensionReference: FloorplanWallDimensionReference | undefined;
    selected: false;
    purpose: "edit";
    highlighted: false;
    hovered: false;
    moving: false;
    palette: FloorplanPalette;
};
type ExportLevel = {
    id: AnyNodeId;
    label: string;
};
type ExportGeometry = {
    id: AnyNodeId;
    model: FloorplanGeometry | null;
    annotations: FloorplanGeometry | null;
};
export type FloorplanPageLayout = {
    planBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
export declare function exportFloorplanPdf(scope: FloorplanExportScope): Promise<void>;
export declare function collectFloorplanSchedules(nodes: Record<string, AnyNode>, levelId: AnyNodeId, unit: 'metric' | 'imperial', scope?: FloorplanExportScope, { drafting }?: {
    drafting?: boolean;
}): FloorplanSchedule[];
export declare function resolveFloorplanPageLayout(pageWidth: number, pageHeight: number): FloorplanPageLayout;
export type FloorplanExportBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function fitPlanToBox(planWidth: number, planHeight: number, boxX: number, boxY: number, boxWidth: number, boxHeight: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function resolveFloorplanExportPlacement(planWidth: number, planHeight: number, boxX: number, boxY: number, boxWidth: number, boxHeight: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function resolveFloorplanExportViewport(modelBounds: FloorplanExportBounds): FloorplanExportBounds;
export declare function rotateFloorplanExportBounds(bounds: FloorplanExportBounds, rotationDeg: number): FloorplanExportBounds;
export declare function resolveFloorplanScreenUnitsPerPixel(modelWidth: number, modelHeight: number, boxWidth: number, boxHeight: number): number;
export declare function resolveFloorplanExportAnnotationVisibility(mode: FloorplanMode, liveVisibility: FloorplanAnnotationVisibility): FloorplanAnnotationVisibility;
export declare function resolveFloorplanExportRotationDeg(buildingRotationY: number, navigationAzimuth?: number): number;
export declare function resolveFloorplanMeasurementSize(viewport: FloorplanExportBounds, screenUnitsPerPixel: number): {
    width: number;
    height: number;
};
export declare function collectFloorplanGeometry(nodes: Record<string, AnyNode>, levelId: AnyNodeId, scope: FloorplanExportScope, unit: 'metric' | 'imperial', metricNotation: FloorplanMetricNotation, annotationVisibility: FloorplanAnnotationVisibility, drawingType: ConstructionDrawingType, wallDimensionReference: FloorplanWallDimensionReference, installedPlugins: readonly string[]): ExportGeometry[];
export declare function filterFloorplanExportOverlay(geometry: FloorplanGeometry): FloorplanGeometry | null;
type FloorplanExportOverlayPartition = {
    model: FloorplanGeometry | null;
    annotations: FloorplanGeometry | null;
};
export declare function resolveFloorplanExportNodeGeometry(base: FloorplanGeometry | null, overlay: FloorplanGeometry | null, annotationOnly: boolean): FloorplanExportOverlayPartition;
export declare function partitionFloorplanExportOverlay(geometry: FloorplanGeometry): FloorplanExportOverlayPartition;
export declare function isFloorplanExportAnnotationGeometry(geometry: FloorplanGeometry): boolean;
/**
 * Levels to export, ordered bottom-to-top. The active building (the building
 * owning the selected level, or the first one found) contributes all of its
 * level children; if there is no building wrapper we fall back to the single
 * resolved level. Roof support levels are excluded: they are not occupied
 * stories, so they do not get a floor-plan page.
 */
export declare function resolveExportLevels(nodes: Record<string, AnyNode>): ExportLevel[];
export {};
//# sourceMappingURL=floorplan-export.d.ts.map
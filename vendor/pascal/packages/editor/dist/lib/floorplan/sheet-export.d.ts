/**
 * Sheets — geometry collection + multi-sheet vector PDF.
 *
 * Two jobs, both of them thin wrappers over machinery that already exists:
 *
 * 1. `collectSheetGeometry` re-runs the registry-driven floor-plan pipeline
 *    (`def.floorplan(node, ctx)`) headlessly for one level, exactly the way
 *    `floorplan-export.tsx` does for its own PDF, but with a per-viewport
 *    annotation-visibility record and category filter instead of the live
 *    editor's global one. It returns the same `FloorplanGeometry` trees the
 *    2D editor draws, so a sheet viewport and the 2D editor cannot drift.
 *
 * 2. `exportSheetsToPdf` writes a page per sheet at the sheet's own paper
 *    size through the existing pdfkit renderer
 *    (`floorplan-pdfkit-renderer.ts` / `floorplan-pdfkit-document.ts`). The
 *    title block is passed in as ordinary geometry in SHEET INCHES, so the
 *    PDF and the screen draw the same primitives. Each page is bookmarked by
 *    its sheet ("A2.0 Ground floor floor plan") — e-plan review portals
 *    require one bookmark per sheet.
 *
 * This module owns no layout opinions — the caller builds the pages and
 * calls in here.
 */
import type { AnyNode, AnyNodeId, ConstructionDrawingType, FloorplanGeometry } from '@pascal-app/core';
import { type FloorplanAnnotationVisibility } from './annotation-visibility';
import { collectFloorplanSchedules } from './floorplan-export';
import type { FloorplanMetricNotation } from './floorplan-extension';
/** PDF user-space units per inch. */
export declare const POINTS_PER_INCH = 72;
export type { FloorplanSchedule } from './floorplan-extension';
/**
 * The schedules the kinds on a level contribute
 * (`def.extensions['pascal:editor/floorplan'].schedule`). Re-exported here so
 * a sheet's schedule viewport prints the SAME marks the plan's mark bubbles
 * do — both come from `resolveOpeningMarks` in `@pascal-app/nodes`. A sheet
 * passes `{ drafting: true }` so its schedules number like its drafted tags.
 */
export { collectFloorplanSchedules };
export type SheetGeometryEntry = {
    id: AnyNodeId;
    type: string;
    model: FloorplanGeometry | null;
    annotations: FloorplanGeometry | null;
};
export type SheetGeometryOptions = {
    nodes: Record<string, AnyNode>;
    levelId: AnyNodeId;
    drawingType: ConstructionDrawingType;
    annotationVisibility: FloorplanAnnotationVisibility;
    /** Return false to leave a node out of this viewport (the layer switches). */
    accept?: (node: AnyNode, category: string | undefined) => boolean;
    unit?: 'metric' | 'imperial';
    metricNotation?: FloorplanMetricNotation;
};
/**
 * The geometry one plan viewport shows. Level-local metres, unrotated — the
 * caller applies `resolveSheetRotationDeg` when it places the drawing.
 */
export declare function collectSheetGeometry(options: SheetGeometryOptions): SheetGeometryEntry[];
/**
 * Plan rotation for a level: the floor-plan view rotation minus the
 * building's own yaw — the same expression `floorplan-export.tsx` uses, with
 * the live navigation azimuth deliberately left out. A sheet must not change
 * because someone orbited the 3D view.
 */
export declare function resolveSheetRotationDeg(nodes: Record<string, AnyNode>, levelId: AnyNodeId): number;
export type SheetPdfWindow = {
    /** Placement on the paper, in sheet inches from the top-left. */
    rect: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** World window shown inside `rect`, in ROTATED plan metres. */
    viewport: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    rotationDeg: number;
    model: FloorplanGeometry | null;
    annotations: FloorplanGeometry | null;
};
export type SheetPdfPage = {
    /** Sheet number and title — the page's bookmark. */
    number: string;
    title: string;
    widthIn: number;
    heightIn: number;
    /** Paper, border and title block — drawn UNDER the live windows. */
    plate: FloorplanGeometry[];
    windows: SheetPdfWindow[];
    /** Viewport labels, tables, notes, images — drawn OVER the live windows. */
    overlay: FloorplanGeometry[];
};
/** Every sheet, one PDF titled `documentTitle`, each page at its own paper size. */
export declare function exportSheetsToPdf(pages: readonly SheetPdfPage[], filename: string, documentTitle: string): Promise<void>;
//# sourceMappingURL=sheet-export.d.ts.map
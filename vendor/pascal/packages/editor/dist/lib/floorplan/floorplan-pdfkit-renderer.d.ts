import { type FloorplanGeometry, type FloorplanPoint } from '@pascal-app/core';
import type { FloorplanExportBounds } from './floorplan-export';
import type { FloorplanPdfDocument } from './floorplan-pdfkit-document';
export type FloorplanPdfKitPlacement = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export declare function renderFloorplanGeometryToPdfKit(doc: FloorplanPdfDocument, geometry: FloorplanGeometry, options: {
    annotationLabelShifts?: readonly FloorplanPoint[];
    annotationLayer: boolean;
    /** Paper size of dimension strings; a drafted sheet prints them larger. */
    dimensionTextSizePt?: number;
    placement: FloorplanPdfKitPlacement;
    rotationDeg: number;
    viewport: FloorplanExportBounds;
}): Promise<void>;
//# sourceMappingURL=floorplan-pdfkit-renderer.d.ts.map
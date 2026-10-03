import type * as THREE from 'three';
import type { PrintExportBounds, PrintExportOptions, PrintExportReport, PrintMeshData } from './print-export';
export type Print3mfPart = {
    name: string;
    mesh: PrintMeshData;
    bounds: PrintExportBounds;
};
export type Print3mfExport = {
    buffer: Uint8Array<ArrayBuffer>;
    report: PrintExportReport;
};
export declare function createPrint3mf(parts: Print3mfPart[], title?: string): Uint8Array<ArrayBuffer>;
export declare function exportSceneToPrint3mf(source: THREE.Object3D, options: PrintExportOptions): Print3mfExport;
//# sourceMappingURL=print-3mf.d.ts.map
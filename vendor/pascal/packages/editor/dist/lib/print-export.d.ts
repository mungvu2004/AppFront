import * as THREE from 'three';
export type PrintExportDiagnostic = {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    nodeIds?: string[];
};
export type PrintArtifactFormat = 'stl' | '3mf';
export type PrintExportOptions = {
    scale: number;
    compiled?: boolean;
    indexedTopology?: boolean;
    format?: PrintArtifactFormat;
    /** Original Y-up world elevation that becomes print Z=0. Omit to use geometry minimum. */
    sourceBedElevationMeters?: number;
};
export type PrintExportBounds = {
    min: {
        x: number;
        y: number;
        z: number;
    };
    max: {
        x: number;
        y: number;
        z: number;
    };
    width: number;
    depth: number;
    height: number;
};
export type PrintExportReport = {
    kind: 'print-export-report';
    version: 2;
    format: PrintArtifactFormat;
    scale: number;
    units: 'millimeter';
    orientation: 'z-up';
    status: 'pass' | 'warning' | 'blocked';
    bounds: PrintExportBounds | null;
    triangleCount: number;
    invalidTriangleCount: number;
    degenerateTriangleCount: number;
    boundaryEdgeCount: number | null;
    nonManifoldEdgeCount: number | null;
    connectedComponentCount: number | null;
    solidComponentCount: number | null;
    invertedWinding: boolean | null;
    volumeMm3: number;
    minimumFeatureThicknessMm?: number | null;
    diagnostics: PrintExportDiagnostic[];
};
export type PrintStlExport = {
    buffer: ArrayBuffer;
    report: PrintExportReport;
};
export type PrintMeshData = {
    positions: Float64Array<ArrayBuffer>;
    indices: Uint32Array<ArrayBuffer>;
};
export declare function prepareSceneForPrint(source: THREE.Object3D, options: PrintExportOptions): {
    scene: THREE.Object3D;
    report: PrintExportReport;
};
export declare function extractPreparedPrintMesh(root: THREE.Object3D): PrintMeshData;
export declare function encodePreparedPrintSceneToStl(scene: THREE.Object3D): ArrayBuffer;
export declare function exportSceneToPrintStl(source: THREE.Object3D, options: PrintExportOptions): PrintStlExport;
export declare function mergePrintExportDiagnostics(report: PrintExportReport, diagnostics: PrintExportDiagnostic[], omitCodes?: ReadonlySet<string>): PrintExportReport;
export declare function isPrintExportReport(value: unknown): value is PrintExportReport;
//# sourceMappingURL=print-export.d.ts.map
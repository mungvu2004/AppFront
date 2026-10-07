import { type AnyNode } from '@pascal-app/core';
import * as THREE from 'three';
import { type PrintArtifactFormat, type PrintExportDiagnostic, type PrintExportReport } from './print-export';
import type { PrintShellCompileResult } from './print-shell-compiler-baseline';
export type PrintBaseMode = 'none' | 'plinth';
export type PrintPlinthOptions = {
    marginMm: number;
    thicknessMm: number;
};
export type PrintLevelPartReport = {
    kind: 'level' | 'plinth';
    levelId: string;
    label: string;
    objectName: string;
    filename: string | null;
    sourceBaseMeters: number | null;
    report: PrintExportReport;
};
export type PrintLevelBundleReport = {
    kind: 'print-level-export-report';
    version: 2;
    format: PrintArtifactFormat;
    scale: number;
    units: 'millimeter';
    orientation: 'z-up';
    status: 'pass' | 'warning' | 'blocked';
    partCount: number;
    parts: PrintLevelPartReport[];
    excludedNodeIds: string[];
    diagnostics: PrintExportDiagnostic[];
};
export type PrintLevelPackage = {
    data: Uint8Array<ArrayBuffer>;
    report: PrintLevelBundleReport;
};
export type PrintLevelExportOptions = {
    scale: number;
    format?: PrintArtifactFormat;
    plinth?: PrintPlinthOptions;
    minimumFeatureMm?: number;
    compileShells?: boolean;
    compileShell?: (source: THREE.Object3D, nodes: Record<string, AnyNode>) => Promise<PrintShellCompileResult>;
};
export declare function exportSceneLevelsForPrint(source: THREE.Object3D, nodes: Record<string, AnyNode>, options: PrintLevelExportOptions): Promise<PrintLevelPackage>;
export declare function isPrintLevelBundleReport(value: unknown): value is PrintLevelBundleReport;
//# sourceMappingURL=level-print-export.d.ts.map
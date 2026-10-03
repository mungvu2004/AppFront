import { type AnyNode } from '@pascal-app/core';
import { type PrintExportDiagnostic, type PrintExportReport } from './print-export';
export type PrintFeatureThickness = {
    nodeId: string;
    thicknessMm: number;
};
export type PrintFeatureThicknessMeasurement = {
    features: PrintFeatureThickness[];
    unmeasuredNodeIds: string[];
};
export declare function measureSemanticPrintFeatureThickness(nodes: Record<string, AnyNode>, sourceNodeIds: Iterable<string>, scale: number): PrintFeatureThicknessMeasurement;
export declare function applyPrintFeatureThickness(report: PrintExportReport, measurement: PrintFeatureThicknessMeasurement, minimumFeatureMm?: number): PrintExportReport;
export declare function applySemanticPrintFeatureThickness(report: PrintExportReport, nodes: Record<string, AnyNode>, sourceNodeIds: Iterable<string>, minimumFeatureMm?: number): PrintExportReport;
export declare function isPrintFeatureThicknessDiagnostic(diagnostic: PrintExportDiagnostic): boolean;
//# sourceMappingURL=print-feature-thickness.d.ts.map
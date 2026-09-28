import { type PrintLevelBundleReport } from '../../../../../lib/level-print-export';
import type { ModelExport, ModelExportArtifact, ModelExportFormat } from '../../../../../lib/model-export';
import { type PrintExportReport } from '../../../../../lib/print-export';
type PreparedPrintExport = {
    artifact: ModelExportArtifact;
    report: PrintExportReport | PrintLevelBundleReport;
};
type PrintModelExportFormat = Extract<ModelExportFormat, 'print-3mf' | 'print-stl'>;
export declare function preparePrintExport(modelExport: ModelExport, onlyVisible: boolean, format: PrintModelExportFormat): Promise<PreparedPrintExport>;
export declare function PrintExportButton({ onlyVisible }: {
    onlyVisible: boolean;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=print-export-button.d.ts.map
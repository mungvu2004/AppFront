import type { CatalogCategory, StructureTool } from '../../../store/use-editor';
export type ToolConfig = {
    id: StructureTool;
    iconSrc: string;
    label: string;
    catalogCategory?: CatalogCategory;
};
export declare const tools: ToolConfig[];
//# sourceMappingURL=structure-tools.d.ts.map
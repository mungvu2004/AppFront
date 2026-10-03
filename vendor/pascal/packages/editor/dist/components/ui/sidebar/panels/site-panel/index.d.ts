export interface SitePanelProps {
    projectId?: string;
    onUploadAsset?: (projectId: string, levelId: string, file: File, type: 'scan' | 'guide') => void;
    onDeleteAsset?: (projectId: string, url: string) => void;
}
export declare function SitePanel({ projectId, onUploadAsset, onDeleteAsset }?: SitePanelProps): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map
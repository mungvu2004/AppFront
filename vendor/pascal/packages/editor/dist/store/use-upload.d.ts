export type UploadStatus = 'preparing' | 'uploading' | 'confirming' | 'done' | 'error';
export interface UploadEntry {
    status: UploadStatus;
    assetType: 'scan' | 'guide';
    fileName: string;
    progress: number;
    error: string | null;
    resultUrl: string | null;
}
export type UploadHandler = (projectId: string, levelId: string, file: File, type: 'scan' | 'guide') => void;
interface UploadState {
    uploads: Record<string, UploadEntry>;
    uploadHandler: UploadHandler | null;
    registerUploadHandler: (handler: UploadHandler) => void;
    unregisterUploadHandler: () => void;
    startUpload: (levelId: string, assetType: 'scan' | 'guide', fileName: string) => void;
    setProgress: (levelId: string, progress: number) => void;
    setStatus: (levelId: string, status: UploadStatus) => void;
    setError: (levelId: string, error: string) => void;
    setResult: (levelId: string, url: string) => void;
    clearUpload: (levelId: string) => void;
}
export declare const useUploadStore: import("zustand").UseBoundStore<import("zustand").StoreApi<UploadState>>;
export {};
//# sourceMappingURL=use-upload.d.ts.map
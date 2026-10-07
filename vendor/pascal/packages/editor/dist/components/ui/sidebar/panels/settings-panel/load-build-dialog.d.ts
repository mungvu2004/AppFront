import type { ValidateBuildJsonResult } from '@pascal-app/core';
export type PendingImport = {
    fileName: string;
    fileSizeBytes: number;
    result: ValidateBuildJsonResult;
};
type Props = {
    pending: PendingImport | null;
    onCancel: () => void;
    onConfirm: (parsed: NonNullable<ValidateBuildJsonResult['parsed']>) => void;
};
export declare function LoadBuildDialog({ pending, onCancel, onConfirm }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=load-build-dialog.d.ts.map
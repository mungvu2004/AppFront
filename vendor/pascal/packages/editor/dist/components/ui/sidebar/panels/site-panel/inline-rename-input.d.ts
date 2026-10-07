import { type AnyNodeId } from '@pascal-app/core';
interface InlineRenameInputProps {
    nodeId: AnyNodeId;
    isEditing: boolean;
    onStopEditing: () => void;
    defaultName: string;
    className?: string;
    onStartEditing?: () => void;
}
export declare const InlineRenameInput: import("react").MemoExoticComponent<({ nodeId, isEditing, onStopEditing, defaultName, className, onStartEditing, }: InlineRenameInputProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=inline-rename-input.d.ts.map
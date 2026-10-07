import type { AnyNode } from '@pascal-app/core';
interface MobileSelectionBarProps {
    node: AnyNode | null;
    label?: string;
    icon?: string;
    onMove: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onEdit: () => void;
}
export declare function MobileSelectionBar({ node, label, icon, onMove, onDuplicate, onDelete, onEdit, }: MobileSelectionBarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=mobile-selection-bar.d.ts.map
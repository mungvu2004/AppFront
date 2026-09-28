import { type AnyNode } from '@pascal-app/core';
import { type ReactNode } from 'react';
export declare function canDrag(node: AnyNode): boolean;
export declare function canDrop(draggedType: string, targetType: string): boolean;
type DragState = {
    nodeId: string;
    nodeType: string;
    sourceParentId: string;
    label: string;
    pointerX: number;
    pointerY: number;
} | null;
type DropTarget = {
    parentId: string;
    insertIndex: number;
} | null;
type TreeNodeDragContextValue = {
    drag: DragState;
    dropTarget: DropTarget;
    startDrag: (nodeId: string, nodeType: string, sourceParentId: string, label: string, x: number, y: number) => void;
    isDragging: boolean;
};
export declare const useTreeNodeDrag: () => TreeNodeDragContextValue;
export declare function TreeNodeDragProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function DropIndicatorLine(): import("react").JSX.Element;
export {};
//# sourceMappingURL=tree-node-drag.d.ts.map
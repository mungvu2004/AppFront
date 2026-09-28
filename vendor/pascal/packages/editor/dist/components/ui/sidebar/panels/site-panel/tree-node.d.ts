import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
export declare function handleTreeSelection(e: React.MouseEvent, nodeId: string, selectedIds: string[], setSelection: (s: any) => void): boolean;
export declare function focusTreeNode(nodeId: AnyNodeId): void;
export declare function routeTreeSelectionToNode(node: AnyNode | null | undefined): void;
interface TreeNodeProps {
    nodeId: AnyNodeId;
    depth?: number;
    isLast?: boolean;
}
type TreeNodeComponent = React.ComponentType<{
    depth: number;
    isLast?: boolean;
    nodeId: AnyNodeId;
}>;
export declare function getTreeNodeComponent(nodeType: string): TreeNodeComponent;
export declare const TreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast }: TreeNodeProps) => import("react").JSX.Element | null>;
interface TreeNodeWrapperProps {
    nodeId?: string;
    icon: React.ReactNode;
    /** Keep the icon's own color when unselected (color dots are the identity). */
    keepIconColor?: boolean;
    label: React.ReactNode;
    depth: number;
    hasChildren: boolean;
    expanded: boolean;
    onToggle: () => void;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onPointerDown?: (e: React.PointerEvent) => void;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    isSelected?: boolean;
    isHovered?: boolean;
    isVisible?: boolean;
    isLast?: boolean;
    isDraggable?: boolean;
    isDropTarget?: boolean;
}
export declare const TreeNodeWrapper: import("react").ForwardRefExoticComponent<TreeNodeWrapperProps & import("react").RefAttributes<HTMLDivElement>>;
export {};
//# sourceMappingURL=tree-node.d.ts.map
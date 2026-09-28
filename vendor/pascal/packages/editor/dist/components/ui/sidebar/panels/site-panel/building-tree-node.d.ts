import { type BuildingNode } from '@pascal-app/core';
interface BuildingTreeNodeProps {
    nodeId: BuildingNode['id'];
    depth: number;
    isLast?: boolean;
}
export declare const BuildingTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: BuildingTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=building-tree-node.d.ts.map
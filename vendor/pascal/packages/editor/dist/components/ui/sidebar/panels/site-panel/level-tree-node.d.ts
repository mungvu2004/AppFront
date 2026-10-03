import { type LevelNode } from '@pascal-app/core';
interface LevelTreeNodeProps {
    nodeId: LevelNode['id'];
    depth: number;
    isLast?: boolean;
}
export declare const LevelTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: LevelTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=level-tree-node.d.ts.map
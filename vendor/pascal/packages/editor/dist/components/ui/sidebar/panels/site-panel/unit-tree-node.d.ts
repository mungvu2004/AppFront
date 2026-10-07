import { type AnyNodeId, type ZoneNode } from '@pascal-app/core';
interface UnitZoneRowProps {
    zoneId: ZoneNode['id'];
    depth: number;
    isLast?: boolean;
    onRemove?: (zoneId: ZoneNode['id']) => void;
}
/** One member zone under a unit: name + level, click selects it. */
export declare const UnitZoneRow: import("react").MemoExoticComponent<({ zoneId, depth, isLast, onRemove, }: UnitZoneRowProps) => import("react").JSX.Element | null>;
interface UnitTreeNodeProps {
    nodeId: AnyNodeId;
    depth: number;
    isLast?: boolean;
}
export declare const UnitTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: UnitTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=unit-tree-node.d.ts.map
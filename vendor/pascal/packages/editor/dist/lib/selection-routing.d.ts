import { type AnyNode } from '@pascal-app/core';
export type SelectionModifierKeys = {
    meta: boolean;
    ctrl: boolean;
    shift: boolean;
    /** Alt alone: select one session-group member without expanding. */
    alt: boolean;
};
export type NodeSelectionTarget = {
    phase: 'site' | 'structure' | 'furnish';
    structureLayer?: 'zones' | 'elements';
};
export declare function emitCanvasNodeSelection(node: AnyNode): void;
export declare function resolveCanvasSelectionNode({ node, nodes, selectedIds, }: {
    node: AnyNode;
    nodes: Readonly<Record<string, AnyNode | undefined>>;
    selectedIds: readonly string[];
}): AnyNode;
export declare function isSelectionModifierActive(keys: SelectionModifierKeys): boolean;
export declare function selectionModifiersFromEvent(event?: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    nativeEvent?: {
        metaKey?: boolean;
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
    };
} | null, fallback?: Partial<SelectionModifierKeys>): SelectionModifierKeys;
export declare function resolveSelectedIdsForNodeClick({ baseSelectedIds, currentSelectedIds, modifierKeys, nodeId, expandIdsForNode, }: {
    baseSelectedIds?: readonly string[];
    currentSelectedIds: readonly string[];
    modifierKeys: SelectionModifierKeys;
    nodeId: string;
    /** Session-group expand on plain click (not on modifier/Alt). */
    expandIdsForNode?: (nodeId: string) => string[] | null;
}): string[];
export declare function shouldPreserveSelectedRoofHostTarget({ node, selectedIds, armedRoofId, }: {
    node: AnyNode;
    selectedIds: readonly string[];
    armedRoofId: string | null;
}): boolean;
export declare function resolveNodeSelectionTarget(node: AnyNode): NodeSelectionTarget | null;
//# sourceMappingURL=selection-routing.d.ts.map
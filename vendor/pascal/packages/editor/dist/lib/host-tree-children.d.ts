import type { AnyNode, AnyNodeId } from '@pascal-app/core';
import type { ComponentType } from 'react';
export type EditorHostTreeChildrenProps = {
    nodeId: AnyNodeId;
    depth: number;
    parentVisible: boolean;
};
export type EditorHostTreeChildren = {
    kind: string;
    component: ComponentType<EditorHostTreeChildrenProps>;
    hasChildren: (node: AnyNode) => boolean;
};
declare class EditorHostTreeChildrenRegistryImpl {
    private readonly entries;
    private readonly listeners;
    private revision;
    subscribe: (onChange: () => void) => (() => void);
    getSnapshot: () => number;
    childrenForKind: (kind: string) => EditorHostTreeChildren | undefined;
    reset(): void;
    register(entry: EditorHostTreeChildren): void;
    private emit;
}
export declare const editorHostTreeChildrenRegistry: EditorHostTreeChildrenRegistryImpl;
export declare function registerEditorHostTreeChildren(entry: EditorHostTreeChildren): void;
export {};
//# sourceMappingURL=host-tree-children.d.ts.map
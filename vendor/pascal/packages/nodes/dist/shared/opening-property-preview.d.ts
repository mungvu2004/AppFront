import type { AnyNode, AnyNodeId, DoorNode, WindowNode } from '@pascal-app/core';
export type OpeningPropertyPreviewDependencies = {
    nodes: () => Readonly<Record<AnyNodeId, AnyNode>>;
    override: (id: AnyNodeId) => Partial<AnyNode> | undefined;
    setOverride: (id: AnyNodeId, patch: Partial<AnyNode>) => void;
    clearOverrideFields: (id: AnyNodeId, fields: string[]) => void;
    markDirty: (id: AnyNodeId) => void;
    updateNode: (id: AnyNodeId, patch: Partial<AnyNode>) => void;
    scheduleFrame: (callback: FrameRequestCallback) => number;
    cancelFrame: (handle: number) => void;
    scheduleDelay: (callback: () => void, delay: number) => number;
    cancelDelay: (handle: number) => void;
};
export declare function createOpeningPropertyPreview<T extends DoorNode | WindowNode>(id: AnyNodeId, dependencies: OpeningPropertyPreviewDependencies): {
    preview(patch: Partial<T>): void;
    commit(patch?: Partial<T>): void;
    cancel: () => void;
};
//# sourceMappingURL=opening-property-preview.d.ts.map
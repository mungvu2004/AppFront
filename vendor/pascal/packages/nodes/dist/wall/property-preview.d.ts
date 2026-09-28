import { type AnyNodeId, type WallNode } from '@pascal-app/core';
export declare function createWallPropertyPreview(id: AnyNodeId): {
    preview(patch: Partial<WallNode>): void;
    commit(patch?: Partial<WallNode>): void;
    cancel: () => void;
};
//# sourceMappingURL=property-preview.d.ts.map
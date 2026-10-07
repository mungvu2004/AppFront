export type RetiredSceneNodeMigration<TNode> = {
    nodes: Record<string, TNode>;
    removedNodeIds: ReadonlySet<string>;
};
export declare function removeRetiredDrawingSheetNodes<TNode>(nodes: Record<string, TNode>): RetiredSceneNodeMigration<TNode>;
//# sourceMappingURL=retired-scene-nodes.d.ts.map
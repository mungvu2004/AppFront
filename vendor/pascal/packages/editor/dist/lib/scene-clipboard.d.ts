import { AnyNode, type AnyNodeId, SceneMaterial, type SceneMaterialId } from '@pascal-app/core';
type ClipboardPayload = {
    copiedAt: number;
    materials: SceneMaterial[];
    nodes: AnyNode[];
    rootIds: AnyNodeId[];
};
export type PasteResult = {
    createdMaterialIds: SceneMaterialId[];
    pastedIds: AnyNodeId[];
    skippedIds: AnyNodeId[];
};
export declare function subscribeEditorClipboard(subscriber: () => void): () => void;
export declare function getEditorClipboardSnapshot(): ClipboardPayload | null;
export declare function hasEditorClipboard(): boolean;
export declare function copySelectedNodesToEditorClipboard(selectedIds?: AnyNodeId[]): boolean;
export declare function readEditorClipboardFromSystem(): Promise<boolean>;
/**
 * Clone the given nodes (subtrees included, ids remapped) onto the target /
 * active level in place — the same copy + paste pipeline in one step, WITHOUT
 * touching the user's editor clipboard. Selects the clones. Used by the group
 * action menu's Duplicate.
 */
export declare function duplicateNodesToLevel(ids: AnyNodeId[], targetLevelId?: AnyNodeId): PasteResult | null;
export declare function pasteEditorClipboardToLevel(targetLevelId?: AnyNodeId): PasteResult | null;
export declare function pasteSystemEditorClipboardToLevel(targetLevelId?: AnyNodeId): Promise<PasteResult | null>;
export {};
//# sourceMappingURL=scene-clipboard.d.ts.map
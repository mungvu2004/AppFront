import type { BlockTopology } from '@pascal-app/core';
export type BlockComponentMode = 'vertex' | 'edge' | 'face';
export type BlockSelection = {
    mode: BlockComponentMode;
    ids: string[];
};
export type BlockSelectionState = BlockSelection & {
    activeId: string | null;
};
export declare function blockSelectionChanged(previous: BlockSelectionState, next: BlockSelectionState): boolean;
export declare function createBlockSelection(mode: BlockComponentMode, ids?: string[]): BlockSelectionState;
export declare function selectBlockComponent(selection: BlockSelectionState, id: string, additive: boolean): BlockSelectionState;
export declare function convertBlockSelection(topology: BlockTopology, selection: BlockSelectionState, nextMode: BlockComponentMode): BlockSelectionState;
export declare function selectAllBlockComponents(topology: BlockTopology, selection: BlockSelectionState): BlockSelectionState;
export declare function invertBlockSelection(topology: BlockTopology, selection: BlockSelectionState): BlockSelectionState;
export declare function clearBlockSelection(selection: BlockSelectionState): BlockSelectionState;
//# sourceMappingURL=selection-model.d.ts.map
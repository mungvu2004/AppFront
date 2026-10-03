import type { BlockTopology, MaterialRef } from '@pascal-app/core';
export declare const BLOCK_BODY_SLOT_ID = "body";
export type BlockMaterialSlots = Record<string, MaterialRef> | undefined;
export type BlockMaterialSlotNames = Record<string, string> | undefined;
export type BlockMaterialSelection = {
    kind: 'empty';
    activeSlotId: null;
} | {
    kind: 'single';
    activeSlotId: string;
    slotId: string;
} | {
    kind: 'mixed';
    activeSlotId: string | null;
};
export type BlockMaterialAssignment = {
    kind: 'slot';
    slotId: string;
};
export type BlockMaterialAssignmentResult = {
    topology: BlockTopology;
    slots: BlockMaterialSlots;
    slotId: string;
    changed: boolean;
};
export type BlockMaterialSlotRemovalResult = {
    topology: BlockTopology;
    slots: BlockMaterialSlots;
    slotNames: BlockMaterialSlotNames;
    fallbackSlotId: string;
    changed: boolean;
};
export type BlockMaterialSlotUpdateResult = {
    slots: BlockMaterialSlots;
    changed: boolean;
};
export type BlockMaterialSlotCreationResult = {
    slotId: string;
    slotNames: Record<string, string>;
};
export type BlockAssignedMaterialSlotCreationResult = (BlockMaterialSlotCreationResult & {
    topology: BlockTopology;
    slots: BlockMaterialSlots;
    changed: true;
}) | {
    topology: BlockTopology;
    slots: BlockMaterialSlots;
    slotId: null;
    slotNames: BlockMaterialSlotNames;
    changed: false;
};
export declare function blockMaterialSlotIds(topology: BlockTopology, slots: BlockMaterialSlots, slotNames?: BlockMaterialSlotNames): string[];
export declare function unpaintedBlockMaterialSlotIds(topology: BlockTopology, slots: BlockMaterialSlots, slotNames?: BlockMaterialSlotNames): string[];
export declare function createBlockMaterialSlot(topology: BlockTopology, slots: BlockMaterialSlots, slotNames: BlockMaterialSlotNames): BlockMaterialSlotCreationResult;
export declare function createAssignedBlockMaterialSlot(topology: BlockTopology, slots: BlockMaterialSlots, slotNames: BlockMaterialSlotNames, selectedFaceIds: readonly string[], materialRef: MaterialRef): BlockAssignedMaterialSlotCreationResult;
export declare function renameBlockMaterialSlot(topology: BlockTopology, slots: BlockMaterialSlots, slotNames: BlockMaterialSlotNames, slotId: string, name: string): BlockMaterialSlotNames;
export declare function setBlockMaterialSlot(slots: BlockMaterialSlots, slotId: string, materialRef: MaterialRef | undefined): BlockMaterialSlotUpdateResult;
export declare function blockMaterialSelection(topology: BlockTopology, selectedFaceIds: readonly string[], activeFaceId: string | null): BlockMaterialSelection;
export declare function removeBlockMaterialSlot(topology: BlockTopology, slots: BlockMaterialSlots, slotId: string, slotNames?: BlockMaterialSlotNames): BlockMaterialSlotRemovalResult;
export declare function assignBlockMaterial(topology: BlockTopology, slots: BlockMaterialSlots, selectedFaceIds: readonly string[], assignment: BlockMaterialAssignment, slotNames?: BlockMaterialSlotNames): BlockMaterialAssignmentResult;
//# sourceMappingURL=material-slots.d.ts.map
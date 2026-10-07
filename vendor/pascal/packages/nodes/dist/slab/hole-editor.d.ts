import { type SlabNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — slab hole editor (registry-driven).
 *
 * Edits a specific hole polygon inside a slab. Mounted by ToolManager
 * via `def.affordanceTools['hole-edit']` when `useEditor.editingHole`
 * is set on the selected slab.
 */
export declare const SlabHoleEditor: React.FC<{
    slabId: SlabNode['id'];
    holeIndex: number;
}>;
export default SlabHoleEditor;
//# sourceMappingURL=hole-editor.d.ts.map
import { type AnyNode, type ItemNode } from '@pascal-app/core';
import { type PlacementState } from '@pascal-app/editor';
/**
 * Phase 5 Stage D — item's registry-driven 3D move affordance.
 *
 * Replaces the legacy `MoveItemContent` in `editor/src/components/tools/
 * item/move-tool.tsx`. Behaviour is identical: it adopts the moving node
 * (or creates a draft for duplicates flagged `isNew`), runs the placement
 * coordinator with surface strategies for floor / wall / ceiling / item-
 * surface, and commits via `useScene.updateNode` on click.
 *
 * Registered via `def.affordanceTools.move`. The editor's
 * `MoveTool` dispatcher picks this up through `getRegistryAffordance
 * Tool('item', 'move')` before its legacy chain reaches `<MoveItemContent>`
 * — so the legacy fallback can now go away.
 *
 * Closes the 2D ↔ 3D coexistence bugs from last session: when both
 * paths mounted, the legacy mover's `destroy()` would clobber the 2D
 * commit; with this tool owning the move, only one path is alive at a
 * time.
 *
 * Placement primitives (`useDraftNode`, `usePlacementCoordinator`,
 * `PlacementState`) are re-exported from `@pascal-app/editor` — same
 * hooks the legacy code used. When `ItemTool` (item placement, not
 * move) also ports to `def.tool`, the primitives can be inlined here
 * and dropped from editor.
 */
export declare function getInitialState(node: ItemNode, parent?: AnyNode | undefined): PlacementState;
export declare function MoveItemTool({ node: source }: {
    node: ItemNode;
}): import("react").JSX.Element;
export default MoveItemTool;
//# sourceMappingURL=move-tool.d.ts.map
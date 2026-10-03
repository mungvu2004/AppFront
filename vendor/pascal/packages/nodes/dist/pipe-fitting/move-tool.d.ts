import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for DWV pipe fittings (elbow / wye /
 * sanitary tee) — the plumbing sibling of the duct-fitting move tool.
 *
 * **Duplicate** (`metadata.isNew`): pure drag-to-place — NOTHING is
 * inserted into the scene until the commit click. A translucent copy of the
 * fitting (built from its real geometry, at its own `rotation`, so an elbow
 * / riser stays properly aligned) rides the cursor inside a footprint
 * bounding box — the same affordance other items get — and Figma-style
 * alignment guides snap the box edges to nearby geometry. The commit click
 * calls `createNode`; Esc discards.
 *
 * **Move** (existing fitting): the real node is hidden while the ghost + box
 * track the cursor; commit writes the new `position` and reveals it.
 *
 * Modifiers (mirroring the duct-fitting move):
 * - **Alt** detaches: the connected-pipe follow drops so the fitting moves
 *   on its own, leaving every mated run where it sits.
 * - **Ctrl / Cmd** switches to vertical movement (stack / riser editing): XZ
 *   holds and the cursor's screen-Y drives the riser height.
 * - **Shift** bypasses grid snapping / alignment.
 *
 * Wired via `def.affordanceTools.move`.
 */
export declare const MovePipeFittingTool: React.FC<{
    node: AnyNode;
}>;
export default MovePipeFittingTool;
//# sourceMappingURL=move-tool.d.ts.map
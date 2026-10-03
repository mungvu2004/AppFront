import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for duct fittings (elbow / tee /
 * reducer / transition).
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
 * Wired via `def.affordanceTools.move`.
 */
export declare const MoveDuctFittingTool: React.FC<{
    node: AnyNode;
}>;
export default MoveDuctFittingTool;
//# sourceMappingURL=move-tool.d.ts.map
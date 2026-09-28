import { WindowNode } from '@pascal-app/core';
/**
 * Move/duplicate tool for WindowNodes — wall-only, same guardrails as WindowTool.
 *
 * Move mode (metadata.isNew falsy):
 *   Adopts the existing window and holds a refcounted history pause for the
 *   gesture. On commit: restores original state (clean undo baseline) then runs
 *   updateNode as the gesture's single tracked write (undo reverts to the
 *   original position). On cancel: restores original state, never tracked.
 *
 * Duplicate mode (metadata.isNew = true):
 *   The node is a freshly created transient copy. On commit: deletes the
 *   transient paused + createNode as the single tracked write (undo removes the
 *   new window entirely). On cancel: deletes the node.
 */
declare const MoveWindowTool: React.FC<{
    node: WindowNode;
}>;
export default MoveWindowTool;
//# sourceMappingURL=move-tool.d.ts.map
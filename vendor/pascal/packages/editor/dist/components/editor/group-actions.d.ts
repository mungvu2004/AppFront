import { type AnyNodeId } from '@pascal-app/core';
/** True when the current selection is a group the pick-up move can carry. */
export declare function canGroupPickUp(): boolean;
/**
 * Pick up the current multi-selection: it follows the cursor (delta-relative)
 * until a click commits, mirroring the single-node `movingNode` flow. Returns
 * false when the selection holds no transformable participants.
 *
 * `scopeToSelection` drops the welded-neighbor endpoints, so connected walls
 * don't stretch along with the move. The
 * Duplicate flow needs this: its clones sit EXACTLY on the originals, so
 * junction coincidence would otherwise weld the originals into the pick-up
 * and drag them along with the copies.
 */
export declare function startGroupPickUp(opts?: {
    onCancel?: () => void;
    positionAtCursor?: boolean;
    scopeToSelection?: boolean;
}): boolean;
/**
 * Duplicate the whole selection (subtrees + id remap via the clipboard
 * pipeline, without touching the clipboard), select the clones, and pick
 * them up so the next click places them. Cancelling the pick-up removes the
 * clones again.
 */
export declare function duplicateSelectionAndPickUp(): boolean;
/**
 * Paste the Pascal scene payload from the browser clipboard onto the active
 * level, then carry the clones under the cursor until click-to-place. Escape
 * removes the uncommitted clones and any scene materials imported with them.
 */
export declare function pasteSelectionAndPickUp(targetLevelId?: AnyNodeId): Promise<boolean>;
/**
 * Cut uses the same cross-tab clipboard payload as Copy, then removes exactly
 * the copied roots. Promoted subtree selections (such as all modules in one
 * cabinet run) therefore remove the same root that Paste will recreate.
 */
export declare function cutSelectionToEditorClipboard(): boolean;
/**
 * Delete every selected node — same semantics as the keyboard Delete arm,
 * including the accidental-bulk-delete confirm.
 */
export declare function deleteSelection(): boolean;
//# sourceMappingURL=group-actions.d.ts.map
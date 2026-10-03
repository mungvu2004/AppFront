/**
 * Pure helpers for editor-only session selection groups.
 * Not scene-graph nodes; not saved with the project.
 * Ctrl/Cmd+G creates, Ctrl/Cmd+Shift+G dissolves; plain click expands.
 *
 * Stored membership is never rewritten to drop deleted nodes — `liveIds`
 * filtering happens on every read instead. A destructive prune would make
 * delete-then-undo lose the restored node's group, and would drop the group
 * outright once it fell under the two-member floor.
 */
export type SessionSelectionGroup = {
    id: string;
    memberIds: readonly string[];
    label: string;
};
export type SessionGroupIdFactory = () => string;
export declare function nextSessionGroupId(): string;
export declare function nextSessionGroupLabel(): string;
export declare function resetSessionGroupIdSerial(value?: number): void;
/**
 * Read-time view: groups narrowed to their live members, dropping any that fall
 * under two. A group below the floor is inert, not gone — deleting members never
 * touches storage, so undo brings it back.
 */
export declare function liveSessionGroups(groups: readonly SessionSelectionGroup[], liveIds?: ReadonlySet<string> | null): SessionSelectionGroup[];
export declare function createSessionGroup(groups: readonly SessionSelectionGroup[], memberIds: readonly string[], options?: {
    liveIds?: ReadonlySet<string> | null;
    idFactory?: SessionGroupIdFactory;
    labelFactory?: () => string;
}): {
    groups: SessionSelectionGroup[];
    created: SessionSelectionGroup | null;
    alreadyGrouped: boolean;
};
export declare function ungroupSessionSelection(groups: readonly SessionSelectionGroup[], selectedIds: readonly string[], liveIds?: ReadonlySet<string> | null): {
    groups: SessionSelectionGroup[];
    dissolved: SessionSelectionGroup[];
};
export declare function expandSessionGroupMembers(groups: readonly SessionSelectionGroup[], nodeId: string, liveIds?: ReadonlySet<string> | null): string[] | null;
export declare function selectionMatchesSessionGroup(groups: readonly SessionSelectionGroup[], selectedIds: readonly string[], liveIds?: ReadonlySet<string> | null): SessionSelectionGroup | null;
export declare function selectionIntersectsSessionGroup(groups: readonly SessionSelectionGroup[], selectedIds: readonly string[], liveIds?: ReadonlySet<string> | null): boolean;
export declare function canCreateSessionGroup(groups: readonly SessionSelectionGroup[], selectedIds: readonly string[], liveIds?: ReadonlySet<string> | null): boolean;
//# sourceMappingURL=session-groups.d.ts.map
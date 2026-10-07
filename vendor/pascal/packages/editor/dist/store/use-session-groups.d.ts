import { type SessionSelectionGroup } from '../lib/session-groups';
type SessionGroupsState = {
    groups: SessionSelectionGroup[];
    setGroups: (groups: SessionSelectionGroup[]) => void;
    clearGroups: () => void;
};
declare const useSessionGroups: import("zustand").UseBoundStore<import("zustand").StoreApi<SessionGroupsState>>;
/**
 * Membership is never rewritten when a member is deleted — every read filters
 * against the live scene instead. Deleting a member and undoing must restore it
 * to its group, and a destructive prune would have already dropped it (or the
 * whole group, once it fell under the two-member floor).
 */
export declare function expandSessionSelectionForNode(nodeId: string): string[] | null;
/** Ctrl/Cmd+G — create session group from multi-selection. */
export declare function groupCurrentSelection(): boolean;
/** Ctrl/Cmd+Shift+G — dissolve session groups intersecting selection. */
export declare function ungroupCurrentSelection(): boolean;
export declare function currentSelectionMatchesSessionGroup(): SessionSelectionGroup | null;
export declare function currentSelectionIntersectsSessionGroup(): boolean;
export declare function currentSelectionCanCreateSessionGroup(): boolean;
export default useSessionGroups;
//# sourceMappingURL=use-session-groups.d.ts.map
export type LiveNodeOverrides = Record<string, unknown>;
type LiveNodeOverrideState = {
    overrides: Map<string, LiveNodeOverrides>;
    set(nodeId: string, values: LiveNodeOverrides): void;
    setMany(entries: ReadonlyArray<readonly [string, LiveNodeOverrides]>): void;
    get(nodeId: string): LiveNodeOverrides | undefined;
    clear(nodeId: string): void;
    clearFields(nodeId: string, keys: readonly string[]): void;
    clearAll(): void;
};
declare const useLiveNodeOverrides: import("zustand").UseBoundStore<import("zustand").StoreApi<LiveNodeOverrideState>>;
/**
 * Merge any live override for `node` into a fresh copy. Spread semantics —
 * override fields win, untouched fields stay. Returns the input unchanged
 * when no override exists, so the caller can use the result directly
 * without an extra "did anything change" check.
 */
export declare function getEffectiveNode<T extends {
    id: string;
}>(node: T): T;
export default useLiveNodeOverrides;
//# sourceMappingURL=use-live-node-overrides.d.ts.map
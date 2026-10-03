/**
 * Feeds the action-cost ledger (lib/perf-actions.ts) the per-frame settle
 * state: how much of the scene is still dirty and how many wall neighbour
 * rebuilds the wall system still owes. Without `?perf` the inner component
 * never mounts, so no useFrame subscriber is registered at all.
 */
export declare const PerfActionSettleSystem: () => import("react").JSX.Element | null;
//# sourceMappingURL=perf-action-settle-system.d.ts.map
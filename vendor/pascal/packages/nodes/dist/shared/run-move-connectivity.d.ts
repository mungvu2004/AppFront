import { type AnyNode, type AnyNodeId, type PortConnectivity } from '@pascal-app/core';
type Vec3 = [number, number, number];
/** Live transform of the moved node for a given drag frame — whichever of
 *  `path` (runs) or `position` (fittings) the node moves by. */
type MovedTransform = {
    path?: Vec3[];
    position?: Vec3;
};
/**
 * Connectivity follow for whole-node ghost move tools (duct / pipe /
 * lineset `MoveTool`, and the duct-fitting `MoveTool`). When you grab a
 * committed run or fitting by its floating move button and slide it, the
 * shared port-connectivity service walks the joint graph and produces the
 * patches that keep neighbours welded:
 *
 * - Moving a **run**: both endpoints translate by the same delta, so any
 *   fitting mated to either end follows rigidly and the OTHER runs on those
 *   fittings stretch / translate per the axis-decomposition rules.
 * - Moving a **fitting**: its collars push the connected runs — the part of
 *   the move along a run's axis stretches it, the part across translates the
 *   whole run (preserving its direction), and that perpendicular part carries
 *   on to whatever is mated to the run's far end.
 *
 * The moved node's own transform drives the snapshot. Followers preview
 * through `useLiveNodeOverrides` (transient — no history churn;
 * `getEffectiveNode` merges overrides so the connected geometry rebuilds at
 * pointer rate), then fold into the commit's single tracked `updateNodes`
 * batch.
 *
 * Returns `null` when nothing is connected, so callers skip all the work.
 */
export declare function startRunMoveConnectivity(node: AnyNode): RunMoveConnectivity | null;
export declare class RunMoveConnectivity {
    private readonly node;
    private readonly connectivity;
    private overriddenIds;
    constructor(node: AnyNode, connectivity: PortConnectivity);
    /** Patches that keep the connected nodes attached for a given live transform. */
    private updatesFor;
    /** Live-preview the followers for the moved node's current drag transform. */
    preview(transform: MovedTransform): void;
    /** Follower patches to fold into the commit `updateNodes` batch. */
    commitUpdates(transform: MovedTransform): {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }[];
    /** Drop all live overrides (commit clears them once the scene write lands;
     *  cancel / unmount clears them to reveal the unchanged followers). */
    clear(): void;
}
export {};
//# sourceMappingURL=run-move-connectivity.d.ts.map
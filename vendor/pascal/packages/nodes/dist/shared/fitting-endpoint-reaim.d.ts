import type { AnyNode, AnyNodeId, DuctFittingNode, PipeFittingNode } from '@pascal-app/core';
/**
 * Shared "drag a run end, the connected fitting re-aims" logic for the
 * selection-time endpoint drag — duct (`duct-segment`) and DWV pipe
 * (`pipe-segment`) alike, plus their 2D `move-path-point` twins.
 *
 * Two re-aim shapes share this path:
 *
 *  - **Elbow** (duct + pipe): when you grab the free end of a straight run
 *    whose OTHER end sits on an elbow collar, the elbow's junction and far
 *    (mated) collar stay put while the near collar swings to face the
 *    dragged end — the bend `angle` adjusts to fit. Mirrors a wall corner.
 *
 *  - **Tee branch** (duct only): when you grab the free end of a run mated
 *    to a tee's BRANCH collar, the tee's run legs stay locked to the trunk
 *    and only its `branchAngle` swings, so the branch keeps pointing at the
 *    dragged end.
 *
 * Detection runs ONCE at drag start (`detectFittingEndpoint`) against a
 * snapshot of the fitting; the per-frame plan (`planFittingEndpointReaim`)
 * always re-derives from that original snapshot, so live mutation of the
 * fitting never compounds.
 */
type Point = [number, number, number];
/** Which run kind we're editing decides which fitting kind to look for. */
type ReaimFitting = DuctFittingNode | PipeFittingNode;
export type FittingEndpoint = {
    /** The fitting node as it stood at drag start (the stable reference). */
    fitting: ReaimFitting;
    /** Whether the re-aim re-orients the whole elbow body or just swings a
     *  duct tee's branch lean. */
    reaim: 'elbow' | 'tee-branch';
    /** Which fitting collar the run's non-dragged end is mated to. */
    portId: 'inlet' | 'outlet' | 'branch';
    /** The fitting kind, so the per-frame plan calls the right realign. */
    fittingType: 'duct-fitting' | 'pipe-fitting';
    /** Patch that restores the fitting to its drag-start state, for the
     *  single-undo dance's pre-resume revert. */
    revert: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    };
};
export type FittingEndpointReaimPlan = {
    /** New path for the dragged run: the dragged end at the cursor, the
     *  fitting end pulled onto the re-aimed collar. */
    path: Point[];
    /** Patch re-aiming the fitting (elbow: angle + rotation; tee: branchAngle). */
    fittingUpdate: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    };
};
/**
 * If `runPath` is a straight two-point run whose NON-dragged end sits on a
 * fitting collar that can re-aim, return that fitting snapshot + the mated
 * port id and re-aim shape. `runKind` selects which fitting kind to scan
 * for. Elbow inlet/outlet collars re-aim the whole elbow; a duct tee's
 * branch collar swings only the branch. Otherwise null — the caller falls
 * back to plain free-drag.
 */
export declare function detectFittingEndpoint(runKind: string, runPath: ReadonlyArray<readonly [number, number, number]>, draggedIndex: number, nodes: Record<string, AnyNode>): FittingEndpoint | null;
/**
 * Plan the run path + fitting re-aim for the dragged end at `draggedPoint`.
 * The fitting swings its mated collar to face the junction→cursor direction;
 * the run goes from that collar to the cursor. Returns null when the
 * required turn falls outside the fitting's buildable range (caller keeps
 * the plain free-drag for that frame).
 */
export declare function planFittingEndpointReaim(endpoint: FittingEndpoint, draggedIndex: number, draggedPoint: Point): FittingEndpointReaimPlan | null;
export {};
//# sourceMappingURL=fitting-endpoint-reaim.d.ts.map
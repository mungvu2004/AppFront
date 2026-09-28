import { type AnyNode, type DuctFittingNode, DuctSegmentNode } from '@pascal-app/core';
import { type RunSurfaceTarget } from '../shared/distribution-run-contract';
import { type RunBodyHit, type ScenePort } from '../shared/ports';
/** Cross-section shared by the drawn run and its fitting preview. */
type DraftProfile = {
    shape: 'round' | 'rect' | 'oval';
    diameter: number;
    width: number;
    height: number;
};
export declare function ductSurfaceClearanceM(profile: DraftProfile, wall?: boolean): number;
/** The full set of nodes a drawn segment produces. The drawn `ducts`
 *  (and any trunk `tails` from a tee / cross split) are previewed by the
 *  duct ghost already; `fittings` are the auto-inserted elbow / tee /
 *  cross nodes the ghost preview draws so the user sees them before the
 *  commit. Shared by `commitSegment` and the live preview so what you see
 *  is exactly what lands. */
type DuctDrawPlan = {
    validationMessage: string | null;
    fittings: DuctFittingNode[];
    ducts: DuctSegmentNode[];
    tails: DuctSegmentNode[];
    updates: {
        id: AnyNode['id'];
        data: Partial<AnyNode>;
    }[];
    delete: AnyNode['id'][];
};
/**
 * Pure planner for a drawn duct segment: given its endpoints and what
 * each end snapped onto (an open port, or a run body for a tee / cross
 * tap), decide every node the commit creates / updates — auto-inserted
 * elbows / tees / crosses, the drawn run (split in two when it crosses a
 * trunk), trunk tails, and trim / realign updates. Reads the live scene
 * graph snapshot but mutates nothing, so the live preview can call it each
 * frame to ghost the fittings before the commit applies the identical plan.
 */
export declare function planDuctDraw(start: [number, number, number], end: [number, number, number], startPort: ScenePort | null, startBody: RunBodyHit | null, endPort: ScenePort | null, endBody: RunBodyHit | null, profile: DraftProfile, nodes: Readonly<Record<string, AnyNode>>, surface?: RunSurfaceTarget | null, autoHangers?: boolean, toolDefaults?: Partial<DuctSegmentNode>, hangerStyle?: 'single' | 'double'): DuctDrawPlan | null;
declare const DuctSegmentTool: () => import("react").JSX.Element | null;
export default DuctSegmentTool;
//# sourceMappingURL=tool.d.ts.map
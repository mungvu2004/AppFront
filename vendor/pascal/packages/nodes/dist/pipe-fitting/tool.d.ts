import { type AnyNode, type AnyNodeId, PipeFittingNode } from '@pascal-app/core';
import { Quaternion } from 'three';
import { type ScenePort } from '../shared/ports';
import { type PipeInlineInsertionPlan } from './inline-insertion';
type Placement = {
    position: [number, number, number];
    rotation: [number, number, number];
    snapPort: ScenePort | null;
    insertion: PipeInlineInsertionPlan | null;
    node: PipeFittingNode;
    valid: boolean;
};
type PlacementContext = {
    levelId: AnyNodeId | null;
    nodes: Readonly<Record<AnyNodeId, AnyNode>>;
};
/**
 * Resolve where the fitting would land for a cursor at `raw`:
 *   - Near an existing DWV port → mate: orientation aligns the inlet
 *     onto the port (plus the user's manual R/T rotation, pivoting
 *     around the inlet collar so it stays on the port while the body
 *     sweeps).
 *   - Otherwise → grid-snapped free placement on the floor, manual
 *     rotation only.
 */
export declare function resolvePlacement(raw: [number, number, number], previewNode: PipeFittingNode, gridStep: number, manualQuat: Quaternion, surfaceHit: boolean, surfaceNormal?: [number, number, number], support?: (node: import("@pascal-app/core").DuctFittingNode | PipeFittingNode, rotation: [number, number, number], position: [number, number, number], surfacePoint: [number, number, number], surfaceNormal?: [number, number, number]) => [number, number, number], context?: PlacementContext): Placement;
/**
 * Click-place tool for DWV pipe fittings (elbow / wye / sanitary tee) —
 * the plumbing sibling of the duct-fitting tool.
 *
 * A translucent ghost of the fitting follows the cursor. Within snap
 * range of any DWV port (pipe run ends, other fittings' collars) the
 * ghost jumps onto the port — position AND orientation — so one click
 * mates the fitting onto the run.
 *
 * Rotation while placing: **R / T** turn the ghost ±45° around the
 * active world axis; **Alt** cycles the axis (Y → X → Z). The HUD badge
 * above the ghost shows the current axis. When snapped to a port the
 * rotation pivots around the inlet collar so the joint stays mated.
 * Handlers run in the capture phase so R doesn't also spin whatever
 * node happens to be selected.
 */
declare const PipeFittingTool: () => import("react").JSX.Element | null;
export default PipeFittingTool;
//# sourceMappingURL=tool.d.ts.map
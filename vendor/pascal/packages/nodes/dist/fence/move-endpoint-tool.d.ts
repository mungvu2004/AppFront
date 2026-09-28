import { type FenceNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — thin React wrapper around `moveFenceEndpointDragAction`.
 *
 * Replaces the legacy `MoveFenceEndpointTool` (425 LoC). All the math
 * (snap, linked cascade, length gate, single-undo dance) lives in the
 * pure action; this wrapper owns the React-only surface:
 *
 *  - Live cursor sphere tracking the moving endpoint (subscribed from
 *    `useScene` so it follows the draft as `apply()` writes).
 *  - Alt-key detach badge — pure UX, reads window keystate so the badge
 *    updates without requiring a pointer move.
 *  - Angle label between this segment and any neighbour segment sharing
 *    the dragged endpoint — same legacy treatment.
 *
 *  Mounted by ToolManager via the `move-endpoint` affordance key. ToolManager
 *  reconstructs this `target` from the reshaped node + the scope's endpoint.
 */
export type MovingFenceEndpoint = {
    fence: FenceNode;
    endpoint: 'start' | 'end';
};
export declare const MoveFenceEndpointTool: React.FC<{
    target: MovingFenceEndpoint;
}>;
export default MoveFenceEndpointTool;
//# sourceMappingURL=move-endpoint-tool.d.ts.map
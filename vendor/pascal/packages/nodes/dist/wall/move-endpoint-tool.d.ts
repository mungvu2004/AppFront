import { type WallNode } from '@pascal-app/core';
/**
 * Wall endpoint move tool (kind-owned).
 *
 * Press-drag-release: the endpoint handle's pointerdown activates this
 * tool; cursor movement updates the preview (snap → linked-wall cascade
 * → Alt-detach); pointerup commits if the endpoint actually moved, else
 * dismisses without committing.
 *
 * Mounted via `def.affordanceTools['move-endpoint']` from
 * `wall/definition.ts`. Triggered by an `endpoint` reshape scope; ToolManager
 * reconstructs this `target` from the reshaped node + the scope's endpoint.
 */
export type MovingWallEndpoint = {
    wall: WallNode;
    endpoint: 'start' | 'end';
};
export declare const MoveWallEndpointTool: React.FC<{
    target: MovingWallEndpoint;
}>;
export default MoveWallEndpointTool;
//# sourceMappingURL=move-endpoint-tool.d.ts.map
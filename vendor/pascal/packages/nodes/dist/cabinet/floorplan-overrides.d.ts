import type { AnyNode, AnyNodeId, LiveTransformLike } from '@pascal-app/core';
/**
 * Cabinet floor-plan symbols resolve their full cabinet ancestry through
 * `ctx.parent` / `ctx.resolve` (run -> module -> child run ...). During live
 * drags only the directly moved cabinet nodes publish overrides, so we need to
 * project those cabinet/cabinet-module patches into the context snapshot that
 * the floor-plan builders read. That keeps every related cabinet symbol in
 * lockstep while the drag is still in flight.
 */
export declare function cabinetFloorplanSiblingOverrides(args: {
    nodeId: AnyNodeId;
    nodes: Record<AnyNodeId, AnyNode>;
    liveTransforms: Map<string, LiveTransformLike>;
    liveOverrides: Map<string, Record<string, unknown>>;
}): Record<AnyNodeId, AnyNode>;
//# sourceMappingURL=floorplan-overrides.d.ts.map
import type { AnyNode, AnyNodeId, LiveTransform } from '@pascal-app/core';
/**
 * Project per-frame wall and opening drag overrides into a fresh `nodes`
 * snapshot. Wall overrides keep shared miters current; door and window
 * overrides keep associative construction dimensions current while an
 * opening moves or changes host. The 2D drag
 * handlers publish overrides for the moved wall plus its linked
 * neighbours; the floor-plan layer hands the merged snapshot to
 * `buildContext` so each wall's `ctx.siblings` (which feeds the
 * miter calculation) reflects the live cursor positions instead of
 * the last committed scene state.
 *
 * Other node types are shared by reference. The allocation cost is one
 * shallow object per relevant override — the override map is small, so
 * this is cheap. When the
 * override map is empty (no live drag) the input is returned
 * unchanged.
 */
export declare function wallFloorplanSiblingOverrides(args: {
    nodeId: AnyNodeId;
    nodes: Record<AnyNodeId, AnyNode>;
    liveTransforms?: Map<string, LiveTransform>;
    liveOverrides: Map<string, Record<string, unknown>>;
}): Record<AnyNodeId, AnyNode>;
//# sourceMappingURL=floorplan-overrides.d.ts.map
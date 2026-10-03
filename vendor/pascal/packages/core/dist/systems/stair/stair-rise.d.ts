import type { AnyNode, AnyNodeId, StairNode } from '../../schema/index.js';
export declare function resolveStairTotalRise(stair: StairNode, nodes: Record<string, AnyNode>): number;
/**
 * Keeps straight stairs' flight segments in step with the resolved rise.
 * Straight-stair geometry derives from per-segment heights (not from
 * `resolveStairTotalRise`), so level-height and deck-elevation changes must
 * write through to the flight segments — curved/spiral stairs read the
 * resolved rise directly and need no sync.
 *
 * Scope: stairs whose total the system owns — follows-mode stairs (absent
 * `totalRise`, tracking their level or their deck) and deck-attached stairs
 * (an explicit rise converges to the typed value). A detached stair with an
 * explicit `totalRise` is the one place hand-edited segment chains are
 * legitimate, so it is never touched. Flight heights scale proportionally
 * (landings keep theirs); returns `updateNodes` patches, empty when every
 * stair is already in step.
 */
export declare function syncStairRises(nodes: Record<string, AnyNode>): Array<{
    id: AnyNodeId;
    data: Partial<AnyNode>;
}>;
//# sourceMappingURL=stair-rise.d.ts.map
import type { AnyNode, AnyNodeId } from '@pascal-app/core';
/**
 * The other surface of the same room: a slab's ceiling, a ceiling's slab —
 * on the same level with the same outline. The plan draws them on top of each
 * other (only the slab takes a click), so deselecting one deselects both.
 * Both kinds declare it as their plan `selectionCounterparts`.
 */
export declare function sameOutlineSurfaceCounterparts({ node, nodes, }: {
    node: AnyNode;
    nodes: Readonly<Record<string, AnyNode | undefined>>;
}): AnyNodeId[];
//# sourceMappingURL=surface-counterparts.d.ts.map
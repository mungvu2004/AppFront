import { type AnyNode, type AnyNodeId, type MaterialSchema, type Space } from '@pascal-app/core';
/**
 * Painter application scope — how far one paint click spreads. The scope set is
 * DERIVED from the hovered node, not a per-kind table: any slot-model node with
 * more than one slot offers `object` (whole node); a node with an `asset` offers
 * `matching` (every instance of that asset); a kind that declares
 * `capabilities.paint.roomScope` offers `room`. One global mode (not per-tool),
 * defaulting to the narrowest `'single'`; the active interaction's HUD shows +
 * cycles it within the hovered node's set.
 */
export type PaintScope = 'single' | 'object' | 'matching' | 'room';
/** What the paint HUD needs to render + cycle the scope chip for a hover. */
export type PaintHoverInfo = {
    /** The scopes available for the hovered node, in cycle order (always ≥ 1). */
    scopes: PaintScope[];
    /** Display name of the hovered slot — the label for the `'single'` scope. */
    slotLabel: string;
    /** Kind noun for the `'object'` label (e.g. "Whole shelf"). */
    nodeNoun: string;
};
/**
 * The scopes a hovered node offers, derived from the node itself: every node
 * paints `single`; > 1 slot adds `object`; an `asset` adds `matching`; a
 * `roomScope`-declaring kind adds `room`. `slotRoles` is the node's full slot set
 * (declared or mesh-derived), passed in by the caller.
 */
export declare function availablePaintScopes(args: {
    node: AnyNode;
    slotRoles: string[];
}): PaintScope[];
export declare function cyclePaintScope(scope: PaintScope, scopes: PaintScope[]): PaintScope;
export declare function paintScopeLabel(scope: PaintScope, info: PaintHoverInfo): string;
/**
 * All paintable slot roles of a node. Prefers the kind's declared
 * `capabilities.slots` (node-authored, stable); falls back to the runtime mesh
 * tags via the injected `meshSlotRoles` for kinds whose slots come from a GLB
 * (items) rather than a declaration.
 */
export declare function nodeSlotRoles(node: AnyNode, meshSlotRoles: (node: AnyNode) => string[]): string[];
/** Display label for the hovered slot — declared label wins, else derived from the id. */
export declare function slotDisplayLabel(node: AnyNode, role: string): string;
export type WallPaintHit = {
    face: 'front' | 'back';
    point: [number, number];
};
/**
 * Expand one paint hit (`node` + resolved `role`) into the full list of
 * (node, role) targets the current `scope` should paint. Returns just the
 * clicked surface for `'single'`, for any target whose scope set doesn't
 * include the current scope, and whenever the spread resolves to a single
 * element — so callers can keep the kind-specific single-node commit for that
 * case and only batch when there's genuinely more than one target.
 *
 * `slotRolesOf` enumerates the node's full slot set (declared or mesh-derived,
 * injected by the caller) for the whole-object scope.
 */
export declare function resolvePaintScopeTargets(args: {
    node: AnyNode;
    role: string;
    scope: PaintScope;
    nodes: Record<string, AnyNode>;
    spaces: Record<string, Space>;
    slotRolesOf: (node: AnyNode) => string[];
    wallHit?: WallPaintHit;
}): Array<{
    nodeId: AnyNodeId;
    role: string;
}>;
/**
 * Apply one paint to many slot-model targets in a single undo step. Resolves
 * the slot ref ONCE — a one-off colour creates a single shared scene material
 * for the whole fan-out, not one per node — then writes every `node.slots[role]`
 * (or deletes it, for the eraser) in one `useScene.setState`. Only ever called
 * for item / wall / slab fan-outs, all of which use the unified slot model.
 */
export declare function commitPaintScopeFanout(targets: ReadonlyArray<{
    nodeId: AnyNodeId;
    role: string;
}>, material: MaterialSchema | undefined, materialPreset: string | undefined): void;
//# sourceMappingURL=paint-scope.d.ts.map
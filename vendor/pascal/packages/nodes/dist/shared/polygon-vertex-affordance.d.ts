import { type AnyNode, type AnyNodeId, type FloorplanAffordance, type FloorplanAffordanceModifiers } from '@pascal-app/core';
import { type WallPlanPoint } from '@pascal-app/editor';
/**
 * Shared "edit polygon" floor-plan affordances. Used by kinds whose
 * primary editable shape is a `polygon: [number, number][]` field
 * (slab, ceiling, site, zone) with optional `holes: [number, number][][]`.
 *
 * Each affordance accepts an optional `holeIndex` in its payload — when
 * present, the operation targets `node.holes[holeIndex]`; otherwise it
 * targets the outer `node.polygon`. The same factory wires both
 * boundary and hole interactions without duplicating the math.
 *
 * Four affordances available:
 *
 * - `move-vertex` — drag an existing vertex.
 * - `add-vertex` — insert a new vertex at an edge midpoint, then drag
 *   it (click-without-drag reverts to the snapshot).
 * - `move-edge` — drag a whole edge perpendicular to itself (both
 *   endpoints translate by `normal * projection`).
 * - `delete-vertex` — remove a double-clicked vertex while preserving
 *   the minimum three-vertex ring.
 */
export type PolygonVertexPayload = {
    /** Target a hole's polygon instead of the boundary. */
    holeIndex?: number;
    vertexIndex: number;
};
export type AddVertexPayload = {
    holeIndex?: number;
    edgeIndex: number;
};
export type EdgeDragPayload = {
    holeIndex?: number;
    edgeIndex: number;
};
type PolygonAffordanceMode = 'move-vertex' | 'add-vertex' | 'move-edge';
export type PolygonAffordanceSnapContext<N extends PolygonShape & {
    id: AnyNodeId;
}> = {
    node: N;
    nodes: Record<AnyNodeId, AnyNode>;
    rawPoint: WallPlanPoint;
    fallbackPoint: WallPlanPoint;
    modifiers: FloorplanAffordanceModifiers;
    holeIndex?: number;
    mode: PolygonAffordanceMode;
};
export type PolygonEdgeSnapContext<N extends PolygonShape & {
    id: AnyNodeId;
}> = {
    node: N;
    nodes: Record<AnyNodeId, AnyNode>;
    /** Candidate edge (after the perpendicular translation), in ring order. */
    edge: [[number, number], [number, number]];
    rawPoint: WallPlanPoint;
    modifiers: FloorplanAffordanceModifiers;
    holeIndex?: number;
};
export type PolygonAffordanceOptions<N extends PolygonShape & {
    id: AnyNodeId;
}> = {
    /** Data committed only when the outer boundary (not a hole) is edited. */
    boundaryCommitData?: Partial<N>;
    resolvePlanPoint?: (context: PolygonAffordanceSnapContext<N>) => WallPlanPoint;
    /**
     * `move-edge` only: absolute edge snap. The point-based resolver runs
     * on the CURSOR, so any grab offset between the pointer and the edge
     * line gets baked into a point snap; an edge that must land exactly on
     * a target line (wall centerline) snaps here instead — return the
     * translated edge, or `null` to keep the candidate.
     */
    snapEdge?: (context: PolygonEdgeSnapContext<N>) => [[number, number], [number, number]] | null;
};
type PolygonShape = {
    polygon: ReadonlyArray<readonly [number, number]>;
    holes?: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
};
export declare function createPolygonVertexAffordance<N extends PolygonShape & {
    id: AnyNodeId;
}>(kind: string, options?: PolygonAffordanceOptions<N>): FloorplanAffordance<N>;
/**
 * Companion to `createPolygonVertexAffordance`. Inserts a new vertex at
 * the midpoint of edge `edgeIndex` (between vertices i and i+1) and
 * then drags that new vertex with the pointer. The dispatcher's
 * snapshot was taken **before** `start()` ran, so a pointer-up without
 * movement reverts to the pre-insert ring — "click without drag" is a
 * no-op, matching the legacy slab boundary editor.
 */
export declare function createPolygonAddVertexAffordance<N extends PolygonShape & {
    id: AnyNodeId;
}>(kind: string, options?: PolygonAffordanceOptions<N>): FloorplanAffordance<N>;
export declare function createPolygonDeleteVertexAffordance<N extends PolygonShape & {
    id: AnyNodeId;
}>(kind: string, options?: PolygonAffordanceOptions<N>): FloorplanAffordance<N>;
/**
 * Edge-drag: move a whole edge perpendicular to itself. Both endpoints
 * translate by `edgeNormal * projectedDelta`. The other vertices of
 * the ring stay put — adjacent edges effectively pivot around their
 * far endpoints.
 *
 * Snap is grid-aligned on the projected scalar (so a Shift-free drag
 * lands on grid lines along the edge normal).
 */
export declare function createPolygonMoveEdgeAffordance<N extends PolygonShape & {
    id: AnyNodeId;
}>(kind: string, options?: PolygonAffordanceOptions<N>): FloorplanAffordance<N>;
export {};
//# sourceMappingURL=polygon-vertex-affordance.d.ts.map
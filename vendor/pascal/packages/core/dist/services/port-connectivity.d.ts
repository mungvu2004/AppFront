import type { AnyNode, AnyNodeId } from '../schema/index.js';
/**
 * Connectivity-aware editing for port-bearing distribution kinds
 * (HVAC ductwork AND DWV plumbing).
 *
 * Two nodes are "connected" when a port of one coincides in space with a
 * port of the other — exactly how the placement tools mate a fitting onto
 * a duct end (they snap the fitting's collar onto the run's open port).
 * This service reads that relationship back out so an edit to one node can
 * carry its neighbours along.
 *
 * Pure logic: it asks each node for its ports via `def.ports` (level-local
 * meters) and does arithmetic. No Three.js, no rendering — it lives in
 * core and is consumed by the editor's move tool and the duct/pipe
 * selection affordances alike.
 *
 * ## Propagation model
 *
 * The joint graph is snapshotted once at drag start (`analyzePortConnectivity`)
 * and walked every frame (`resolveConnectivityUpdates`) given the moved node's
 * live transform. Deltas flow outward from the moved node through coincident
 * ports:
 *
 * - **Fitting** (rigid): a collar pushed by delta `d` translates the whole
 *   fitting by `d`; every other collar carries that same `d` onward.
 * - **Run** (stretch + slide, never skew): an endpoint pushed by delta `d` is
 *   split against the run's own axis. The *parallel* part slides only that
 *   endpoint (the run lengthens / shortens); the *perpendicular* part
 *   translates the entire run (so its direction is preserved). The far
 *   endpoint therefore moves by just the perpendicular part, and that part
 *   propagates onward to whatever is mated to the far endpoint.
 *
 * Propagation walks the whole connected component so a joint stays welded all
 * the way down the chain, with a visited guard so cycles (looped runs) and
 * shared joints terminate. First-reached (shortest path) wins on a node
 * reachable two ways.
 */
type Point = readonly [number, number, number];
/** A node carried by the edit, plus the snapshot needed to revert it. Kept
 *  deliberately small: the move tools read only `kind` + `nodeId` and the
 *  matching start snapshot to revert before the single tracked commit. */
export type PortConnection = {
    /** A fitting mated collar-to-collar: it translates rigidly. */
    kind: 'rigid-node';
    nodeId: AnyNodeId;
    /** Node's `position` at edit-start. */
    startPosition: Point;
} | {
    /** A run whose endpoint(s) ride the edit: it stretches and/or
     *  translates, never skews. */
    kind: 'run';
    nodeId: AnyNodeId;
    /** The run's full `path` at edit-start. */
    startPath: Point[];
};
/** One node in the snapshotted joint graph (everything reachable from the
 *  moved node, excluding the moved node itself). */
type GraphNode = {
    id: AnyNodeId;
    role: 'run' | 'fitting';
    ports: ReadonlyArray<{
        id: string;
        position: Point;
        system?: string;
    }>;
    startPath?: Point[];
    startPosition?: Point;
};
/** Who else sits on a given node's port, keyed `nodeId` → `portId` → mates. */
type Adjacency = Record<string, Record<string, Array<{
    nodeId: AnyNodeId;
    portId: string;
}>>>;
export type PortConnectivity = {
    movedNodeId: AnyNodeId;
    /** The moved node's port world positions at edit-start, keyed by port id —
     *  the reference each frame's delta is measured from. */
    startMovedPorts: Record<string, Point>;
    /** Reachable run/fitting nodes (excludes the moved node), keyed by id. */
    graph: Record<string, GraphNode>;
    /** Port coincidence edges across the moved node + every graph node. */
    adjacency: Adjacency;
    /** Flat list of carried nodes for the move tools' revert + "anything to
     *  follow?" check. Derived from `graph`. */
    connections: PortConnection[];
};
/**
 * Snapshot the joint graph reachable from `movedNode`'s ports, taken at the
 * start of a move/resize. Call once before the drag; feed the result to
 * `resolveConnectivityUpdates` on every frame.
 *
 * Only `run`-role partners (segments) and `fitting`-role partners are walked —
 * terminals and equipment usually mount to a surface and shouldn't be yanked
 * off it when an adjacent fitting nudges. Fittings that declare
 * `portConnectivityFollow: false` are anchored fixtures (e.g. pipe-trap) and
 * are skipped, so a connected run stretches against them instead.
 */
export declare function analyzePortConnectivity(movedNode: AnyNode, nodes: Record<string, AnyNode>): PortConnectivity;
/**
 * Given the moved node in its live (in-drag) transform, produce the patches
 * that keep every connected node attached. `previewNode` is the moved node
 * with its current drag position/rotation applied so its ports recompute.
 *
 * Walks the snapshotted graph, propagating each port delta outward: fittings
 * translate rigidly, runs stretch along their axis and translate across it
 * (never skew when driven from one end), and effective port movement carries on
 * to neighbouring joints. Port-level output guards bound cycles while still
 * allowing a looped/shared run to accept constraints at both endpoints.
 */
export declare function resolveConnectivityUpdates(connectivity: PortConnectivity, previewNode: AnyNode): {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[];
export {};
//# sourceMappingURL=port-connectivity.d.ts.map
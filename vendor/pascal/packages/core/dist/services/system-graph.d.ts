import { type NodePort } from '../registry/index.js';
import type { AnyNode, AnyNodeId } from '../schema/index.js';
export type SystemSummary = {
    /** Every node in this connected component. */
    nodeIds: AnyNodeId[];
    /** Distribution loops present, e.g. ['supply'], ['supply','return']. */
    systems: string[];
    /** Duct / lineset run statistics. */
    runCount: number;
    runLengthM: number;
    fittingCount: number;
    terminalCount: number;
    equipmentCount: number;
    /** False = orphaned subtree: air goes nowhere (no furnace / air
     *  handler / condenser anywhere in the component). */
    connectedToEquipment: boolean;
};
export type SystemPort = {
    port: NodePort;
    nodeId: AnyNodeId;
    x: number;
    y: number;
    z: number;
    system: string | undefined;
};
export declare function collectSystemPorts(nodes: Readonly<Record<AnyNodeId, AnyNode>>): SystemPort[];
export declare function distributionPointToWorld(node: AnyNode, point: readonly [number, number, number], nodes: Readonly<Record<AnyNodeId, AnyNode>>): [number, number, number];
/**
 * Group every port-bearing node into connected components via coinciding
 * ports. Nodes with ports but no joints form singleton components; nodes
 * without `def.ports` don't participate at all.
 */
export declare function buildPortComponents(nodes: Readonly<Record<AnyNodeId, AnyNode>>): AnyNodeId[][];
/**
 * Summary of the system the given node belongs to, or null when the node
 * has no ports (not a distribution kind). A node with ports but no
 * joints yet still gets a (singleton) summary — `connectedToEquipment:
 * false` is the interesting signal there.
 */
export declare function summarizeSystemFor(nodeId: AnyNodeId, nodes: Readonly<Record<AnyNodeId, AnyNode>>): SystemSummary | null;
//# sourceMappingURL=system-graph.d.ts.map
import { type AnyNode, type AnyNodeId, type DuctSegmentNode, type FloorplanGeometry, type GeometryContext, type PipeSegmentNode } from '@pascal-app/core';
import { ExtrudeGeometry, Group, Vector3 } from 'three';
export type SupportedRun = DuctSegmentNode | PipeSegmentNode;
export type RunHanger = {
    center: Vector3;
    anchor: Vector3;
    direction: Vector3;
    hostId: AnyNodeId;
};
export declare function hangerSceneNodes(ctx?: GeometryContext): Record<AnyNodeId, AnyNode>;
export type RunHangerSlot = {
    id: string;
    segmentIndex: number;
    fraction: number;
    center: Vector3;
    skipped: boolean;
    hanger: RunHanger | null;
};
export declare function planRunHangerSlots(run: SupportedRun, nodes: Record<AnyNodeId, AnyNode>): RunHangerSlot[];
export declare function planRunHangers(run: SupportedRun, nodes: Record<AnyNodeId, AnyNode>): RunHanger[];
export declare function buildHangerBandGeometry(run: SupportedRun): ExtrudeGeometry;
export declare function hangerSupportLines(run: SupportedRun, hanger: RunHanger): [Vector3, Vector3][];
export declare function buildRunHangers(run: SupportedRun, ctx?: GeometryContext): Group;
export declare function runHangerFloorplan(run: SupportedRun, ctx: GeometryContext): FloorplanGeometry[];
//# sourceMappingURL=run-hangers.d.ts.map
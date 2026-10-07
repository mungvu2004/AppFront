import { type AnyNode, type AnyNodeId, type DuctFittingNode, type FloorplanAffordance } from '@pascal-app/core';
import { type RunContinuationHandlePlan } from '../shared/elbow-branch-continuation';
import type { RunBodyHit, ScenePort } from '../shared/ports';
import type { DuctSegmentNode } from './schema';
export type DuctEndpoint = 'start' | 'end';
export type DuctContinuationSeed = {
    duct: DuctSegmentNode;
    port: ScenePort | null;
    body: RunBodyHit | null;
    promotedFitting?: DuctFittingNode;
};
export declare function ductEndpointPort(duct: DuctSegmentNode, endpoint: DuctEndpoint): ScenePort | null;
export declare function ductContinuationHandlePoint(duct: DuctSegmentNode, endpoint: DuctEndpoint, gap?: number): [number, number, number] | null;
export declare function ductContinuationHandlePlan(duct: DuctSegmentNode, endpoint: DuctEndpoint, nodes: Readonly<Record<string, AnyNode>>, gap?: number): RunContinuationHandlePlan | null;
export declare function resolveDuctContinuationSeed(defaults: unknown, nodes: Record<string, AnyNode>): DuctContinuationSeed | null;
export declare function activateDuctBranch(duct: DuctSegmentNode, segmentIndex: number, point: [number, number, number]): void;
export declare function activateDuctContinuation(duct: DuctSegmentNode, endpoint: DuctEndpoint, fittingId?: AnyNodeId): void;
export declare const ductContinuationAffordance: FloorplanAffordance<DuctSegmentNode>;
export declare const ductBranchAffordance: FloorplanAffordance<DuctSegmentNode>;
export declare function currentDuctContinuationSeed(): DuctContinuationSeed | null;
//# sourceMappingURL=continuation.d.ts.map
import { type AnyNode, type AnyNodeId, type FloorplanAffordance } from '@pascal-app/core';
import type { PipeFittingNode } from '../pipe-fitting/schema';
import { type RunContinuationHandlePlan } from '../shared/elbow-branch-continuation';
import type { RunBodyHit, ScenePort } from '../shared/ports';
import type { PipeSegmentNode } from './schema';
export type PipeEndpoint = 'start' | 'end';
export type PipeContinuationSeed = {
    pipe: PipeSegmentNode;
    port: ScenePort | null;
    body: RunBodyHit | null;
    promotedFitting?: PipeFittingNode;
};
export declare function pipeEndpointPort(pipe: PipeSegmentNode, endpoint: PipeEndpoint): ScenePort | null;
export declare function pipeContinuationHandlePoint(pipe: PipeSegmentNode, endpoint: PipeEndpoint, gap?: number): [number, number, number] | null;
export declare function pipeContinuationHandlePlan(pipe: PipeSegmentNode, endpoint: PipeEndpoint, nodes: Readonly<Record<string, AnyNode>>, gap?: number): RunContinuationHandlePlan | null;
export declare function resolvePipeContinuationSeed(defaults: unknown, nodes: Record<string, AnyNode>): PipeContinuationSeed | null;
export declare function activatePipeBranch(pipe: PipeSegmentNode, segmentIndex: number, point: [number, number, number]): void;
export declare function activatePipeContinuation(pipe: PipeSegmentNode, endpoint: PipeEndpoint, fittingId?: AnyNodeId): void;
export declare const pipeContinuationAffordance: FloorplanAffordance<PipeSegmentNode>;
export declare const pipeBranchAffordance: FloorplanAffordance<PipeSegmentNode>;
export declare function currentPipeContinuationSeed(): PipeContinuationSeed | null;
//# sourceMappingURL=continuation.d.ts.map
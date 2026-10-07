import { type AnyNode, type AnyNodeId, DuctFittingNode, PipeFittingNode } from '@pascal-app/core';
import type { ScenePort } from './ports';
type Point = [number, number, number];
export type ElbowBranchPromotion<T> = {
    fitting: T;
    continuationPort: ScenePort;
};
export type RunContinuationHandlePlan = {
    position: Point;
    fittingId?: AnyNodeId;
};
export declare function findMatedScenePorts(source: ScenePort, nodes: Readonly<Record<string, AnyNode>>): ScenePort[];
export declare function resolveDuctContinuationHandle(source: ScenePort, nodes: Readonly<Record<string, AnyNode>>, gap: number): RunContinuationHandlePlan | null;
export declare function resolvePipeContinuationHandle(source: ScenePort, nodes: Readonly<Record<string, AnyNode>>, gap: number): RunContinuationHandlePlan | null;
export declare function planDuctElbowBranchPromotion(elbow: DuctFittingNode, connectedPortId: string): ElbowBranchPromotion<DuctFittingNode> | null;
export declare function planPipeElbowBranchPromotion(elbow: PipeFittingNode, connectedPortId: string): ElbowBranchPromotion<PipeFittingNode> | null;
export declare function planDuctTeeCrossPromotion(tee: DuctFittingNode): ElbowBranchPromotion<DuctFittingNode> | null;
export declare function planPipeTeeCrossPromotion(tee: PipeFittingNode): ElbowBranchPromotion<PipeFittingNode> | null;
export {};
//# sourceMappingURL=elbow-branch-continuation.d.ts.map
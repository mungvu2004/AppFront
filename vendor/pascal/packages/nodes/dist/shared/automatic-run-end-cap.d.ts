import { type AnyNode, type AnyNodeId, DuctFittingNode, type DuctSegmentNode, PipeFittingNode, type PipeSegmentNode } from '@pascal-app/core';
import type { ScenePort } from './ports';
export declare function createDuctRunEndCap(duct: DuctSegmentNode, endpoint?: 'start' | 'end'): DuctFittingNode | null;
export declare function createPipeRunEndCap(pipe: PipeSegmentNode, endpoint?: 'start' | 'end'): PipeFittingNode | null;
export declare function isRunEndCapPort(port: ScenePort, nodes: Readonly<Record<string, AnyNode>>): boolean;
export declare function findMatedRunEndCapIds(source: ScenePort | null, nodes: Readonly<Record<string, AnyNode>>, fittingKind: 'duct-fitting' | 'pipe-fitting'): AnyNodeId[];
export declare function findAutomaticRunEndCapIds(runId: AnyNodeId, nodes: Readonly<Record<string, AnyNode>>, fittingKind: 'duct-fitting' | 'pipe-fitting'): AnyNodeId[];
export declare function planRunEndCapFollowUpdates(originalRun: DuctSegmentNode | PipeSegmentNode, nextRun: DuctSegmentNode | PipeSegmentNode, endpoint: 'start' | 'end', nodes: Readonly<Record<string, AnyNode>>): {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[];
//# sourceMappingURL=automatic-run-end-cap.d.ts.map
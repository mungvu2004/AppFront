import { PipeFittingNode, PipeSegmentNode } from '@pascal-app/core';
import type { RunBodyHit } from '../shared/ports';
export type PipeInlineInsertionPlan = {
    fitting: PipeFittingNode;
    runUpdate: {
        id: PipeSegmentNode['id'];
        data: Partial<PipeSegmentNode>;
    };
    runTail: PipeSegmentNode;
};
export declare function isInlinePipeFitting(node: PipeFittingNode): boolean;
export declare function planPipeInlineInsertion(run: PipeSegmentNode, hit: RunBodyHit, template: PipeFittingNode): PipeInlineInsertionPlan | null;
//# sourceMappingURL=inline-insertion.d.ts.map
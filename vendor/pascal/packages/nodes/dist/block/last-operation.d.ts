import type { AnyNodeId, BlockTopology, SceneApi } from '@pascal-app/core';
import type { SelectionAffordanceHistoryApi } from '@pascal-app/editor';
import { type BlockCommand, type BlockCommandResult, type BlockSelection } from './commands';
type SuccessfulBlockCommandResult = Extract<BlockCommandResult, {
    ok: true;
}>;
export type BlockOperationServices = {
    historyApi: SelectionAffordanceHistoryApi;
    readOnly: boolean;
    sceneApi: Pick<SceneApi, 'get' | 'update' | 'applyChanges'>;
};
export type BlockLastOperation = {
    baseTopology: BlockTopology;
    command: BlockCommand;
    historyDepth: number;
    label: string;
    nodeId: AnyNodeId;
    resultSelection: BlockSelection;
    resultTopology: BlockTopology;
};
export type BlockLastOperationReplacement = {
    ok: true;
    operation: BlockLastOperation;
} | {
    ok: false;
    error: string;
};
export type BlockOperationCommit = {
    ok: true;
    changed: false;
} | {
    ok: true;
    changed: true;
    operation: BlockLastOperation;
    result: SuccessfulBlockCommandResult;
} | {
    ok: false;
    error: string;
};
type RepeatSelection = BlockSelection & {
    activeId: string | null;
};
export declare function recordCommittedBlockOperation(services: BlockOperationServices, nodeId: AnyNodeId, label: string, baseTopology: BlockTopology, command: BlockCommand, result: SuccessfulBlockCommandResult): BlockLastOperation;
export declare function commitBlockOperation(services: BlockOperationServices, nodeId: AnyNodeId, label: string, baseTopology: BlockTopology, command: BlockCommand): BlockOperationCommit;
export declare function replaceCommittedBlockOperation(services: BlockOperationServices, operation: BlockLastOperation, command: BlockCommand): BlockLastOperationReplacement;
export declare function repeatCommittedBlockOperation(services: BlockOperationServices, operation: BlockLastOperation, selection: RepeatSelection): BlockLastOperationReplacement;
export {};
//# sourceMappingURL=last-operation.d.ts.map
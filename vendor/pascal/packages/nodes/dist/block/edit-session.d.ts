import type { BlockTopology } from '@pascal-app/core';
import type { BlockLastOperation } from './last-operation';
import { type BlockSelectionState } from './selection-model';
type BlockEditSessionState = {
    nodeId: string | null;
    selection: BlockSelectionState;
    lastOperation: BlockLastOperation | null;
    begin: (nodeId: string, selection: BlockSelectionState) => void;
    end: (nodeId: string) => void;
    setSelection: (nodeId: string, selection: BlockSelectionState) => void;
    reconcileSelection: (nodeId: string, topology: BlockTopology) => void;
    setLastOperation: (nodeId: string, operation: BlockLastOperation | null) => void;
};
declare const useBlockEditSession: import("zustand").UseBoundStore<import("zustand").StoreApi<BlockEditSessionState>>;
export default useBlockEditSession;
//# sourceMappingURL=edit-session.d.ts.map
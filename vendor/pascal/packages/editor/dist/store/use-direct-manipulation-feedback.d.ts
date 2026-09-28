import type { AnyNodeId } from '@pascal-app/core';
type DirectManipulationFeedbackState = {
    activeRotateNodeId: AnyNodeId | null;
    setActiveRotateNodeId(nodeId: AnyNodeId | null): void;
    clearActiveRotateNodeId(nodeId?: AnyNodeId): void;
};
declare const useDirectManipulationFeedback: import("zustand").UseBoundStore<import("zustand").StoreApi<DirectManipulationFeedbackState>>;
export default useDirectManipulationFeedback;
//# sourceMappingURL=use-direct-manipulation-feedback.d.ts.map
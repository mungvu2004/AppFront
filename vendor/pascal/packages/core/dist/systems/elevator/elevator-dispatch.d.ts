import type { AnyNode, AnyNodeId } from '../../schema/index.js';
import type { ElevatorInteractiveState } from '../../store/use-interactive.js';
type ElevatorRuntimeMap = Record<AnyNodeId, ElevatorInteractiveState>;
type ResolveElevatorDispatchTargetArgs = {
    elevators: ElevatorRuntimeMap;
    levelId: AnyNodeId;
    nodes: Record<string, AnyNode>;
    requestedElevatorId: AnyNodeId;
};
export declare function resolveElevatorDispatchTarget({ elevators, levelId, nodes, requestedElevatorId, }: ResolveElevatorDispatchTargetArgs): AnyNodeId;
export {};
//# sourceMappingURL=elevator-dispatch.d.ts.map
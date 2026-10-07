import { type NodeDefinition } from '@pascal-app/core';
import { ElevatorNode } from './schema';
/**
 * Elevator — Stage A registration. Wrap-exports the legacy renderer +
 * the three legacy systems (runtime / interaction / opening) bundled
 * as one `def.system`. Move / inspector still go through legacy
 * (`MoveElevatorTool`, `<ElevatorPanel>`) via panel-manager's
 * hardcoded switch.
 */
export declare const elevatorDefinition: NodeDefinition<typeof ElevatorNode>;
//# sourceMappingURL=definition.d.ts.map
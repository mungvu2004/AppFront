import { type AnyNode } from '@pascal-app/core';
/**
 * A node draws in the plan unless it, or an ancestor whose flag reaches its
 * descendants, is hidden. A hidden Site keeps its buildings on the plan; see
 * `hidesDescendants`.
 */
export declare function isVisibleInFloorplan(node: AnyNode, nodes: Record<string, AnyNode>): boolean;
//# sourceMappingURL=floorplan-preview-visibility.d.ts.map
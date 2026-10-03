import { type NodeDefinition } from '@pascal-app/core';
import { StairNode } from './schema';
/**
 * Stair — Stage A. Composite node like roof: owns overall framing,
 * `stair-segment` children own per-flight geometry. Wrap-exports the
 * legacy `StairRenderer` + `StairSystem`.
 */
export declare const stairDefinition: NodeDefinition<typeof StairNode>;
//# sourceMappingURL=definition.d.ts.map
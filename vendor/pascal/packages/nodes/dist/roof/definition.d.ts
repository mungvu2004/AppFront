import { type NodeDefinition } from '@pascal-app/core';
import { RoofNode } from './schema';
/**
 * Roof is a composite node with `roof-segment` children that own the
 * per-segment geometry. Its floor-plan contribution merges those child
 * footprints so a multi-segment roof reads as one shape.
 */
export declare const roofDefinition: NodeDefinition<typeof RoofNode>;
//# sourceMappingURL=definition.d.ts.map
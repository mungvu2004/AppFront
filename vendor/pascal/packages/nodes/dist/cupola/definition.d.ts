import { type NodeDefinition } from '@pascal-app/core';
import { CupolaNode } from './schema';
/**
 * Cupola — a louvered roof lantern. Parented to a `roof-segment`; position
 * is segment-local; rotation rotates it around the segment's vertical axis
 * after the slope tilt is applied. Same composition as the box vent (custom
 * renderer, pure geometry builder, no system) — see box-vent's definition
 * for the rationale on why roof accessories need a custom renderer.
 */
export declare const cupolaDefinition: NodeDefinition<typeof CupolaNode>;
//# sourceMappingURL=definition.d.ts.map
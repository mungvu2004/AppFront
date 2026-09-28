import { type NodeDefinition } from '@pascal-app/core';
import { EyebrowVentNode } from './schema';
/**
 * Eyebrow vent — a low, curved lens-shaped hood with a louvered front that
 * sweeps out of a roof slope. Parented to a `roof-segment`; position is
 * segment-local; rotation rotates it around the segment's vertical axis after
 * the slope tilt is applied. Same composition as the box vent / cupola (custom
 * renderer, pure geometry builder, no system) — see box-vent's definition for
 * the rationale on why roof accessories need a custom renderer.
 */
export declare const eyebrowVentDefinition: NodeDefinition<typeof EyebrowVentNode>;
//# sourceMappingURL=definition.d.ts.map
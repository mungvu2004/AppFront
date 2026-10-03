import { type NodeDefinition } from '@pascal-app/core';
import { SolarPanelNode } from './schema';
/**
 * Solar panel array — a grid of photovoltaic panels mounted on a roof
 * segment. Position is segment-local; the surface normal stored on
 * the node orients the array flat to the slope.
 *
 * Three-checkbox model: custom `def.renderer` for the parent-segment
 * lookup + analytical surface normal fallback. No `geometry` (the
 * builder lives in `./geometry` and is shared with the preview), no
 * `system` (the orientation quaternion is computed once per render,
 * not per frame — see renderer notes).
 */
export declare const solarPanelDefinition: NodeDefinition<typeof SolarPanelNode>;
//# sourceMappingURL=definition.d.ts.map
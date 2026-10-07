import type { NodeDefinition } from '@pascal-app/core';
import { LinesetNode } from './schema';
/**
 * Refrigerant lineset — the copper suction + liquid pair joining a split
 * system's outdoor condenser to its indoor coil. The refrigerant-side
 * sibling of `duct-segment`: same polyline model and draw tool, but it
 * snaps onto refrigerant service ports instead of duct collars.
 *
 * Composition: `def.geometry` only, plus a selection-time path-handle
 * system shared in spirit with the duct segment. The framework's
 * `<ParametricNodeRenderer>` mounts an empty group; `<GeometrySystem>`
 * fills it via `buildLinesetGeometry` on dirty.
 */
export declare const linesetDefinition: NodeDefinition<typeof LinesetNode>;
//# sourceMappingURL=definition.d.ts.map
import { type NodeDefinition } from '@pascal-app/core';
import { ChimneyNode } from './schema';
/**
 * Chimney — a vertical masonry stack hosted on a roof segment.
 *
 * Three-checkbox model: `def.renderer` (custom — segment-aware
 * geometry from `useScene`, body height derived from
 * `segment.wallHeight + roofHeight + heightAboveRidge`), no `geometry`,
 * no `system`.
 *
 * **Option C scope**: chimney ships in the registry shape with solid
 * geometry. CSG-driven decoration (cap flue holes, body cavity,
 * panels, bands) is preserved in the schema but not rendered yet —
 * those re-light when roof-segment migrates to Stage B and introduces
 * a `roofCutout` capability the parent segment can read.
 */
export declare const chimneyDefinition: NodeDefinition<typeof ChimneyNode>;
//# sourceMappingURL=definition.d.ts.map
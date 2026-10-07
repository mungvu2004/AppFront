import { type NodeDefinition } from '@pascal-app/core';
import { GutterNode } from './schema';
/**
 * Gutter — a rain-water channel running along the eave of a roof
 * segment. Parented to a `roof-segment`; position is segment-local.
 *
 * Three-checkbox model — same shape as box-vent / ridge-vent: custom
 * `def.renderer` for the parent-segment transform lookup + live
 * override merge, pure geometry builder in `./geometry` shared with
 * the placement preview, no per-frame system (no animation, no
 * cross-kind cascades).
 *
 * Placement tool snaps to the eave line (segment-local
 * `Z = +depth/2, Y = wallHeight`) wherever the cursor lands on a
 * segment. After commit, the length L/R handles cover trimming and
 * the inspector covers profile + size adjustments.
 */
export declare const gutterDefinition: NodeDefinition<typeof GutterNode>;
//# sourceMappingURL=definition.d.ts.map
import { type NodeDefinition } from '@pascal-app/core';
import { RidgeVentNode } from './schema';
/**
 * Ridge vent — a ventilation strip running along the ridge of a roof
 * segment. Parented to a `roof-segment`; position is segment-local.
 *
 * Three-checkbox model — same shape as box-vent: custom `def.renderer`
 * (parent segment transform lookup + live-transform follow), pure
 * geometry builder shared with the placement preview + future tests,
 * no animation or per-frame system.
 *
 * The placement tool snaps to the nearest ridge/break line wherever the
 * cursor lands on a segment.
 */
export declare const ridgeVentDefinition: NodeDefinition<typeof RidgeVentNode>;
//# sourceMappingURL=definition.d.ts.map
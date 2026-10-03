import { type NodeDefinition } from '@pascal-app/core';
import { DownspoutNode } from './schema';
/**
 * Downspout — vertical drop pipe taking water from a gutter outlet to
 * the ground. Scene-graph parent is the same roof-segment the host
 * gutter sits on (so it renders under `roof-elements` like every
 * other accessory); the logical link to the gutter is via the
 * `gutterId` field, which the renderer uses to look up the outlet
 * position.
 *
 * No `handles` yet — the downspout's geometry is anchored to the
 * gutter's outlet. Length (tracker cube at the routed mouth) and
 * diameter (chevron on the wall run) are draggable arrows; the wall
 * standoff lives in the inspector.
 */
export declare const downspoutDefinition: NodeDefinition<typeof DownspoutNode>;
//# sourceMappingURL=definition.d.ts.map
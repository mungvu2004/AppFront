import type { AnyNode, AnyNodeId } from '../types.js';
import type { DownspoutNode } from './downspout.js';
import { type GutterNode } from './gutter.js';
import type { RoofSegmentNode } from './roof-segment.js';
export type AutoDownspoutPlacement = {
    gutterId: GutterNode['id'];
    offset: number;
};
export type AutomaticDownspoutInput = {
    segments: readonly RoofSegmentNode[];
    gutters: readonly GutterNode[];
    downspouts: readonly DownspoutNode[];
    maxRunPerDownspout?: number;
};
export declare function resolveAutomaticDownspoutLength(nodes: Record<AnyNodeId, AnyNode>, segment: RoofSegmentNode, gutter: GutterNode, outletOffset: number): number;
export declare function planAutomaticDownspouts({ segments, gutters, downspouts, maxRunPerDownspout, }: AutomaticDownspoutInput): AutoDownspoutPlacement[];
//# sourceMappingURL=automatic-downspout.d.ts.map
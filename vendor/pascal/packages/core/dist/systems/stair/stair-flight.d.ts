import type { AnyNode, StairNode } from '../../schema/index.js';
import { StairSegmentNode } from '../../schema/index.js';
export type StairFlightOverrides = Partial<Pick<StairSegmentNode, 'width' | 'length' | 'height' | 'stepCount' | 'attachmentSide' | 'fillToFloor' | 'thickness'>>;
/**
 * The single definition of a default straight flight. Anything left out falls
 * through to the `StairSegmentNode` schema defaults (length 3 m, 10 steps,
 * filled to floor) rather than being spelled again per call site, so the stair
 * tool's seed segment, the flight the panel materializes when a curved stair
 * becomes straight, and the viewer's fallback body all describe one stair.
 */
export declare function createDefaultStairSegment(overrides?: StairFlightOverrides): StairSegmentNode;
/**
 * The flight a straight stair implies from its own fields — used wherever a
 * straight stair has to stand in for missing `stair-segment` children.
 */
export declare function createStairFlightFromStair(stair: StairNode, nodes: Record<string, AnyNode>): StairSegmentNode;
//# sourceMappingURL=stair-flight.d.ts.map
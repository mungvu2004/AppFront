import { type AnyNode, type StairNode, type StairSegmentNode, type StairType } from '@pascal-app/core';
export type StairTypeChange = {
    updates: Partial<StairNode>;
    /** A flight to create under the stair, or null when the stair already has segments. */
    segment: StairSegmentNode | null;
};
/**
 * Computes the stair patch for a type switch.
 *
 * Straight stairs are drawn from their `stair-segment` children while curved
 * and spiral stairs are drawn parametrically from the stair's own fields, so a
 * stair that reaches `straight` without segments has nothing to draw at all.
 * Switching to straight therefore materializes the flight the stair already
 * describes. Switching away keeps the segments — they simply go unused until
 * the stair comes back, which makes the round trip lossless.
 */
export declare function getStairTypeChange(stair: StairNode, nextType: StairType, nodes: Record<string, AnyNode>): StairTypeChange;
//# sourceMappingURL=stair-type.d.ts.map
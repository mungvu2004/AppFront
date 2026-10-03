import type { AnyNode, StairNode, StairSegmentNode } from '../../schema/index.js';
/**
 * Stair footprint geometry shared by the slab-opening sync and the
 * alignment-anchor adapters. A stair has no single box footprint: straight
 * stairs are a cumulative chain of `stair-segment` children, curved / spiral
 * stairs are an annular sector stored entirely on the parent. Both reduce to
 * an XZ bounding box here so callers that only need "where does the stair sit
 * in plan" (alignment guides) don't have to re-walk the geometry.
 *
 * All math is in the building-local XZ frame, matching `node.position`.
 */
export type StairFootprintAABB = {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
};
type SegmentTransform = {
    position: [number, number, number];
    rotation: number;
};
/**
 * XZ rotation in the stair geometry convention (equivalent to rotating by
 * `-angle` in standard math): positive `angle` turns local +Z toward +X. Every
 * stair helper — slab openings, floor-plan emitter, this footprint — shares it,
 * so anchors line up with the rendered stair.
 */
export declare function rotateXZ(x: number, z: number, angle: number): [number, number];
/**
 * Cumulative per-segment transforms for a straight (segment-chained) stair.
 * Each flight attaches to the previous segment's end; `attachmentSide` rotates
 * the chain ±90° (left / right) or continues straight (front). Positions are in
 * the stair's local frame (before the stair's own `position` / `rotation`).
 */
export declare function computeSegmentTransforms(segments: StairSegmentNode[]): SegmentTransform[];
/**
 * XZ bounding box of a stair's plan footprint, or null when it can't be
 * determined (a straight stair whose segment children aren't in `nodes`).
 * Straight stairs need the children to walk the flight chain; curved / spiral
 * stairs are derived from the parent alone, so `nodes` is optional for them.
 */
export declare function stairFootprintAABB(stair: StairNode, nodes?: Readonly<Record<string, AnyNode>>): StairFootprintAABB | null;
export {};
//# sourceMappingURL=stair-footprint.d.ts.map
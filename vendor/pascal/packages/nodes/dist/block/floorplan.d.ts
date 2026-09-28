import type { BlockNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * The plan cut: a floor plan is the storey sliced 4 ft above the floor and
 * looked at from above. A block standing wholly ABOVE that line — fascia and
 * rake boards, a gable ornament, a dormer, a ceiling fan — is overhead trim a
 * drafted sheet leaves off (otherwise blocks modelled as roof trim filled the
 * roof footprint plus its overhang over every room). Level-local metres.
 */
export declare const PLAN_CUT_HEIGHT = 1.2;
/** True when the block's lowest vertex stands above the plan cut. */
export declare function isOverheadBlock(node: Pick<BlockNode, 'position' | 'topology'>): boolean;
export declare function buildBlockFloorplan(node: BlockNode, ctx?: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
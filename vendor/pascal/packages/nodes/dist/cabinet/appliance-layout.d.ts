import type { CabinetModuleNode } from '@pascal-app/core';
import type { SinkLayout } from './stack';
export declare const BASIN_WALL = 0.012;
export declare const FAUCET_SETBACK = 0.03;
export type SinkBowlSpec = {
    centerX: number;
    width: number;
    depth: number;
};
/**
 * Bowl rects in module-local X/Z given the usable countertop footprint.
 * Shared by the 3D cut, the run-countertop cut, and the 2D floorplan symbol.
 */
export declare function sinkBowls(layout: SinkLayout, usableWidth: number, usableDepth: number): SinkBowlSpec[];
export declare function sinkOpening(bowl: SinkBowlSpec): SinkBowlSpec;
export declare function cooktopFootprint(node: Pick<CabinetModuleNode, 'width' | 'depth'>): {
    width: number;
    depth: number;
};
export declare const FAUCET_BASE_RADIUS = 0.032;
export declare function sinkFaucetFootprint(bowls: readonly SinkBowlSpec[]): {
    x: number;
    z: number;
    radius: number;
};
//# sourceMappingURL=appliance-layout.d.ts.map
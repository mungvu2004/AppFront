import type { CurtainGrid, CurtainPanelType, CurtainWallConfig, DoorNode } from '@pascal-app/core';
export declare function curtainGridPositions(length: number, grid: CurtainGrid): number[];
export type CurtainWallPiece = {
    left: number;
    right: number;
    bottom: number;
    top: number;
    front: number;
    back: number;
    role: 'frame' | 'glass' | 'solid';
};
export declare function curtainPanelType(config: CurtainWallConfig, column: number, row: number, rowCount: number): CurtainPanelType;
export declare function buildCurtainWallLayout(length: number, height: number, depth: number, config: CurtainWallConfig, openings?: readonly (Pick<DoorNode, 'position' | 'width' | 'height' | 'openingShape'> & {
    type: 'door' | 'window';
})[], baseElevation?: number): CurtainWallPiece[];
//# sourceMappingURL=curtain-wall-layout.d.ts.map
import type { AnyNode, AnyNodeId } from '@pascal-app/core';
export type CabinetPlacementDimension = {
    id: string;
    start: [number, number, number];
    end: [number, number, number];
    offsetNormal: [number, number];
    offsetDistance: number;
    value: number;
    renderIn3d?: boolean;
    renderInFloorplan?: boolean;
};
export declare function buildCabinetPlacementSizeDimensions({ depth, height, position, rotation, width, }: {
    depth: number;
    height: number;
    position: readonly [number, number, number];
    rotation: number;
    width: number;
}): CabinetPlacementDimension[];
export declare function resolveCabinetPlacementDimensions({ depth, levelId, nodes, position, rotation, wallId, width, }: {
    depth: number;
    levelId: AnyNodeId;
    nodes: Readonly<Record<AnyNodeId, AnyNode>>;
    position: readonly [number, number, number];
    rotation: number;
    wallId?: AnyNodeId;
    width: number;
}): CabinetPlacementDimension[];
export declare function resolveCabinetPlacementDimensionPosition({ depth, dimensionId, levelId, nodes, position, rotation, wallId, width, value, }: {
    depth: number;
    dimensionId: string;
    levelId: AnyNodeId;
    nodes: Readonly<Record<AnyNodeId, AnyNode>>;
    position: readonly [number, number, number];
    rotation: number;
    wallId?: AnyNodeId;
    width: number;
    value: number;
}): {
    position: [number, number, number];
    wallLocalX: number;
} | null;
//# sourceMappingURL=placement-dimensions.d.ts.map
import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
type FloorStackPreviewArgs = {
    node: AnyNode;
    position: [number, number, number];
    rotation?: unknown;
    levelId?: string | null;
    nodes?: Record<AnyNodeId, AnyNode>;
    /** Pointer-decided support cap — see `FloorPlacedElevationArgs.maxElevation`. */
    maxElevation?: number | null;
};
export declare function getFloorStackPreviewPosition({ node, position, rotation, levelId, nodes, maxElevation, }: FloorStackPreviewArgs): [number, number, number];
export {};
//# sourceMappingURL=floor-stack-preview.d.ts.map
import { type AnyNode, type AnyNodeId, type DoorNode, type WindowNode } from '@pascal-app/core';
type Opening = DoorNode | WindowNode;
export declare function curtainOpeningResizeMax(opening: Opening, nodes: Readonly<Record<AnyNodeId, AnyNode>>, axis: 'x' | 'y', sign: number): number | undefined;
export declare function curtainOpeningLimits(opening: Opening, nodes: Readonly<Record<AnyNodeId, AnyNode>>): {
    margin: number;
    length: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
} | null;
export declare function constrainCurtainOpening<T extends Opening>(opening: T, patch: Partial<T>, nodes: Readonly<Record<AnyNodeId, AnyNode>>): Partial<T>;
export {};
//# sourceMappingURL=curtain-opening-limits.d.ts.map
import { type AnyNodeId, type CeilingNode, type FloorplanMoveTarget, type FloorplanMoveTargetSession, type WallNode } from '@pascal-app/core';
import { type ProceduralItemNode } from '@pascal-app/core/procedural-items';
export declare const createProceduralWallMoveSession: typeof createProceduralMountedMoveSession;
export declare const createProceduralCeilingMoveSession: typeof createProceduralMountedMoveSession;
declare function createProceduralMountedMoveSession(node: ProceduralItemNode, levelId: AnyNodeId): FloorplanMoveTargetSession & {
    wall(wall: WallNode, x: number, y: number, side: "front" | "back", alt: boolean): void;
    ceiling(ceiling: CeilingNode, x: number, z: number, alt: boolean): void;
    rotate(direction: number): void;
    free(point: readonly [number, number]): void;
    commit(): void;
    readonly candidate: ProceduralItemNode | null;
};
export declare const proceduralFloorplanMoveTarget: FloorplanMoveTarget<ProceduralItemNode>;
export {};
//# sourceMappingURL=move-session.d.ts.map
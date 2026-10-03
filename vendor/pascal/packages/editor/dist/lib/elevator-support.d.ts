import { type AnyNode, type BuildingNode, type ElevatorNode, type LevelNode } from '@pascal-app/core';
export declare function resolveCurrentBuildingId({ buildingId, levelId, nodes, }: {
    buildingId: BuildingNode['id'] | null;
    levelId: LevelNode['id'] | null;
    nodes: Record<string, AnyNode>;
}): BuildingNode['id'] | null;
export declare function resolveElevatorSupportLevelId({ buildingId, preferredLevelId, }: {
    buildingId: string | null | undefined;
    preferredLevelId?: string | null;
}): LevelNode['id'] | null;
export declare function resolveElevatorSupportY({ buildingId, preferredLevelId, x, z, }: {
    buildingId: string | null | undefined;
    preferredLevelId?: string | null;
    x: number;
    z: number;
}): number;
export declare function resolveElevatorNodeSupportY(node: ElevatorNode, position?: [number, number, number]): number;
//# sourceMappingURL=elevator-support.d.ts.map
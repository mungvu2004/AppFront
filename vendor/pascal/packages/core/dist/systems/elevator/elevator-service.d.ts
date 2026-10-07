import type { AnyNode, ElevatorNode, LevelNode } from '../../schema/index.js';
export type ElevatorLevelEntry = {
    id: LevelNode['id'];
    label: string;
    baseY: number;
};
export declare function resolveElevatorBuildingLevels(elevator: ElevatorNode, nodes: Record<string, AnyNode>): LevelNode[];
export declare function resolveElevatorServiceLevelIds(elevator: ElevatorNode, nodes: Record<string, AnyNode>): string[];
export declare function resolveElevatorServiceLevels(elevator: ElevatorNode, nodes: Record<string, AnyNode>): LevelNode[];
export declare function resolveElevatorLevels(elevator: ElevatorNode, nodes: Record<string, AnyNode>): {
    entries: ElevatorLevelEntry[];
    defaultEntry: ElevatorLevelEntry | null;
    shaftBaseY: number;
    shaftTopY: number;
    totalHeight: number;
};
//# sourceMappingURL=elevator-service.d.ts.map
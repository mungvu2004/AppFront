import { type AnyNodeId, type BuildingNode, type LevelNode } from '@pascal-app/core';
type ElevatorToolProps = {
    buildingId: BuildingNode['id'] | null;
    levelId: LevelNode['id'] | null;
    onPlaced?: (elevatorId: AnyNodeId, buildingId: BuildingNode['id']) => void;
};
export declare const ElevatorTool: React.FC<ElevatorToolProps>;
export {};
//# sourceMappingURL=elevator-tool.d.ts.map
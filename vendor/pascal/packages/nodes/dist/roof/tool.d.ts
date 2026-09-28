import { type AnyNode, type LevelNode, type RoofFootprintTarget, type SceneApi } from '@pascal-app/core';
import { type RoofPlacementMode } from './roof-placement-mode';
/**
 * Creates a roof group with one default gable segment
 */
export declare const commitRoofPlacement: (sceneApi: SceneApi, levelId: LevelNode["id"], corner1: [number, number, number], corner2: [number, number, number], selectedIds: string[], quarterTurn: boolean, placementMode: RoofPlacementMode) => AnyNode["id"] | null;
export declare const commitRoofFootprint: (sceneApi: SceneApi, levelId: LevelNode["id"], target: RoofFootprintTarget, quarterTurn: boolean) => AnyNode["id"] | null;
export declare const RoofTool: React.FC;
export default RoofTool;
//# sourceMappingURL=tool.d.ts.map
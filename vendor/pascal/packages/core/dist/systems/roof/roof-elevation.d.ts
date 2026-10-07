import type { AnyNode, LevelNode, RoofNode, WallNode } from '../../schema/index.js';
export declare function resolveRoofWallTopElevation(targetLevelId: LevelNode['id'], wall: WallNode, nodes: Readonly<Record<string, AnyNode>>, elevations?: Map<string, import("../../index.js").LevelElevation>): number;
export declare function resolveRoofElevation(roof: RoofNode, nodes: Readonly<Record<string, AnyNode>>): number;
//# sourceMappingURL=roof-elevation.d.ts.map
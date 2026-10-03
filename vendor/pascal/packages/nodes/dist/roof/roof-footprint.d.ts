import { type AnyNode, type LevelNode, type RoofFootprintTarget, type RoofType, type WallNode } from '@pascal-app/core';
export type RoofFootprintSource = 'room' | 'walls' | 'draw';
export declare function isStandardRoofWallEligible(wall: WallNode): boolean;
export declare function isConicalRoofWallEligible(targetLevelId: LevelNode['id'], wall: WallNode, nodes: Readonly<Record<string, AnyNode>>): boolean;
export declare function parseRoofFootprintSource(value: unknown, roofType: RoofType): RoofFootprintSource;
export declare function subscribeToConicalRoofWallClicks(options: {
    footprintSource: RoofFootprintSource;
    currentLevelId: LevelNode['id'] | null;
    getNodes: () => Readonly<Record<string, AnyNode>>;
    onPreview?: (wall: WallNode | null) => void;
    onSelect: (wall: WallNode) => void;
    roofType: RoofType;
}): () => void;
export declare function resolveRoofFootprintElevation(targetLevelId: LevelNode['id'], target: RoofFootprintTarget, nodes: Readonly<Record<string, AnyNode>>): number;
export declare function resolveRoofFootprintWorldElevation(targetLevelId: LevelNode['id'], target: RoofFootprintTarget, nodes: Readonly<Record<string, AnyNode>>): number;
/**
 * World/building-local Y for a wall-top preview rendered outside a level node.
 *
 * Roof nodes are parented to a level, so their stored position is relative to
 * that level's floor. The conical wall hover ghost is rendered directly in the
 * building group instead, and therefore needs the active level's world base
 * added back after resolving the level-relative placement.
 */
export declare function resolveRoofWallTopWorldElevation(targetLevelId: LevelNode['id'], wall: WallNode, nodes: Readonly<Record<string, AnyNode>>, elevations?: Map<string, import("@pascal-app/core").LevelElevation>): number;
//# sourceMappingURL=roof-footprint.d.ts.map
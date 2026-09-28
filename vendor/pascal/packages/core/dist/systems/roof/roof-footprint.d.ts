import type { AnyNode, LevelNode, WallNode } from '../../schema/index.js';
export type RoofFootprintTarget = {
    id: string;
    polygon: Array<[number, number]>;
    wallIds: WallNode['id'][];
    center: [number, number];
    width: number;
    depth: number;
    rotation: number;
    rectangular: boolean;
};
export declare function fitRoofFootprint(id: string, polygon: Array<[number, number]>, wallIds: WallNode['id'][]): RoofFootprintTarget | null;
export declare function resolveRoomRoofFootprint(levelId: LevelNode['id'], nodes: Readonly<Record<string, AnyNode>>, point: [number, number], options?: {
    rectangularOnly?: boolean;
}): RoofFootprintTarget | null;
export declare function resolveRoomRoofFootprintOnLevel(levelId: LevelNode['id'], nodes: Readonly<Record<string, AnyNode>>, point: [number, number]): RoofFootprintTarget | null;
//# sourceMappingURL=roof-footprint.d.ts.map
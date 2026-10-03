import type { WallNode } from '../schema/index.js';
type SceneNodes = Record<string, any>;
type Point = [number, number];
type IndexedRoom = {
    boundaryFaces: Array<{
        wallId: WallNode['id'];
    }>;
};
type IndexedLevelTopology<TRoom extends IndexedRoom> = {
    walls: Map<string, WallNode>;
    rooms: TRoom[];
    wallIdsByCell: Map<string, Set<string>>;
    cellKeysByWallId: Map<string, string[]>;
};
export type IndexedTopologyDelta<TRoom extends IndexedRoom> = {
    strategy: 'indexed' | 'fallback';
    beforeRooms: TRoom[];
    currentRooms: TRoom[];
    allCurrentRooms: TRoom[];
    previousWalls: WallNode[];
    currentWalls: WallNode[];
    examinedWallIds: string[];
};
type RoomTopologyIndexOptions<TRoom extends IndexedRoom> = {
    detectRooms: (walls: WallNode[]) => TRoom[];
    sampleWall: (wall: WallNode) => Point[];
    junctionTolerance: number;
};
export declare function distanceToSegment(point: Point, segStart: Point, segEnd: Point): number;
export declare class RoomTopologyIndex<TRoom extends IndexedRoom> {
    private readonly options;
    private readonly levels;
    private readonly queryMargin;
    constructor(options: RoomTopologyIndexOptions<TRoom>);
    rebuild(nodes: SceneNodes): void;
    rebuildLevel(levelId: string, nodes: SceneNodes): IndexedLevelTopology<TRoom>;
    applyWallDelta(levelId: string, changedWallIds: ReadonlySet<string>, beforeNodes: SceneNodes, currentNodes: SceneNodes): IndexedTopologyDelta<TRoom>;
    private wallsForLevel;
    private wallsFromNodes;
    private createLevel;
    private wallBbox;
    private cellKeysForWall;
    private removeWall;
    private setWall;
    private queryWalls;
    private wallsTouch;
    private connectedWallIds;
}
export {};
//# sourceMappingURL=room-topology-index.d.ts.map
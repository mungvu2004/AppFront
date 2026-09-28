import { type AnyNodeId, type CeilingNode as CeilingNodeType, type SlabNode as SlabNodeType, type WallNode, type ZoneNode as ZoneNodeType } from '../schema/index.js';
type Point2D = {
    x: number;
    y: number;
};
export type SpaceBoundaryFace = {
    wallId: WallNode['id'];
    face: 'front' | 'back';
    points: Array<[number, number]>;
};
export type Space = {
    id: string;
    levelId: string;
    polygon: Array<[number, number]>;
    wallIds: Array<WallNode['id']>;
    boundaryFaces: SpaceBoundaryFace[];
    isExterior: boolean;
};
export type SpaceTopologyReconcileEvent = {
    levelId: string;
    strategy: 'indexed' | 'fallback';
    examinedWallIds: string[];
    affectedBeforeRoomCount: number;
    affectedCurrentRoomCount: number;
};
export type SpaceDetectionSyncOptions = {
    onTopologyReconcile?: (event: SpaceTopologyReconcileEvent) => void;
};
type ExtractedRoom = {
    polygon: Point2D[];
    boundaryFaces: SpaceBoundaryFace[];
};
type WallSideUpdate = {
    wallId: string;
    frontSide: 'interior' | 'exterior' | 'unknown';
    backSide: 'interior' | 'exterior' | 'unknown';
};
export type AutoSlabSyncPlan = {
    create: SlabNodeType[];
    update: Array<{
        id: SlabNodeType['id'];
        data: Partial<SlabNodeType>;
    }>;
    delete: Array<SlabNodeType['id']>;
};
export type AutoSlabPlanningContext = {
    elevationForRoom?: (polygon: Array<[number, number]>) => number | undefined;
    previousElevationForRoom?: (polygon: Array<[number, number]>) => number | undefined;
};
export type AutoCeilingSyncPlan = {
    create: CeilingNodeType[];
    update: Array<{
        id: CeilingNodeType['id'];
        data: Partial<CeilingNodeType>;
    }>;
    delete: Array<CeilingNodeType['id']>;
    reparent: Array<{
        id: AnyNodeId;
        parentId: CeilingNodeType['id'];
    }>;
};
export type AutoZoneSyncPlan = {
    update: Array<{
        id: ZoneNodeType['id'];
        data: Partial<ZoneNodeType>;
    }>;
};
export type AutoCeilingPlanningContext = {
    /** Stored storey height of the level being planned (floor-to-floor). */
    storeyHeight?: number;
    /**
     * Stage 3-B clamp-bound resolver for a polygon on the planned level:
     * `min(storey plane, lowest covering-slab underside from the level
     * above) - CEILING_CLAMP_MARGIN` (see `getCeilingClampBound`). Absent
     * (pure-planner callers without a nodes record), the bound degrades to
     * the plane-only `storeyHeight - CEILING_CLAMP_MARGIN`.
     */
    ceilingClampBound?: (polygon: Array<[number, number]>) => number;
    heightForRoom?: (polygon: Array<[number, number]>) => number | undefined;
    previousHeightForRoom?: (polygon: Array<[number, number]>) => number | undefined;
    childPosition?: (childId: AnyNodeId) => [number, number] | undefined;
};
declare function bboxOf(points: Point2D[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
/**
 * True when `wall` lies on the boundary of a room enclosed by `walls`, using the
 * same planar room graph the auto slab/ceiling sync uses. The wall builder's
 * "Room (auto-close)" mode calls this so drafting stops the moment a segment
 * closes a room — whether the chain loops back to its own start or seals a bay
 * against the middle of an existing wall (a T-junction). Sharing one graph means
 * auto-close and auto-slab detection can never disagree about what is "closed".
 */
export declare function wallClosesRoom(walls: WallNode[], wall: WallNode): boolean;
export declare function resolveWallSurfaceSides(wall: Pick<WallNode, 'start' | 'end' | 'thickness' | 'frontSide' | 'backSide'>, roomPolygons: Point2D[][]): Pick<WallSideUpdate, 'frontSide' | 'backSide'>;
type BoundedPolygon = {
    polygon: Point2D[];
    bbox: ReturnType<typeof bboxOf>;
};
export declare function surfaceTouchesRooms(surface: BoundedPolygon, rooms: BoundedPolygon[]): boolean;
export declare function planAutoZonesForLevel(spaces: readonly Space[], existingZones: readonly ZoneNodeType[]): AutoZoneSyncPlan;
export declare function resolveAutoZonePolygon(zone: Pick<ZoneNodeType, 'autoFromWalls' | 'boundaryWallIds' | 'polygon'>, resolve: (id: AnyNodeId) => unknown): ZoneNodeType['polygon'];
export declare function planAutoSlabsForLevel(roomPolygons: Point2D[][], existingSlabs: SlabNodeType[], context?: AutoSlabPlanningContext, namingSlabs?: Array<{
    name?: string;
}>): AutoSlabSyncPlan;
export declare function planAutoCeilingsForLevel(roomPolygons: Point2D[][], existingCeilings: CeilingNodeType[], context?: AutoCeilingPlanningContext, namingCeilings?: Array<{
    name?: string;
}>): AutoCeilingSyncPlan;
export declare function detectSpacesForLevel(levelId: string, walls: WallNode[]): {
    rooms: ExtractedRoom[];
    roomPolygons: Point2D[][];
    spaces: Space[];
    wallUpdates: WallSideUpdate[];
};
/** Pause the wall-driven auto slab/ceiling sync. Refcounted — pair with `resumeSpaceDetection`. */
export declare function pauseSpaceDetection(): void;
/** Resume the wall-driven auto slab/ceiling sync. No-op if not currently paused. */
export declare function resumeSpaceDetection(): void;
/** True iff the wall-driven auto slab/ceiling sync is currently paused. */
export declare function isSpaceDetectionPaused(): boolean;
export declare function initSpaceDetectionSync(sceneStore: any, editorStore: any, options?: SpaceDetectionSyncOptions): () => void;
export declare function wallTouchesOthers(wall: WallNode, otherWalls: WallNode[]): boolean;
export {};
//# sourceMappingURL=space-detection.d.ts.map
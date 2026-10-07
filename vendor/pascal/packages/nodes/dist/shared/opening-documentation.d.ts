import type { AnyNode, DoorNode, FloorplanGeometry, WallNode, WindowNode } from '@pascal-app/core';
import { type FloorplanSchedule } from '@pascal-app/editor';
import { type ConstructionLengthProfile, type ConstructionLinearUnit } from './construction-length';
type OpeningNode = DoorNode | WindowNode;
export type OpeningConstructionType = 'framed' | 'masonry';
export type OpeningDimensionReference = 'nominal' | 'rough-opening' | 'masonry-opening' | 'finish-opening';
export type OpeningDimensionDocumentation = {
    constructionType: OpeningConstructionType;
    reference: OpeningDimensionReference;
    locationPolicy: 'centerline' | 'edge-to-edge';
    width: number | null;
    height: number | null;
    prefix: string;
    verified: boolean;
};
export type OpeningFloorplanLevelData = {
    markById: ReadonlyMap<string, string>;
    /** The drafted-sheet numbering, resolved on first use so the editor plan never pays for it. */
    draftingMarkById: () => ReadonlyMap<string, string>;
};
export declare function computeDoorFloorplanLevelData(args: {
    siblings: ReadonlyArray<DoorNode>;
    nodes: Record<string, AnyNode>;
}): OpeningFloorplanLevelData;
export declare function computeWindowFloorplanLevelData(args: {
    siblings: ReadonlyArray<WindowNode>;
    nodes: Record<string, AnyNode>;
}): OpeningFloorplanLevelData;
export declare function buildDoorFloorplanSchedule(args: {
    siblings: ReadonlyArray<DoorNode>;
    nodes: Readonly<Record<string, AnyNode>>;
    levelId: string;
    unit: ConstructionLinearUnit;
    profile?: ConstructionLengthProfile;
    drafting?: boolean;
}): FloorplanSchedule | null;
export declare function buildWindowFloorplanSchedule(args: {
    siblings: ReadonlyArray<WindowNode>;
    nodes: Readonly<Record<string, AnyNode>>;
    levelId: string;
    unit: ConstructionLinearUnit;
    profile?: ConstructionLengthProfile;
    drafting?: boolean;
}): FloorplanSchedule | null;
export declare const OPENING_TAG_HEIGHT: number;
export declare const OPENING_TAG_STROKE_WIDTH: number;
export declare const OPENING_TAG_FONT_SIZE: number;
export declare const OPENING_TAG_LEADER_WIDTH: number;
/** Clear distance from the wall face to the near edge of the tag. */
export declare const OPENING_TAG_STANDOFF: number;
export declare function buildOpeningMarkAnnotation(opening: OpeningNode, wall: WallNode, levelData: OpeningFloorplanLevelData | undefined, { preferredSide, stroke, drafting, }?: {
    preferredSide?: -1 | 1;
    stroke?: string;
    /** Sheet drafting: tag outside the exterior face, door hexagon / window ellipse, paper sizes. */
    drafting?: boolean;
}): FloorplanGeometry | null;
export declare function resolveOpeningDimensionDocumentation(opening: OpeningNode): OpeningDimensionDocumentation;
export {};
//# sourceMappingURL=opening-documentation.d.ts.map
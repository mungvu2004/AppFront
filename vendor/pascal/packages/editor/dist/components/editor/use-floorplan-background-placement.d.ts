import { type FenceNode, type WallNode } from '@pascal-app/core';
import { type MouseEvent as ReactMouseEvent } from 'react';
import { type WallPlanPoint } from '../tools/wall/wall-drafting';
type UseFloorplanBackgroundPlacementArgs = {
    activePolygonDraftPoints: WallPlanPoint[];
    ceilingDraftPoints: WallPlanPoint[];
    clearFencePlacementDraft: () => void;
    clearRoofPlacementDraft: () => void;
    clearWallPlacementDraft: () => void;
    emitFloorplanGridEvent: (type: 'click' | 'double-click' | 'move', planPoint: WallPlanPoint, event: ReactMouseEvent<SVGSVGElement>) => void;
    fenceDraftStart: WallPlanPoint | null;
    fences: FenceNode[];
    findClosestWallPoint: (point: WallPlanPoint, walls: WallNode[], options?: {
        canUseWall?: (wall: WallNode) => boolean;
    }) => {
        normal: [number, number, number];
        point: WallPlanPoint;
        t: number;
        wall: WallNode;
    } | null;
    floorplanOpeningLocalY: number;
    getSnappedFloorplanPoint: (point: WallPlanPoint) => WallPlanPoint;
    handleCeilingItemPlacementClick: (planPoint: WallPlanPoint, nativeEvent: ReactMouseEvent<SVGSVGElement>) => boolean;
    handleCeilingPlacementPoint: (point: WallPlanPoint) => void;
    handleSlabPlacementPoint: (point: WallPlanPoint) => void;
    handleWallPlacementPoint: (point: WallPlanPoint) => void;
    handleZonePlacementPoint: (point: WallPlanPoint) => void;
    isCeilingBuildActive: boolean;
    isCeilingItemPlacementActive: boolean;
    isFenceBuildActive: boolean;
    isFloorplanGridInteractionActive: boolean;
    isOpeningPlacementActive: boolean;
    isPolygonBuildActive: boolean;
    isRoofBuildActive: boolean;
    isWallBuildActive: boolean;
    isZoneBuildActive: boolean;
    levelId: string | null;
    registryToolOwnsSnapping: boolean;
    roofDraftStart: WallPlanPoint | null;
    setCursorPoint: React.Dispatch<React.SetStateAction<WallPlanPoint | null>>;
    setFenceDraftEnd: React.Dispatch<React.SetStateAction<WallPlanPoint | null>>;
    setFenceDraftStart: React.Dispatch<React.SetStateAction<WallPlanPoint | null>>;
    setRoofDraftEnd: React.Dispatch<React.SetStateAction<WallPlanPoint | null>>;
    setRoofDraftStart: React.Dispatch<React.SetStateAction<WallPlanPoint | null>>;
    snapWallDraftPoint: (args: {
        point: WallPlanPoint;
        walls: WallNode[];
        start?: WallPlanPoint;
        angleSnap?: boolean;
        bypassSnap?: boolean;
        step?: number;
        gridSnap?: (point: WallPlanPoint) => WallPlanPoint;
    }) => WallPlanPoint;
    snapPolygonDraftPoint: (args: {
        point: WallPlanPoint;
        start?: WallPlanPoint;
        angleSnap: boolean;
    }) => WallPlanPoint;
    toPoint2D: (point: WallPlanPoint) => {
        x: number;
        y: number;
    };
    walls: WallNode[];
    /**
     * Snap a building-local plan point to the world XZ grid at `step`.
     * Injected so the hook doesn't have to know the building's rotation
     * or position — used by wall / fence branches that snap at variable
     * step.
     */
    worldGridSnap: (point: WallPlanPoint, step: number) => WallPlanPoint;
};
export declare function useFloorplanBackgroundPlacement({ activePolygonDraftPoints, ceilingDraftPoints, clearFencePlacementDraft, clearRoofPlacementDraft, clearWallPlacementDraft, emitFloorplanGridEvent, fenceDraftStart, fences, findClosestWallPoint, floorplanOpeningLocalY, getSnappedFloorplanPoint, handleCeilingItemPlacementClick, handleCeilingPlacementPoint, handleSlabPlacementPoint, handleWallPlacementPoint, handleZonePlacementPoint, isCeilingBuildActive, isCeilingItemPlacementActive, isFenceBuildActive, isFloorplanGridInteractionActive, isOpeningPlacementActive, isPolygonBuildActive, isRoofBuildActive, isWallBuildActive, isZoneBuildActive, levelId, registryToolOwnsSnapping, roofDraftStart, setCursorPoint, setFenceDraftEnd, setFenceDraftStart, setRoofDraftEnd, setRoofDraftStart, snapWallDraftPoint, snapPolygonDraftPoint, toPoint2D, walls, worldGridSnap, }: UseFloorplanBackgroundPlacementArgs): {
    handleBackgroundPlacementClick: (planPoint: WallPlanPoint, event: ReactMouseEvent<SVGSVGElement>, draftStart: WallPlanPoint | null) => boolean;
};
export {};
//# sourceMappingURL=use-floorplan-background-placement.d.ts.map
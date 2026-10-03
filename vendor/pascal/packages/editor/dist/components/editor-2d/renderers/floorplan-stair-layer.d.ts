import type { Point2D, StairNode, StairSegmentNode } from '@pascal-app/core';
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
type FloorplanPolygonEntry = {
    points: string;
    polygon: Point2D[];
};
type FloorplanStairSegmentEntry = {
    segment: StairSegmentNode;
    points: string;
    treadBars: FloorplanPolygonEntry[];
};
type FloorplanStairArrowEntry = {
    head: Point2D[];
    polyline: Point2D[];
};
type FloorplanStairEntry = {
    arrow: FloorplanStairArrowEntry | null;
    hitPolygons: Point2D[][];
    stair: StairNode;
    segments: FloorplanStairSegmentEntry[];
};
type FloorplanPalette = {
    deleteFill: string;
    deleteStroke: string;
    stairFill: string;
    stairSelectedFill: string;
    stairStroke: string;
    stairAccent: string;
    stairTread: string;
    stairSelectedTread: string;
};
type FloorplanStairLayerProps = {
    canFocusStairs: boolean;
    canSelectStairs: boolean;
    cursor: string;
    highlightedIdSet: ReadonlySet<string>;
    hitStrokeWidth: number;
    hoveredStairId: StairNode['id'] | null;
    isDeleteMode: boolean;
    onStairDoubleClick: (stair: StairNode, event: ReactMouseEvent<SVGElement>) => void;
    onStairHoverChange: (stairId: StairNode['id'] | null) => void;
    onStairHoverEnter: (stairId: StairNode['id']) => void;
    onStairPointerDown: (stairId: StairNode['id'], event: ReactPointerEvent<SVGElement>) => void;
    onStairSelect: (stairId: StairNode['id'], event: ReactMouseEvent<SVGElement>) => void;
    palette: FloorplanPalette;
    selectedIdSet: ReadonlySet<string>;
    stairEntries: FloorplanStairEntry[];
};
export declare const FloorplanStairLayer: import("react").MemoExoticComponent<({ canFocusStairs, canSelectStairs, cursor, highlightedIdSet, hitStrokeWidth, hoveredStairId, isDeleteMode, onStairDoubleClick, onStairHoverChange, onStairHoverEnter, onStairPointerDown, onStairSelect, palette, selectedIdSet, stairEntries, }: FloorplanStairLayerProps) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-stair-layer.d.ts.map
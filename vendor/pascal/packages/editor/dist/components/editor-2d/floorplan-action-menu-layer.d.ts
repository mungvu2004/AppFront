import { type MouseEvent as ReactMouseEvent } from 'react';
type SvgPoint = {
    x: number;
    y: number;
};
export type FloorplanActionMenuHandler = (event: ReactMouseEvent<HTMLButtonElement>) => void;
export type FloorplanActionMenuEntry = {
    position: SvgPoint | null;
    onDelete: FloorplanActionMenuHandler;
    onMove?: FloorplanActionMenuHandler;
    onAddHole?: FloorplanActionMenuHandler;
    onCurve?: FloorplanActionMenuHandler;
    onDuplicate?: FloorplanActionMenuHandler;
};
type FloorplanActionMenuLayerProps = {
    elevator: FloorplanActionMenuEntry;
    item: FloorplanActionMenuEntry;
    wall: FloorplanActionMenuEntry;
    fence: FloorplanActionMenuEntry;
    slab: FloorplanActionMenuEntry;
    ceiling: FloorplanActionMenuEntry;
    opening: FloorplanActionMenuEntry;
    spawn: FloorplanActionMenuEntry;
    stair: FloorplanActionMenuEntry;
    roof: FloorplanActionMenuEntry;
    offsetY?: number;
};
export declare const FloorplanActionMenuLayer: import("react").MemoExoticComponent<({ elevator, item, wall, fence, slab, ceiling, opening, spawn, stair, roof, offsetY, }: FloorplanActionMenuLayerProps) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-action-menu-layer.d.ts.map
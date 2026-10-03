export type ScreenRect = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export declare const SCREEN_RECTANGLE_SELECTION_DRAG_THRESHOLD_PX = 4;
export declare function createScreenRectangleSelectionElement(): HTMLDivElement;
export declare function normalizeScreenRect(startX: number, startY: number, endX: number, endY: number): ScreenRect;
export declare function screenRectFromDomRect(rect: DOMRect | DOMRectReadOnly): ScreenRect;
export declare function screenRectsIntersect(a: ScreenRect, b: ScreenRect): boolean;
export declare function intersectScreenRects(a: ScreenRect, b: ScreenRect): ScreenRect | null;
export declare function updateScreenRectangleSelectionElement(element: HTMLDivElement, rect: ScreenRect): void;
export declare function hideScreenRectangleSelectionElement(element: HTMLDivElement | null): void;
//# sourceMappingURL=screen-rectangle-selection.d.ts.map
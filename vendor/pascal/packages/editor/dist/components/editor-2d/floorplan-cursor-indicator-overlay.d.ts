import { type FloorplanSelectionTool } from '../../store/use-editor';
import { type FloorplanCursorPoint } from './floorplan-cursor-indicator-position';
type FloorplanCursorIndicatorOverlayProps = {
    cursorPosition: FloorplanCursorPoint | null;
    floorplanSelectionTool: FloorplanSelectionTool;
    movingOpeningType: 'door' | 'window' | null;
    isPanning: boolean;
    cursorColor: string;
    indicatorLineHeight?: number;
    indicatorBadgeOffsetX?: number;
    indicatorBadgeOffsetY?: number;
};
export declare const FloorplanCursorIndicatorOverlay: import("react").MemoExoticComponent<({ cursorPosition, floorplanSelectionTool, movingOpeningType, isPanning, cursorColor, indicatorLineHeight, indicatorBadgeOffsetX, indicatorBadgeOffsetY, }: FloorplanCursorIndicatorOverlayProps) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-cursor-indicator-overlay.d.ts.map
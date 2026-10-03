type SvgLine = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
type FloorplanDraftLayerProps = {
    draftPolygonPoints: string | null;
    linearDraftSegment: SvgLine | null;
    polygonDraftPolygonPoints: string | null;
    polygonDraftPolylinePoints: string | null;
    polygonDraftClosingSegment: SvgLine | null;
    draftAnchorPoints: Array<{
        x: number;
        y: number;
        isPrimary: boolean;
    }>;
    draftFill: string;
    draftStroke: string;
    polygonDraftStroke?: string;
    polygonDraftStrokeWidth?: string;
    anchorFill: string;
    unitsPerPixel: number;
};
export declare const FloorplanDraftLayer: import("react").MemoExoticComponent<({ draftPolygonPoints, linearDraftSegment, polygonDraftPolygonPoints, polygonDraftPolylinePoints, polygonDraftClosingSegment, draftAnchorPoints, draftFill, draftStroke, polygonDraftStroke, polygonDraftStrokeWidth, anchorFill, unitsPerPixel, }: FloorplanDraftLayerProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=floorplan-draft-layer.d.ts.map
type SvgSelectionBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};
type FloorplanMarqueeLayerProps = {
    bounds: SvgSelectionBounds | null;
    cursorColor: string;
    outlineWidth: number;
    glowWidth: number;
};
export declare const FloorplanMarqueeLayer: import("react").MemoExoticComponent<({ bounds, cursorColor, outlineWidth, glowWidth, }: FloorplanMarqueeLayerProps) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-marquee-layer.d.ts.map
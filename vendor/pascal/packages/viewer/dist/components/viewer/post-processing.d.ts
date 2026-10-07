export declare const GRADE_PARAMS: {
    contrast: number;
    saturation: number;
};
export declare const SSGI_PARAMS: {
    enabled: boolean;
    sliceCount: number;
    stepCount: number;
    radius: number;
    expFactor: number;
    thickness: number;
    backfaceLighting: number;
    aoIntensity: number;
    giIntensity: number;
    useLinearThickness: boolean;
    useScreenSpaceSampling: boolean;
    useTemporalFiltering: boolean;
};
export type HoverStyle = {
    visibleColor: number;
    hiddenColor: number;
    strength: number;
    pulse: boolean;
};
export type HoverStyles = {
    default: HoverStyle;
} & Record<string, HoverStyle>;
export declare const DEFAULT_HOVER_STYLES: HoverStyles;
declare const PostProcessingPasses: ({ hoverStyles, disablePostFx, }: {
    hoverStyles?: HoverStyles;
    /** Host-controlled equivalent of `?disable=postFx` — see the Viewer prop. */
    disablePostFx?: boolean;
}) => null;
export default PostProcessingPasses;
//# sourceMappingURL=post-processing.d.ts.map
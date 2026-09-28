export type ViewerControlsBarProps = {
    canShowScans?: boolean;
    canShowGuides?: boolean;
    /** A baked GLB is the active artifact: hide controls it can't honor (wall
     *  modes aren't baked into the GLB). */
    glbActive?: boolean;
    /** In GLB mode, whether scans/guides were re-added from scene data — so the
     *  visibility control surfaces the matching toggle even though the artifact
     *  itself carries none. */
    glbHasScans?: boolean;
    glbHasGuides?: boolean;
    walkthroughActive?: boolean;
    onWalkthroughToggle: () => void;
    className?: string;
};
export declare const ViewerControlsBar: ({ canShowScans, canShowGuides, glbActive, glbHasScans, glbHasGuides, walkthroughActive, onWalkthroughToggle, className, }: ViewerControlsBarProps) => import("react").JSX.Element;
//# sourceMappingURL=viewer-controls-bar.d.ts.map
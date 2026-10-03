export declare const VIEWER_STAGE_MODES: readonly ["3d", "2d", "split"];
export type ViewerStageMode = (typeof VIEWER_STAGE_MODES)[number];
export declare function normalizeViewerStageModes(modes: readonly ViewerStageMode[] | undefined): readonly ViewerStageMode[];
export declare function resolveViewerStageMode(mode: ViewerStageMode | undefined, modes: readonly ViewerStageMode[]): ViewerStageMode;
export declare function resolveMobileViewerStageMode(mode: ViewerStageMode, modes: readonly ViewerStageMode[]): ViewerStageMode;
export declare function viewerStageIncludes3D(modes: readonly ViewerStageMode[]): boolean;
//# sourceMappingURL=viewer-stage-modes.d.ts.map
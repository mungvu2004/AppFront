export type FloorplanPresentationViewBox = {
    minX: number;
    minY: number;
    width: number;
    height: number;
};
export declare function setFloorplanCompassRotation(compass: {
    style: {
        transform: string;
    };
} | null, rotationDeg: number): void;
type FloorplanRotationPresentation = {
    svg: {
        style: {
            transform: string;
            transformOrigin: string;
            willChange: string;
        };
    };
    svgStyle: {
        transform: string;
        transformOrigin: string;
        willChange: string;
    };
};
export declare function queueFloorplanRotationPresentationRestore<Presentation extends FloorplanRotationPresentation>(pending: {
    current: Presentation | null;
}, presentation: Presentation): void;
export declare function flushFloorplanRotationPresentationRestore<Presentation extends FloorplanRotationPresentation>(pending: {
    current: Presentation | null;
}): void;
export declare function getFloorplanRotationOverscanViewBox(viewBox: FloorplanPresentationViewBox): FloorplanPresentationViewBox;
export declare function resolveFloorplanPresentationViewBox(reactViewBox: FloorplanPresentationViewBox, imperativeViewBox: FloorplanPresentationViewBox | null, interactionInProgress: boolean): FloorplanPresentationViewBox;
export declare function canZoomFloorplanDuringNavigation(rotationInProgress: boolean): boolean;
export declare function canApplyFloorplanNavigationSync(interactionInProgress: boolean): boolean;
export type FloorplanNavigationSyncScheduler<Pose> = {
    update: (pose: Pose) => void;
    flush: () => void;
    discard: () => void;
};
export declare function createFloorplanNavigationSyncScheduler<Pose>({ applyPresentation, commit, settleMs, schedule, cancel, }: {
    applyPresentation: (pose: Pose) => void;
    commit: (pose: Pose) => void;
    settleMs?: number;
    schedule?: (callback: () => void, delay: number) => ReturnType<typeof globalThis.setTimeout>;
    cancel?: (timer: ReturnType<typeof globalThis.setTimeout>) => void;
}): FloorplanNavigationSyncScheduler<Pose>;
export declare function finalizeFloorplanNavigation<RotationState>({ zoomPending, panActive, rotationState, commitZoom, commitPan, commitRotation, }: {
    zoomPending: boolean;
    panActive: boolean;
    rotationState: RotationState | null;
    commitZoom: () => void;
    commitPan: () => void;
    commitRotation: (rotationState: RotationState) => void;
}): void;
export {};
//# sourceMappingURL=floorplan-navigation-presentation.d.ts.map
export declare function resolveFloorplanLabelAngle(angleRadians: number, sceneRotationDeg: number, screenUpright?: boolean): number;
export declare function shouldUpdateFloorplanLabelRotation(previousRotationDeg: number | null, nextRotationDeg: number, minimumDeltaDeg?: number): boolean;
export declare function resolveFloorplanAnnotationUpdate({ layoutInputsChanged, previousRotationDeg, nextRotationDeg, }: {
    layoutInputsChanged: boolean;
    previousRotationDeg: number | null;
    nextRotationDeg: number;
}): {
    resolveCollisions: boolean;
    updateLabelPresentation: boolean;
};
export declare function resolveFloorplanAnnotationLabelTransform({ angleRadians, sceneRotationDeg, screenUpright, beforeRotation, afterRotation, layoutDx, layoutDy, }: {
    angleRadians: number;
    sceneRotationDeg: number;
    screenUpright: boolean;
    beforeRotation: string;
    afterRotation: string;
    layoutDx?: number;
    layoutDy?: number;
}): {
    defaultTransform: string;
    transform: string;
};
export declare function updateSvgFloorplanLabelOrientations(labels: Iterable<SVGGElement>, sceneRotationDeg: number): number;
//# sourceMappingURL=floorplan-label-angle.d.ts.map
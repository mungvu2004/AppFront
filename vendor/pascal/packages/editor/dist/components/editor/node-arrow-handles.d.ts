export { ARROW_COLOR, ARROW_HOVER_COLOR, ARROW_SCALE, createArrowHandleGeometry, createArrowHitAreaGeometry, createEndpointHitAreaGeometry, createMoveCrossHandleGeometry, createRotateArrowHandleGeometry, createRotateArrowHitAreaGeometry, HandleArrow, type HandleArrowInputShape, type HandleArrowPlacement, type HandleArrowProps, HIT_AREA_MARGIN, InvisibleHandleHitArea, NO_RAYCAST, useArrowMaterial, useInvisibleHitAreaMaterial, } from './handles/handle-arrow';
export { swallowNextClick } from './handles/use-handle-drag';
export declare function NodeArrowHandles(): import("react").JSX.Element | null;
export declare function GuideRing({ center, radius, y, }: {
    center?: readonly [number, number, number];
    radius: number;
    y: number;
}): import("react").JSX.Element;
export type RotationGuideData = {
    center: [number, number, number];
    startAngle: number;
    endAngle: number;
    radius: number;
    labelPos: [number, number, number];
    /** Swept magnitude in radians, for the degree chip. */
    sweep: number;
};
export declare function RotationGuide({ data }: {
    data: RotationGuideData;
}): import("react").JSX.Element;
//# sourceMappingURL=node-arrow-handles.d.ts.map
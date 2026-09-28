import type { WallPlanPoint } from '@pascal-app/core';
/** Length plate + angle arcs for a drafted wall segment, in plan space. */
export type DraftWallMeasurement = {
    lengthLabel: string;
    midpoint: WallPlanPoint;
    direction: WallPlanPoint;
    angleLabels: {
        id: string;
        label: string;
        center: WallPlanPoint;
        radius: number;
        startAngle: number;
        endAngle: number;
        midAngle: number;
    }[];
};
export declare function FloorplanDraftWallMeasurement({ measurement, measurementStroke, labelBackground, labelText, sceneRotationDeg, unitsPerPixel, }: {
    measurement: DraftWallMeasurement;
    measurementStroke: string;
    labelBackground: string;
    labelText: string;
    sceneRotationDeg: number;
    unitsPerPixel: number;
}): import("react").JSX.Element;
//# sourceMappingURL=floorplan-draft-wall-measurement.d.ts.map
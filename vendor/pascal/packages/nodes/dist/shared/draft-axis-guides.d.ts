import { type WallPlanPoint } from '@pascal-app/editor';
export type DraftAngleLabel = {
    id: string;
    label: string;
    position: [number, number, number];
    arc: {
        center: WallPlanPoint;
        radius: number;
        startAngle: number;
        endAngle: number;
        y: number;
    };
};
export type DraftAxisGuideState = {
    origin: WallPlanPoint;
    endOrigin: WallPlanPoint | null;
    y: number;
    angleLabel: DraftAngleLabel | null;
} | null;
export declare function getNearestAxisAngleLabel(start: WallPlanPoint, end: WallPlanPoint, y: number): DraftAngleLabel | null;
export declare function DraftAxisGuides({ guide, labelColor, labelShadowColor, }: {
    guide: DraftAxisGuideState;
    labelColor: string;
    labelShadowColor: string;
}): import("react").JSX.Element | null;
export declare function DraftAngleArc({ arc, color }: {
    arc: DraftAngleLabel['arc'];
    color: string;
}): import("react").JSX.Element;
//# sourceMappingURL=draft-axis-guides.d.ts.map
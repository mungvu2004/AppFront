import { type MeasurementAxisGuide, type MeasurementPoint } from '../../store/use-measurement-draft';
type PlanPoint = {
    x: number;
    z: number;
};
type ProjectedSnapPoint = PlanPoint & {
    nodeId: string;
};
type ProjectedSnapSegment = {
    start: ProjectedSnapPoint;
    end: ProjectedSnapPoint;
    nodeId: string;
};
export type ProjectedFloorplanSnap = {
    kind: 'vertex' | 'edge';
    nodeId: string;
    point: PlanPoint;
};
export declare function resolveProjectedFloorplanSnap(pointer: PlanPoint, vertices: readonly ProjectedSnapPoint[], segments: readonly ProjectedSnapSegment[], vertexThreshold?: number, edgeThreshold?: number): ProjectedFloorplanSnap | null;
export declare function isProjectedFloorplanAxisPointVerified(candidate: PlanPoint, nodeId: string, vertices: readonly ProjectedSnapPoint[], segments: readonly ProjectedSnapSegment[], tolerance?: number): boolean;
export declare function resolveFloorplanMeasurementAxisSnap(raw: MeasurementPoint, anchor: MeasurementPoint, xAxisScreenDistance: number, zAxisScreenDistance: number, threshold?: number, lockedAxis?: 'x' | 'z' | null, releaseThreshold?: number, proximity?: boolean): {
    point: MeasurementPoint;
    guide: MeasurementAxisGuide;
};
export declare function FloorplanMeasurementToolLayer(): import("react").JSX.Element | null;
export default FloorplanMeasurementToolLayer;
//# sourceMappingURL=floorplan-measurement-tool-layer.d.ts.map
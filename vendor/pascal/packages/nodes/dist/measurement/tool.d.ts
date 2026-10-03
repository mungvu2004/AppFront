import { type AlignmentAnchor, type MeasurementFeatureAnchor, type MeasurementSnapKind } from '@pascal-app/core';
import { type LinearUnit, type MeasurementAxis, type MeasurementAxisGuide, type MeasurementKind, type MeasurementPoint } from '@pascal-app/editor';
import { type FC } from 'react';
import { type Camera, type Intersection, type Object3D, Raycaster, Vector2, Vector3 } from 'three';
import { type MeasurementSurfacePreference } from './surface-query';
export type MeasurementRaycastContext = {
    ownerByObject: Map<Object3D, string>;
    roots: Object3D[];
};
export type WorldSurfaceHit = {
    intersection: Intersection<Object3D>;
    targetNodeId: string | null;
};
export type LocalSurfaceHit = {
    point: MeasurementPoint;
    normal: MeasurementPoint;
    targetNodeId: string | null;
};
export type MeasurementAxisProjection = {
    axis: MeasurementAxis;
    point: MeasurementPoint;
};
export type MeasurementAxisSurfaceIntersection = {
    axis: MeasurementAxis;
    point: MeasurementPoint;
};
type MeasurementAxisCandidate = MeasurementAxisProjection & {
    anchor?: MeasurementPoint;
    proximity?: boolean;
    screenDistance: number;
    verified: boolean;
};
export declare function projectMeasurementPointToAxes(anchor: MeasurementPoint, point: MeasurementPoint): MeasurementAxisProjection[];
export declare function projectMeasurementPointToPlanarAxes(anchor: MeasurementPoint, point: MeasurementPoint): MeasurementAxisProjection[];
export declare function selectClosestVerifiedAxisProjection(candidates: readonly MeasurementAxisCandidate[], threshold?: number, lockedAxis?: MeasurementAxis | null, releaseThreshold?: number, lockedFrom?: MeasurementPoint | null): MeasurementAxisProjection | null;
export declare function selectAxisCandidateForSurfaceVerification<T extends MeasurementAxisCandidate>(candidates: readonly T[], threshold?: number, lockedAxis?: MeasurementAxis | null, releaseThreshold?: number, lockedFrom?: MeasurementPoint | null): T | null;
export declare function measurementVertexSnapAnchors(points: readonly MeasurementPoint[], index: number, polygon: boolean): MeasurementPoint[];
export declare function selectClosestMeasurementVertexIndex(screenDistances: readonly number[], threshold?: number): number | null;
export declare function measurementPolygonSurfacePreference(kind: MeasurementKind, plane: {
    point: MeasurementPoint;
    normal: MeasurementPoint;
} | null, applyMagneticSnap: boolean): MeasurementSurfacePreference | null;
export declare function isMeasurementSurfaceMaterialVisible(object: Object3D, materialIndex?: number): boolean;
export declare function isMeasurementSurfaceEligible(object: Object3D): boolean;
export declare function collectMeasurementSurfaceRoots(scene: Object3D, registeredRoots: readonly Object3D[]): Object3D[];
export declare function castVisibleMeasurementSurface(raycaster: Raycaster, context: MeasurementRaycastContext): WorldSurfaceHit | null;
export declare function collectMeasurementAxisSurfaceIntersections(scene: Object3D, levelObject: Object3D, anchor: MeasurementPoint, maxDistance?: number): MeasurementAxisSurfaceIntersection[];
export declare function measurementIntersectionWorldNormal(intersection: Intersection<Object3D>): Vector3;
export declare function resolveSurfacePoint(event: MouseEvent | PointerEvent, camera: Camera, canvas: HTMLCanvasElement, raycaster: Raycaster, pointer: Vector2, scene: Object3D, levelObject: Object3D, anchorOrAnchors: MeasurementPoint | readonly MeasurementPoint[] | null, lockedGuide?: MeasurementAxisGuide | null, planarProximityAnchors?: readonly AlignmentAnchor[]): {
    hit: LocalSurfaceHit;
    guide: MeasurementAxisGuide | null;
} | null;
export declare function associateSurfaceHit(hit: LocalSurfaceHit, maxDistance?: number): LocalSurfaceHit & {
    anchor?: MeasurementFeatureAnchor;
    semantic?: {
        label: string;
        length: number | null;
        snapKind: MeasurementSnapKind;
    };
};
export declare function closestMeasurementExtrusionHeight(rayOrigin: MeasurementPoint, rayDirection: MeasurementPoint, axisOrigin: MeasurementPoint, axisDirection: MeasurementPoint): number | null;
export declare function parseMeasurementExtrusionHeight(value: string, unit: LinearUnit): number | null;
export declare function localNormalToPreviewFrame(levelObject: Object3D, buildingObject: Object3D | null, normal: MeasurementPoint): Vector3;
export declare function buildMeasurementDraftLinePositions(points: readonly Vector3[], dashSize?: number, gapSize?: number): number[];
export declare const MeasurementTool: FC;
export default MeasurementTool;
//# sourceMappingURL=tool.d.ts.map
import { type AlignmentAnchor, type MeasurementFeatureAnchor, type MeasurementSnapKind } from '@pascal-app/core';
import type { MeasurementAxis, MeasurementAxisGuide, MeasurementPoint } from '@pascal-app/editor';
import { type Camera, type Intersection, type Object3D, Raycaster, Vector3 } from 'three';
export type MeasurementRaycastContext = {
    ownerByObject: Map<Object3D, string>;
    roots: Object3D[];
    includeZoneLayer?: boolean;
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
export type MeasurementSurfacePreference = {
    kind: 'horizontal';
} | {
    kind: 'plane';
    point: MeasurementPoint;
    normal: MeasurementPoint;
};
export type MeasurementAxisProjection = {
    axis: MeasurementAxis;
    point: MeasurementPoint;
};
export type MeasurementAxisSurfaceIntersection = {
    axis: MeasurementAxis;
    normal: MeasurementPoint;
    point: MeasurementPoint;
};
export type MeasurementAxisCandidate = MeasurementAxisProjection & {
    anchor?: MeasurementPoint;
    proximity?: boolean;
    screenDistance: number;
    verified: boolean;
};
export type MeasurementSurfaceQuerySession = {
    resolvePointer(args: {
        event: MouseEvent | PointerEvent;
        camera: Camera;
        canvas: HTMLCanvasElement;
        levelObject: Object3D;
        anchorOrAnchors: MeasurementPoint | readonly MeasurementPoint[] | null;
        lockedGuide?: MeasurementAxisGuide | null;
        planarProximityAnchors?: readonly AlignmentAnchor[];
        surfacePreference?: MeasurementSurfacePreference | null;
        applyMagneticSnap: boolean;
        showAlignmentGuides: boolean;
    }): {
        hit: LocalSurfaceHit;
        guide: MeasurementAxisGuide | null;
    } | null;
    collectAxisIntersections(args: {
        levelObject: Object3D;
        anchor: MeasurementPoint;
        maxDistance?: number;
    }): MeasurementAxisSurfaceIntersection[];
    invalidate(): void;
    dispose(): void;
};
export declare function projectMeasurementPointToAxes(anchor: MeasurementPoint, point: MeasurementPoint): MeasurementAxisProjection[];
export declare function projectMeasurementPointToPlanarAxes(anchor: MeasurementPoint, point: MeasurementPoint): MeasurementAxisProjection[];
export declare function selectClosestVerifiedAxisProjection(candidates: readonly MeasurementAxisCandidate[], threshold?: number, lockedAxis?: MeasurementAxis | null, releaseThreshold?: number, lockedFrom?: MeasurementPoint | null): MeasurementAxisProjection | null;
export declare function selectAxisCandidateForSurfaceVerification<T extends MeasurementAxisCandidate>(candidates: readonly T[], threshold?: number, lockedAxis?: MeasurementAxis | null, releaseThreshold?: number, lockedFrom?: MeasurementPoint | null): T | null;
export declare function measurementVertexSnapAnchors(points: readonly MeasurementPoint[], index: number, polygon: boolean): MeasurementPoint[];
export declare function selectClosestMeasurementVertexIndex(screenDistances: readonly number[], threshold?: number): number | null;
export declare function isMeasurementSurfaceMaterialVisible(object: Object3D, materialIndex?: number): boolean;
export declare function collectMeasurementSurfaceRoots(scene: Object3D, registeredRoots: readonly Object3D[]): Object3D[];
export declare function createMeasurementRaycastContext(scene: Object3D, options?: {
    includeZoneLayer?: boolean;
}): MeasurementRaycastContext;
export declare function castVisibleMeasurementSurface(raycaster: Raycaster, context: MeasurementRaycastContext): WorldSurfaceHit | null;
export declare function measurementIntersectionWorldNormal(intersection: Intersection<Object3D>): Vector3;
export declare function selectMeasurementSurfaceHit(hits: readonly WorldSurfaceHit[], levelObject: Object3D, preference: MeasurementSurfacePreference | null): WorldSurfaceHit | null;
export declare function worldPointScreenDistance(point: Vector3, event: MouseEvent | PointerEvent, camera: Camera, canvas: HTMLCanvasElement): number;
export declare function createMeasurementSurfaceQuerySession(scene: Object3D, options?: {
    includeZoneLayer?: boolean;
}): MeasurementSurfaceQuerySession;
export declare function associateSurfaceHit(hit: LocalSurfaceHit, maxDistance?: number): LocalSurfaceHit & {
    anchor?: MeasurementFeatureAnchor;
    semantic?: {
        label: string;
        length: number | null;
        snapKind: MeasurementSnapKind;
    };
};
//# sourceMappingURL=surface-query.d.ts.map
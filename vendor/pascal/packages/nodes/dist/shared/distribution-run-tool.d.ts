import { type AnyNodeId } from '@pascal-app/core';
import { type DimensionPillPart } from '@pascal-app/editor';
import { type RefObject } from 'react';
import { type Group } from 'three';
import type { RunSurfaceTarget } from './distribution-run-contract';
import type { RunBodyHit, ScenePort } from './ports';
import { type RunDirectionMode } from './run-direction-feedback';
import { type PortScreenPoint } from './run-port-snap';
export type RunPoint = [number, number, number];
export type RunSurfaceFrame = {
    origin: RunPoint;
    normal: RunPoint;
    tangent: RunPoint;
    bitangent: RunPoint;
};
export type RunConnection = {
    port: ScenePort | null;
    body: RunBodyHit | null;
};
export type RunCommitResult = {
    nextStart: RunPoint;
    nextConnection: RunConnection;
};
export type RunCursorRay = {
    origin: RunPoint;
    direction: RunPoint;
};
export type CameraDirectionProjection = {
    point: RunPoint;
    direction: RunPoint;
};
type RunWallSurfaceTarget = Extract<RunSurfaceTarget, {
    kind: 'wall';
}>;
export declare function shouldLockRunWallSurface(target: RunSurfaceTarget | null | undefined, connection: RunConnection): target is RunWallSurfaceTarget;
export declare function isSameRunWallSurface(target: RunWallSurfaceTarget, hit: {
    kind?: string;
    hostId?: string;
    face?: string;
    side?: string;
} | undefined): boolean;
/** Build a stable 2D drawing frame for a floor, wall, ceiling, or sloped face. */
export declare function createRunSurfaceFrame(origin: readonly number[], surfaceNormal?: readonly number[]): RunSurfaceFrame;
export declare function projectRunPointToSurface(point: readonly number[], frame: RunSurfaceFrame): RunPoint;
export declare function snapRunPointToSurface(point: readonly number[], frame: RunSurfaceFrame, step: number): RunPoint;
export declare function projectRunToSurfaceAngleLock(from: readonly number[], raw: readonly number[], frame: RunSurfaceFrame, sourceDirection?: readonly number[] | null): RunPoint;
type DistributionRunToolConfig = {
    active: boolean;
    levelId: AnyNodeId | null;
    toolName: 'duct-segment' | 'pipe-segment';
    initialStart?: RunPoint | null;
    initialConnection?: RunConnection | null;
    getPorts: () => ScenePort[];
    findBody: (point: RunPoint, surface: RunSurfaceTarget | null) => RunBodyHit | null;
    surfaceClearance?: (surface: RunSurfaceTarget | null) => number;
    resolveFreeEnd?: (start: RunPoint, end: RunPoint, startConnection: RunConnection) => RunPoint;
    /** Minimum drawable centerline length, including fitting clearance. */
    minimumSegmentLength?: number;
    inheritFromConnection?: (connection: RunConnection) => void;
    commit: (args: {
        start: RunPoint;
        end: RunPoint;
        startConnection: RunConnection;
        endConnection: RunConnection;
        surfaceTarget: RunSurfaceTarget | null;
    }) => RunCommitResult | null;
    onShortcut?: (event: KeyboardEvent, start: RunPoint | null) => void;
};
export declare const RUN_PREVIEW_OPACITY = 0.55;
export declare const RUN_SNAP_CURSOR_COLOR = "#22c55e";
export declare function runSectionHalfSizeM(nominalInches: number): number;
export declare function snapRunValue(value: number, step: number): number;
export declare function runDistanceSquared(a: readonly number[], b: readonly number[]): number;
export declare function projectRunToAngleLock(from: RunPoint, raw: RunPoint, sourceDirection?: readonly [number, number, number] | null): RunPoint;
export declare function snapRunLength(from: RunPoint, point: RunPoint, step: number): RunPoint;
export declare function projectRunToDirection(from: RunPoint, raw: RunPoint, direction: readonly [number, number, number]): RunPoint;
export declare function projectRunToCameraDirection(from: RunPoint, ray: RunCursorRay, sourceDirection: readonly [number, number, number], minimumDistance: number, gridStep: number, candidates?: RunPoint[], surfaceFrame?: RunSurfaceFrame, screen?: {
    project: (point: RunPoint) => [number, number] | null;
    pointer: [number, number];
    previous: RunPoint | null;
}): CameraDirectionProjection | null;
export declare function stepNominalRunSize(sizes: readonly number[], current: number, direction: 1 | -1): number;
export declare function useDistributionRunTool(config: DistributionRunToolConfig): {
    refreshCursor: () => void;
    start: RunPoint | null;
    cursor: RunPoint | null;
    snapTarget: RunPoint | null;
    snapScreen: PortScreenPoint | null;
    altActive: boolean;
    directionMode: RunDirectionMode;
    lengthInput: string;
    validationMessage: string | null;
    onLengthInputChange: (value: string) => void;
    onDirectionSelect: (direction: RunPoint) => void;
    startConnection: RunConnection;
    endConnection: RunConnection;
    surfaceTarget: RunSurfaceTarget | null;
};
export declare function DistributionRunCursor({ cursor, start, snapTarget, snapScreen, altActive, unit, extraParts, cursorRef, directionMode, startDirection, lengthInput, validationMessage, onLengthInputChange, onDirectionSelect, }: {
    cursor: RunPoint | null;
    start: RunPoint | null;
    snapTarget: RunPoint | null;
    snapScreen?: PortScreenPoint | null;
    altActive: boolean;
    unit: 'metric' | 'imperial';
    extraParts?: DimensionPillPart[];
    cursorRef?: RefObject<Group | null>;
    directionMode: RunDirectionMode;
    startDirection?: readonly [number, number, number] | null;
    lengthInput?: string;
    validationMessage?: string | null;
    minimumSegmentLength?: number;
    onLengthInputChange?: (value: string) => void;
    onDirectionSelect?: (direction: RunPoint) => void;
}): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=distribution-run-tool.d.ts.map
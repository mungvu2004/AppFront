import type { SnapshotCaptureFailedEvent, SnapshotCapturePose, SnapshotSavedEvent, ThumbnailGenerateEvent } from '@pascal-app/core';
import { type PerspectiveCamera } from 'three';
export declare function isOverlaySnapshotSave(event: SnapshotSavedEvent | undefined, projectId: string): boolean;
export declare function createSnapshotQueue(): (event: Pick<ThumbnailGenerateEvent, "requestId" | "captureMode">, capture: () => Promise<void>) => Promise<void>;
export declare function enqueueSnapshotCapture(enqueue: ReturnType<typeof createSnapshotQueue>, version: {
    current: number;
}, event: ThumbnailGenerateEvent, capture: (event: ThumbnailGenerateEvent) => Promise<void>, reportFailure: (failure: SnapshotCaptureFailedEvent) => void): Promise<void>;
export declare function captureSnapshotScene<T>(capture: (restore: (callback: () => void) => void) => T | Promise<T>): Promise<T>;
export declare function applySnapshotCapturePose(camera: PerspectiveCamera, pose: SnapshotCapturePose, viewport: {
    width: number;
    height: number;
}, output: {
    w: number;
    h: number;
}): void;
export declare function runSnapshotCapture(requestId: string | undefined, busy: {
    current: boolean;
}, capture: () => Promise<void>, reportFailure: (failure: SnapshotCaptureFailedEvent) => void): Promise<void>;
//# sourceMappingURL=snapshot-capture.d.ts.map
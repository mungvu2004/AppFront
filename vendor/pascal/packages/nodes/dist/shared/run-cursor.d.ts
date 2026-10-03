import type { RunPoint, RunSurfaceFrame } from './distribution-run-contract';
export declare function intersectRunPlane(ray: {
    origin: RunPoint;
    direction: RunPoint;
}, frame: RunSurfaceFrame): RunPoint | null;
export declare function resolveRunCursorPlane({ hit, working, ray, fallback, clearance, }: {
    hit: {
        point: RunPoint;
        frame: RunSurfaceFrame;
    } | null;
    working: RunSurfaceFrame | null;
    ray?: {
        origin: RunPoint;
        direction: RunPoint;
    };
    fallback: RunPoint;
    clearance: number;
}): {
    point: RunPoint;
    frame: RunSurfaceFrame;
};
//# sourceMappingURL=run-cursor.d.ts.map
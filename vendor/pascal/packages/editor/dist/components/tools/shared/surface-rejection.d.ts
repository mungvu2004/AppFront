import type { SurfaceRejectReason } from '@pascal-app/core';
export declare function createSurfaceRejectionFeedback(onChange?: (reason: SurfaceRejectReason | null) => void): {
    readonly reason: SurfaceRejectReason | null;
    reject(next: SurfaceRejectReason, event?: object): void;
    clear(): void;
    grid(event: object): void;
};
export declare function createSurfaceEventOwnership(): {
    allows(hostId: string, event: object): boolean;
    claim(hostId: string, event: object): void;
};
//# sourceMappingURL=surface-rejection.d.ts.map
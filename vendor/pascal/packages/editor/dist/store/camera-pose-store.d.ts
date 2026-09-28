import type { CameraPose } from '@pascal-app/core';
type CameraPoseState = {
    pose: CameraPose | null;
};
export declare const cameraPoseStore: Omit<import("zustand").StoreApi<CameraPoseState>, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: CameraPoseState, previousSelectedState: CameraPoseState) => void): () => void;
        <U>(selector: (state: CameraPoseState) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
};
export declare function publishCameraPose(pose: CameraPose): void;
export declare function subscribeCameraPose(listener: (pose: CameraPose) => void): () => void;
export {};
//# sourceMappingURL=camera-pose-store.d.ts.map
import type { NavigationSyncPose } from './use-editor';
type NavigationSyncPoseState = {
    pose: NavigationSyncPose | null;
};
export declare const navigationSyncPoseStore: Omit<import("zustand").StoreApi<NavigationSyncPoseState>, "subscribe"> & {
    subscribe: {
        (listener: (selectedState: NavigationSyncPoseState, previousSelectedState: NavigationSyncPoseState) => void): () => void;
        <U>(selector: (state: NavigationSyncPoseState) => U, listener: (selectedState: U, previousSelectedState: U) => void, options?: {
            equalityFn?: ((a: U, b: U) => boolean) | undefined;
            fireImmediately?: boolean;
        } | undefined): () => void;
    };
};
export declare function publishNavigationSyncPoseToStore(pose: NavigationSyncPose): void;
export declare function subscribeNavigationSyncPose(listener: (pose: NavigationSyncPose) => void): () => void;
export {};
//# sourceMappingURL=navigation-sync-pose-store.d.ts.map
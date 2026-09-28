interface SceneLoaderProps {
    className?: string;
    fullScreen?: boolean;
}
export declare function SceneLoader({ className, fullScreen }: SceneLoaderProps): import("react").JSX.Element;
interface SceneLoadFailedProps {
    className?: string;
    onRetry: () => void;
}
/**
 * Replaces the loader when the host could not deliver the scene. Rendered
 * INSTEAD of falling back to an empty default scene: a session that shows
 * scaffold nodes after a failed load autosaves that scaffold over the real
 * project (prod scene-wipe class, 2026-09-02).
 */
export declare function SceneLoadFailed({ className, onRetry }: SceneLoadFailedProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=scene-loader.d.ts.map
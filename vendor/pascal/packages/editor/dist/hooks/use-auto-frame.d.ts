/**
 * Auto-frame the camera onto a freshly loaded scene.
 *
 * Motivation: when the MCP `setScene` tool (or any other entry point) swaps
 * the scene graph while the default camera is pointing at empty space, the
 * user sees a black viewport. This hook subscribes to the core scene store
 * and, whenever `nodes` transitions from empty → non-empty, computes the
 * XZ bounds of the new scene and emits `camera-controls:fit-scene`. The
 * `<CustomCameraControls />` component picks up that event and frames the
 * camera onto the bounds.
 *
 * Mount in exactly ONE component (the Editor). It holds no state of its own;
 * the subscription is torn down on unmount.
 */
export declare function useAutoFrame(): void;
//# sourceMappingURL=use-auto-frame.d.ts.map
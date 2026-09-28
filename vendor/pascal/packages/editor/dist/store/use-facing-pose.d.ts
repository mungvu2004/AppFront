export type FacingPose = {
    /** Ghost origin in building-local space. */
    position: [number, number, number];
    /** Ghost yaw (radians). The triangle inherits this so it points where the
     *  node faces. */
    rotationY: number;
    /** Footprint depth along the ghost's local +Z; the triangle sits just past
     *  `center[1] + depth / 2`. */
    depth: number;
    /** Footprint centre offset `[x, z]` in the ghost's local frame. Defaults to
     *  the origin. Kinds whose forward edge isn't centred on the origin (e.g. a
     *  stair, whose run starts at the entry) shift the triangle via this. */
    center?: [number, number];
    /** Point along local -Z (the front is the -Z side) instead of +Z. */
    reversed?: boolean;
};
type FacingPoseState = {
    pose: FacingPose | null;
    set(pose: FacingPose): void;
    clear(): void;
};
declare const useFacingPose: import("zustand").UseBoundStore<import("zustand").StoreApi<FacingPoseState>>;
export default useFacingPose;
//# sourceMappingURL=use-facing-pose.d.ts.map
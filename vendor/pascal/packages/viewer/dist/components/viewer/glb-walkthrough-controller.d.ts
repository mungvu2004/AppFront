export declare const WALKTHROUGH_FOV = 60;
export declare const STAND_CAPSULE: [number, number, number, number];
export declare const CROUCH_CAPSULE: [number, number, number, number];
export declare const STAND_FLOAT_HEIGHT = 0.5;
export declare const CROUCH_FLOAT_HEIGHT = 0.25;
export declare const CROUCH_EYE_OFFSET = 0.1;
export declare const CROUCH_WALK_SPEED = 1;
export declare const CROUCH_RUN_SPEED = 1.4;
export declare const STAND_CLEARANCE = 1.25;
export declare const EYE_LERP_SPEED = 12;
/**
 * First-person walkthrough controller for the baked GLB. Reuses the editor's
 * `BVHEcctrl` capsule character controller (gravity, jump, sprint, ground-float,
 * mesh collision) fed a collider built from the artifact's own geometry — so the
 * baked viewer walks the building with the same physics as the editor, without
 * the parametric scene. Pointer-lock drives look; WASD moves; Space jumps; Shift
 * sprints. Interaction stays in `GlbScene` (its centre-ray HUD).
 */
export declare function GlbWalkthroughController({ url }: {
    url: string;
}): import("react").JSX.Element | null;
//# sourceMappingURL=glb-walkthrough-controller.d.ts.map
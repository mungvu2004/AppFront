import { Box3 } from 'three';
export declare const DEFAULT_FRAMING_EXCLUDED_TYPES: readonly ["site", "scan", "guide", "spawn"];
export declare function heroCameraPose({ boxes, aspect, aim, fovDeg, azimuthRad, elevationRad, padding, minDistance, frameShift, }: {
    boxes: Box3 | readonly Box3[];
    aspect: number;
    /** Where the camera looks (frame center). Defaults to the union-box center;
     *  pass the building's center to keep it dead-center while outlying boxes
     *  (lot plate, far palms) simply take asymmetric margin — the corner fit
     *  still guarantees every box stays in frame. */
    aim?: [number, number, number];
    fovDeg?: number;
    azimuthRad?: number;
    elevationRad?: number;
    padding?: number;
    minDistance?: number;
    /** Fraction of the frustum half-height to drop the aim by. 0 keeps the aim
     *  (the building center) exactly at frame center. */
    frameShift?: number;
}): {
    position: [number, number, number];
    target: [number, number, number];
};
export declare function unionRegisteredNodeBounds({ excludeTypes, }: {
    excludeTypes: readonly string[];
}): Box3 | null;
export type HeroFraming = {
    /** Fit constraints — everything that must stay in frame. */
    boxes: Box3[];
    /** Frame center: plate/structure center on XZ, building center on Y. */
    aim: [number, number, number];
    /** 45° to the dominant facade (falls back to world 45°). */
    azimuthRad: number;
};
/**
 * Framing for a scene hero shot. The base set is the built structure (walls,
 * roofs, slabs, …) plus any intentionally-shaped site plate; an item joins
 * only when it sits near that base — one palm at the far lot corner must not
 * shrink the building. `building`/`level` container groups are skipped (their
 * Object3D holds the whole subtree). The aim keeps the building dead-center:
 * XZ from the plate+structure union, Y from the structure alone so the
 * building — not the ground — is vertically centered. Scenes with no
 * structure (pure furniture arrangements) fall back to framing every
 * non-helper node.
 */
export declare function computeHeroFraming(): HeroFraming | null;
export declare function temporarilyHideNodeTypes(types: readonly string[]): () => void;
//# sourceMappingURL=hero-pose.d.ts.map
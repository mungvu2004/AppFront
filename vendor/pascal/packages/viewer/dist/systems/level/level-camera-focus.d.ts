import { Box3 } from 'three';
/**
 * Bounds of everything that renders on one level, in world space.
 *
 * Read from the level's own Object3D — it holds the whole subtree, so one
 * `setFromObject` covers every wall, slab and item on the floor without
 * walking the scene graph. The Y comes from `getLevelPresentationY` instead
 * of the mesh, because `LevelSystem` lerps a level into place over several
 * frames: framing the mesh mid-lerp aims at where the floor WAS.
 */
export declare function levelBounds(levelId: string): Box3 | null;
export type LevelFraming = {
    position: [number, number, number];
    target: [number, number, number];
};
/**
 * Camera pose that frames one level, or null when the level has nothing in it.
 *
 * Same fit as the hero shot (`heroCameraPose`) so a level frame and a whole-
 * building frame read as the same camera, only closer.
 */
export declare function fitToBounds(levelId: string, { aspect, fovDeg }: {
    aspect: number;
    fovDeg: number;
}): LevelFraming | null;
/**
 * Frames the camera on the level the user just switched to.
 *
 * Only on a CHANGE, never on mount: on mount the host has usually just posed
 * the camera for the whole model, and stealing that pose one frame later is
 * the kind of jump that reads as a bug. The first selection a session sees is
 * therefore recorded, not acted on.
 */
export declare function LevelCameraFocus(): null;
//# sourceMappingURL=level-camera-focus.d.ts.map
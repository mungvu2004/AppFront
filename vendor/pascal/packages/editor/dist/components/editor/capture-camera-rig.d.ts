/**
 * Owns the main camera's field of view while the snapshot capture overlay is
 * open, and is mounted only for that window. `ThumbnailGenerator` copies the
 * main camera's fov on every shot, so the value written here is what lands in
 * the saved image.
 *
 * The overlay's slider cannot reach the camera itself (it renders outside the
 * canvas), so the store carries the value and this rig applies it.
 */
export declare const CaptureCameraRig: () => null;
//# sourceMappingURL=capture-camera-rig.d.ts.map
import type { Object3D } from 'three';
export declare const INVALID_GHOST_COLOR = 15680580;
export declare const VALID_GHOST_COLOR = 2278750;
/**
 * Apply ghost material treatment to a preview mesh tree.
 *
 * Traverses the object tree, disables raycasting on all descendants (prevents
 * cursor-ray starvation), and clones visible mesh materials to set translucency.
 *
 * Tint by state:
 *   - `invalid` (red, opacity ~0.4): off-host or colliding — can't place here.
 *   - `valid` (green, opacity ~0.45): on a host and placeable — the "go" cue.
 *   - neither (opacity ~0.5, original color): a plain translucent preview.
 * `invalid` wins if both are passed.
 *
 * Skips: meshes whose material.visible === false (door/window root hitbox) and
 * children named 'cutout'.
 *
 * Returns cleanup that disposes only the cloned materials (never originals or geometry).
 *
 * @param root - The preview mesh tree (typically from buildDoorPreviewMesh / buildWindowPreviewMesh)
 * @param opts - { invalid?, valid? } placement-state tint
 * @returns Cleanup function that disposes the cloned materials
 */
export declare function applyGhost(root: Object3D, opts?: {
    invalid?: boolean;
    valid?: boolean;
}): () => void;
//# sourceMappingURL=ghost-materials.d.ts.map
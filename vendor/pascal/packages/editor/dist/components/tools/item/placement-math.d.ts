import { type AssetInput } from '@pascal-app/core';
import { type Matrix4 } from 'three';
/**
 * R/T rotation: round the current angle to the nearest 45° then step ONE
 * increment in `direction` (+1 / -1), so the node always lands on a clean 45°
 * multiple regardless of its starting angle (12° → 45°, 40° → 90°) rather than a
 * blind ±45° from an arbitrary angle.
 */
export declare function steppedRotation(current: number, direction: 1 | -1): number;
/**
 * Snaps a position to the active grid step, aligning item edges to grid lines.
 */
export declare function snapToGrid(position: number, dimension: number, step?: number): number;
/**
 * Snap a value to the active grid step (used for wall-local positions).
 */
export declare function snapToHalf(value: number, step?: number): number;
/**
 * Round a value up to the next multiple of `step`, with a minimum of `step`.
 */
export declare function snapUpToGridStep(value: number, step?: number): number;
/**
 * Expand an item's scaled dimensions up to the active grid step on the axes
 * the placement grid covers. Used for the placement wireframe, snap math, and
 * collision against the draft so a small item visually reserves a full grid
 * cell.
 *
 * - Floor / ceiling / item-surface: X + Z (footprint) expand; Y stays exact.
 * - Wall / wall-side: X (along wall) + Y (height) expand; Z (depth) stays exact
 *   so wall-thickness offsets aren't disturbed.
 */
export declare function getGridAlignedDimensions(scaledDims: [number, number, number], attachTo: AssetInput['attachTo'] | null | undefined, step?: number): [number, number, number];
export declare function getDetachedAttachmentPreviewLift(attachTo: AssetInput['attachTo'] | null | undefined): number;
/**
 * Calculate item rotation in WALL-LOCAL space from normal.
 * Items are children of the wall mesh, so their rotation is relative to wall's local space.
 */
export declare function calculateItemRotation(normal: [number, number, number] | undefined): number;
/**
 * Determine which side of the wall based on the normal vector.
 * In wall-local space, the wall runs along X-axis, so the normal points along Z-axis.
 * Positive Z normal = 'front', Negative Z normal = 'back'
 */
export declare function getSideFromNormal(normal: [number, number, number] | undefined): 'front' | 'back';
/**
 * Check if the normal indicates a valid wall side face (front or back).
 * Filters out top face and thickness edges.
 *
 * In wall-local geometry space (after ExtrudeGeometry + rotateX):
 * - X axis: along wall direction
 * - Y axis: up (height)
 * - Z axis: perpendicular to wall (thickness direction)
 *
 * So valid side faces have normals pointing in ±Z direction (local space).
 */
export declare function isValidWallSideFace(normal: [number, number, number] | undefined): boolean;
/** Strip placement-only metadata flags before committing a draft. */
export declare function stripTransient(meta: any): any;
/**
 * Compute euler rotation that tilts an item so its local +Y aligns with a
 * roof surface normal. The normal is in the hit mesh's local space and is
 * transformed to world space via the mesh's matrixWorld.
 */
export declare function calculateRoofRotation(normal: [number, number, number] | undefined, objectMatrixWorld: Matrix4): [number, number, number];
//# sourceMappingURL=placement-math.d.ts.map
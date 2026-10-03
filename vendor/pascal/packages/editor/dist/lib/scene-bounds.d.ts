/**
 * Scene bounds in the X/Z plane.
 *
 * Used by the auto-frame hook to fit the camera onto a freshly loaded scene
 * (see `../hooks/use-auto-frame`). The hook subscribes to the core scene
 * store and, when `nodes` transitions from empty → non-empty, fires a
 * `camera-controls:fit-scene` event on the core event bus carrying the
 * computed bounds.
 *
 * This module contains no rendering code: it only walks the flat-dict node
 * tree and derives an axis-aligned bounding box on the XZ (plan) plane.
 */
import type { AnyNode } from '@pascal-app/core/schema';
export type SceneBoundsXZ = {
    /** Min [x, z] in world units (meters). */
    min: [number, number];
    /** Max [x, z] in world units (meters). */
    max: [number, number];
    /** Center [x, z] = (min + max) / 2. */
    center: [number, number];
    /** Size [w, d] = max - min. */
    size: [number, number];
};
/**
 * Compute the axis-aligned XZ bounds of a scene.
 *
 * Walks every node and extracts 2D footprint points from the fields most
 * nodes carry:
 *   - `start`/`end`  → wall and fence endpoints in level coordinates.
 *   - `polygon`      → zone, slab, site-boundary polygons.
 *   - `position`     → building/item/door/window position; uses [x, z] only.
 *
 * Site-node polygons are intentionally excluded when they are the default
 * 30×30 bootstrap polygon — otherwise a brand-new empty scene would frame
 * an empty square around the origin. We still include site polygons that
 * look intentional (> 4 points, or any point outside the ±15 m default).
 *
 * Returns `null` if no usable geometry was found.
 */
export declare function computeSceneBoundsXZ(nodes: AnyNode[] | Record<string, AnyNode>): SceneBoundsXZ | null;
//# sourceMappingURL=scene-bounds.d.ts.map
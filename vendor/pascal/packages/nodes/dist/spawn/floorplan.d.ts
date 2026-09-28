import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { SpawnNode } from './schema';
/**
 * 2D floor-plan marker for a spawn point. Uses the same footprint icon
 * as the walkthrough-mode control and rotates it toward the spawn's
 * first-person starting view.
 *
 * Color matches the 3D renderer's indigo spawn material so the user
 * sees the same visual identity in both views.
 *
 * Coordinates are level-local meters; rotation is radians.
 */
export declare function buildSpawnFloorplan(node: SpawnNode, ctx: GeometryContext): FloorplanGeometry;
//# sourceMappingURL=floorplan.d.ts.map
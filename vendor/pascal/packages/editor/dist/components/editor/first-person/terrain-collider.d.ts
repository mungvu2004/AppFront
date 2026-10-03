/**
 * The sculpted ground as walkthrough collision geometry.
 *
 * The first-person collider world is a single merged BVH mesh, and before terrain
 * the ground contributed one flat 2 km box to it. That box is wrong in both
 * directions on a sculpted site: it holds the player up at the datum inside an
 * excavation, and buries them inside a hill. This module replaces it.
 *
 * Two properties it has to hold, because the whole point is that walking agrees
 * with every other consumer of the field:
 *
 * - **The surface is the field**, sampled at every vertex — the same
 *   `heightAtSample`/`normalAt` the rendered mesh uses (`terrain-geometry.ts`),
 *   so what you see is what you stand on. It is deliberately not a decimated
 *   proxy at realistic field sizes.
 * - **It extends past the field**, because `heightAt` clamps to the border
 *   outside it. A collider that stopped at the field edge would drop the player
 *   into the void one step past the site, which is exactly the bug the flat box
 *   existed to prevent. The skirt extrudes each border sample outward at its own
 *   height, so the collider and `heightAt` agree everywhere, not just inside.
 *
 * Non-indexed triangles with position + normal, matching what the other collider
 * contributors emit — `mergeGeometries` requires every input to agree on both.
 */
import { type TerrainField } from '@pascal-app/core';
import * as THREE from 'three';
/**
 * Terrain collision geometry in the site's own frame — the caller applies the
 * site's world matrix, exactly as it did for the flat box it replaces.
 */
export declare function createTerrainColliderGeometry(field: TerrainField): THREE.BufferGeometry | null;
//# sourceMappingURL=terrain-collider.d.ts.map
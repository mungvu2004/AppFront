import { type SiteNode } from '@pascal-app/core';
import type { Material } from 'three';
/**
 * Renders the site's sculpted ground.
 *
 * Mounted by `SiteRenderer` only when the site has terrain (or a stroke is in
 * flight), so a scene that never touched terrain mounts nothing at all and pays
 * nothing.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * - **The geometry is a ref, not React state.** A sculpt stroke pushes dozens of
 *   patches a second; routing each through a re-render would rebuild the
 *   `BufferGeometry` object identity every dab and throw away the partial-upload
 *   win entirely. The component subscribes to the *patch*, mutates the buffers in
 *   place, and never re-renders during a stroke.
 * - **It stays on the default `SCENE_LAYER`.** This is real, visible,
 *   shadow-receiving geometry — not an overlay. Overlay/hit-area meshes must use
 *   the editor layer, but moving actual scene geometry there would exclude it from
 *   the MRT depth/normal pass and break the screen-space ink against it.
 */
export declare const TerrainRenderer: ({ material, site, }: {
    /** Owned by `SiteRenderer` so the ground material stays defined in one place. */
    material: Material;
    site: SiteNode;
}) => import("react").JSX.Element | null;
export default TerrainRenderer;
//# sourceMappingURL=terrain-renderer.d.ts.map
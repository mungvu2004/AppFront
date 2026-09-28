import { type SiteNode } from '@pascal-app/core';
import { type MutableRefObject } from 'react';
import type { TerrainBrushFocus } from './terrain-brush-cursor';
/**
 * A terrain-following lattice shown for the entire lifetime of sculpt mode.
 *
 * The ordinary editor grid is a planar snapping aid, so making it visible here
 * would leave it cutting through hills and hiding below excavations. This grid
 * shares the terrain samples instead: every row and column visibly bends with
 * the surface, and live dabs rewrite only the affected height span. It stays on
 * `GRID_LAYER` so scene geometry depth-occludes it instead of the overlay pass
 * compositing it through walls and objects.
 */
export declare function TerrainSculptGrid({ focusRef, site, }: {
    focusRef: MutableRefObject<TerrainBrushFocus | null>;
    site: SiteNode;
}): import("react").JSX.Element;
//# sourceMappingURL=terrain-sculpt-grid.d.ts.map
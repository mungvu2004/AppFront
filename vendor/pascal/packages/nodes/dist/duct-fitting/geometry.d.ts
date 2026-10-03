import type { GeometryContext } from '@pascal-app/core';
import type { ColorPreset, RenderShading } from '@pascal-app/viewer';
import { Group } from 'three';
import type { DuctFittingNode } from './schema';
/**
 * Pure geometry builder for a duct fitting, in the fitting's LOCAL frame —
 * `<ParametricNodeRenderer>` applies `node.position` / `node.rotation`.
 *
 * Strategy: one cylinder stub per port from the junction center outward
 * (reusing the segment builder's `buildSection`), a sphere at the
 * junction, and a slightly-oversized crimp collar ring at each port
 * opening so fittings read as sheet-metal junctions rather than bare
 * tube ends.
 *
 * The reducer is special-cased: instead of equal stubs + sphere it draws
 * a short inlet stub, a tapered cone, and a short outlet stub inline.
 *
 * Non-round shapes (elbow / tee): run legs carry the fitting's
 * width × height profile — rect prisms or flat-oval stadiums — matching
 * the trunk they join; a tee's branch leg carries its own `shape2`
 * profile (width2 × height2, or round at `diameter2`). The profile's
 * height rides local +Y — for the horizontal-plane orientations trunks
 * are drawn in, that's world-vertical.
 */
export declare function buildDuctFittingGeometry(node: DuctFittingNode, ctx?: GeometryContext, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string): Group;
//# sourceMappingURL=geometry.d.ts.map
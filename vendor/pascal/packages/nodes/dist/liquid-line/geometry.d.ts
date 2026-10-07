import { Group } from 'three';
import type { LiquidLineNode } from './schema';
/**
 * Pure geometry builder for a standalone liquid line: a single thin bare-copper
 * cylinder following the node path centerline.
 *
 * Each line is a standalone two-point node (no fitting system), so a sphere caps
 * BOTH endpoints. On a free end it rounds the cap; where two segments share a
 * coordinate the coincident spheres fill the miter gap, so the turn reads as
 * continuous pipe.
 *
 * Children are level-local meters; `<ParametricNodeRenderer>` owns the node
 * transform (identity today — the path is absolute within the level).
 */
export declare function buildLiquidLineGeometry(node: LiquidLineNode): Group;
//# sourceMappingURL=geometry.d.ts.map
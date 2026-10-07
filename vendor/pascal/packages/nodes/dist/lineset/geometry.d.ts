import { Group } from 'three';
import type { LinesetNode } from './schema';
/**
 * Pure geometry builder for a refrigerant lineset: a single copper line that
 * follows the node path centerline, optionally wrapped in a foam jacket.
 *
 * One line per node — what the ghost previews is exactly what commits. To run
 * the suction line beside the liquid line, draw them as two separate linesets
 * rather than rendering both together off one path.
 *
 * Each line is a standalone two-point node (no fitting system, unlike ducts),
 * so a sphere caps BOTH endpoints. On a free end it just rounds the cap; where
 * two segments share a coordinate the coincident spheres fill the miter gap, so
 * the turn reads as continuous pipe.
 *
 * Children are level-local meters; `<ParametricNodeRenderer>` owns the
 * node transform (identity today — the path is absolute within the level).
 */
export declare function buildLinesetGeometry(node: LinesetNode): Group;
//# sourceMappingURL=geometry.d.ts.map
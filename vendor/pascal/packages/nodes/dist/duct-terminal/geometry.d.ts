import { Group } from 'three';
import type { DuctTerminalNode } from './schema';
/**
 * Pure geometry builder for a duct terminal, in the node's LOCAL frame —
 * `<ParametricNodeRenderer>` applies `position` + yaw, and the builder
 * applies the mount orientation itself.
 *
 * Canonical (floor) frame before the mount rotation: face plate lying
 * in XZ at y=0 with its normal +Y, louver slats just above it, collar
 * cylinder going -Y toward the duct side. Ceiling mounts flip it; wall
 * mounts stand it up facing +Z.
 */
export declare function buildDuctTerminalGeometry(node: DuctTerminalNode): Group;
//# sourceMappingURL=geometry.d.ts.map
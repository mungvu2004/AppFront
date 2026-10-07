import { Group, Vector3 } from 'three';
import type { PipeTrapNode } from './schema';
/**
 * P-trap geometry in the LOCAL frame (origin at the trap weir, the low
 * point of the U). Inlet stub rises +Y to the fixture tailpiece; a
 * half-torus U-bend turns the flow; the trap arm runs +X toward the
 * vented waste line. `<ParametricNodeRenderer>` applies position + yaw.
 */
export declare function buildPipeTrapGeometry(node: PipeTrapNode): Group;
/** Local-frame port positions (before position/yaw): inlet at the top
 *  of the riser facing +Y, outlet at the end of the arm facing +X. */
export declare function localTrapPorts(node: PipeTrapNode): {
    inlet: Vector3;
    outlet: Vector3;
};
//# sourceMappingURL=geometry.d.ts.map
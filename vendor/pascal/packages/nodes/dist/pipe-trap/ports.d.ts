import type { NodePort } from '@pascal-app/core';
import type { PipeTrapNode } from './schema';
/**
 * `def.ports` — the trap's inlet (up, to the fixture) and outlet (the
 * trap arm, toward the vented waste line), transformed by position +
 * yaw into level-local space. Both carry the trap diameter and the
 * 'waste' system tag so the pipe tool and system graph treat them like
 * any other DWV joint.
 */
export declare function getPipeTrapPorts(node: PipeTrapNode): NodePort[];
//# sourceMappingURL=ports.d.ts.map
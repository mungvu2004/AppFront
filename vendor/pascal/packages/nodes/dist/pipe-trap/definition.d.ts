import type { NodeDefinition } from '@pascal-app/core';
import { PipeTrapNode } from './schema';
/**
 * DWV P-trap — the water-seal fitting on the waste line. Placed by its
 * own click tool; the pipe tool then draws the trap arm off the outlet.
 * Modeled explicitly so the IPC 909.1 trap-arm rule has a node to
 * validate.
 */
export declare const pipeTrapDefinition: NodeDefinition<typeof PipeTrapNode>;
//# sourceMappingURL=definition.d.ts.map
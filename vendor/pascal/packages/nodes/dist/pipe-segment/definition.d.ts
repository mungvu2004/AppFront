import type { NodeDefinition } from '@pascal-app/core';
import { PipeSegmentNode } from './schema';
/**
 * Phase 4 of the distribution-system effort (the research doc's Phase 2)
 * — DWV plumbing's first kind: the pipe run. The plumbing sibling of
 * `duct-segment`: same polyline + typed-ports model, with SLOPE as the
 * new ingredient (the draw tool drops waste runs ¼"/ft; vents run level
 * or vertical).
 *
 * Deferred to later slices: DWV fittings (wye / sanitary tee / closet
 * bend), fixtures, traps, cleanouts, IPC validators, riser view.
 */
export declare const pipeSegmentDefinition: NodeDefinition<typeof PipeSegmentNode>;
//# sourceMappingURL=definition.d.ts.map
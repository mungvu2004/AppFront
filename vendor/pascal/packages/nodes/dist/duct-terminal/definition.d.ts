import type { NodeDefinition } from '@pascal-app/core';
import { DuctTerminalNode } from './schema';
/**
 * Phase 3 of the HVAC node system — duct terminals: supply registers,
 * ceiling diffusers, return grilles. The end of the air loop. One typed
 * port at the collar (mount-aware direction) so duct runs end onto a
 * terminal like any other port.
 *
 * Composition: `def.geometry` only. Yaw-only rotation — the editor's
 * default R-rotate works on a selected terminal.
 */
export declare const ductTerminalDefinition: NodeDefinition<typeof DuctTerminalNode>;
//# sourceMappingURL=definition.d.ts.map
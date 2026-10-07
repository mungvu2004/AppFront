import { type NodeDefinition } from '@pascal-app/core';
import { ZoneNode } from './schema';
/**
 * Zone — Stage A. Custom-behavior escape hatch: zone uses TSL shader
 * materials + `<Html>` portals + per-frame uniform poking, so it
 * lives via `def.renderer` + `def.system` (no `def.geometry` possible
 * because zone isn't really a mesh).
 */
export declare const zoneDefinition: NodeDefinition<typeof ZoneNode>;
//# sourceMappingURL=definition.d.ts.map
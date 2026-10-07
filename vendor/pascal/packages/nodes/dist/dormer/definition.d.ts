import { type NodeDefinition } from '@pascal-app/core';
import { DormerNode } from './schema';
/**
 * Dormer — a small house-shaped protrusion sitting on top of a roof
 * segment. Windows are hosted child nodes; the legacy window* fields remain
 * in the schema only so scene migration can preserve older dormers.
 *
 * The renderer cuts each hosted window from the dormer shell and mounts
 * the regular WindowNode renderer in the selected wall-face frame.
 */
export declare const dormerDefinition: NodeDefinition<typeof DormerNode>;
//# sourceMappingURL=definition.d.ts.map
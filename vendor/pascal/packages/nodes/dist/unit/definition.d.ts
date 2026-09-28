import { type NodeDefinition } from '@pascal-app/core';
import { UnitNode } from './schema';
/**
 * Unit — a referencing overlay, not a container. It lists member zone ids
 * and owns no geometry: member zones carry its tint, and the site panel
 * drives selection (declaring `selectable` would subscribe the kind to 3D
 * clicks that have nothing to hit). Not placeable: no tool, no palette tile.
 */
export declare const unitDefinition: NodeDefinition<typeof UnitNode>;
//# sourceMappingURL=definition.d.ts.map
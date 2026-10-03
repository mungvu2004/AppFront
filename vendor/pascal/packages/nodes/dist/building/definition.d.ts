import { type NodeDefinition } from '@pascal-app/core';
import { BuildingNode } from './schema';
/**
 * Building — Stage A. Container for levels; can be translated /
 * rotated as a whole (movable + rotatable on Y). The legacy
 * `MoveBuildingContent` handles building-wide drag; the registry
 * fallback would translate position, which is close to right —
 * but kept legacy at Stage A to avoid disturbing the building's
 * world-space group transform handling.
 */
export declare const buildingDefinition: NodeDefinition<typeof BuildingNode>;
//# sourceMappingURL=definition.d.ts.map
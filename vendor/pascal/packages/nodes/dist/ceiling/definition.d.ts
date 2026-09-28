import { type NodeDefinition } from '@pascal-app/core';
import { CeilingNode } from './schema';
/**
 * Ceiling — Phase 5 batch kind, polygon-based. Structurally similar to
 * slab but with React-rendered hosted children + TSL shader materials +
 * named meshes that other systems poke (`getObjectByName('ceiling-grid')`).
 *
 * **Stage B intentionally skipped**: pure `def.geometry` extraction
 * would lose the React children rendering (hosted items) and the
 * named-mesh structure. Ceiling keeps `def.renderer` as the custom
 * escape hatch (per plans/editor-node-registry.md "custom-behavior
 * escape hatch"). Renderer wraps the legacy CeilingRenderer; system
 * wraps the legacy CeilingSystem.
 *
 * **Stage C completed**: `def.floorplan` builder draws the ceiling
 * polygon as a dashed outline in floor plan; legacy `ceilingPolygons`
 * short-circuits to [] when ceiling is registered.
 */
export declare const ceilingDefinition: NodeDefinition<typeof CeilingNode>;
//# sourceMappingURL=definition.d.ts.map
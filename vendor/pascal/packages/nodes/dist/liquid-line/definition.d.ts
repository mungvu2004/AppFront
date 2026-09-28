import type { NodeDefinition } from '@pascal-app/core';
import { LiquidLineNode } from './schema';
/**
 * Standalone refrigerant liquid line — the thin bare-copper line broken out of
 * the lineset so it can be drawn on its own. The refrigerant-side sibling of
 * `lineset`: same polyline model and draw tool, snapping onto refrigerant
 * service ports, but a single thin line. Its tool adds a Follow mode that
 * traces an existing lineset's path at an offset.
 *
 * Composition: `def.geometry` only, plus a selection-time path-handle system
 * shared in spirit with the lineset. The framework's `<ParametricNodeRenderer>`
 * mounts an empty group; `<GeometrySystem>` fills it via
 * `buildLiquidLineGeometry` on dirty.
 */
export declare const liquidLineDefinition: NodeDefinition<typeof LiquidLineNode>;
//# sourceMappingURL=definition.d.ts.map
import type { ParametricDescriptor } from '@pascal-app/core';
import type { ShelfNode } from './schema';
/**
 * Inspector descriptor for the parametric shelf. Drives both the
 * auto-derived inspector UI and the AI/MCP `create_shelf` /
 * `update_shelf` tools with bounded JSON-schema parameters.
 *
 * Fields are grouped by intent: Style first (what kind of shelf), then
 * Topology (rows / columns / back / sides / bottom + wall-shelf bracket
 * style), then Dimensions. Surface material is paint-tray driven (same
 * flow as walls / slabs / stairs) and intentionally not surfaced here.
 */
export declare const shelfParametrics: ParametricDescriptor<ShelfNode>;
//# sourceMappingURL=parametrics.d.ts.map
import type { FloorplanGeometry, GeometryContext, WindowNode } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for window. Mirrors the legacy
 * floorplan-panel window rendering:
 *
 *   1. Window footprint rectangle in the wall cutout (themed accent
 *      stroke when selected).
 *   2. Inset inner outline — the "glass pane" frame inside the cutout.
 *   3. Center mullion line down the middle of the opening, along the
 *      wall direction — the legacy's standard glass divider.
 *
 * Skipped vs the full legacy for now: arched / rounded opening shape
 * variants, multi-pane mullion grids.
 */
export declare function buildWindowFloorplan(node: WindowNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map
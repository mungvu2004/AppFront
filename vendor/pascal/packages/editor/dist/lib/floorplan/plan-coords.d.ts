import type { FloorplanAffordancePoint } from '@pascal-app/core';
/**
 * Convert client (screen) coordinates into floor-plan plan coordinates via
 * the mounted floor-plan scene `<g>`'s screen CTM. The scene `<g>` maps plan
 * X/Z directly to SVG x/y (Z stored as the Y axis on screen — same convention
 * as `toSvgPlanPoint`), so the returned point is in the same level-frame
 * meters node placements use. Null when no floor plan is mounted.
 */
export declare function clientToPlan(clientX: number, clientY: number): FloorplanAffordancePoint | null;
//# sourceMappingURL=plan-coords.d.ts.map
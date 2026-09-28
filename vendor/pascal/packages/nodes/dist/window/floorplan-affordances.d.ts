import { type FloorplanAffordance, type WindowNode } from '@pascal-app/core';
/**
 * 2D drag affordance for the window's width side-arrows. Sister to the 3D
 * `WindowSideArrow` width drag in `packages/editor/src/components/editor/
 * window-side-handles.tsx` — both anchor at the opposite window edge and
 * clamp to wall bounds. Mirrors `doorWidthAffordance` 1:1 with the door
 * type swapped for the window type.
 *
 * Payload encodes which edge the user grabbed:
 *   - `'start'`: arrow at the window edge closer to `wall.start`. The
 *     opposite edge (toward `wall.end`) stays fixed.
 *   - `'end'`: arrow at the edge closer to `wall.end`. The wall-start
 *     edge stays fixed.
 *
 * Preview state stays in the live override store so the scene graph is
 * written only once, when the drag commits.
 */
export declare const windowWidthAffordance: FloorplanAffordance<WindowNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
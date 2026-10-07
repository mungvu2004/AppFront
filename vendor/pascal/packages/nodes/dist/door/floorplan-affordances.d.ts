import { type DoorNode, type FloorplanAffordance } from '@pascal-app/core';
/**
 * 2D drag affordance for the door's width side-arrows. Sister to the 3D
 * `DoorSideArrow` width drag in `packages/editor/src/components/editor/
 * door-side-handles.tsx` — both anchor at the opposite door edge and clamp
 * to wall bounds.
 *
 * Payload encodes which edge the user grabbed:
 *   - `'start'`: arrow at the door edge closer to `wall.start`. The
 *     opposite edge (toward `wall.end`) stays fixed.
 *   - `'end'`: arrow at the edge closer to `wall.end`. The wall-start
 *     edge stays fixed.
 *
 * Preview state stays in the live override store so the scene graph is
 * written only once, when the drag commits.
 */
export declare const doorWidthAffordance: FloorplanAffordance<DoorNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
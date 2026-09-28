import { type ElevatorNode, type FloorplanAffordance } from '@pascal-app/core';
/**
 * Elevator width / depth drag (floor-plan). Mirrors the 3D
 * `linear-resize` handles declared in `definition.ts` — `anchor: 'center'`
 * means dragging outward on either +X or -X edge grows `width` by 2×
 * the elevator-local cursor offset while `position` stays put. Same for
 * +Z / -Z and `depth`.
 */
export declare const elevatorResizeAffordance: FloorplanAffordance<ElevatorNode>;
/**
 * Elevator rotation drag (floor-plan). Sister to the 3D `arc-resize`
 * handle declared in `definition.ts`. Same `- delta` sign convention as
 * the 3D path so dragging the cursor in the same direction in both views
 * produces the same rotation.
 */
export declare const elevatorRotateAffordance: FloorplanAffordance<ElevatorNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map
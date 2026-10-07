import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core';
import type { ShelfNode } from './schema';
/**
 * 2D floor-plan representation of a shelf. The unit's outer footprint
 * projects to a rectangle of `width × depth` centered on the shelf's
 * position, rotated by its Y angle. For `bookshelf` / `cubby` with
 * columns > 1, vertical column dividers project as thin lines so the
 * grid is legible from above.
 *
 * Brackets / posts / individual boards are intentionally omitted — they
 * stack vertically under the topmost board from a top-down view and
 * adding them clutters the plan without conveying useful information.
 *
 * When selected, emits resize chevrons matching the 3D handle set
 * (width on +X, depth on +Z) plus a rotate-arrow at the front-right
 * corner. Body move continues to flow through `shelfFloorplanMoveTarget`
 * (engaged from the action-menu Move button, not from these arrows).
 */
export declare function buildShelfFloorplan(node: ShelfNode, ctx?: GeometryContext): FloorplanGeometry;
//# sourceMappingURL=floorplan.d.ts.map
import { type GeometryContext } from '@pascal-app/core';
import { type RenderShading } from '@pascal-app/viewer';
import { Group } from 'three';
import type { ShelfNode } from './schema';
export declare function buildShelfGeometry(rawNode: ShelfNode, ctx?: GeometryContext, shading?: RenderShading): Group;
/**
 * Y of the top surface of each shelf row (top of the board). Used by
 * `capabilities.surfaces.custom` so items host at the right Y on
 * whichever row the cursor targets. When `withBottom` is on (cubby /
 * bookshelf only — wall-shelf and open-rack ignore the toggle), the
 * top of the bottom board is exposed as an additional surface so items
 * can host in the lowest cell.
 */
export declare function shelfRowSurfaceYs(node: ShelfNode): number[];
//# sourceMappingURL=geometry.d.ts.map
import { type AnyNodeId, type GridEvent } from '@pascal-app/core';
import type { PointerSupportSurface } from './pointer-support-cap';
export type HorizontalConstructionPlane = {
    /** Building-local Y used by the cursor and draft preview. */
    localY: number;
    /** World Y used by the shared placement grid. */
    worldY: number;
    /** Level-local base elevation used when the node is committed. */
    elevation: number | null;
    /** Support source selected at the first click. */
    supportSlabId: string | null;
    /** Optional scene node from which this frozen plane was derived. */
    sourceNodeId: AnyNodeId | null;
};
export declare function resolveEventConstructionPlane(event: GridEvent, pointed: PointerSupportSurface | null): HorizontalConstructionPlane;
export declare function resolveLevelConstructionPlane(): HorizontalConstructionPlane | null;
export declare function resampleTerrainConstructionPlane(plane: HorizontalConstructionPlane, point: readonly [number, number]): HorizontalConstructionPlane;
export declare function publishHorizontalConstructionPlane(event: GridEvent, plane: HorizontalConstructionPlane): void;
//# sourceMappingURL=horizontal-construction-plane.d.ts.map
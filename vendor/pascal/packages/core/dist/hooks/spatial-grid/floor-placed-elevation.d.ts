import type { FloorPlacedFootprint, FloorPlacedFootprintContext, FloorPlacedFootprintsResolver } from '../../registry/types.js';
import type { AnyNode } from '../../schema/index.js';
export { getFloorPlacedFootprints } from './floor-placed-footprints.js';
export { GROUND_SUPPORT_ID } from './support-host-id.js';
/**
 * Sentinel `supportSlabId` meaning "hosted by the level base (ground)".
 * Persisted when a pointer-capped commit elects the ground while one or
 * more slabs (e.g. an elevated deck) still overlap the footprint above the
 * cap — without it, the uncapped per-frame election would lift the
 * committed node back onto the deck.
 */
export type FloorPlacedElevationArgs = {
    node: AnyNode;
    nodes: Record<string, AnyNode>;
    position: [number, number, number];
    rotation?: unknown;
    levelId?: string | null;
    /**
     * Pointer-decided support cap (level-local Y): only slabs whose walking
     * surface sits at or below `maxElevation + SUPPORT_ELEVATION_EPSILON`
     * may be elected, and the persisted `supportSlabId` is bypassed — during
     * a drag the pointer, not the stored host, decides the target surface.
     * Omit (or pass null) for the uncapped committed-read behavior.
     */
    maxElevation?: number | null;
};
export declare function getFloorPlacedElevation({ node, nodes, position, rotation, levelId, maxElevation, }: FloorPlacedElevationArgs): number;
export declare function getFloorStackedPosition(args: FloorPlacedElevationArgs): [number, number, number];
export type { FloorPlacedFootprint, FloorPlacedFootprintContext, FloorPlacedFootprintsResolver };
//# sourceMappingURL=floor-placed-elevation.d.ts.map
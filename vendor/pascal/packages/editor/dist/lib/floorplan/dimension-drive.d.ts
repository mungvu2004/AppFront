import type { AnyNode, AnyNodeId } from '@pascal-app/core';
/**
 * Driving dimensions — WS3.
 *
 * A dimension label in the floor plan is editable. Committing a new value
 * does NOT re-letter the annotation: it MOVES the geometry so the dimension
 * becomes true, the way a CAD "driving dimension" works.
 *
 * Everything in this module is pure: it reads a snapshot of the scene node
 * map and returns node patches. The React layer
 * (`floorplan-dimension-renderer.tsx` + `floorplan-registry-layer.tsx`)
 * applies them through `sceneApi.update`.
 */
export type DimensionPlanPoint = [number, number];
/**
 * Parse a typed dimension value into METRES.
 *
 * Accepted (case-insensitive, whitespace tolerant):
 *   - `12'-6"`, `12' 6"`, `12'6"`, `12'`, `6"`, `12'-6 1/2"`, `6 1/2"`
 *   - `3810mm`, `381cm`, `3.81m`, `3810 mm`
 *   - bare number — `12.5` — interpreted in the caller's unit system:
 *     imperial → feet, metric → metres.
 *
 * Returns null for anything unparseable or non-positive.
 */
export declare function parseDimensionInput(raw: string, unit?: 'metric' | 'imperial'): number | null;
export type DimensionDriveTarget = {
    kind: 'wall-endpoint';
    wallId: AnyNodeId;
    endpoint: 'start' | 'end';
    /** Unit vector along which the moving endpoint travels when the value grows. */
    direction: DimensionPlanPoint;
} | {
    kind: 'opening';
    openingId: AnyNodeId;
    wallId: AnyNodeId;
    /** +1 when growing the dimension increases `position[0]`, -1 otherwise. */
    sign: 1 | -1;
} | {
    /**
     * The dimension measures the opening itself (its own width tag), so
     * the value resizes the opening rather than sliding it.
     */
    kind: 'opening-width';
    openingId: AnyNodeId;
    wallId: AnyNodeId;
};
export type DimensionDriveResolution = {
    drivable: true;
    target: DimensionDriveTarget;
} | {
    drivable: false;
    reason: string;
};
export type DimensionDriveQuery = {
    nodes: Readonly<Record<string, AnyNode>>;
    /** Node the dimension geometry was emitted by (the registry entry). */
    ownerNodeId: AnyNodeId;
    /** Witness points of the dimension segment, in level-plan metres (x, z). */
    start: DimensionPlanPoint;
    end: DimensionPlanPoint;
};
/**
 * Work out what a dimension's value drives.
 *
 * Resolution is deliberately conservative: when nothing binds we say so and
 * the caller falls back to `textOverride` (with an "override" badge) rather
 * than moving something the author did not mean.
 */
export declare function resolveDimensionDrive(query: DimensionDriveQuery): DimensionDriveResolution;
export type DimensionDriveUpdate = {
    id: AnyNodeId;
    data: Record<string, unknown>;
};
export type DimensionDrivePlan = {
    updates: DimensionDriveUpdate[];
    /** Signed change in metres that was applied. */
    delta: number;
};
/**
 * Turn a resolved target plus a length delta into node patches.
 *
 * `currentLength` is the dimension's own measured length (whatever datum it
 * uses) and `nextLength` the typed value — the drive is applied as the
 * DELTA between them, so face / centreline datum offsets cancel out and the
 * dimension reads exactly the typed value afterwards.
 */
export declare function planDimensionDrive(args: {
    nodes: Readonly<Record<string, AnyNode>>;
    target: DimensionDriveTarget;
    currentLength: number;
    nextLength: number;
}): DimensionDrivePlan | null;
//# sourceMappingURL=dimension-drive.d.ts.map
import { type AnyNode, type AnyNodeId, type NodePort } from '@pascal-app/core';
import type { RunSurfaceTarget } from './distribution-run-contract';
/** A port plus the scene node that owns it. */
export type ScenePort = NodePort & {
    nodeId: AnyNodeId;
};
/** Air-loop port systems — what duct runs and fittings snap to. */
export declare const DUCT_PORT_SYSTEMS: readonly ["supply", "return"];
/** DWV port systems — what drain / waste / vent pipe runs snap to. */
export declare const DWV_PORT_SYSTEMS: readonly ["waste", "vent"];
/** Refrigerant-loop port system — what linesets snap to. */
export declare const REFRIGERANT_PORT_SYSTEMS: readonly ["refrigerant"];
/**
 * Filter narrowing which ports a tool will snap to.
 *   - `excludeNodeId` skips the node currently being drawn/placed so a
 *     tool doesn't snap to its own preview.
 *   - `systems` keeps only ports on the listed distribution loops — duct
 *     tools pass the air loops so they ignore refrigerant service ports;
 *     the lineset tool passes `'refrigerant'` so it ignores duct collars.
 *     A port with no `system` matches any filter.
 */
export type PortFilter = {
    levelId?: AnyNodeId;
    excludeNodeId?: AnyNodeId;
    systems?: readonly string[];
};
/**
 * Gather every typed port in the scene by asking each node's registered
 * `def.ports`. Positions are level-local meters (the kind applies its own
 * transform inside `def.ports`).
 */
export declare function collectScenePorts(filter?: PortFilter, sceneNodes?: Readonly<Record<AnyNodeId, AnyNode>>): ScenePort[];
/**
 * Nearest port within `radius` of `point` on the XZ plane. Y is ignored —
 * grid events ride the floor plane while ports usually hang at duct
 * height, so a vertical-distance check would make elevated ports
 * unreachable. The snap adopts the port's full 3D position.
 */
export declare function findNearestPortXZ(point: readonly [number, number, number], ports: ScenePort[], radius: number): ScenePort | null;
/** Nearest port using true 3D distance. Use this while drafting on a wall. */
export declare function findNearestPort3D(point: readonly [number, number, number], ports: ScenePort[], radius: number, surface?: RunSurfaceTarget | null): ScenePort | null;
/** Closest-point hit on a duct run's centerline (not its end ports). */
export type RunBodyHit = {
    nodeId: AnyNodeId;
    /** Polyline segment hit — between `path[segmentIndex]` and `path[segmentIndex + 1]`. */
    segmentIndex: number;
    /** Closest point on the centerline, level-local meters (Y interpolated). */
    point: [number, number, number];
};
/**
 * Nearest point on any duct-segment CENTERLINE within `radius` of `point`
 * on the XZ plane — how a branch taps the side of a trunk. Same XZ-only
 * distance convention as `findNearestPortXZ` (grid events ride the floor,
 * runs hang at duct height); the hit adopts the centerline's full 3D
 * position. Vertical risers project to a point in XZ and are skipped —
 * tapping those isn't meaningful.
 */
export declare function findNearestRunBodyXZ(point: readonly [number, number, number], radius: number, filter?: {
    excludeNodeId?: AnyNodeId;
    kinds?: readonly string[];
    levelId?: AnyNodeId;
}, sceneNodes?: Readonly<Record<AnyNodeId, AnyNode>>): RunBodyHit | null;
/** Nearest run centerline point using true 3D distance, including risers. */
export declare function findNearestRunBody3D(point: readonly [number, number, number], radius: number, filter?: {
    excludeNodeId?: AnyNodeId;
    kinds?: readonly string[];
    levelId?: AnyNodeId;
}, surface?: RunSurfaceTarget | null, sceneNodes?: Readonly<Record<AnyNodeId, AnyNode>>): RunBodyHit | null;
/**
 * Where a drawn segment `start`→`end` crosses straight THROUGH an
 * existing run's centerline in XZ — the four-way (cross) case, as
 * opposed to ending ON a run (the tee case). The crossing must be
 * INTERIOR to both: strictly between the drawn segment's ends (so the
 * run truly passes through, not just touches at a tip — those are tee
 * taps) and strictly inside the hit trunk segment, clear of its joints
 * by `endMargin` meters so the run legs have room. The hit's `point`
 * adopts the trunk centerline's interpolated 3D position (the drawn run
 * snaps onto the trunk's height). Returns the nearest such crossing, or
 * null. Vertical risers (no XZ extent) are skipped, same as the body
 * query.
 */
export declare function findRunBodyCrossingXZ(start: readonly [number, number, number], end: readonly [number, number, number], endMargin: number, filter?: {
    excludeNodeId?: AnyNodeId;
    kinds?: readonly string[];
}): RunBodyHit | null;
/** Surface-local crossing for wall drafting. Intersects projected U/V lines
 * and ignores runs that are not coplanar with the selected wall. */
export declare function findRunBodyCrossingSurface(start: readonly [number, number, number], end: readonly [number, number, number], endMargin: number, surface: RunSurfaceTarget, filter?: {
    excludeNodeId?: AnyNodeId;
    kinds?: readonly string[];
}): RunBodyHit | null;
//# sourceMappingURL=ports.d.ts.map
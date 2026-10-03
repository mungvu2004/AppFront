import { type AnyNode, type AnyNodeId, PipeSegmentNode, type PortConnection } from '@pascal-app/core';
import type { PipeFittingNode } from '../pipe-fitting/schema';
import type { ScenePort } from './ports';
/**
 * Center-cube vertical-move auto-routing for pipe runs.
 *
 * When a run is lifted / lowered with the run-center cube's ±Y arrows, a
 * RUN-connected end should stay welded to its (stationary) partner by way of
 * an offset: an elbow on the lifted run, a plumb riser down to the partner's
 * height, and a second elbow that meets the partner — the classic pipe S/Z
 * offset. Without it, plain connectivity-follow would translate the collinear
 * partner run straight up too (it has no turn to absorb the lift), dragging
 * the whole network along.
 *
 * RUN-connected end (partner stays at its old height):
 *   - top elbow at the lifted endpoint, turning the run axis → vertical;
 *   - a plumb riser straight down (same X/Z) to one leg above the partner;
 *   - bottom elbow at the partner joint, turning vertical → the partner's
 *     axis; the partner run is trimmed back one leg so the elbow replaces
 *     that stretch.
 * The lifted run is trimmed back one leg at the offset end so it meets the
 * top elbow's collar instead of overlapping it.
 *
 * ELBOW-connected end (a clean L): the existing elbow STAYS PUT and re-aims so
 * its mated collar swings vertical (flattening toward a straight coupling); a
 * plumb riser rises from that collar to a single new TOP elbow that turns back
 * along the run axis onto the lifted endpoint. One new elbow + one riser — no
 * horizontal jog. Non-elbow fittings (and elbows whose re-aim is out of the
 * buildable 15–90° range) ride up via plain connectivity-follow instead. Open
 * ends likewise just ride up.
 */
type Point = [number, number, number];
type PipeProfile = {
    diameter: number;
    pipeMaterial: PipeFittingNode['pipeMaterial'];
};
/**
 * Three-state outcome of a connected vertical lift:
 *  - `null` — the run has NO connected ends, so the caller plain-translates it
 *    (nothing to keep welded; everyone is free to ride along or there's no one).
 *  - `{ status: 'invalid' }` — at least one connected end CANNOT form a clean
 *    offset at this height (no room for the elbows + riser, a non-elbow fitting,
 *    or a re-aim out of the buildable 15–90° range). The caller lifts ONLY the
 *    dragged run as a red preview, freezes every partner, and commits nothing on
 *    release. We never silently drag the network up to "absorb" the lift.
 *  - `{ status: 'valid', plan }` — every connected end welds back to its
 *    stationary partner via the planned offset; the caller lifts + trims, ghosts
 *    the new fittings green, and mints them on release.
 */
export type VerticalOffsetResult = {
    status: 'valid';
    plan: VerticalOffsetPlan;
} | {
    status: 'invalid';
} | null;
export type VerticalOffsetPlan = {
    /** Actual vertical offset used by the route. This can differ from the raw
     *  cursor delta when the route snaps through a topology transition. */
    dy: number;
    /** The lifted run's new path: every point raised by `dy`, each RUN-offset
     *  end trimmed back one elbow-leg to meet its top elbow (fitting / open ends
     *  keep their lifted endpoint). */
    pipePath: Point[];
    /** The path to seed the caller's connectivity-follow from: identical to the
     *  lifted run except each RUN-offset end is reset to its ORIGINAL height, so
     *  its trimmed partner shows zero delta (we trim it via `updates` instead)
     *  while a FITTING / open end shows `+dy` — lifting its elbow rigidly and
     *  lengthening that elbow's riser into a clean L. */
    followPath: Point[];
    /** Two elbows per RUN-offset end (top + bottom). */
    fittings: PipeFittingNode[];
    /** One plumb riser per RUN-offset end. */
    risers: PipeSegmentNode[];
    /** Partner-run trims (the run mated at each RUN-offset end pulled back one
     *  leg). Fitting partners are rigid and never updated. */
    updates: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }[];
    /** Existing generated/absorbed parts to remove when an offset collapses into a direct L. */
    delete?: AnyNodeId[];
};
export declare function planVerticalOffsets(args: {
    pipe: PipeSegmentNode;
    /** Signed vertical move (meters); +up / -down. */
    dy: number;
    profile: PipeProfile;
    /** The drag-start connectivity snapshot's connections. */
    connections: PortConnection[];
    /** Scene ports (excluding the lifted run) for partner direction lookup. */
    scenePorts: ScenePort[];
    /** Drag-start node snapshots keyed by id, so a connected elbow's ORIGINAL
     *  pose can be re-aimed each frame (the live store carries the last frame's
     *  re-aim). */
    nodesById: Record<string, AnyNode>;
}): VerticalOffsetResult;
export {};
//# sourceMappingURL=pipe-vertical-offset.d.ts.map
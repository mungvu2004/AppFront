import { DuctFittingNode, DuctSegmentNode, PipeFittingNode, PipeSegmentNode } from '@pascal-app/core';
import type { RunBodyHit, ScenePort } from './ports';
type Point = [number, number, number];
/** Cross-section a planned fitting (and the duct drawing it) carries. */
export type DuctProfile = {
    shape: 'round' | 'rect' | 'oval';
    /** Round size in inches (ignored for rect / oval — the equivalent is derived). */
    diameter: number;
    /** Rect / oval profile in inches. */
    width: number;
    height: number;
};
/** Effective round-size (inches) a profile presents at joints. */
export declare function profileDiameterIn(profile: DuctProfile): number;
export type ElbowJointPlan = {
    /** Parsed elbow node, its junction centered ON the drawn corner point,
     *  oriented so the inlet faces the existing run and the outlet faces
     *  the new one. */
    fitting: DuctFittingNode;
    /** The elbow's outlet collar — where the new duct should start (or end)
     *  instead of the corner point, so duct meets metal instead of
     *  overlapping the fitting. */
    collarPoint: Point;
    /** Where the EXISTING run's endpoint must move (pulled back one leg
     *  from the corner) so the elbow's inlet collar replaces that stretch
     *  of duct — keeping the visual corner exactly where it was drawn. */
    trimmedPortPoint: Point;
};
/**
 * Plan the elbow that joins an existing run's open port to a new run
 * leaving the joint along `awayDir`.
 *
 * Geometry: the elbow's local inlet faces -X and its outlet is turned
 * `angle`° in the local XZ plane (see the duct-fitting schema). For a
 * turn of θ between the port's outward direction and `awayDir`, an elbow
 * with `angle = θ` mates both exactly; the rotation is whatever maps the
 * local (inlet, outlet) direction pair onto the world (port, away) pair —
 * which also covers vertical turns (horizontal run → riser), since the
 * mapping is a full 3D rotation, not just yaw.
 *
 * Returns null when no fitting belongs at the joint: near-straight
 * continuation (butt-join is fine), a back-turn sharper than 90°, or a
 * degenerate direction pair.
 */
/**
 * Domain-agnostic corner-joint math: where an elbow-shaped fitting (any
 * kind whose local inlet faces -X with the outlet turned `angle`° in
 * XZ) lands when joining `port` to a run leaving along `awayDir`, with
 * legs of `legM` meters. The junction sits exactly ON the corner; the
 * caller trims the existing run to `trimmedPortPoint` and starts the
 * new one at `collarPoint`.
 */
export type CornerJointGeometry = {
    angleDeg: number;
    rotation: Point;
    junction: Point;
    collarPoint: Point;
    trimmedPortPoint: Point;
};
export declare function planCornerJoint(port: Pick<ScenePort, 'position' | 'direction'>, awayDir: Point, legM: number): CornerJointGeometry | null;
export declare function planElbowAtPort(port: ScenePort, awayDir: Point, profile: DuctProfile): ElbowJointPlan | null;
export type TeeTapPlan = {
    /** Parsed tee node, its junction centered ON the tap point, run legs
     *  along the trunk and branch collar toward the new run. */
    fitting: DuctFittingNode;
    /** The tee's branch collar — where the new duct should start. */
    branchCollar: Point;
    /** Trunk rewritten to END one run-leg before the tap point. */
    trunkUpdate: {
        id: DuctSegmentNode['id'];
        data: {
            path: Point[];
        };
    };
    /** New run carrying the rest of the trunk, starting one run-leg after
     *  the tap point. Created alongside the tee. */
    trunkTail: DuctSegmentNode;
};
/**
 * Plan the tee that taps a branch off the SIDE of an existing run.
 *
 * The trunk is split at the tap point: the original node keeps the
 * upstream half (trimmed one leg short), a new duct-segment node carries
 * the downstream half (starting one leg after), and the tee's run legs
 * bridge the gap with its junction exactly on the centerline hit. The
 * branch collar follows `awayDir`: the tee becomes a lateral whose
 * `branchAngle` (clamped to the buildable 45–135° range) matches the turn
 * the drawn run makes off the trunk, so the new duct continues straight
 * out of the collar instead of kinking square.
 *
 * Returns null when the tap can't be built: too close to the segment's
 * ends (no room for the run legs — join the end port instead), or the
 * branch direction is parallel to the trunk.
 */
export declare function planTeeAtRunBody(trunk: DuctSegmentNode, hit: RunBodyHit, awayDir: Point, branch: DuctProfile): TeeTapPlan | null;
export type CrossTapPlan = {
    /** Parsed cross node, junction ON the crossing point, run legs along
     *  the trunk and two opposed branch legs along the drawn run. */
    fitting: DuctFittingNode;
    /** Branch collar on the START side of the drawn run — the first half
     *  of the drawn duct ENDS here. */
    branchCollarNear: Point;
    /** Branch collar on the END side of the drawn run — the second half
     *  of the drawn duct STARTS here. */
    branchCollarFar: Point;
    /** Trunk rewritten to END one run-leg before the crossing. */
    trunkUpdate: {
        id: DuctSegmentNode['id'];
        data: {
            path: Point[];
        };
    };
    /** New run carrying the rest of the trunk, starting one run-leg past
     *  the crossing. Created alongside the cross. */
    trunkTail: DuctSegmentNode;
};
/**
 * Plan the four-way cross where a drawn run passes straight THROUGH the
 * SIDE of an existing run. Like a tee tap, the trunk is split at the
 * crossing (original keeps the upstream half, a new node carries the
 * downstream half, both pulled one run-leg back). The drawn run is split
 * by the CALLER into two halves that meet the cross's two opposed branch
 * collars — `branchCollarNear` toward `awayDir`'s origin (the drawn
 * start) and `branchCollarFar` along `awayDir` (the drawn end).
 *
 * `awayDir` is the drawn run's direction (start → end). Its component
 * perpendicular to the trunk axis sets the branch axis; a drawn run that
 * isn't square to the trunk still gets a square cross (the off-square
 * lead-ins are absorbed by the drawn duct halves). Returns null when the
 * crossing is too near a trunk end (no room for the run legs) or the
 * drawn run is parallel to the trunk.
 */
export declare function planCrossAtRunBody(trunk: DuctSegmentNode, hit: RunBodyHit, awayDir: Point, branch: DuctProfile): CrossTapPlan | null;
export type ElbowRealignPlan = {
    /** Patch for the existing elbow: new turn angle + orientation. */
    update: {
        id: DuctFittingNode['id'];
        data: {
            angle: number;
            rotation: Point;
        };
    };
    /** Where the free collar lands — the new duct starts (or ends) here. */
    collarPoint: Point;
};
export type PipeElbowRealignPlan = {
    update: {
        id: PipeFittingNode['id'];
        data: {
            angle: number;
            rotation: Point;
        };
    };
    collarPoint: Point;
};
/** Re-aim a DUCT elbow whose open collar a new run just snapped onto. */
export declare function planElbowRealign(elbow: DuctFittingNode, snappedPortId: string, awayDir: Point): ElbowRealignPlan | null;
/** Re-aim a DWV PIPE elbow — same geometry, pipe collar leg length. */
export declare function planPipeElbowRealign(elbow: PipeFittingNode, snappedPortId: string, awayDir: Point): PipeElbowRealignPlan | null;
export type TeeBranchRealignPlan = {
    /** Patch for the existing tee: new branch lean angle. The run axis and
     *  the tee's orientation stay fixed (inlet / outlet stay mated to the
     *  trunk) — only `branchAngle` changes. */
    update: {
        id: DuctFittingNode['id'];
        data: {
            branchAngle: number;
        };
    };
    /** Where the branch collar lands at the new angle — the dragged run's
     *  mated end rides here. */
    collarPoint: Point;
};
/**
 * Re-aim a duct TEE's branch to follow a run dragged off its branch collar.
 *
 * Unlike the elbow (which re-orients its whole body), a tee's run legs stay
 * mated to the trunk, so the body orientation is FIXED: the branch can only
 * swing within the tee's local XZ plane (local +X = run axis, +Z = the
 * square branch direction). `awayDir` (junction → dragged end) is projected
 * onto that plane and read as the lean angle off +X — 90° square, <90°
 * leaning downstream toward the outlet, >90° upstream toward the inlet —
 * clamped to the schema's buildable 45–135° lateral range.
 */
export declare function planTeeBranchRealign(tee: DuctFittingNode, awayDir: Point): TeeBranchRealignPlan | null;
export type PipeElbowPlan = {
    fitting: PipeFittingNode;
    collarPoint: Point;
    trimmedPortPoint: Point;
};
/**
 * Elbow (bend) joining an existing DWV run's open port to a new run —
 * same corner geometry as the duct elbow, minted as a pipe fitting.
 */
export declare function planPipeElbowAtPort(port: ScenePort, awayDir: Point, diameterIn: number, pipeMaterial?: PipeFittingNode['pipeMaterial']): PipeElbowPlan | null;
export type PipeBranchTapPlan = {
    /** Parsed wye / sanitary tee, junction ON the tap point. */
    fitting: PipeFittingNode;
    /** The branch collar — where the new run starts. */
    branchCollar: Point;
    /** Tapped run rewritten to END one run-leg before the tap. */
    runUpdate: {
        id: PipeSegmentNode['id'];
        data: {
            path: Point[];
        };
    };
    /** New run carrying the rest of the tapped run. */
    runTail: PipeSegmentNode;
};
/**
 * Plan the branch fitting that taps a new run into the SIDE of an
 * existing DWV run — a **sanitary tee**: the branch enters SQUARE off the
 * run (same T as the duct tee tap), facing the drawn branch's side.
 *
 * The run splits like a duct tee tap: original keeps the upstream half,
 * a new node carries the downstream half, both trimmed one run-leg from
 * the tap point.
 */
export declare function planPipeBranchTap(run: PipeSegmentNode, hit: RunBodyHit, awayDir: Point, branchDiameterIn: number): PipeBranchTapPlan | null;
export type PipeCrossTapPlan = {
    /** Parsed cross node, junction ON the crossing point, run legs along
     *  the run and two opposed branch legs along the drawn run. */
    fitting: PipeFittingNode;
    /** Branch collar on the START side of the drawn run — the first half
     *  of the drawn pipe ENDS here. */
    branchCollarNear: Point;
    /** Branch collar on the END side of the drawn run — the second half
     *  of the drawn pipe STARTS here. */
    branchCollarFar: Point;
    /** Tapped run rewritten to END one run-leg before the crossing. */
    runUpdate: {
        id: PipeSegmentNode['id'];
        data: {
            path: Point[];
        };
    };
    /** New run carrying the rest of the tapped run. */
    runTail: PipeSegmentNode;
};
/**
 * Plan the four-way DWV cross where a drawn run passes straight THROUGH
 * the SIDE of an existing run — the pipe sibling of `planCrossAtRunBody`.
 * The run splits at the crossing (original keeps the upstream half, a new
 * node carries the downstream half, both pulled one run-leg back). The
 * drawn run is split by the CALLER into two halves meeting the cross's
 * opposed branch collars — `branchCollarNear` toward the drawn start,
 * `branchCollarFar` along the drawn end. Returns null when the crossing
 * is too near a run end or the drawn run is parallel to the run.
 */
export declare function planPipeCrossAtRunBody(run: PipeSegmentNode, hit: RunBodyHit, awayDir: Point, branchDiameterIn: number): PipeCrossTapPlan | null;
export {};
//# sourceMappingURL=auto-fitting.d.ts.map
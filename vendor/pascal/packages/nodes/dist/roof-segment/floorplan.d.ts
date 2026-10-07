import { type FloorplanGeometry, type GeometryContext, type RoofSegmentNode } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for roof segment. Renders the segment as a
 * proper architectural roof plan: the footprint outline plus the
 * ridge / hip / break linework (and a downslope arrow for sheds) that
 * makes each roof shape — hip, gable, shed, gambrel, dutch, mansard,
 * flat — read distinctly, rather than as a bare rectangle.
 *
 * All linework is derived in segment-local space, mirroring the faces the
 * 3D builder (`getModuleFaces` in the roof system) generates per type, so
 * the plan and the model agree. Everything is composed into world coords
 * via the parent roof's position + rotation and the segment's own.
 */
export declare function buildRoofSegmentFloorplan(node: RoofSegmentNode, ctx: GeometryContext): FloorplanGeometry | null;
export type PlanPt = readonly [number, number];
export type PlanSeg = readonly [PlanPt, PlanPt];
export declare function getConicalRoofPlanFootprint(node: RoofSegmentNode): PlanPt[];
/**
 * Ridge / hip / break linework for a roof segment in segment-local space
 * (lx = width axis, lz = depth axis), mirroring the faces the 3D builder
 * (`getModuleFaces`) generates for each roof type. The floor-plan builder
 * maps these to world coords. `slope`, when set, is a shed roof's downhill
 * fall direction (tail = high eave, head = low eave).
 *
 * - ridge: peak line(s) where opposite slopes meet
 * - hip:   diagonal from an eave corner up to a ridge end / peak
 * - break: horizontal fold where the slope angle changes (gambrel kink,
 *          mansard/dutch waist)
 *
 * Exported so the roof-level builder can reuse the same architectural
 * linework for the complete roof plan.
 */
export declare function getRoofSegmentPlanLinework(node: RoofSegmentNode): {
    ridges: PlanSeg[];
    hips: PlanSeg[];
    breaks: PlanSeg[];
    slope: {
        tail: PlanPt;
        head: PlanPt;
    } | null;
};
//# sourceMappingURL=floorplan.d.ts.map
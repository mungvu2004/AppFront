import { type SurfacePlanSnapInput, type SurfacePlanSnapResult } from './surface-plan-snap';
export declare const CEILING_ALIGNMENT_THRESHOLD_M = 0.08;
export type CeilingPlanSnapInput = SurfacePlanSnapInput;
export type CeilingPlanSnapResult = SurfacePlanSnapResult;
export declare function clearCeilingSnapFeedback(): void;
export declare function resolveCeilingPlanPointSnap(input: CeilingPlanSnapInput): CeilingPlanSnapResult;
//# sourceMappingURL=ceiling-plan-snap.d.ts.map
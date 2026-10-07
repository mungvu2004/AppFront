import type { AnyNode, AnyNodeId, CabinetModuleNode, CabinetNode } from '@pascal-app/core';
export declare const CABINET_PLANNING_TOLERANCE = 0.0001;
export declare const MIN_PRACTICAL_TOP_CABINET_HEIGHT = 0.15;
export type CabinetPlanningIssueCode = 'module-overlap' | 'module-gap' | 'tier-mismatch' | 'stack-too-short' | 'top-cabinet-too-short' | 'ceiling-overflow';
export type CabinetPlanningIssue = {
    code: CabinetPlanningIssueCode;
    severity: 'error' | 'warning';
    message: string;
    nodeIds: string[];
};
export type CabinetPlanningReport = {
    valid: boolean;
    errors: CabinetPlanningIssue[];
    warnings: CabinetPlanningIssue[];
};
export type CabinetPlanningOptions = {
    tolerance?: number;
    minimumTopCabinetHeight?: number;
    nodes?: Readonly<Partial<Record<AnyNodeId, AnyNode>>>;
};
/**
 * Validate the structural rules shared by cabinet-run editing, previews, and
 * export. This is intentionally scene-independent: callers resolve a run's
 * module children and pass the same values used to build the run geometry.
 */
export declare function validateCabinetRun(run: CabinetNode, modules: readonly CabinetModuleNode[], options?: CabinetPlanningOptions): CabinetPlanningReport;
//# sourceMappingURL=validation.d.ts.map
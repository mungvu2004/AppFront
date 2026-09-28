import { type AnyNode, type RoofSegmentNode } from '@pascal-app/core';
import * as THREE from 'three';
export type PrintRoofSolidDiagnostic = {
    severity: 'error';
    code: 'invalid_roof_print_dimensions' | 'roof_print_topology_mismatch' | 'unsupported_roof_print_trim' | 'unsupported_roof_print_cut';
    message: string;
    nodeIds: string[];
};
export type PrintRoofSolidResult = {
    status: 'ready';
    object: THREE.Group;
    diagnostics: [];
} | {
    status: 'blocked';
    object: null;
    diagnostics: PrintRoofSolidDiagnostic[];
};
export declare function buildPrintableRoofSegmentSolids(node: RoofSegmentNode, nodes?: Record<string, AnyNode>): PrintRoofSolidResult;
//# sourceMappingURL=print-roof-solids.d.ts.map
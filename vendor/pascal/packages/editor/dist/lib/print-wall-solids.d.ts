import { type AnyNode, type WallNode } from '@pascal-app/core';
import * as THREE from 'three';
export type PrintWallSolidDiagnostic = {
    severity: 'error';
    code: 'invalid_wall_print_dimensions' | 'unsupported_wall_print_curve' | 'unsupported_wall_print_terrain' | 'unsupported_wall_print_opening_shape' | 'invalid_wall_print_opening' | 'unresolved_wall_print_child';
    message: string;
    nodeIds: string[];
};
export type PrintWallSolidOptions = {
    effectiveHeight: number;
    includedNodeIds?: ReadonlySet<string>;
};
export type PrintWallSolidResult = {
    status: 'ready';
    object: THREE.Group;
    diagnostics: [];
} | {
    status: 'blocked';
    object: null;
    diagnostics: PrintWallSolidDiagnostic[];
};
export declare function buildPrintableWallSolids(node: WallNode, options: PrintWallSolidOptions, nodes?: Record<string, AnyNode>): PrintWallSolidResult;
//# sourceMappingURL=print-wall-solids.d.ts.map
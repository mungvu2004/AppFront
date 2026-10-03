import { type AnyNode } from '@pascal-app/core';
import * as THREE from 'three';
import { type PrintShellCompileDiagnostic, type PrintShellCompileResult } from './print-shell-compiler-baseline';
export type SemanticPrintCompileOptions = {
    wallSolids?: boolean;
};
export type SemanticPrintSourceResult = {
    status: 'ready';
    scene: THREE.Object3D;
    diagnostics: [];
    dispose: () => void;
} | {
    status: 'blocked';
    scene: null;
    inputMeshCount: number;
    sourceNodeIds: string[];
    diagnostics: PrintShellCompileDiagnostic[];
    dispose: () => void;
};
export declare function prepareSemanticPrintShellSource(source: THREE.Object3D, nodes: Record<string, AnyNode>, options?: SemanticPrintCompileOptions): SemanticPrintSourceResult;
/**
 * Compiles a semantic structural source instead of trusting display aggregates.
 * Roof segments are replaced as complete identity subtrees so their hosted
 * display CSG and accessory meshes cannot leak into the manufacturing shell.
 */
export declare function compileSemanticPrintShell(source: THREE.Object3D, nodes: Record<string, AnyNode>, options?: SemanticPrintCompileOptions): PrintShellCompileResult;
//# sourceMappingURL=print-shell-compiler.d.ts.map
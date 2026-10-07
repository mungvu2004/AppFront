import * as THREE from 'three';
export type PrintShellCompileDiagnostic = {
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    nodeIds: string[];
};
export type PrintShellCompileResult = {
    backend: 'pascal-three-bvh-csg' | 'manifold-3d';
    status: 'compiled' | 'blocked';
    scene: THREE.Object3D | null;
    inputMeshCount: number;
    sourceNodeIds: string[];
    diagnostics: PrintShellCompileDiagnostic[];
};
export type PrintShellInput = {
    inputMeshCount: number;
    sourceNodeIds: Set<string>;
    geometries: THREE.BufferGeometry[];
    geometryNodeIds: string[];
    diagnostics: PrintShellCompileDiagnostic[];
};
export declare function collectPrintShellInput(source: THREE.Object3D): PrintShellInput;
/**
 * Synchronous baseline used only by print fixtures while backend correctness
 * is evaluated. It unions world-space static meshes and preserves source node
 * IDs at result level; it does not yet run in a worker or provide face-level
 * provenance.
 */
export declare function compilePrintShellBaseline(source: THREE.Object3D): PrintShellCompileResult;
//# sourceMappingURL=print-shell-compiler-baseline.d.ts.map
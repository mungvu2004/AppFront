import type { AnyNode } from '@pascal-app/core';
import * as THREE from 'three';
import { type SemanticPrintCompileOptions } from './print-shell-compiler';
import { type PrintShellCompileResult } from './print-shell-compiler-baseline';
import type { ManifoldCompileOutput, ManifoldMeshData, ManifoldRuntimeOptions } from './print-shell-compiler-protocol';
/**
 * Overrides where the print-export worker loads the manifold-3d module and
 * wasm from. See the loader in print-shell-compiler-manifold-core.ts for the
 * default resolution order; hosts with restrictive networks should call this
 * with self-hosted asset URLs before the first print export.
 */
export declare function configureManifoldRuntime(options: ManifoldRuntimeOptions | undefined): void;
export type ManifoldCompileRunner = (meshes: ManifoldMeshData[]) => Promise<ManifoldCompileOutput>;
export type SemanticManifoldCompileOptions = SemanticPrintCompileOptions & {
    runner?: ManifoldCompileRunner;
};
export declare const runManifoldWorker: ManifoldCompileRunner;
export declare function compileSemanticPrintShellWithManifold(source: THREE.Object3D, nodes: Record<string, AnyNode>, options?: SemanticManifoldCompileOptions): Promise<PrintShellCompileResult>;
//# sourceMappingURL=print-shell-compiler-manifold-worker.d.ts.map
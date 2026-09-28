import { type AnyNode } from '@pascal-app/core';
import * as THREE from 'three';
export type PrintContentScope = 'structure' | 'everything';
/**
 * Keep registered structural nodes plus the minimum semantic/Three ancestry
 * needed to preserve their world transforms. Unknown, furnishing, analysis,
 * utility, and site-owned geometry is removed unless it is only a transform
 * container leading to retained structure.
 */
export declare function filterPreparedSceneForPrintContent(source: THREE.Object3D, nodes: Record<string, AnyNode>, scope: PrintContentScope): THREE.Object3D;
//# sourceMappingURL=print-content-scope.d.ts.map
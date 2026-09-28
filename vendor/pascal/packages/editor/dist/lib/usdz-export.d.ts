import type { AnyNode } from '@pascal-app/core';
import type { Object3D } from 'three';
import { type GlbExportOptions } from './glb-export';
export type UsdzExportOptions = Pick<GlbExportOptions, 'excludedNodeTypes' | 'includedPresentationIds' | 'onlyVisible' | 'onWarning' | 'timeoutMs'>;
/** Export a native, self-contained USDZ with no glTF conversion fallback. */
export declare function exportSceneToUsdz(sceneGroup: Object3D, nodes: Record<string, AnyNode>, options?: UsdzExportOptions): Promise<Uint8Array<ArrayBuffer>>;
//# sourceMappingURL=usdz-export.d.ts.map
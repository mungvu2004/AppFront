import { DuctFittingNode } from '@pascal-app/core';
import { Vector3 } from 'three';
import { type DuctProfile } from './auto-fitting';
import type { ScenePort } from './ports';
export declare function ductProfilesMatch(a: DuctProfile, b: DuctProfile): boolean;
export declare function planDuctAdapter(port: ScenePort, source: DuctProfile, target: DuctProfile, widthAxis?: Vector3): {
    fitting: DuctFittingNode;
    collarPoint: [number, number, number];
} | null;
//# sourceMappingURL=duct-adapter.d.ts.map
import type { NodePort } from '@pascal-app/core';
import { Vector3 } from 'three';
import type { PipeFittingNode } from './schema';
/** Hub stub length in meters — pipe fittings are stubbier than duct
 *  fittings (a 2" wye hub is ~7 cm to the collar). */
export declare function pipeFittingLegLength(diameterInches: number): number;
/** Wye branch angle — DWV wyes enter at 45°. */
export declare const WYE_BRANCH_RAD: number;
type LocalPort = {
    id: string;
    position: Vector3;
    direction: Vector3;
    diameter: number;
};
/**
 * Ports in the fitting's LOCAL frame (origin at the junction, before
 * `position`/`rotation`). Conventions documented on the schema: elbow
 * inlet -X / outlet at `angle`° in XZ; wye run along X with the branch
 * at 45° between +X and +Z; sanitary tee run along X, branch +Z; cross
 * run along X, two opposed branches on ±Z.
 */
export declare function localPipeFittingPorts(node: PipeFittingNode): LocalPort[];
/** `def.ports` — local ports transformed into level-local space. */
export declare function getPipeFittingPorts(node: PipeFittingNode): NodePort[];
export {};
//# sourceMappingURL=ports.d.ts.map
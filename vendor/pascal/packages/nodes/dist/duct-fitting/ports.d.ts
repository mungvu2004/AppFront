import type { NodePort } from '@pascal-app/core';
import { Vector3 } from 'three';
import type { DuctFittingNode } from './schema';
/**
 * Collar stub length in meters — how far each port sticks out from the
 * fitting's junction center. Scales with the duct so big trunks get
 * proportionally longer collars, with a floor so 4" fittings stay
 * grabbable.
 */
export declare function fittingLegLength(diameterInches: number): number;
type LocalPort = {
    id: string;
    position: Vector3;
    direction: Vector3;
    diameter: number;
};
/**
 * Ports in the fitting's LOCAL frame (origin at the junction center,
 * before `position`/`rotation`). Shared by `def.ports` (which transforms
 * them to level-local) and the geometry builder (which draws a stub per
 * port).
 *
 * Conventions documented on the schema: elbow inlet -X / outlet turned
 * `angle`° in XZ; tee run along X with the branch at `branchAngle`° off
 * the +X outlet axis (90° → +Z square tee, 45° → downstream lateral,
 * 135° → upstream lateral); reducer -X → +X.
 */
export declare function localFittingPorts(node: DuctFittingNode): LocalPort[];
export declare function adapterShape(node: DuctFittingNode, outlet?: boolean): 'round' | 'rect' | 'oval';
/** `def.ports` — local ports transformed into level-local space. */
export declare function getDuctFittingPorts(node: DuctFittingNode): NodePort[];
export {};
//# sourceMappingURL=ports.d.ts.map
import type { NodePort } from '@pascal-app/core';
import { Quaternion } from 'three';
import type { DuctTerminalNode } from './schema';
/** Collar stub length in meters behind the face. */
export declare const COLLAR_LENGTH = 0.12;
/**
 * Mount orientation: rotation applied to the canonical floor frame
 * (face normal +Y, collar pointing -Y). Ceiling flips it; wall stands
 * it up so the face looks along +Z and the collar points -Z (into the
 * wall). Yaw is applied on top by the renderer / port transform.
 */
export declare function mountQuaternion(mount: DuctTerminalNode['mount']): Quaternion;
export declare function terminalSystem(node: DuctTerminalNode): 'supply' | 'return';
/**
 * Diameter (inches) the collar advertises at its port. Rect / oval
 * collars report the area-equivalent round diameter so round runs mate
 * at a sensible size — the same convention duct segments use.
 */
export declare function collarPortDiameterIn(node: DuctTerminalNode): number;
/**
 * `def.ports` — the single collar port in level-local space. Canonical
 * frame: collar tip at (0, -COLLAR_LENGTH, 0) pointing -Y (away from the
 * face); mount + yaw + position transform it. Direction points OUT of
 * the terminal — i.e. toward the duct that should connect.
 */
export declare function getDuctTerminalPorts(node: DuctTerminalNode): NodePort[];
//# sourceMappingURL=ports.d.ts.map
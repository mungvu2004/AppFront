import type { Vector3 } from 'three';
export declare function signedAngleAroundAxis(from: Vector3, to: Vector3, axis: Vector3): number;
export declare function lockedRotationAngleFromHits(origin: Vector3, initialHit: Vector3, currentHit: Vector3, axis: Vector3): number | null;
export declare function unwrapRotationDelta(previous: number, current: number): number;
//# sourceMappingURL=rotation-drag.d.ts.map